// ─────────────────────────────────────────────────────────────────────────────
// PATCH para src/app/api/work/develop/route.ts
//
// Substitui as três funções no topo do ficheiro:
//   • normalizeTitle
//   • sectionAllowsClosing
//   • getSectionInstruction
//
// Compatível com AMBAS as estruturas:
//   Academic : I. Introdução, II. Objectivos, III. Metodologia, 1.x …
//   Project  : 1. Introdução, 1.1 Objetivo, 1.1.1 Objetivo Geral, 2. …
// ─────────────────────────────────────────────────────────────────────────────

// ── Normalização de título (remove prefixos numéricos/romanos até 3 níveis) ───

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Prefixo romano: I., II., IV. …
    .replace(/^[ivxlcdm]+\.\s*/i, '')
    // Prefixo numérico 3 níveis: 1.1.1. ou 1.1.1
    .replace(/^\d+\.\d+\.\d+\.?\s*/, '')
    // Prefixo numérico 2 níveis: 1.1. ou 1.1
    .replace(/^\d+\.\d+\.?\s*/, '')
    // Prefixo numérico simples: 1. ou 1
    .replace(/^\d+\.?\s*/, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Secções que permitem conteúdo de fecho ────────────────────────────────────

const CLOSING_SECTION_NAMES = new Set([
  // Académico
  'conclusao',
  'conclusion',
  'referencias',
  'referencias bibliograficas',
  'bibliography',
  // Projecto
  'referencia bibliografica',
  'referencias bibliograficas',
]);

function sectionAllowsClosing(title: string): boolean {
  return CLOSING_SECTION_NAMES.has(normalizeTitle(title));
}

// ── Instruções específicas por secção ─────────────────────────────────────────
//
// Cobre as secções da estrutura ACADÉMICA e da estrutura PROJECTO.
// A correspondência é feita pelo nome normalizado (sem prefixos).

function getSectionInstruction(normalizedName: string, isSubsection: boolean): string {

  // ── PROJECTO ────────────────────────────────────────────────────────────────

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
    // Contêiner 1.1 — não deve ser desenvolvido directamente (só as subsubsecções)
    return `Apresenta brevemente a finalidade desta secção: os objetivos do projecto estão divididos em Objetivo Geral (o propósito central) e Objetivos Específicos (os passos mensuráveis para o atingir). 2-3 frases introdutórias apenas. NÃO listes os objetivos aqui.`;
  }

  if (normalizedName === 'problematizacao') {
    return `Descreve o problema real que o projecto pretende resolver. Deve:
- Identificar claramente o problema (quem sofre, onde, com que impacto)
- Apresentar dados ou evidências que comprovem a existência do problema
- Ligar o problema ao contexto moçambicano quando relevante
- Ter entre 200 e 320 palavras
NÃO incluas soluções aqui — apenas o problema. NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'justificativa') {
    return `Explica POR QUÊ este projecto é necessário e relevante. Deve:
- Mostrar a importância e o impacto esperado do projecto
- Argumentar sobre os benefícios para a comunidade, escola ou região
- Mencionar quem beneficia e de que forma
- Ter entre 180 e 280 palavras
NÃO repitas a problematização. NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'analise fofa') {
    return `Apresenta a Análise FOFA (SWOT) do projecto num formato estruturado com 4 blocos:

**Forças** (internas, positivas) — 3 a 4 bullets
**Oportunidades** (externas, positivas) — 3 a 4 bullets
**Fraquezas** (internas, negativas) — 2 a 3 bullets
**Ameaças** (externas, negativas) — 2 a 3 bullets

Cada item deve ser específico ao projecto. Usa linguagem directa e concisa.
NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'localizacao do projeto' || normalizedName === 'localizacao do projecto') {
    return `Descreve a localização onde o projecto será implementado. Deve:
- Indicar a localização específica (cidade, bairro, estabelecimento)
- Justificar a escolha da localização (acesso ao público-alvo, infraestrutura, concorrência, etc.)
- Mencionar vantagens logísticas ou estratégicas dessa localização
- Ter entre 150 e 250 palavras
Usa linguagem clara e objectiva. NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'recursos humanos') {
    return `Descreve a equipa necessária para implementar o projecto. Deve:
- Listar os cargos/funções necessários (ex: gestor, vendedor, técnico)
- Indicar o número de pessoas por função
- Descrever brevemente as responsabilidades de cada função
- Mencionar qualificações ou competências desejáveis
- Organizar em formato de lista ou tabela Markdown
- Ter entre 150 e 280 palavras
NÃO incluas conclusão nem referências no final.`;
  }

  if (
    normalizedName === 'analise financeira  despesas' ||
    normalizedName === 'analise financeira despesas' ||
    normalizedName.includes('financeira') && normalizedName.includes('despesa')
  ) {
    return `Apresenta a análise financeira e as despesas do projecto. Deve:
- Listar as despesas de investimento inicial (equipamento, espaço, licenças)
- Listar as despesas operacionais mensais (salários, matéria-prima, electricidade, etc.)
- Indicar o custo total estimado
- Mencionar possíveis fontes de financiamento (poupanças, crédito, apoios)
- Usar tabela Markdown ou lista organizada com valores em MZN (meticais) quando possível
- Ter entre 200 e 350 palavras
NÃO incluas receitas ou lucros aqui — isso é para a secção Lucro. NÃO incluas conclusão.`;
  }

  if (normalizedName === 'lucro') {
    return `Apresenta a projecção de receitas e lucratividade do projecto. Deve:
- Estimar as receitas mensais esperadas (preço × volume de vendas estimado)
- Calcular o lucro líquido (receitas − despesas operacionais)
- Indicar o ponto de equilíbrio (break-even) — quando o projecto cobre os custos
- Estimar o período de retorno do investimento inicial
- Usar tabela Markdown ou cálculos organizados com valores em MZN quando possível
- Ter entre 180 e 300 palavras
NÃO repitas as despesas. NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'marketing') {
    return `Desenvolve a estratégia de marketing do projecto. Deve cobrir os 4 P's:

**Produto/Serviço** — o que é oferecido e o que o diferencia
**Preço** — estratégia de preço (competitivo, premium, de penetração) e justificação
**Praça/Distribuição** — como e onde o produto/serviço chegará ao cliente
**Promoção** — canais de comunicação (redes sociais, boca-a-boca, cartazes, etc.)

Deve também identificar o **público-alvo** (perfil do cliente ideal).
Ter entre 250 e 380 palavras. Usar Markdown com subtítulos em negrito.
NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'enquadramento teorico') {
    return `Apresenta o enquadramento teórico do projecto. Deve:
- Definir conceitos-chave relacionados com o tipo de negócio/projecto
- Citar autores e teorias relevantes (empreendedorismo, gestão, marketing, etc.) em APA 7.ª
- Contextualizar o projecto no âmbito do sector em Moçambique
- Ter entre 250 e 400 palavras
NÃO incluas as subsecções (FOFA, Localização, RH) aqui — apenas teoria geral.
NÃO incluas conclusão nem referências no final.`;
  }

  if (normalizedName === 'implementacao do projeto' || normalizedName === 'implementacao do projecto') {
    return `Descreve o plano de implementação do projecto. Deve:
- Apresentar as etapas cronológicas de implementação
- Indicar responsáveis por cada etapa quando relevante
- Mencionar os recursos necessários em cada fase
- Ter entre 200 e 320 palavras
NÃO incluas a análise financeira detalhada aqui — isso é para as subsecções 4.1 e 4.2.
NÃO incluas conclusão nem referências no final.`;
  }

  // ── ACADÉMICO ───────────────────────────────────────────────────────────────

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
    return `Escreve uma introdução académica simples para um trabalho do ensino secundário/médio. Deve:
- Contextualizar o tema de forma acessível (o que é e porquê é importante)
- Apresentar o problema de pesquisa em 1-2 frases
- Referir os objectivos gerais do trabalho
- Descrever brevemente a estrutura do trabalho (as secções que existem)
- Ter entre 280 e 480 palavras — NÃO ultrapasses este limite
- NÃO desenvolver conceitos teóricos — isso é para o Desenvolvimento
- NÃO incluir conclusão nem referências no final`;
  }

  if (normalizedName === 'objectivos' || normalizedName === 'objetivos') {
    return `Escreve APENAS os objectivos do trabalho, de forma SIMPLES e CONCISA para o ensino secundário/médio.

Estrutura OBRIGATÓRIA:
**Objectivo Geral**
1 frase que resume o propósito do trabalho (começa com infinitivo: "Analisar...", "Compreender...", "Identificar...")

**Objectivos Específicos**
Lista de 3 a 4 bullets curtos, cada um com 1 frase simples no infinitivo.
PROIBIÇÕES ABSOLUTAS:
❌ NÃO escrevas nada sobre metodologia aqui
❌ NÃO uses referências nem citações
❌ NÃO ultrapasses 100 palavras no total
❌ NÃO incluas conclusão nem referências no final`;
  }

  if (normalizedName === 'metodologia') {
    return `Escreve APENAS a metodologia do trabalho, de forma APROFUNDADA mas acessível ao ensino secundário/médio.

Estrutura OBRIGATÓRIA (3 a 4 parágrafos curtos):
1. **Natureza da pesquisa** — indica se é qualitativa, bibliográfica, documental, etc. e justifica brevemente
2. **Método de análise** — descreve o método usado (histórico, comparativo, descritivo, qualitativo, etc.)
3. **Fontes e critérios de selecção** — que tipo de fontes foram consultadas e por que razão
4. **Organização dos dados** — como a informação foi tratada e apresentada (ex: tematicamente, segundo APA 7.ª edição)

PROIBIÇÕES ABSOLUTAS:
❌ NÃO escrevas objectivos aqui
❌ NÃO ultrapasses 150 palavras no total
❌ NÃO incluas conclusão nem referências no final`;
  }

  if (normalizedName === 'conclusao' || normalizedName === 'conclusão') {
    return `Escreve uma conclusão consistente e académica. Deve:
- Retomar os pontos mais importantes desenvolvidos no trabalho (1 parágrafo)
- Responder ao problema de pesquisa apresentado na introdução
- Apresentar a relevância do tema e o que o trabalho contribuiu
- Incluir reflexão crítica ou opinião fundamentada do aluno
- Ter entre 220 e 320 palavras — NÃO ultrapasses este limite
- Usar linguagem clara: "Conclui-se que...", "O presente trabalho demonstrou..."
- NÃO introduzir informação nova`;
  }

  if (normalizedName.includes('referencia') || normalizedName.includes('bibliografia')) {
    return `Lista as referências bibliográficas em formato APA (7.ª edição). Deve:
- Incluir no mínimo 4 referências relevantes e credíveis para o tema
- Ordenar alfabeticamente pelo apelido do primeiro autor
- Apresentar cada referência numa linha separada
- Incluir: livros didácticos, artigos académicos, sites educativos ou institucionais`;
  }

  return `Desenvolve o conteúdo de forma académica adequada ao ensino secundário, entre 220 e 380 palavras. NÃO incluas conclusão nem referências no final.`;
}
