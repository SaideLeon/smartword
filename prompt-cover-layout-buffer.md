# Prompt — Adicionar buffer de segurança ao cálculo de layout da capa

## Contexto

Tens acesso a uma biblioteca de geração de documentos `.docx` em TypeScript.
O código está **funcional e em produção**. A única alteração pedida é cirúrgica:
adicionar um buffer de segurança ao cálculo de layout da capa para evitar que
ela transborde para uma segunda página em casos onde a renderização real do Word
é ligeiramente maior do que o estimado.

**Não alteres** nenhum outro ficheiro. **Não refactores** estruturas, tipos,
nomes de funções, exportações, nem lógica existente. A única intervenção é em
`src/lib/docx/cover-layout.ts`.

---

## Problema

O ficheiro `cover-layout.ts` calcula a distribuição de espaço vertical da capa
usando estimativas de altura por linha (`LINE_12PT = 270`, `LINE_14PT = 315`,
etc.). O Word adiciona micro-espaçamentos internos que estas constantes não
capturam, fazendo com que a capa transborde ~1 linha para uma segunda página
em alguns casos.

---

## Alteração pedida

### Ficheiro: `src/lib/docx/cover-layout.ts`

#### Passo 1 — Adicionar a constante `LAYOUT_SAFETY_BUFFER`

Localiza este bloco existente (por volta da linha 20):

```ts
/** Altura útil do conteúdo em twips (1 twip = 1/1440 polegada = 1/20 pt) */
const CONTENT_HEIGHT = convertMillimetersToTwip(PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM);
```

Adiciona **imediatamente a seguir** (não substituis a linha existente):

```ts
/**
 * Buffer de segurança em twips — absorve micro-espaçamentos internos do Word
 * que as constantes LINE_*PT não conseguem prever com exactidão.
 * 300 twips ≈ 5mm ≈ uma linha a 12pt. Aumenta em 100 se ainda houver overflow.
 */
const LAYOUT_SAFETY_BUFFER = 300;

/**
 * Altura efectiva usada nos cálculos de gap — ligeiramente menor que
 * CONTENT_HEIGHT para garantir que o conteúdo não transborda na renderização real.
 */
const EFFECTIVE_CONTENT_HEIGHT = CONTENT_HEIGHT - LAYOUT_SAFETY_BUFFER;
```

#### Passo 2 — Substituir `CONTENT_HEIGHT` por `EFFECTIVE_CONTENT_HEIGHT` na função `computeGaps`

Localiza a função `computeGaps`. Dentro dela existem exactamente **dois** sítios
onde `CONTENT_HEIGHT` é usado para calcular o espaço residual. Substitui apenas
esses dois:

```ts
// ANTES
const remaining12 = CONTENT_HEIGHT - fixed12;
// DEPOIS
const remaining12 = EFFECTIVE_CONTENT_HEIGHT - fixed12;
```

```ts
// ANTES
const remaining10 = CONTENT_HEIGHT - fixed10;
// DEPOIS
const remaining10 = EFFECTIVE_CONTENT_HEIGHT - fixed10;
```

`CONTENT_HEIGHT` original **não é removido** — fica declarado e disponível.

---

## O que NÃO alterar

- As constantes `LINE_12PT`, `LINE_14PT`, `LINE_10PT`, `AFTER_*`, `MIN_GAP`, `N_GAPS`
- As funções `fixedContentHeight`, `calculateCoverLayout`, `calculateBackCoverLayout`
- O tipo `CoverLayoutMetrics` e qualquer exportação
- Qualquer outro ficheiro fora de `cover-layout.ts`

---

## Verificação esperada após a alteração

Os testes existentes em `src/lib/docx/__tests__/` não cobrem `cover-layout.ts`
directamente, por isso não é esperado que falhem. A verificação é visual:
gera um documento com os dados abaixo e confirma que a capa ocupa uma única
página no Word/LibreOffice.

### Dados de teste de stress (caso extremo)

```ts
const coverData = {
  institution: "INSTITUTO INDUSTRIAL E COMERCIAL 1º DE MAIO DE QUELIMANE",
  delegation: "QUELIMANE",
  logoBase64: "<base64 de qualquer png>",
  course: "CONTABILIDADE CV3",
  subject: "Preencher os modelos obrigatórios para o pagamento das obrigações sociais",
  theme: "Conhecer os Princípios Básicos da Legislação Comercial, Laboral e Fiscal",
  group: "3º Grupo",
  members: ["Aluno Um", "Aluno Dois", "Aluno Três", "Aluno Quatro", "Aluno Cinco"],
  teacher: "Prof. Nome Completo do Docente",
  city: "Quelimane",
  date: "Março de 2026",
};
```

---

## Calibração do buffer se necessário

| Resultado visual | Acção |
|---|---|
| Ainda transborda | Aumenta `LAYOUT_SAFETY_BUFFER` para `400` |
| Gaps demasiado pequenos / capa vazia | Reduz para `200` |
| Funciona correctamente | Mantém `300` |
