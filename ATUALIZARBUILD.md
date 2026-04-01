Vou analisar o problema. O índice (`{toc}`) aparece na pré-visualização mas não no Word exportado.Analisando o código, identifiquei o problema. No `docx-builder.ts`, a função `buildToc()` retorna um array com `[titleParagraph, toc, noteParagraph]`, mas no `buildBlock()` o resultado é tratado como um único elemento — o `deepFlat` acaba por desestruturar incorrectamente o `TableOfContents`.

Mas o problema **principal** está aqui: a função `buildContentSections` processa os nós assim:

```ts
const built = await buildBlock(node);
if (built !== null && built !== undefined) {
  children.push(...deepFlat(Array.isArray(built) ? built : [built]));
}
```

O `deepFlat` aplana **recursivamente** tudo — incluindo o objeto `TableOfContents` da biblioteca `docx`, que internamente contém arrays. Isso corrompe o objeto antes de chegar ao `Packer`.

Vou corrigir:O problema está claro. Vou explicar a causa e a solução exacta:

---

## O problema

No `src/lib/docx/docx-builder.ts`, a função `deepFlat` é **recursiva** — desce indefinidamente dentro de qualquer array:

```ts
function deepFlat(arr: any[]): any[] {
  const result: any[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) result.push(...deepFlat(item)); // ← desce recursivamente
    else result.push(item);
  }
  return result;
}
```

O objeto `TableOfContents` da biblioteca `docx` contém arrays internos como parte da sua estrutura. Quando `buildToc()` retorna `[titleParagraph, toc, noteParagraph]` e o `buildContentSections` chama `deepFlat(built)`, o `deepFlat` **entra dentro do objeto `TableOfContents`** e destrói a sua estrutura interna. O Word recebe um objeto corrompido e ignora-o.

---

## A solução

Substituir `deepFlat` por uma versão **de 1 nível apenas** que não desce dentro de objetos da biblioteca `docx`:

**Em `src/lib/docx/docx-builder.ts`**, substituir a função `deepFlat` por:

```ts
// Aplana apenas 1 nível — preserva objetos docx (TableOfContents, Paragraph, etc.)
function deepFlat(arr: any[]): any[] {
  const result: any[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      for (const inner of item) result.push(inner); // apenas 1 nível
    } else {
      result.push(item);
    }
  }
  return result;
}
```

Esta mudança mínima (remover a chamada recursiva `deepFlat(item)` e substituir por iteração simples) resolve o problema sem tocar em mais nada. O nome da função mantém-se igual, logo todas as chamadas existentes continuam a funcionar.

---

## Porquê funciona

- `buildToc()` devolve `[titleParagraph, toc, noteParagraph]` — um array plano com 3 objetos
- A versão corrigida aplana esse array em 3 itens no `children[]` sem tocar no interior do `TableOfContents`
- O `Packer` recebe o `TableOfContents` intacto e o Word consegue processar o campo `{TOC}` ao abrir o documento

> **Nota adicional:** O `features: { updateFields: true }` já está correcto no `buildDocxDocument`. Ao abrir no Word, o índice popula automaticamente. Se o utilizador estiver no Word Mobile (Android/iOS), pode ser necessário clicar com o botão direito no índice → *Actualizar campo* manualmente.