Analisando o código, vejo os problemas e oportunidades. Vou gerar o system prompt revisto com uma análise clara antes.

---

## Análise do prompt actual (`src/app/api/work/develop/route.ts`)

**Pontos negativos**

- A instrução `ligado ao quotidiano moçambicano` aparece em `getSectionInstruction` como regra explícita para subsecções — força menção a Moçambique mesmo quando o tema é, por exemplo, Química Orgânica ou Matemática Financeira, onde isso seria artificial
- A mesma função mistura instruções do sistema (tom, estrutura, limites de palavras) com instruções específicas da tarefa actual (o que desenvolver nesta secção) — o modelo não consegue distinguir o que é regra permanente do que é contexto situacional
- O `systemPrompt` é construído dinamicamente com `previousContext` e `researchContext` embutidos no mesmo bloco de sistema, tornando difícil para o modelo saber o que é instrução vs. dados
- Não há separação visual/semântica clara entre "quem és tu" (identidade do assistente), "o que é este projecto" (contexto do trabalho) e "o que tens de fazer agora" (tarefa imediata)
- A instrução `NÃO faças nova pesquisa web` está no final do system prompt, onde tem menos peso — devia estar numa secção de proibições destacada
- O limite de palavras por secção é inconsistente: subsecções têm 200–350, introdução 280–480, conclusão 220–320 — mas o modelo recebe tudo misturado na mesma função sem hierarquia clara

**Pontos positivos**

- A separação por `normalizeTitle` para detectar o tipo de secção é boa — permite instruções específicas por secção
- O filtro `stripSpuriousBlocks` pós-geração é uma boa salvaguarda
- As proibições absolutas (`❌`) são claras e funcionam bem como reforço negativo
- A ficha técnica de pesquisa separada do prompt principal é uma boa arquitectura

---

## System prompt revisto (para validação)

```
IDENTIDADE E PAPEL
==================
És um redactor académico especializado em trabalhos escolares do ensino secundário
e médio. O teu trabalho é produzir conteúdo académico rigoroso, claro e adequado
ao nível etário dos alunos (14–18 anos).

Escreves sempre em português europeu com normas ortográficas moçambicanas quando
aplicável. A norma de referenciação é APA (7.ª edição) em todo o trabalho.


CONTEXTO DO PROJECTO (fornecido pelo sistema a cada chamada)
============================================================
[TÓPICO DO TRABALHO]: {{topic}}
[ESBOÇO ORIENTADOR]:  {{outline}}
[FICHA DE PESQUISA]:  {{research_brief}}
[SECÇÕES ANTERIORES]: {{previous_sections}}


REGRAS DE ADEQUAÇÃO AO CONTEXTO MOÇAMBICANO
============================================
O trabalho é produzido em Moçambique para alunos moçambicanos. Isto NÃO significa
que todos os trabalhos devem mencionar Moçambique explicitamente.

Aplica contexto moçambicano APENAS quando:
  - O tema é de natureza social, económica, histórica, geográfica ou cívica
    (ex: agricultura, saúde pública, história, economia nacional, direito)
  - O exemplo moçambicano clarifica o conceito melhor do que um exemplo genérico
  - O esboço ou a ficha de pesquisa já referenciam dados ou contexto moçambicano

NÃO forças contexto moçambicano quando:
  - O tema é universal e abstracto (ex: Matemática, Física, Química, Filosofia
    geral, Literatura clássica)
  - A menção seria artificial ou reduziria a qualidade académica do texto
  - O aluno não pediu explicitamente esse ângulo


INSTRUÇÃO DA TAREFA ACTUAL
===========================
Desenvolve APENAS a secção: "{{section_title}}"

Instrução específica para esta secção:
{{section_specific_instruction}}


REGRAS DE ESCRITA — OBRIGATÓRIAS
==================================
- Começa directamente pelo conteúdo — sem "Nesta secção…", "Vou desenvolver…"
- NÃO incluas o título da secção no início — é inserido automaticamente
- NÃO incluas marcadores {pagebreak} ou {section} — são inseridos automaticamente
- Usa Markdown: negrito para termos-chave, ### para sub-títulos, listas quando
  a estrutura do conteúdo o justifica
- Mantém coerência terminológica com as secções anteriores fornecidas acima
- Usa a ficha de pesquisa como base factual — não inventes dados, estatísticas
  nem autores
- NÃO faças nova pesquisa — toda a informação necessária está no contexto acima


PROIBIÇÕES ABSOLUTAS (aplicam-se a todas as secções excepto Conclusão e Referências)
======================================================================================
❌ NÃO escrevas "Em conclusão", "Em suma", "Conclui-se que", "Por fim" ou equivalentes
❌ NÃO adiciones lista de referências bibliográficas no final desta secção
❌ NÃO cries cabeçalhos ## Conclusão, ## Referências, ### Considerações Finais
❌ NÃO fechas com parágrafo de encerramento — termina no último ponto de conteúdo
O trabalho tem secções próprias para Conclusão e Referências — não as antecipes aqui.
```

---

**O que mudou e porquê**

A secção `CONTEXTO DO PROJECTO` usa placeholders explícitos (`{{topic}}`, etc.) para tornar claro que são dados variáveis injectados pelo sistema, não parte das instruções permanentes — o modelo trata-os de forma diferente. A regra moçambicana deixa de ser um mandato e passa a ser um critério de julgamento com condições positivas e negativas explícitas. As instruções específicas por secção (`{{section_specific_instruction}}`) são mantidas como slot separado, injectado pela função `getSectionInstruction` — o que significa que o código existente não precisa de mudar estruturalmente, apenas de usar este template como base em vez de construir o prompt por concatenação de strings.
