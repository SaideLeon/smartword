# Integração da funcionalidade de Requerimento — Muneri

## Ficheiros a copiar

Copia cada ficheiro para o caminho exacto indicado na coluna "Destino no projecto":

| Ficheiro gerado | Destino no projecto |
|---|---|
| `src/lib/docx/requerimento-types.ts` | `src/lib/docx/requerimento-types.ts` |
| `src/lib/docx/requerimento-builder.ts` | `src/lib/docx/requerimento-builder.ts` |
| `src/hooks/useRequerimentoFormPersistence.ts` | `src/hooks/useRequerimentoFormPersistence.ts` |
| `src/hooks/useRequerimento.ts` | `src/hooks/useRequerimento.ts` |
| `src/components/RequerimentoFormModal.tsx` | `src/components/RequerimentoFormModal.tsx` |
| `src/app/api/requerimento/generate/route.ts` | `src/app/api/requerimento/generate/route.ts` |

---

## O que cada ficheiro faz

```
requerimento-types.ts        → Tipos TypeScript (RequerimentoData, RequerimentoFormDraft)
requerimento-builder.ts      → Gera o ficheiro .docx com a estrutura formal do requerimento
useRequerimentoFormPersistence.ts → Persiste o rascunho no IndexedDB (mesmo padrão do CoverForm)
useRequerimento.ts           → Hook que une modal + fetch + download do .docx
RequerimentoFormModal.tsx    → Modal com formulário completo (brasão, dados pessoais, secções)
route.ts (API)               → Endpoint POST /api/requerimento/generate
```

---

## Como usar na UI (exemplo mínimo)

Adiciona um botão em qualquer página ou painel existente do Muneri:

```tsx
'use client';

import { useRequerimento } from '@/hooks/useRequerimento';
import { RequerimentoFormModal } from '@/components/RequerimentoFormModal';
import { ProcessingBars } from '@/components/ProcessingBars';

export function BotaoRequerimento() {
  const { isFormOpen, isGenerating, openForm, closeForm, generate } = useRequerimento();

  return (
    <>
      {/* Modal — renderizado no topo do tree */}
      {isFormOpen && (
        <RequerimentoFormModal
          onSubmit={generate}
          onCancel={closeForm}
        />
      )}

      {/* Botão de acesso */}
      <button
        onClick={openForm}
        disabled={isGenerating}
        className="flex items-center gap-2 rounded border border-[var(--panel-border)] bg-[var(--panel-surface)] px-4 py-2 font-mono text-[11px] text-[var(--panel-accent)] transition-colors hover:bg-[var(--panel-accent-dim)]"
      >
        {isGenerating ? (
          <>
            <ProcessingBars height={12} />
            <span>A gerar requerimento…</span>
          </>
        ) : (
          <>📋 Gerar Requerimento</>
        )}
      </button>
    </>
  );
}
```

---

## Onde integrar no painel lateral (WorkPanel ou novo separador)

Se quiseres adicionar ao painel "Trabalho Escolar" existente, insere no `WorkPanel.tsx`:

```tsx
// Importa no topo
import { useRequerimento } from '@/hooks/useRequerimento';
import { RequerimentoFormModal } from '@/components/RequerimentoFormModal';

// Dentro do componente WorkPanel, adiciona:
const req = useRequerimento();

// No JSX, antes do botão "Iniciar trabalho":
{req.isFormOpen && (
  <RequerimentoFormModal
    onSubmit={req.generate}
    onCancel={req.closeForm}
    isMobile={isMobile}
  />
)}

// Botão novo no ecrã idle:
<Btn onClick={req.openForm} color={C.muted} outline flex>
  📋 Gerar Requerimento
</Btn>
```

---

## Dependências — nada novo a instalar

O `requerimento-builder.ts` usa apenas os mesmos pacotes já presentes no Muneri:
- `docx` (já usado em `cover-builder.ts` e `docx-builder.ts`)
- `@/lib/validation/image-validator` (já usado em `cover-builder.ts`)
- `@/lib/api-auth`, `@/lib/rate-limit`, `@/lib/utils/filename` (já existem)

---

## Pré-visualização do documento gerado

O `.docx` gerado segue exactamente a estrutura do requerimento do PDF de referência:

```
┌─────────────────────────────────────┐
│  [BRASÃO OPCIONAL]                  │
│  REPÚBLICA DE MOÇAMBIQUE            │
│  INSTITUTO INDUSTRIAL E COMERCIAL…  │
│  Curso de Contabilidade, nível CV3  │
│  Quelimane — Zambézia               │
│  ─────────────────────────────────  │
│                                     │
│  Exmo. Sr. Formador, Lucas Maribeu  │
│                          Quelimane  │
│                                     │
│  Eu, Saíde Omar Saíde, filho de…    │
│  …venho solicitar a aprovação do…   │
│                                     │
│  1. Identificação do Projecto       │
│  ─────────────────────────────      │
│  O projecto proposto…               │
│                                     │
│  2. Justificativa e Viabilidade     │
│  ─────────────────────────────      │
│  a) Relevância: …                   │
│  b) Modelo de negócio: …            │
│                                     │
│  3. Do Pedido                       │
│  ─────────────────────────────      │
│  Face ao exposto…                   │
│                                     │
│  Pede deferimento,                  │
│                                     │
│  Quelimane, 29 de Abril de 2026     │
│  ─────────────────────              │
│  Saíde Omar Saíde                   │
│  Formando · Contabilidade CV3 · B   │
└─────────────────────────────────────┘
```

---

## Notas de segurança

- A API `/api/requerimento/generate` exige autenticação (`requireAuth`) e rate limiting (10 req/min por IP).
- O logo/brasão é validado por `validateBase64Image` antes de ser embebido no DOCX.
- Todos os campos passam por sanitização de comprimento antes de serem aceites.

---

## Campos obrigatórios vs opcionais

| Campo | Obrigatório |
|---|---|
| Brasão/logo | ❌ opcional |
| "República de Moçambique" | Toggle (ligado por defeito) |
| Instituição, curso, cidade | ✅ |
| Destinatário (nome, módulo, cidade) | ✅ |
| Dados pessoais completos (nome, pais, nascimento, BI, emissão) | ✅ |
| Dados académicos (curso, nível, turma) | ✅ |
| Propósito do pedido | ✅ |
| Secção 1, 2, 3 (título + conteúdo) | ❌ opcionais |
| Local, data, papel do requerente | ✅ |
