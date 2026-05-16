// app/api/work/develop/route.ts
// A responsabilidade de inserir {pagebreak} pertence EXCLUSIVAMENTE ao cliente (WorkPanel.tsx).
// O servidor devolve conteúdo puro, sem marcadores estruturais.
//
// ── ARQUITECTURA ADAPTATIVA ──────────────────────────────────────────────────
//
// COM documentos RAG carregados → arquitectura de 2 passes:
//   PASS 1: rascunho rápido ~300 palavras via geminiGenerateText
//   AGENTE REVISOR: 10 perguntas → busca RAG → matriz de conhecimento
//   PASS 2 (stream): refinamento com enrichedContext como base obrigatória
//
// SEM documentos RAG → passe único directo:
//   PASS 2 (stream): geração directa com conhecimento nativo do modelo
//
// SSE custom events emitidos antes do streaming (apenas com RAG activo):
//   {"type":"phase","phase":"reviewing","questionCount":10}
//   {"type":"phase","phase":"refining","sourceCount":N,"usedWeb":bool,"ragCount":N}

import { NextResponse } from 'next/server';
import { getWorkSession, saveWorkResearchBrief, saveWorkSectionContent } from '@/lib/work/service';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';
import { geminiGenerateText, geminiGenerateTextStreamSSE } from '@/lib/gemini-resilient';
import { generateResearchBrief } from '@/lib/research/brief';
import { parseSessionPayload } from '@/lib/validation/input-guards';
import { wrapUserInput, PROMPT_INJECTION_GUARD } from '@/lib/prompt-sanitizer';
import { semanticSearch, generateRagFicha } from '@/lib/work/rag-service';
import { runSectionReviewer, type ReviewerResult } from '@/lib/work/section-reviewer';

// ── Normalização de título ─────────────────────────────────────────────────────
// Remove prefixos romanos e numéricos até 3 níveis (1.1.1.)

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^[ivxlcdm]+\.\s*/i, '')
    .replace(/^\d+\.\d+\.\d+\.?\s*/, '')
    .replace(/^\d+\.\d+\.?\s*/, '')
    .replace(/^\d+\.?\s*/, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Secções que permitem conteúdo de fecho ────────────────────────────────────

const CLOSING_SECTION_NAMES = new Set([
  'conclusao',
  'conclusion',
  'referencias',
  'referencias bibliograficas',
  'bibliography',
  'referencia bibliografica',
]);

function sectionAllowsClosing(title: string): boolean {
  return CLOSING_SECTION_NAMES.has(normalizeTitle(title));
}

// ════════════════════════════════════════════════════════════════════════════════
// SISTEMA DE CONTROLO DE CITAÇÕES — 3 CAMADAS DE DEFESA
//
// PROBLEMA:  O modelo inseria "(Gisslen, 2017)", "(ILO, 2020)" em secções
//            operacionais como FOFA, Implementação, Recursos Humanos, etc.
//
// SOLUÇÃO:   3 camadas complementares que trabalham em sequência:
//   CAMADA 1 → allowsCitations():        decisão lógica por nome de secção
//   CAMADA 2 → buildCitationGuard():     bloco injectado no prompt do modelo
//   CAMADA 3 → stripSpuriousCitations(): regex pós-processamento no output
// ════════════════════════════════════════════════════════════════════════════════

// ── CAMADA 1: Controlo por nome de secção ────────────────────────────────────
//
// Função central que decide se uma secção tem PERMISSÃO para receber citações.
//
// REGRA DO PROJECTO:
//   ✅ PERMITIDO: Enquadramento Teórico, Desenvolvimento Teórico (académico),
//                 subsecções académicas (1.1, 1.2...), Conclusão, Referências
//   ❌ PROIBIDO:  Introdução, Metodologia, Objetivos, Problematização,
//                 Justificativa, Análise FOFA, Localização, Recursos Humanos,
//                 Implementação, Análise Financeira, Lucro, Marketing

function allowsCitations(sectionTitle: string): boolean {
  const norm = sectionTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // ✅ Lista branca: secções que PERMITEM citações (correspondência exacta após normalização)
  const CITATION_ALLOWED_SECTIONS = new Set([
    'enquadramento teorico',       // 3. Enquadramento Teórico (projecto)
    'desenvolvimento teorico',     // 1. Desenvolvimento Teórico (académico)
    'referencia bibliografica',    // Referência Bibliográfica
    'referencias bibliograficas',  // Referências Bibliográficas
    'bibliography',
    'conclusao',                   // Conclusão — permitido com moderação
    'conclusion',
  ]);

  if (CITATION_ALLOWED_SECTIONS.has(norm)) return true;

  // Subsecções académicas (1.1, 1.2, 1.3...) pertencem ao Desenvolvimento Teórico
  // e portanto também permitem citações. Identificadas pelo padrão numérico duplo.
  // ATENÇÃO: subsecções de projecto (3.1 FOFA, 3.2 Localização, 3.3 RH, 4.1, 4.2)
  // são secções OPERACIONAIS e estão implicitamente excluídas (não são académicas).
  // Para distinguir, verificamos se o título contém nomes de subsecções proibidas.
  if (/^\d+\.\d+/.test(sectionTitle)) {
    const OPERATIONAL_SUBSECTIONS = new Set([
      'analise fofa',
      'localizacao do projeto',
      'localizacao do projecto',
      'recursos humanos',
      'analise financeira',
      'despesas',
      'lucro',
      'problematizacao',
      'justificativa',
      'objetivo',
      'objetivos',
      'objectivo',
      'objectivos',
      'objetivo geral',
      'objetivos especificos',
    ]);
    const normSubsection = normalizeTitle(sectionTitle);
    if (OPERATIONAL_SUBSECTIONS.has(normSubsection)) return false; // subsecção operacional
    return true; // subsecção académica → permite citações
  }

  return false; // Tudo o resto: PROIBIDO
}

// ── CAMADA 2: Gerador do bloco de proibição para o prompt ────────────────────
//
// Gera um bloco de texto com EXEMPLOS CONCRETOS injectado no system prompt.
// O modelo segue exemplos (❌ vs ✅) muito mais consistentemente do que regras.
//
// Este bloco é dinâmico: varia conforme allowsCitations() para a secção actual.

function buildCitationGuard(sectionTitle: string): string {
  const citationsAllowed = allowsCitations(sectionTitle);

  if (!citationsAllowed) {
    return `
REGRA CRÍTICA — CITAÇÕES DE AUTORES NESTA SECÇÃO: ❌ COMPLETAMENTE PROIBIDAS
═══════════════════════════════════════════════════════════════════════════════
A secção "${sectionTitle}" é uma secção OPERACIONAL ou ESTRUTURAL do projecto.
Citações de autores são EXCLUSIVAS do Enquadramento Teórico / Desenvolvimento Teórico.

PROIBIÇÕES ABSOLUTAS — NÃO ESCREVAS NADA DISTO:
  ❌ "Segundo Gisslen (2017), a padronização é essencial..."
  ❌ "De acordo com a ILO (2020), o emprego produtivo..."
  ❌ "Conforme Porter (2008), a vantagem competitiva..."
  ❌ "...é fundamental para a sustentabilidade (Gisslen, 2017)."
  ❌ "...conforme preconizado por Kotler & Keller (2012)."
  ❌ "...segundo as diretrizes da ILO (ILO, 2020)."
  ❌ Qualquer padrão "(Autor, Ano)" ou "Autor (Ano)" no corpo do texto

COMO ESCREVER CORRECTAMENTE NESTA SECÇÃO:
  ✅ "A padronização dos processos garante qualidade constante e reduz desperdícios."
  ✅ "A formação técnica é um pilar fundamental para a criação de emprego produtivo."
  ✅ "O modelo de baixo custo operacional permite o rápido retorno do investimento."
  ✅ "A escola instalada em bairro de alta densidade tem acesso facilitado ao público-alvo."
  ✅ Afirmações directas sobre o projecto — sem nenhuma referência bibliográfica.

CHECKLIST MENTAL ANTES DE TERMINAR (obrigatório):
  → Existe algum "(Autor, Ano)" ou "Autor (Ano)" no texto? → REMOVER.
  → Existe "Segundo X...", "De acordo com X...", "Conforme X..."? → REMOVER.
  → Existe "...conforme preconizado por..."? → REMOVER.
  → Substituir sempre por afirmação directa sobre o projecto.
═══════════════════════════════════════════════════════════════════════════════
`;
  } else {
    return `
REGRA — CITAÇÕES DE AUTORES NESTA SECÇÃO: ✅ PERMITIDAS (uso moderado)
═══════════════════════════════════════════════════════════════════════════════
A secção "${sectionTitle}" é uma secção TEÓRICA. Podes usar citações em APA 7.ª ed.

FORMATO CORRECTO:
  ✅ Narrativo:    "Segundo Gisslen (2017), a padronização de processos..."
  ✅ Parentético:  "...é determinante para o sucesso (Porter, 2008)."
  ✅ Organização:  "A ILO (2020) defende que o apoio às PME é essencial..."

REGRAS DE USO:
  → Máximo 2-3 citações por parágrafo; não citar em cada frase
  → Usa autores reais e relevantes para o tema
  → Formato obrigatório: APA 7.ª edição
  → Cita para sustentar ideias, não para preencher espaço
═══════════════════════════════════════════════════════════════════════════════
`;
  }
}

// ── CAMADA 3: Filtro pós-processamento (regex de segurança) ──────────────────
//
// Última linha de defesa. Remove citações que escaparam às camadas 1 e 2.
// Executado APÓS a geração do conteúdo, ANTES de salvar na base de dados.
//
// Padrões detectados e removidos:
//   → (Autor, 2020)              → citação parentética APA
//   → (Autor & Autor, 2020)      → citação parentética com 2 autores
//   → (Autor et al., 2020)       → citação com et al.
//   → "Segundo Autor (Ano),"     → frase de introdução de citação
//   → "De acordo com Autor (Ano)"
//   → "conforme preconizado por Autor (Ano)"

function stripSpuriousCitations(content: string, sectionTitle: string): string {
  // Se a secção PERMITE citações → não filtra nada (preserva o texto intacto)
  if (allowsCitations(sectionTitle)) return content;

  let cleaned = content;

  // Padrão 1: Citação parentética simples → (Autor, Ano) ou (Autor & Autor, Ano)
  // Detecta: (Gisslen, 2017) | (Porter, 2008) | (Kotler & Keller, 2012)
  cleaned = cleaned.replace(
    /\s*\([A-ZÁÀÂÃÉÊÍÓÔÕÚ][a-záàâãéêíóôõúç]+(?:\s*[,&]\s*[A-ZÁÀÂÃÉÊÍÓÔÕÚ][a-záàâãéêíóôõúç]+)*,\s*\d{4}[a-z]?\)/g,
    ''
  );

  // Padrão 2: Citação com "et al." → (Autor et al., Ano)
  // Detecta: (Silva et al., 2021)
  cleaned = cleaned.replace(
    /\s*\([A-ZÁÀÂÃÉÊÍÓÔÕÚ][a-záàâãéêíóôõúç]+\s+et\s+al\.,\s*\d{4}\)/g,
    ''
  );

  // Padrão 3: Citação de organização com sigla → (ILO, 2020) | (OIT, 2020)
  // Remove apenas se contém ano de 4 dígitos (para não remover siglas normais como (PME))
  cleaned = cleaned.replace(
    /\s*\([A-Z]{2,8},\s*\d{4}\)/g,
    ''
  );

  // Padrão 4: Frase "Segundo Autor (Ano)," → remove a frase introdutória
  // Detecta: "Segundo Gisslen (2017)," | "Para Porter (2008),"
  cleaned = cleaned.replace(
    /(?:Segundo|De acordo com|Conforme|Consoante|Para|Segundo o autor|Segundo os autores|Segundo a|De acordo com a)\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚ][a-záàâãéêíóôõúç]+(?:\s*[,&]\s*[A-ZÁÀÂÃÉÊÍÓÔÕÚ][a-záàâãéêíóôõúç]+)*(?:\s+\(\d{4}\))?,?\s*/g,
    ''
  );

  // Padrão 5: "...conforme preconizado/indicado/referido por Autor (Ano)"
  // Detecta: "conforme preconizado por Gisslen (2017)"
  cleaned = cleaned.replace(
    /,?\s*conforme\s+(?:preconizado|indicado|referido|citado|apontado|descrito|defendido)\s+por\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚ][a-záàâãéêíóôõúç]+(?:\s*[,&]\s*[A-ZÁÀÂÃÉÊÍÓÔÕÚ][a-záàâãéêíóôõúç]+)*\s*(?:\(\d{4}\))?/gi,
    ''
  );

  // Padrão 6: Referência inline com nome completo de organização
  // Detecta: "(International Labour Organization [ILO], 2020)"
  cleaned = cleaned.replace(
    /\s*\([A-Z][a-zA-Z\s]+\[[A-Z]{2,8}\],\s*\d{4}\)/g,
    ''
  );

  // Limpeza final: espaços duplos, pontuação órfã resultante das remoções
  cleaned = cleaned
    .replace(/[ \t]{2,}/g, ' ')        // espaços duplos → 1 espaço
    .replace(/\.\s*\./g, '.')           // ponto duplo → 1 ponto
    .replace(/,\s*\./g, '.')            // vírgula + ponto → 1 ponto
    .replace(/^\s*[,;]\s*/gm, '')       // vírgula/ponto-e-vírgula no início de linha
    .replace(/\n{3,}/g, '\n\n')         // linhas em branco excessivas
    .trim();

  return cleaned;
}

// ── Filtro pós-processamento (bloco) ──────────────────────────────────────────

const SPURIOUS_HEADING_PATTERN = /^#{1,3}\s*(conclus[aã]o|consider[aã]es\s+finais|refere?ncias?(\s+bibliogr[aá]ficas?)?|bibliography|notas?\s+finais?|síntese)\s*$/im;
const SPURIOUS_CLOSING_PHRASES = /\n+(em\s+(suma|conclus[aã]o|síntese)|portanto,\s+conclui-se|por\s+fim,\s+(pode|é\s+poss[ií]vel)|conclui-se\s+(assim|que|portanto)|desta\s+(forma|maneira|feita),\s+(conclui|verifica|observa)-se)[^]*/i;
const SPURIOUS_REFERENCE_BLOCK = /\n+(#{1,3}\s*refere?ncias?[^\n]*\n+)?([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][^.\n]{2,60}\.\s*\(\d{4}\)[^\n]*\n){2,}[^]*/;
const UNIVERSITY_LANGUAGE_PATTERNS = [
  /\n*#{1,3}\s*(abordagem\s+de\s+investiga[cç][aã]o|crit[eé]rios\s+de\s+avalia[cç][aã]o|procedimentos?\s+operacionais?|revis[aã]o\s+bibliogr[aá]fica|an[aá]lise\s+de\s+casos?\s+reais?|coer[eê]ncia\s+metodol[oó]gica)[^\n]*\n[^]*/gi,
];

function stripUniversityLanguage(content: string, sectionTitle: string): string {
  const norm = normalizeTitle(sectionTitle);
  if (!norm.includes('objectivo') && !norm.includes('objetivo') && !norm.includes('metodologia')) return content;
  let cleaned = content;
  for (const pattern of UNIVERSITY_LANGUAGE_PATTERNS) cleaned = cleaned.replace(pattern, '');
  return cleaned.trimEnd();
}

function stripSpuriousBlocks(content: string, sectionTitle: string): string {
  if (sectionAllowsClosing(sectionTitle)) return content;
  let cleaned = content;
  const headingMatch = SPURIOUS_HEADING_PATTERN.exec(cleaned);
  if (headingMatch?.index !== undefined) cleaned = cleaned.slice(0, headingMatch.index).trimEnd();
  cleaned = cleaned.replace(SPURIOUS_CLOSING_PHRASES, '').trimEnd();
  cleaned = cleaned.replace(SPURIOUS_REFERENCE_BLOCK, '').trimEnd();
  return stripUniversityLanguage(cleaned, sectionTitle);
}

// ── Instruções específicas por secção ─────────────────────────────────────────

function getSectionInstruction(normalizedName: string, isSubsection: boolean): string {

  if (normalizedName === 'objetivo geral') {
    return `Escreve o Objetivo Geral do projecto em exactamente 1 frase no infinitivo (ex: "Criar…", "Desenvolver…", "Implementar…"). A frase deve resumir a ambição central do projecto de forma clara e mensurável. Máximo 40 palavras. NÃO uses lista. NÃO incluas conclusão nem referências.`;
  }

  if (normalizedName === 'objetivos especificos' || normalizedName === 'objectivos especificos') {
    return `Lista 3 a 5 Objetivos Específicos do projecto, cada um numa linha com bullet (-). Cada objetivo:
- Começa com verbo no infinitivo (Identificar, Analisar, Elaborar, Calcular, Promover…)
- É concreto, mensurável e ligado ao contexto do projecto
- Máximo 25 palavras por item
NÃO incluas Objetivo Geral aqui. NÃO incluas conclusão nem referências.`;
  }

  if (normalizedName === 'objetivo') {
    return `Apresenta brevemente a finalidade desta secção: os objetivos estão divididos em Objetivo Geral (o propósito central) e Objetivos Específicos (os passos mensuráveis). 2-3 frases introdutórias. NÃO listes os objetivos aqui.`;
  }

  if (normalizedName === 'problematizacao') {
    return `Escreve APENAS a problematização em 1 frase simples, directa e objectiva.
Regras obrigatórias:
- Deve mencionar apenas 1 único problema central (não listar dois ou mais problemas)
- Máximo 35 palavras
- Sem explicações longas, sem dados extensos e sem proposta de solução
- Não transformar em justificativa
Exemplo de estilo: "A falta de formação técnica acessível em confeitaria limita a qualidade, a competitividade e a autonomia financeira de pequenos empreendedores moçambicanos."
NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'justificativa') {
    return `Explica POR QUÊ este projecto é necessário e relevante. Deve:
- Mostrar o impacto esperado do projecto
- Argumentar sobre os benefícios para a comunidade, escola ou região
- Mencionar quem beneficia e de que forma
- Ter entre 180 e 280 palavras
NÃO repitas a problematização. NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'analise fofa') {
    return `Apresenta APENAS a Análise FOFA (SWOT) APLICADA ao projecto concreto (não teoria), com 4 blocos bem estruturados:

**Forças** (internas, positivas) — 3 a 4 bullets
**Oportunidades** (externas, positivas) — 3 a 4 bullets
**Fraquezas** (internas, negativas) — 2 a 3 bullets
**Ameaças** (externas, negativas) — 2 a 3 bullets

REGRA FUNDAMENTAL:
- Esta secção é de análise aplicada ao projecto, não de enquadramento teórico.
- NÃO explicar o que é FOFA, NÃO citar autores, NÃO descrever como a ferramenta funciona.

REGRAS OBRIGATÓRIAS DA ANÁLISE:
- Cada ponto deve ser específico ao projecto e conter dados concretos quando possível (valores, localização, equipa, público, produto, mercado).
- Evitar frases genéricas que sirvam para qualquer projecto.
- Mostrar mecanismo de impacto nas fraquezas/ameaças (o que acontece e com que consequência para o projecto).
- Usar linguagem directa, analítica e descritiva da realidade do projecto.

CHECKLIST INTERNO (obrigatório antes de concluir):
- Há algum ponto genérico/copiável para outro projecto? Se sim, reescrever.
- Há citação de autor para justificar a análise? Se sim, remover.
- Estou a aplicar a FOFA ao projecto ou a explicar a ferramenta? Se estiver a explicar, corrigir.

NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'localizacao do projeto' || normalizedName === 'localizacao do projecto') {
    return `Descreve a localização onde o projecto será implementado. Deve:
- Indicar a localização específica (cidade, bairro, estabelecimento)
- Justificar a escolha (acesso ao público-alvo, infraestrutura, concorrência)
- Mencionar vantagens logísticas ou estratégicas
- Ter entre 150 e 250 palavras
NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'recursos humanos') {
    return `Descreve a equipa necessária para o projecto. Deve:
- Listar os cargos/funções necessários
- Indicar o número de pessoas por função
- Descrever as responsabilidades de cada função
- Mencionar qualificações desejáveis
- Organizar em formato de lista ou tabela Markdown
- Ter entre 150 e 280 palavras
NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName.includes('financeira') && normalizedName.includes('despesa')) {
    return `Apresenta a análise financeira e as despesas do projecto. Deve:
- Listar as despesas de investimento inicial (equipamento, espaço, licenças)
- Listar as despesas operacionais mensais (salários, matéria-prima, electricidade)
- Indicar o custo total estimado
- Mencionar possíveis fontes de financiamento
- Usar tabela Markdown ou lista com valores em MZN quando possível
- Ter entre 200 e 350 palavras
- CONSISTÊNCIA OBRIGATÓRIA: se a Introdução já tiver definido investimento inicial, usar exactamente o mesmo valor aqui.
NÃO incluas receitas ou lucros aqui. NÃO incluas conclusão.`;
  }

  if (normalizedName === 'lucro') {
    return `Apresenta a projecção de receitas e lucratividade do projecto. Deve:
- Estimar as receitas mensais esperadas (preço × volume estimado)
- Calcular o lucro líquido (receitas − despesas operacionais)
- Indicar o ponto de equilíbrio (break-even)
- Estimar o período de retorno do investimento
- Usar tabela Markdown ou cálculos com valores em MZN quando possível
- Ter entre 180 e 300 palavras
- CONSISTÊNCIA OBRIGATÓRIA: manter o mesmo investimento inicial definido na Introdução e na Análise financeira/Despesas.
NÃO repitas as despesas. NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'marketing') {
    return `Desenvolve a estratégia de marketing do projecto cobrindo os 4 Ps:

**Produto/Serviço** — o que é oferecido e o que o diferencia
**Preço** — estratégia de preço e justificação
**Praça/Distribuição** — como e onde o produto chegará ao cliente
**Promoção** — canais de comunicação (redes sociais, boca-a-boca, cartazes)

Identifica também o **público-alvo** (perfil do cliente ideal).
Ter entre 250 e 380 palavras. Usar subtítulos em negrito.
NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'enquadramento teorico') {
    return `Apresenta o enquadramento teórico do projecto. Deve:
- Definir conceitos-chave relacionados com o tipo de negócio/projecto
- Citar autores e teorias relevantes em APA 7.ª edição
- Contextualizar o projecto no sector em Moçambique
- Ter entre 250 e 400 palavras
- Aqui DEVE haver citações de autores; nas secções de análise aplicada (FOFA, financeira, mercado), NÃO usar citações
NÃO incluas as subsecções (FOFA, Localização, RH) aqui.
NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'implementacao do projeto' || normalizedName === 'implementacao do projecto') {
    return `Descreve o plano de implementação do projecto. Deve:
- Apresentar as etapas cronológicas
- Indicar responsáveis por cada etapa
- Mencionar recursos necessários em cada fase
- Ter entre 200 e 320 palavras
NÃO incluas a análise financeira detalhada aqui.
NÃO incluas conclusão nem referências no final.`;
  }

  if (isSubsection) {
    return `Desenvolve este subtópico de forma clara e didáctica para alunos do ensino secundário. Deve:
- Apresentar o conceito com uma definição simples e acessível
- Incluir pelo menos 1 exemplo prático quando isso ajudar a compreensão
- Ter entre 220 e 380 palavras
- Usar Markdown (negrito para termos importantes, listas quando adequado)
- NÃO repetir conteúdo já presente nas secções anteriores
- NÃO incluir conclusão nem lista de referências no final`;
  }

  if (normalizedName === 'introducao') {
    return `Escreve a secção "Introdução" para trabalho escolar/projeto do ensino secundário/médio.

ESTRUTURA OBRIGATÓRIA (5 parágrafos):
- Parágrafo 1: definição do projeto + explicação directa do tema
- Parágrafo 2: importância do tema + contextualização social/económica breve
- Parágrafo 3: problema identificado + necessidade do projeto
- Parágrafo 4: objectivo geral + metas principais + grupo-alvo + valor social/económico/educacional + estimativa resumida de investimento inicial
- Parágrafo 5: resumo dos tópicos que serão abordados ao longo do trabalho

REGRAS DE QUALIDADE:
- Linguagem clara, objectiva, académica e organizada
- 280 a 480 palavras
- NÃO incluir conclusão nem referências no final`;
  }

  if (normalizedName === 'objectivos' || normalizedName === 'objetivos') {
    return `Escreve APENAS os objectivos do trabalho, de forma SIMPLES e CONCISA.

Estrutura OBRIGATÓRIA:
**Objectivo Geral** — 1 frase no infinitivo
**Objectivos Específicos** — 3 a 4 bullets no infinitivo

NÃO uses referências nem citações. NÃO ultrapasses 100 palavras no total.`;
  }

  if (normalizedName === 'metodologia') {
    return `Escreve APENAS a metodologia do trabalho/projeto (3 a 4 parágrafos curtos):
1. Natureza da pesquisa (qualitativa, bibliográfica…)
2. Método de análise (descritivo, comparativo…)
3. Fontes e critérios de selecção
4. Organização dos dados

NÃO incluas objectivos aqui. NÃO ultrapasses 220 palavras. NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'conclusao' || normalizedName === 'conclusão') {
    return `Escreve uma conclusão consistente e académica (220 a 320 palavras):
- Retoma os pontos mais importantes do trabalho
- Responde ao problema de pesquisa da introdução
- Apresenta a relevância do tema
- Inclui reflexão crítica
- NÃO introduz informação nova`;
  }

  if (normalizedName.includes('referencia') || normalizedName.includes('bibliografia')) {
    return `Lista as referências bibliográficas em formato APA (7.ª edição):
- Mínimo 4 referências relevantes
- Ordenadas alfabeticamente pelo apelido do primeiro autor
- Cada referência numa linha separada`;
  }

  return `Desenvolve o conteúdo de forma académica adequada ao ensino secundário, entre 220 e 380 palavras. NÃO incluas conclusão nem referências no final.`;
}

// ── Prompt do rascunho rápido (Pass 1 — apenas com RAG activo) ────────────────

function buildDraftPrompt(
  sectionTitle: string,
  topic: string,
  outline: string,
  specificInstruction: string,
): string {
  // CAMADA 2 aplicada também ao rascunho inicial
  const citationGuard = buildCitationGuard(sectionTitle);

  return `${PROMPT_INJECTION_GUARD}

És um redactor académico do ensino secundário moçambicano. Gera um RASCUNHO INICIAL da secção "${sectionTitle}" para um trabalho sobre ${wrapUserInput('user_topic', topic)}.

Esboço orientador:
${wrapUserInput('user_outline', outline.slice(0, 700))}

Instrução desta secção:
${specificInstruction}

${citationGuard}

REGRAS DO RASCUNHO:
- Entre 180 e 350 palavras — rascunho inicial, não definitivo
- Estrutura clara e coerente
- Cobre os pontos principais da secção
- Português europeu
- Usa Markdown básico
- NÃO incluas conclusão nem referências bibliográficas no final`;
}

// ── Prompt do refinamento / geração directa (Pass 2) ─────────────────────────

function buildRefinedSystemPrompt(params: {
  topic: string;
  outline: string;
  sectionTitle: string;
  specificInstruction: string;
  previousContext: string;
  researchBrief: string | null;
  ragContext: string;
  enrichedContext: string;
}): string {
  const {
    topic, outline, sectionTitle, specificInstruction,
    previousContext, researchBrief, ragContext, enrichedContext,
  } = params;

  const researchBlock = researchBrief
    ? `\n[FICHA DE PESQUISA]\n${wrapUserInput('user_research_brief', researchBrief)}\n`
    : '';

  const enrichedBlock = enrichedContext
    ? `\n[CONHECIMENTO RECUPERADO — PRIORIDADE MÁXIMA]\n${wrapUserInput('user_enriched_context', enrichedContext)}\n`
    : '';

  const ragBlock = ragContext
    ? `\n[BASE DE CONHECIMENTO MULTIMODAL — DOCUMENTOS CARREGADOS]\n${wrapUserInput('user_rag_context', ragContext)}\n`
    : '';

  const antiClosingInstruction = !sectionAllowsClosing(sectionTitle)
    ? `
PROIBIÇÕES ABSOLUTAS PARA ESTA SECÇÃO:
❌ NÃO escrevas "Em conclusão", "Em suma", "Conclui-se que", "Por fim, conclui-se" ou equivalentes
❌ NÃO adiciones lista de referências bibliográficas no final
❌ NÃO escrevas cabeçalhos como "## Conclusão", "## Referências", "### Considerações Finais"
❌ NÃO fechas com parágrafo de encerramento — termina no último ponto de conteúdo`
    : '';

  // ── CAMADA 2: Bloco de controlo de citações injectado no system prompt ──────
  // Este bloco é gerado dinamicamente por buildCitationGuard() e varia conforme
  // allowsCitations(sectionTitle). Para secções operacionais, injeta proibição
  // com exemplos concretos (❌ vs ✅). Para secções teóricas, injeta orientação.
  const citationGuard = buildCitationGuard(sectionTitle);

  return `IDENTIDADE E PAPEL
==================
${PROMPT_INJECTION_GUARD}

És um redactor académico especializado em trabalhos escolares e projectos do ensino secundário e médio.
Escreves sempre em português europeu com normas ortográficas moçambicanas quando aplicável.
A norma de referenciação é APA (7.ª edição) em todo o trabalho.

${enrichedBlock}

CONTEXTO DO PROJECTO
====================
[TÓPICO DO TRABALHO]
${wrapUserInput('user_topic', topic)}

[ESBOÇO ORIENTADOR]
${wrapUserInput('user_outline', outline)}
${previousContext}
${researchBlock}
${ragBlock}

${citationGuard}

REGRAS DE ADEQUAÇÃO AO CONTEXTO MOÇAMBICANO
===========================================
O trabalho é produzido em Moçambique. Aplica contexto moçambicano APENAS quando o tema for social, económico, histórico ou geográfico. NÃO forces contexto geográfico em temas universais.

INSTRUÇÃO DA TAREFA ACTUAL
==========================
Desenvolve APENAS a secção: "${sectionTitle}"

${specificInstruction}
${antiClosingInstruction}

REGRAS DE ESCRITA — OBRIGATÓRIAS
=================================
- Começa directamente pelo conteúdo — sem "Nesta secção…", "Vou desenvolver…"
- NÃO incluas o título da secção no início — é inserido automaticamente
- Usa Markdown: negrito para termos-chave, subtítulos quando adequado, listas quando necessário
- Mantém coerência terminológica com as secções anteriores
- Se existir contexto enriquecido acima, integra-o com citações APA no corpo do texto (APENAS se esta secção permitir citações — ver regra acima)
- Tom académico claro e acessível ao nível do ensino secundário/médio`.trim();
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'work:develop', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const planError = await requireFeatureAccess(user.id, 'create_work', req);
  if (planError) return planError;

  try {
    const parsedPayload = parseSessionPayload(await req.json());
    if (!parsedPayload) {
      return NextResponse.json(
        { error: 'Payload inválido: sessionId e sectionIndex são obrigatórios' },
        { status: 400 },
      );
    }

    const { sessionId, sectionIndex } = parsedPayload;

    const session = await getWorkSession(sessionId);
    if (!session) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });

    const outline = session.outline_approved ?? session.outline_draft;
    if (!outline) return NextResponse.json({ error: 'Esboço ainda não disponível' }, { status: 400 });

    const section = session.sections.find(s => s.index === sectionIndex);
    if (!section) return NextResponse.json({ error: 'Secção não encontrada' }, { status: 404 });

    const hasRagDocuments = !!session.rag_enabled;

    if (!hasRagDocuments && !session.research_brief) {
      try {
        const research = await generateResearchBrief(session.topic, outline);
        await saveWorkResearchBrief(session.id, research.keywords, research.brief);
        session.research_keywords = research.keywords;
        session.research_brief = research.brief;
        session.research_generated_at = new Date().toISOString();
      } catch (researchError) {
        console.warn('[work/develop] Falha ao gerar ficha de pesquisa (sem RAG):', researchError);
      }
    }

    const previousSections = session.sections
      .filter(s => s.index < sectionIndex && s.content)
      .map(s => ({ title: s.title, content: s.content }));

    const previousContext =
      previousSections.length > 0
        ? `\n[SECÇÕES ANTERIORES]\n${wrapUserInput(
            'user_previous_sections',
            previousSections
              .map(s => `### ${s.title}\n${s.content.slice(0, 400)}${s.content.length > 400 ? '…' : ''}`)
              .join('\n\n'),
          )}\n`
        : '\n[SECÇÕES ANTERIORES]\n(nenhuma secção anterior disponível)\n';

    let ragContext = '';

    if (hasRagDocuments) {
      if (!session.rag_ficha) {
        const supabase = await (await import('@/lib/supabase')).createClient();
        const ficha = await generateRagFicha(session.id, session.topic);
        await supabase
          .from('work_sessions')
          .update({ rag_ficha: ficha })
          .eq('id', session.id)
          .eq('user_id', user.id);
        session.rag_ficha = ficha;
      }

      const sectionQuery = `${section.title} ${session.topic}`;
      const ragChunks = await semanticSearch(session.id, sectionQuery, 8);

      if (ragChunks.length > 0) {
        const ficha = session.rag_ficha as any;
        const fichaTxt = ficha
          ? `FICHA TÉCNICA:\nAutores: ${ficha.autores?.join('; ') ?? ''}\nObras: ${ficha.obras?.join('; ') ?? ''}\nConceitos: ${ficha.conceitos_chave?.join(', ') ?? ''}\n`
          : '';
        const chunksTxt = ragChunks
          .map((c, i) => {
            const icon =
              c.metadata?.modal_type === 'image' ? '[FIGURA]'
              : c.metadata?.modal_type === 'pdf_visual' ? '[PDF VISUAL]'
              : c.metadata?.modal_type === 'audio' ? '[ÁUDIO]'
              : '[TEXTO]';
            return `${icon} Excerto ${i + 1}:\n${c.chunk_text}`;
          })
          .join('\n\n---\n\n');

        ragContext = `${fichaTxt}\nEXCERTOS RELEVANTES:\n${chunksTxt}\n\nINSTRUÇÕES:\n- Baseia os argumentos nos excertos acima\n- Cita os autores reais da ficha técnica (APA 7.ª) APENAS se esta secção permitir citações\n- Não inventes referências — usa APENAS as listadas\n`;
      }
    }

    const isSubsection = /^\d+\.\d+/.test(section.title);
    const normalizedName = normalizeTitle(section.title);
    const specificInstruction = getSectionInstruction(normalizedName, isSubsection);

    const encoder = new TextEncoder();

    const orchestratedStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          let enrichedContext = '';

          if (hasRagDocuments) {
            const draft = await geminiGenerateText({
              model: 'gemini-3.1-flash-lite-preview',
              messages: [
                {
                  role: 'system',
                  content: buildDraftPrompt(section.title, session.topic, outline, specificInstruction),
                },
                { role: 'user', content: `Gera o rascunho inicial da secção "${section.title}".` },
              ],
              maxOutputTokens: 700,
              temperature: 0.5,
            });

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'phase', phase: 'reviewing', questionCount: 10 })}\n\n`));

            let reviewResult: ReviewerResult = {
              knowledgeMatrix: [],
              enrichedContext: '',
              sourceCount: 0,
              usedWeb: false,
              ragCount: 0,
              questionCount: 0,
            };

            try {
              reviewResult = await runSectionReviewer({
                draft,
                sectionTitle: section.title,
                topic: session.topic,
                sessionId: session.id,
                ragEnabled: true,
                researchBrief: session.research_brief,
              });
            } catch (reviewErr) {
              console.error('[work/develop] Agente revisor falhou:', reviewErr);
            }

            enrichedContext = reviewResult.enrichedContext;

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'phase',
              phase: 'refining',
              sourceCount: reviewResult.sourceCount,
              usedWeb: reviewResult.usedWeb,
              ragCount: reviewResult.ragCount,
            })}\n\n`));
          }

          const refinedSystemPrompt = buildRefinedSystemPrompt({
            topic: session.topic,
            outline,
            sectionTitle: section.title,
            specificInstruction,
            previousContext,
            researchBrief: session.research_brief,
            ragContext,
            enrichedContext,
          });

          const refinedStream = await geminiGenerateTextStreamSSE({
            model: 'gemini-3.1-flash-lite-preview',
            messages: [
              { role: 'system', content: refinedSystemPrompt },
              {
                role: 'user',
                content: `Desenvolve a secção "${section.title}" com máximo rigor académico. ${enrichedContext ? 'Integra os achados das fontes fornecidas no sistema.' : ''} Escreve APENAS o conteúdo desta secção, sem conclusão, sem referências no final.`,
              },
            ],
            maxOutputTokens: 1800,
            temperature: 0.4,
          });

          const reader = refinedStream.getReader();
          let accumulated = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = new TextDecoder().decode(value);
            for (const line of text.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content ?? '';
                if (delta) accumulated += delta;
              } catch { /* ignorar */ }
            }

            controller.enqueue(value);
          }

          if (accumulated) {
            // CAMADA 3: pipeline de limpeza pós-geração
            // Passo 1: Remove blocos de fecho espúrios (conclusão, referências no final)
            const afterBlockStrip = stripSpuriousBlocks(accumulated, section.title);
            // Passo 2: Remove citações de autores em secções onde são proibidas
            const cleaned = stripSpuriousCitations(afterBlockStrip, section.title);
            await saveWorkSectionContent(sessionId, sectionIndex, cleaned, session.sections);
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (streamError) {
          console.error('[work/develop] Erro no stream orquestrado:', streamError);
          controller.error(streamError);
        }
      },
    });

    return new NextResponse(orchestratedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
