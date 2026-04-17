# Muneri — Rich Editor Migration Guide

## 1. Install packages

```bash
npm install \
  @tiptap/react \
  @tiptap/pm \
  @tiptap/starter-kit \
  @tiptap/extension-placeholder \
  @tiptap/extension-character-count \
  @tiptap/extension-bubble-menu \
  @tiptap/extension-collaboration \
  @tiptap/extension-collaboration-cursor \
  tiptap-markdown \
  yjs \
  y-webrtc
```

## 2. Copy files to your project

| File (from this package)       | Destination in project                          |
|--------------------------------|-------------------------------------------------|
| `RichEditor.tsx`               | `src/components/RichEditor.tsx`                 |
| `EditorToolbar.tsx`            | `src/components/EditorToolbar.tsx`              |
| `AiBubbleMenu.tsx`             | `src/components/AiBubbleMenu.tsx`               |
| `CollaborationPanel.tsx`       | `src/components/CollaborationPanel.tsx`         |
| `inline-route.ts`              | `src/app/api/ai/inline/route.ts`               |
| `app-page.tsx`                 | `src/app/app/page.tsx`                          |

## 3. Update EditorFileToolbar to add preview toggle

Add two new props to `src/components/EditorFileToolbar.tsx`:

```tsx
// Add to Props interface:
showPreview?: boolean;
onTogglePreview?: () => void;

// Add button in JSX (after existing "Avançado" button):
{onTogglePreview && (
  <button
    type="button"
    onClick={onTogglePreview}
    className={`whitespace-nowrap rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.06em] transition ${
      showPreview
        ? 'border-[var(--gold2)] bg-[var(--gold2)]/10 text-[var(--gold2)]'
        : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--gold2)] hover:text-[var(--gold2)]'
    }`}
    title="Pré-visualização DOCX"
  >
    {showPreview ? 'Ocultar pré-vis.' : 'Pré-visualização'}
  </button>
)}
```

## 4. How it works

```
User types in Tiptap
      ↓
tiptap-markdown serializes → Markdown string
      ↓
EditorStore (unchanged)
      ↓
DocumentPreview renders DOCX preview
      ↓
Export pipeline (unchanged)
```

The Markdown stays as the single source of truth. Tiptap is the UI layer only.

## 5. Inline AI editing

When the user selects text in the editor, a bubble menu appears with:
- **Melhorar** — improve clarity and academic style
- **Expandir** — add details and examples
- **Resumir** — condense the text
- **Corrigir** — fix grammar/spelling only
- **Formalizar** — make it more academic
- **Instrução custom** — any instruction the user types

The AI response streams in real time. The user can apply or regenerate.

## 6. Collaboration (Yjs + WebRTC)

Click the "Colaborar" button in the toolbar to:
1. **Create a room** — generates a random room ID
2. **Share the ID** — paste it to collaborators
3. **Join a room** — paste someone else's ID

Uses y-webrtc for P2P collaboration. No server needed. The public signaling
server `wss://signaling.yjs.dev` is used for peer discovery only.

For production, run your own signaling server:
```bash
npx y-webrtc-signaling --port 4444
```

Then update the signaling URL in `RichEditor.tsx`:
```ts
const provider = new WebrtcProvider(roomId, ydoc, {
  signaling: ['wss://your-server.com'],
});
```

## 7. Known limitations

- **Math rendering**: LaTeX equations (`$...$` and `$$...$$`) are shown as text
  in the Tiptap editor but render correctly in the DOCX preview. Use the "π"
  toolbar button to insert math. Full inline rendering can be added with
  `@tiptap/extension-mathematics` (Tiptap Pro) or a custom node extension.

- **Custom markers**: `{pagebreak}`, `{section}`, `{toc}` are preserved by
  `tiptap-markdown` as literal text. They render correctly in the DOCX preview.

- **Yjs + SSR**: The collaboration code is wrapped in `'use client'` and
  handles SSR safely via lazy imports.

## 8. Troubleshooting

**Editor is blank on load:**
Make sure `tiptap-markdown` version is ≥ 0.9. The extension must be listed
AFTER `StarterKit` in the extensions array.

**Types errors with y-webrtc:**
```bash
npm install --save-dev @types/y-webrtc
```
Or add to `tsconfig.json`:
```json
{ "compilerOptions": { "skipLibCheck": true } }
```

**BubbleMenu not appearing:**
Check that `shouldShow` returns `true` when text is selected. The `editor`
must be initialized (not null) before BubbleMenu is rendered.
