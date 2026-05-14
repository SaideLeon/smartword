Usuario:
Como acrescentar a estrutura de trabalho, sem quebrar a anterior. ## 1. Introdução
### 1.1 Objetivo
#### 1.1.1 Objetivo Geral
#### 1.1.2 Objetivos Específicos
## 2. Metodologia
### 2.1 Problematização
### 2.2 Justificativa
## 3. Enquadramento Teórico
### 3.1 Análise FOFA
### 3.2 Localização do projeto
### 3.3 Recursos Humanos
## 4. Implementação do projeto
### 4.1 Análise financeira / Despesas
### 4.2 Lucro
## 5. Marketing
## 6. Conclusão
## Referência Bibliográfica

Claude AI:
Vou analisar o código existente para entender a estrutura actual antes de propor a solução.

A estrutura actual no `SYSTEM` prompt de `generate/route.ts` força sempre:

```
I. Introdução → II. Objectivos → III. Metodologia → 1. Desenvolvimento Teórico → IV. Conclusão → Referências
```

E o `service.ts` extrai secções com `##` (nível 2) e `###` (nível 3), mas ignora `####` (nível 4).

Para suportar a nova estrutura (que vai até `####`) sem quebrar a anterior, a solução é:

1. **Adicionar um segundo tipo de esboço** — um "template de projecto" — seleccionável pelo utilizador
2. **Actualizar o `extractSections`** para reconhecer `####` como subsecções de nível 3
3. **Actualizar `getSectionInstruction`** no `develop/route.ts` para os novos nomes de secção
4. **Actualizar `normalizeTitle`** para lidar com prefixos numéricos de 3 níveis (ex: `1.1.1`)

Vamos lá:Vou avançar directamente com as alterações ao código.

---

### Ficheiro 1 — `src/lib/work/types.ts`

Adicionar o campo `work_type` à sessão:### Ficheiro 2 — `src/lib/work/service.ts`

Suporte a `work_type` no CRUD e extracção de secções até `####`:### Ficheiro 3 — `src/app/api/work/generate/route.ts`

Sistema prompt novo com suporte aos dois tipos de trabalho:### Ficheiro 4 — `src/app/api/work/develop/route.ts` (excerto das funções alteradas)

As funções `normalizeTitle`, `sectionAllowsClosing` e `getSectionInstruction` precisam de reconhecer os novos nomes:### Ficheiro 5 — `src/app/api/work/session/route.ts`

Passar `workType` ao criar sessão:### Ficheiro 6 — Patch para `input-guards.ts`

`parseOutlinePayload` precisa de aceitar `workType`:### Ficheiro 7 — `WorkPanel.tsx` (patch: seletor de tipo + suporte a `####`)### Ficheiro 8 — Migração SQL (Supabase)Aqui está o resumo completo de todas as alterações e a lógica por trás de cada decisão:

---

## O que foi alterado e porquê

### Princípio central: zero breaking changes
A estrutura académica existente não foi tocada. O novo tipo `project` é paralelo, não substituto.

---

### 1. `types.ts` — novo campo `WorkType`
Adicionado o tipo `WorkType = 'academic' | 'project'` e o campo `work_type` ao `WorkSessionRecord`. Sessões antigas sem este campo são tratadas como `'academic'` por defeito.

### 2. `service.ts` — 3 alterações
- `createWorkSession` aceita agora `workType` (padrão `'academic'`)
- `extractSections` suporta agora `####` (nível 4) com a regra de colapso:
  - Um `##` seguido de `###` → é contêiner, não gera secção
  - Um `###` seguido de `####` → é contêiner, não gera secção
  - `####` é sempre folha (sempre gera secção desenvolvível)
- `normalizeTitle` remove prefixos de 3 níveis (`1.1.1.`)

### 3. `generate/route.ts` — dois sistemas prompt
`SYSTEM_ACADEMIC` (idêntico ao anterior) e `SYSTEM_PROJECT` (novo, com a estrutura pedida). O correcto é seleccionado com base no `workType` do payload.

### 4. `develop-patch.ts` — instruções por secção do projecto
`getSectionInstruction` reconhece agora todos os nomes normalizados da estrutura de projecto: `objetivo geral`, `objetivos especificos`, `problematizacao`, `justificativa`, `analise fofa`, `localizacao do projeto`, `recursos humanos`, `analise financeira despesas`, `lucro`, `marketing`, `enquadramento teorico`.

### 5. `session/route.ts` — aceita `workType` no POST
Validação do campo `workType` com whitelist (`['academic', 'project']`).

### 6. `input-guards-patch.ts` — `parseOutlinePayload` com `workType`
O validador do payload de geração de esboço passa agora o `workType` adiante.

### 7. `WorkPanel-patch.tsx` — seletor visual + funções de heading
- Seletor de tipo com dois botões (📚 Trabalho Escolar / 💼 Projecto Empresarial)
- `getSectionHeading()` detecta `####` para títulos `N.N.N`, `###` para `N.N`, `##` para o resto
- `buildReconstructedContent` e `buildSectionMarkdown` usam a nova lógica de heading
- `getParentTitleFromOutline` suporta busca de `###` (parent de `####`) além de `##`

### 8. `migration_work_type.sql` — Supabase
Coluna `work_type TEXT NOT NULL DEFAULT 'academic'` com constraint `CHECK`. Retrocompatível: sessões existentes recebem `'academic'` automaticamente, sem migrações manuais de dados.