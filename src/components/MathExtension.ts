'use client'

// MathRendererExtension — renderiza fórmulas LaTeX no editor TipTap
//
// Comportamento (Obsidian Live Preview):
//   - Fórmula renderizada com temml quando o cursor NÃO está no range $...$
//   - Fonte LaTeX destacada e editável quando o cursor ESTÁ no range $...$
//
// Não altera a estrutura do documento ProseMirror — o markdown $...$ é preservado.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import temml from 'temml'
import { sanitizeMathMarkup } from '@/lib/math-markup-sanitizer'

// ── Regexes ───────────────────────────────────────────────────────────────────
// Bloco $$...$$ tem prioridade — processado antes do inline $...$

const BLOCK_RE  = /\$\$([\s\S]+?)\$\$/g
const INLINE_RE = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface MathRange {
  from:    number
  to:      number
  latex:   string
  display: boolean
}

// ── Plugin key ────────────────────────────────────────────────────────────────

const MATH_KEY = new PluginKey<DecorationSet>('mathRenderer')

// ── Rendering com temml ───────────────────────────────────────────────────────

function renderMath(latex: string, display: boolean): string {
  try {
    return sanitizeMathMarkup(
      temml.renderToString(latex, {
        displayMode:  display,
        throwOnError: false,
        strict:       false,
      })
    )
  } catch {
    // Fallback: mostra o LaTeX bruto em código
    return display
      ? `<code class="math-error">$$${latex}$$</code>`
      : `<code class="math-error">$${latex}$</code>`
  }
}

// ── Encontrar ranges de matemática no documento ───────────────────────────────

function findMathRanges(doc: any): MathRange[] {
  const ranges: MathRange[] = []

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return

    const text = node.text as string

    // 1. Blocos $$...$$
    BLOCK_RE.lastIndex = 0
    let m: RegExpExecArray | null

    while ((m = BLOCK_RE.exec(text)) !== null) {
      ranges.push({
        from:    pos + m.index,
        to:      pos + m.index + m[0].length,
        latex:   m[1].trim(),
        display: true,
      })
    }

    // 2. Inline $...$ (ignora sobreposições com blocos)
    INLINE_RE.lastIndex = 0

    while ((m = INLINE_RE.exec(text)) !== null) {
      const from = pos + m.index
      const to   = pos + m.index + m[0].length
      if (!ranges.some(r => from < r.to && to > r.from)) {
        ranges.push({ from, to, latex: m[1].trim(), display: false })
      }
    }
  })

  return ranges
}

// ── Construir decorações ──────────────────────────────────────────────────────

function buildDecorations(doc: any, cursorPos: number): DecorationSet {
  const ranges = findMathRanges(doc)
  const decos: Decoration[] = []

  for (const { from, to, latex, display } of ranges) {
    const cursorInRange = cursorPos >= from && cursorPos <= to

    if (cursorInRange) {
      // ── Modo edição: destaca o texto LaTeX fonte ─────────────────────────
      decos.push(
        Decoration.inline(from, to, {
          class:         `math-src-active ${display ? 'math-src-block' : 'math-src-inline'}`,
          'data-latex':  latex,
        })
      )
    } else {
      // ── Modo view: widget renderizado + fonte oculta ─────────────────────
      const _latex   = latex
      const _display = display

      // Widget: fórmula renderizada
      decos.push(
        Decoration.widget(
          from,
          () => {
            const el = document.createElement(_display ? 'div' : 'span')
            el.className = `math-widget ${_display ? 'math-widget-block' : 'math-widget-inline'}`
            el.setAttribute('contenteditable', 'false')
            el.setAttribute('title', _display ? `$$${_latex}$$` : `$${_latex}$`)
            el.setAttribute('aria-label', `Fórmula: ${_latex}`)
            el.innerHTML = renderMath(_latex, _display)
            return el
          },
          { side: -1, key: `mw-${from}` }
        )
      )

      // Texto fonte oculto (cursor ainda pode entrar para edição)
      decos.push(
        Decoration.inline(from, to, {
          class: `math-src-hidden ${display ? 'math-src-block' : 'math-src-inline'}`,
        })
      )
    }
  }

  return DecorationSet.create(doc, decos)
}

// ── Extensão TipTap ───────────────────────────────────────────────────────────

export const MathRendererExtension = Extension.create({
  name: 'mathRenderer',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: MATH_KEY,

        state: {
          init(_, state) {
            return buildDecorations(state.doc, state.selection.from)
          },

          apply(tr, oldDecs, _oldState, newState) {
            if (tr.docChanged || tr.selectionSet) {
              return buildDecorations(newState.doc, newState.selection.from)
            }
            // Sem alterações — mapeia posições eficientemente
            return oldDecs.map(tr.mapping, tr.doc)
          },
        },

        props: {
          decorations(state) {
            return MATH_KEY.getState(state) ?? DecorationSet.empty
          },
        },
      }),
    ]
  },
})
