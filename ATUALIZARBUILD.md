Vou analisar as imagens e o código para identificar o problema.

**O problema nas imagens:**

- **Como devia ser** (imagem 1 - Smartword): A coluna "Tipo" aparece preenchida em todas as linhas (ex: "Bicamadas", "Canal, transportadora...", "Ligadas à superfície...", "Modula a fluidez", "Componentes de superfície")
- **Como aparece** (imagem 2 - Word exportado): A coluna do meio ("Tipo") aparece **vazia** em várias linhas — especificamente nas linhas de Fosfolípidos, Proteínas periféricas e Colesterol

**Causa raiz:**

Olhando para `docx-builder.ts`, na função `buildTableRow`, há este trecho:

```ts
const styledRuns = row.isHeader
  ? runs.map((run: any) => {
      if (run instanceof TextRun) {
        const text = (run as any).text ?? (run as any).options?.text ?? '';
        return new TextRun({ text, bold: true, color: COLOR_HEADER_FG });
      }
      return run;
    })
  : runs;
```

O problema está na extracção do texto: `(run as any).text ?? (run as any).options?.text ?? ''`. A biblioteca `docx` guarda o texto internamente numa propriedade que pode não ser `.text` nem `.options.text` directamente, resultando em células vazias.

Mas o problema **real** está na função `buildInline` para nós `strong` — nas células com texto em bold, os runs são arrays aninhados que o `deepFlat` pode não estar a aplanar correctamente antes de chegarem ao `styledRuns`.

Veja `buildTableRow`:

```ts
const inlineNodes = await Promise.all(cell.children.map(n => buildInline(n)));
const runs = deepFlat(inlineNodes);
```

E `deepFlat` só aplana **1 nível**. Se `buildInline` para `strong` retorna `[TextRun, TextRun]`, e esse array entra como item de `inlineNodes`, o `deepFlat` aplana correctamente — mas se houver mais níveis (emphasis dentro de strong, etc.) fica aninhado.

O problema **principal** porém é este — na linha da header:

```ts
const text = (run as any).text ?? (run as any).options?.text ?? '';
return new TextRun({ text, bold: true, color: COLOR_HEADER_FG });
```

Quando um `run` não é `instanceof TextRun` (ex: é um nó de math ou hyperlink), ele é passado sem alteração — correcto. Mas quando é `TextRun`, a tentativa de ler `.text` falha silenciosamente e cria um `TextRun` com `text: ''`.

A correcção está em `docx-builder.ts`:O ficheiro está em read-only (uploads). Vou mostrar a correcção directamente.

---

**Há dois problemas sobrepostos:**

**1. O problema principal — células vazias nas linhas normais (não-header)**

A coluna "Tipo" fica vazia nas linhas de Fosfolípidos, Proteínas periféricas e Colesterol. Repare que essas três linhas têm texto **simples** (não bold), enquanto as outras têm bold na primeira coluna. Isso aponta para um problema de alinhamento de índice de coluna.

Olhando `buildTableRow`, o `colWidths` é calculado com base em `row.cells.length` da **primeira linha**. Se a linha de header tiver `colspan` ou contagem diferente, os índices ficam desfasados — mas esse não é o caso aqui.

O **verdadeiro culpado** é este padrão em `buildInline` para `strong`:

```ts
case 'strong': {
  const children = await Promise.all(node.children.map(c => buildInline(c, { ...options, bold: true })));
  return children.flat(); // ← retorna um Array, não um único elemento
}
```

Quando `buildInline` retorna um array (caso `strong`/`emphasis`), e esse resultado vai para `deepFlat(inlineNodes)`, o `deepFlat` só aplana 1 nível. Se dentro de `strong` houver outro `strong`, fica aninhado e o run interior é perdido/ignorado pelo Word como elemento inválido.

**A correcção correcta em `docx-builder.ts`:**

```ts
// Substitua deepFlat por uma versão recursiva real
function deepFlat(arr: any[]): any[] {
  const result: any[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...deepFlat(item)); // ← recursivo
    } else {
      result.push(item);
    }
  }
  return result;
}
```

**2. O problema secundário — header com células vazias**

Quando reconstrói os TextRuns do header para aplicar bold+cor, lê `.text` antes de `.options?.text`. Na versão actual da lib `docx`, o texto fica em `.options.text`. A ordem correcta:

```ts
const text: string =
  (run as any).options?.text ??
  (run as any).text ??
  '';
```

---

**Resumo das duas correcções a aplicar em `src/lib/docx/docx-builder.ts`:**

```diff
- function deepFlat(arr: any[]): any[] {
-   const result: any[] = [];
-   for (const item of arr) {
-     if (Array.isArray(item)) {
-       for (const inner of item) result.push(inner); // apenas 1 nível
-     } else {
-       result.push(item);
-     }
-   }
-   return result;
- }
+ function deepFlat(arr: any[]): any[] {
+   const result: any[] = [];
+   for (const item of arr) {
+     if (Array.isArray(item)) {
+       result.push(...deepFlat(item)); // recursivo — aplana todos os níveis
+     } else {
+       result.push(item);
+     }
+   }
+   return result;
+ }
```

```diff
  const styledRuns = row.isHeader
    ? runs.map((run: any) => {
        if (run instanceof TextRun) {
-         const text = (run as any).text ?? (run as any).options?.text ?? '';
+         const text: string = (run as any).options?.text ?? (run as any).text ?? '';
          return new TextRun({ text, bold: true, color: COLOR_HEADER_FG });
        }
        return run;
      })
    : runs;
```

A primeira correcção resolve as células do corpo da tabela; a segunda garante que o cabeçalho também não perde texto quando a versão da lib muda a localização interna da propriedade.
