'use client';

import { useState } from 'react';

const DEFAULT_MARKDOWN = `# Matemática — Equações do 2.º Grau e Logaritmos

## 1. Equações do 2.º Grau

Uma equação do 2.º grau (ou equação quadrática) é toda equação da forma:

$$ax^2 + bx + c = 0$$

onde $a \\neq 0$ e $a, b, c \\in \\mathbb{R}$.

### 1.1. Fórmula de Bhaskara

A solução geral é dada pela **fórmula de Bhaskara**:

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

O valor $\\Delta = b^2 - 4ac$ denomina-se **discriminante** e determina a natureza das raízes:

- Se $\\Delta > 0$: duas raízes reais e distintas
- Se $\\Delta = 0$: duas raízes reais e iguais (raiz dupla)
- Se $\\Delta < 0$: sem raízes reais (raízes complexas)

---

### 1.2. Exemplos Resolvidos

**Exemplo 1** — Resolver $x^2 - 5x + 6 = 0$

Identificamos $a = 1$, $b = -5$, $c = 6$.

Calculamos o discriminante:

$$\\Delta = (-5)^2 - 4 \\cdot 1 \\cdot 6 = 25 - 24 = 1$$

Aplicamos a fórmula:

$$x = \\frac{-(-5) \\pm \\sqrt{1}}{2 \\cdot 1} = \\frac{5 \\pm 1}{2}$$

Logo:

$$x_1 = \\frac{5 + 1}{2} = 3 \\qquad x_2 = \\frac{5 - 1}{2} = 2$$

O conjunto solução é $S = \\{2, 3\\}$.

---

**Exemplo 2** — Resolver $2x^2 - 4x + 2 = 0$

Identificamos $a = 2$, $b = -4$, $c = 2$.

$$\\Delta = (-4)^2 - 4 \\cdot 2 \\cdot 2 = 16 - 16 = 0$$

Como $\\Delta = 0$, existe uma raiz dupla:

$$x = \\frac{-(-4)}{2 \\cdot 2} = \\frac{4}{4} = 1$$

O conjunto solução é $S = \\{1\\}$.

---

**Exemplo 3** — Resolver $x^2 + x + 1 = 0$

$$\\Delta = 1^2 - 4 \\cdot 1 \\cdot 1 = 1 - 4 = -3$$

Como $\\Delta < 0$, não existem raízes reais. $S = \\emptyset$.

---

### 1.3. Relações de Girard (Vieta)

Para uma equação $ax^2 + bx + c = 0$ com raízes $x_1$ e $x_2$:

$$x_1 + x_2 = -\\frac{b}{a} \\qquad x_1 \\cdot x_2 = \\frac{c}{a}$$

**Verificação do Exemplo 1:**

$$x_1 + x_2 = 3 + 2 = 5 = -\\frac{-5}{1} \\checkmark$$

$$x_1 \\cdot x_2 = 3 \\times 2 = 6 = \\frac{6}{1} \\checkmark$$

---

## 2. Logaritmos

### 2.1. Definição

O **logaritmo** de $b$ na base $a$ é o expoente $x$ tal que $a^x = b$:

$$\\log_a b = x \\iff a^x = b$$

com $a > 0$, $a \\neq 1$ e $b > 0$.

### 2.2. Propriedades Fundamentais

Sendo $a > 0$, $a \\neq 1$, e $M, N > 0$:

1. **Logaritmo do produto:**

$$\\log_a (M \\cdot N) = \\log_a M + \\log_a N$$

2. **Logaritmo do quociente:**

$$\\log_a \\left(\\frac{M}{N}\\right) = \\log_a M - \\log_a N$$

3. **Logaritmo da potência:**

$$\\log_a M^k = k \\cdot \\log_a M$$

4. **Mudança de base:**

$$\\log_a M = \\frac{\\log_b M}{\\log_b a}$$

5. **Logaritmo neperiano** (base $e$, onde $e \\approx 2{,}718$):

$$\\ln x = \\log_e x$$

---

### 2.3. Exemplos Resolvidos

**Exemplo 4** — Calcular $\\log_2 64$

$$2^x = 64 = 2^6 \\implies \\log_2 64 = 6$$

---

**Exemplo 5** — Simplificar $\\log_3 81 - \\log_3 9$

Usando a propriedade do quociente:

$$\\log_3 81 - \\log_3 9 = \\log_3 \\frac{81}{9} = \\log_3 9 = 2$$

---

**Exemplo 6** — Calcular $\\log_5 \\sqrt{125}$

$$\\log_5 \\sqrt{125} = \\log_5 125^{\\frac{1}{2}} = \\frac{1}{2} \\cdot \\log_5 5^3 = \\frac{1}{2} \\cdot 3 = \\frac{3}{2}$$

---

**Exemplo 7** — Converter $\\log_4 32$ para base 2

$$\\log_4 32 = \\frac{\\log_2 32}{\\log_2 4} = \\frac{5}{2}$$

---

### 2.4. Equações Logarítmicas

**Exemplo 8** — Resolver $\\log_2 (x + 3) = 4$

$$x + 3 = 2^4 = 16 \\implies x = 13$$

**Verificação:** $\\log_2 16 = 4$ ✓

---

**Exemplo 9** — Resolver $\\log x + \\log(x - 3) = 1$ (base 10)

Pela propriedade do produto:

$$\\log [x(x-3)] = 1 \\implies x(x-3) = 10^1 = 10$$

$$x^2 - 3x - 10 = 0$$

Calculando o discriminante:

$$\\Delta = (-3)^2 - 4 \\cdot 1 \\cdot (-10) = 9 + 40 = 49$$

$$x = \\frac{3 \\pm 7}{2} \\implies x_1 = 5 \\quad \\text{ou} \\quad x_2 = -2$$

Como o domínio exige $x > 0$ e $x - 3 > 0$, logo $x > 3$, temos $x_2 = -2$ rejeitado.

**Solução:** $S = \\{5\\}$

---

## 3. Exercícios Propostos

1. Resolva a equação $3x^2 - 12x + 9 = 0$ e verifique com as relações de Vieta.

2. Determine $k$ para que $x^2 + kx + 9 = 0$ tenha raiz dupla.

3. Calcule $\\log_6 216 + \\log_6 \\frac{1}{36}$.

4. Resolva $2^{x+1} = 8^{x-1}$.

5. Mostre que $\\log_a b \\cdot \\log_b a = 1$.`;

export function useDocumentEditor() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState('matematica-teste');

  const clearDefaultMarkdown = () => {
    setMarkdown(current => (current === DEFAULT_MARKDOWN ? '' : current));
  };

  const exportDocx = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: markdown, filename })
      });
      
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert('Failed to export DOCX');
    } finally {
      setLoading(false);
    }
  };

  return { markdown, setMarkdown, filename, setFilename, loading, exportDocx, clearDefaultMarkdown };
}
