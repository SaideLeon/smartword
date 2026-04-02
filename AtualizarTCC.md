# Prompt para Migração das Actualizações de Work → TCC

---

```
TAREFA: Migrar actualizações da API de Trabalho Escolar para a API de TCC

Vais actualizar o ficheiro `src/app/api/tcc/develop/route.ts` aplicando as
mesmas melhorias estruturais e de qualidade que foram implementadas em
`src/app/api/work/develop/route.ts`, adaptando-as ao nível universitário do TCC.

════════════════════════════════════════════════════════════════════
PARTE 1 — O QUE MUDOU EM work/develop/route.ts (fonte da verdade)
════════════════════════════════════════════════════════════════════

As seguintes mudanças foram feitas no work/develop que AINDA NÃO existem
no tcc/develop e precisam de ser migradas com adaptações:

1. SYSTEM PROMPT REESTRUTURADO EM SECÇÕES NOMEADAS
   O systemPrompt passou de uma string contínua e difícil de ler para um
   formato com secções claramente separadas por cabeçalhos em maiúsculas:

     IDENTIDADE E PAPEL
     ==================
     CONTEXTO DO PROJECTO (fornecido pelo sistema a cada chamada)
     ============================================================
     REGRAS DE ADEQUAÇÃO AO CONTEXTO MOÇAMBICANO
     ===========================================
     INSTRUÇÃO DA TAREFA ACTUAL
     ==========================
     REGRAS DE ESCRITA — OBRIGATÓRIAS
     =================================
     PROIBIÇÕES ABSOLUTAS (excepto Conclusão e Referências)
     =======================================================

   Esta separação visual ajuda o modelo a distinguir instruções permanentes
   de dados variáveis injectados por chamada.

2. BLOCOS DE DADOS COM RÓTULOS DELIMITADOS
   O previousContext e o researchContext deixaram de ser strings soltas
   concatenadas e passaram a usar rótulos explícitos:

     \n[SECÇÕES ANTERIORES]\n ... \n
     \n[FICHA DE PESQUISA]\n  ... \n

   Quando não há dados, os blocos mostram uma mensagem explícita em vez de
   ficarem vazios:

     \n[SECÇÕES ANTERIORES]\n(nenhuma secção anterior disponível)\n
     \n[FICHA DE PESQUISA]\n(não disponível)\n

3. REGRA DO CONTEXTO MOÇAMBICANO INTELIGENTE
   Foi adicionada uma secção REGRAS DE ADEQUAÇÃO AO CONTEXTO MOÇAMBICANO
   que substitui a instrução anterior que forçava menção explícita a
   Moçambique em todas as subsecções.

   A nova regra define QUANDO aplicar e QUANDO NÃO aplicar o contexto:

   APLICAR quando:
   - O tema é de natureza social, económica, histórica, geográfica ou cívica
   - O exemplo moçambicano clarifica o conceito melhor que um exemplo genérico
   - O esboço ou ficha de pesquisa já referenciam dados ou contexto moçambicano

   NÃO APLICAR quando:
   - O tema é universal e abstracto (Matemática, Física, Química, Filosofia,
     Literatura clássica)
   - A menção seria artificial ou reduziria a qualidade académica
   - O aluno não pediu explicitamente esse ângulo

4. getSectionInstruction — subsecções sem menção forçada a Moçambique
   No case de isSubsection, a instrução anterior dizia:
     "Incluir pelo menos 1 exemplo prático ligado ao quotidiano moçambicano"
   Foi substituída por:
     "Incluir pelo menos 1 exemplo prático quando isso ajudar a compreensão"
   O julgamento sobre usar ou não contexto moçambicano fica para a secção
   REGRAS DE ADEQUAÇÃO do system prompt.

5. PROIBIÇÕES ABSOLUTAS como secção própria no system prompt
   As proibições (❌) que antes eram injectadas apenas via antiClosingInstruction
   no final do prompt passaram a existir também como secção permanente
   PROIBIÇÕES ABSOLUTAS, garantindo que o modelo as veja mesmo quando
   antiClosingInstruction não é injectado (ex: secções de Conclusão).

════════════════════════════════════════════════════════════════════
PARTE 2 — O QUE NÃO DEVES COPIAR (diferenças legítimas TCC vs Work)
════════════════════════════════════════════════════════════════════

O TCC é um trabalho de nível universitário. As seguintes diferenças
DEVEM ser mantidas e reforçadas, não substituídas pelas versões de Work:

A. IDENTIDADE DO ASSISTENTE
   Work:  "redactor académico para ensino secundário e médio (14–18 anos)"
   TCC:   "especialista académico para TCC de nível universitário"
   → Mantém a identidade TCC. Tom técnico, rigoroso, científico.

B. getSectionInstruction — conteúdo das instruções por secção
   O work tem instruções simplificadas (100–350 palavras, linguagem acessível).
   O TCC tem instruções com maior profundidade (300–600 palavras, linguagem
   técnica, obrigatoriedade de citações APA no corpo do texto).
   → NÃO substituas as instruções por secção do TCC pelas do Work.
   → Apenas aplica a estrutura e a lógica de como são injectadas.

C. EXTENSÃO DO CONTEÚDO
   Work:  200–350 palavras por subsecção, 220–480 por secções principais
   TCC:   300–600 palavras (mantém o valor actual do tcc/develop)
   → Não alterares os limites de palavras do TCC.

D. NORMA DE CITAÇÃO
   Ambos usam APA 7.ª edição, mas o TCC exige citações no texto em TODAS
   as secções de desenvolvimento (não apenas nas referências).
   → Reforça esta exigência na secção REGRAS DE ESCRITA do TCC.

E. CONTEXTO DE COMPRESSÃO
   O tcc/develop tem lógica de compressão de contexto (compressContextIfNeeded,
   buildOptimisedContext, historicalContext, recentContext, contextNote) que
   o work/develop NÃO tem.
   → Mantém toda a lógica de compressão do TCC intacta.
   → Apenas adapta como esses blocos são apresentados no system prompt,
     usando os mesmos rótulos delimitados da nova estrutura.

F. SECÇÕES PERMITIDAS PARA FECHO
   Work usa CLOSING_SECTION_NAMES com normalizeTitle.
   TCC usa SECTIONS_THAT_ALLOW_CLOSING com .toLowerCase().trim().
   → Mantém a lógica do TCC. Não substituas por normalizeTitle do Work
     a menos que queiras unificar — mas se o fizeres, garante que os
     nomes normalizados do TCC (com acentos como "conclusão") continuam
     a ser reconhecidos correctamente.

G. MODELO E PARÂMETROS
   Ambos usam openai/gpt-oss-120b com temperatura 0.5.
   O TCC usa max_tokens: 2048; o Work usa 1500.
   → Mantém 2048 no TCC.

════════════════════════════════════════════════════════════════════
PARTE 3 — RESULTADO ESPERADO: ESTRUTURA DO NOVO systemPrompt DO TCC
════════════════════════════════════════════════════════════════════

O systemPrompt final de tcc/develop deve ter esta estrutura (com o conteúdo
adaptado ao nível universitário):

  IDENTIDADE E PAPEL
  ==================
  [especialista TCC universitário — tom técnico e científico]
  [APA 7.ª edição obrigatória em todo o trabalho]
  [português europeu]

  CONTEXTO DO PROJECTO (fornecido pelo sistema a cada chamada)
  ============================================================
  [TÓPICO DO TCC]
  ${topic}

  [ESBOÇO APROVADO]
  ${outline}

  [CONTEXTO HISTÓRICO COMPRIMIDO]   ← apenas se compressionActive
  ${contextSummary}

  [SECÇÕES RECENTES COMPLETAS]      ← apenas se recentSectionsContent não vazio
  ${recentSectionsContent}

  [NOTA DE COMPRESSÃO]              ← apenas se compressionActive
  ${contextNote}

  [FICHA DE PESQUISA]
  ${researchBrief ?? '(não disponível)'}

  REGRAS DE ADEQUAÇÃO AO CONTEXTO MOÇAMBICANO
  ============================================
  [mesma lógica do Work — aplicar apenas quando relevante, não forçar]

  INSTRUÇÃO DA TAREFA ACTUAL
  ==========================
  Desenvolve APENAS o conteúdo interno da secção: "${currentSection.title}"
  [instrução específica por secção — mantém as do TCC, não substitui pelas do Work]
  [antiClosingInstruction — apenas se a secção não permite fecho]

  REGRAS DE ESCRITA — OBRIGATÓRIAS
  ==================================
  - Começa directamente pelo conteúdo académico
  - NÃO incluas o título da secção no início
  - Texto académico técnico em português europeu
  - Mantém coerência terminológica com o contexto fornecido
  - Usa a ficha de pesquisa como base factual — não inventes dados nem autores
  - Usa citações APA no corpo do texto em todas as secções de desenvolvimento
  - Usa Markdown (negrito, listas, ### para sub-títulos)
  - Extensão: entre 300 e 600 palavras
  - Não repitas conteúdo já presente no contexto histórico ou recente
  - NÃO faças nova pesquisa — toda a informação está no contexto acima

  PROIBIÇÕES ABSOLUTAS (aplicam-se a todas as secções excepto Conclusão e Referências)
  =====================================================================================
  ❌ [lista completa de proibições — igual ao Work]

════════════════════════════════════════════════════════════════════
PARTE 4 — CHECKLIST DE VALIDAÇÃO APÓS A MIGRAÇÃO
════════════════════════════════════════════════════════════════════

Depois de escreveres o código, verifica cada item:

[ ] O systemPrompt tem as 6 secções nomeadas com cabeçalhos em maiúsculas
[ ] Os blocos de dados usam rótulos [CONTEXTO HISTÓRICO COMPRIMIDO],
    [SECÇÕES RECENTES COMPLETAS], [NOTA DE COMPRESSÃO], [FICHA DE PESQUISA]
[ ] A lógica de compressão (compressContextIfNeeded, buildOptimisedContext)
    está intacta e os seus outputs são injectados nos blocos correctos
[ ] A secção REGRAS DE ADEQUAÇÃO AO CONTEXTO MOÇAMBICANO existe e usa
    a lógica condicional (aplicar / não aplicar)
[ ] getSectionInstruction NÃO menciona "quotidiano moçambicano" explicitamente
    nas subsecções — o julgamento fica para a secção de regras
[ ] A IDENTIDADE do assistente é universitária, não secundária
[ ] Os limites de palavras mantêm-se em 300–600 (não 200–350 do Work)
[ ] max_tokens mantém-se em 2048
[ ] SECTIONS_THAT_ALLOW_CLOSING mantém "conclusão", "referências" com acentos
[ ] As PROIBIÇÕES ABSOLUTAS existem tanto como secção permanente do prompt
    como via antiClosingInstruction dinâmico
[ ] O ficheiro compila sem erros TypeScript
[ ] A assinatura de buildSystemPrompt mantém os mesmos parâmetros que tinha
    (topic, outline, researchBrief, contextSummary, recentSectionsContent,
    currentSection, compressionActive)
```
