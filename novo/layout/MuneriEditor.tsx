'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import styles from './MuneriEditor.module.css'

type Mode = 'trabalho' | 'tcc' | 'ia'
type ViewMode = 'read' | 'edit' | 'web'

interface BubblePos {
  x: number
  y: number
  visible: boolean
}

export default function MuneriEditor() {
  const [mode, setMode] = useState<Mode>('tcc')
  const [activeTab, setActiveTab] = useState('inicio')
  const [fmtState, setFmtState] = useState({ bold: false, italic: false, ul: false })
  const [zoom, setZoom] = useState(90)
  const [viewMode, setViewMode] = useState<ViewMode>('read')
  const [fileName, setFileName] = useState('matematica-teste')
  const [wordCount, setWordCount] = useState(0)
  const [charInfo, setCharInfo] = useState('0 LINHAS · 0 CARACTERES')
  const [bubble, setBubble] = useState<BubblePos>({ x: 0, y: 0, visible: false })
  const [showStylesPanel, setShowStylesPanel] = useState(true)
  const [activeStyle, setActiveStyle] = useState('p')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  const tabs = ['PÁGINA INICIAL', 'INSERIR', 'DESIGN', 'LAYOUT DA PÁGINA', 'REFERÊNCIAS', 'REVISÃO']
  const tabKeys = ['inicio', 'inserir', 'design', 'layout', 'refs', 'revisao']

  const toggleFmt = useCallback((fmt: 'bold' | 'italic' | 'ul') => {
    const newState = { ...fmtState, [fmt]: !fmtState[fmt] }
    setFmtState(newState)
    const cmd = fmt === 'bold' ? 'bold' : fmt === 'italic' ? 'italic' : 'underline'
    document.execCommand(cmd, false, undefined)
    editorRef.current?.focus()
  }, [fmtState])

  const execFmt = useCallback((cmd: string) => {
    if (cmd === 'cut') document.execCommand('cut')
    else if (cmd === 'copy') document.execCommand('copy')
    else if (cmd === 'paste') document.execCommand('paste')
    else if (cmd === 'selectAll') document.execCommand('selectAll')
    setBubble(b => ({ ...b, visible: false }))
  }, [])

  const callAI = useCallback((action: string) => {
    const sel = window.getSelection()?.toString() || ''
    const labels: Record<string, string> = { improve: 'Melhorar', summarize: 'Resumir', formalize: 'Formalizar', expand: 'Expandir', correct: 'Corrigir' }
    alert(`IA: ${labels[action]}${sel ? ` — Texto seleccionado: "${sel.slice(0, 60)}"` : ' — Selecciona texto primeiro'}`)
    setBubble(b => ({ ...b, visible: false }))
  }, [])

  const applyStyle = useCallback((tag: string) => {
    setActiveStyle(tag)
    const blockTag = tag === 'p' ? 'p' : tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : tag === 'h3' ? 'h3' : 'blockquote'
    document.execCommand('formatBlock', false, blockTag)
    editorRef.current?.focus()
  }, [])

  const onEditorInput = useCallback(() => {
    const ed = editorRef.current
    if (!ed) return
    const text = ed.innerText || ''
    const words = text.trim().split(/\s+/).filter(w => w.length > 0)
    setWordCount(words.length)
    setCharInfo(`${text.split('\n').length} LINHAS · ${text.length} CARACTERES`)
    if (text.trim() === '') {
      ed.dataset.empty = 'true'
    } else {
      ed.dataset.empty = 'false'
    }
  }, [])

  const onTextSelect = useCallback(() => {
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const page = pageRef.current?.getBoundingClientRect()
      if (!page) return
      let x = rect.left - page.left
      let y = rect.top - page.top - 52
      if (y < 4) y = rect.bottom - page.top + 6
      setBubble({ x: Math.max(0, x), y: Math.max(4, y), visible: true })
    } else {
      setBubble(b => ({ ...b, visible: false }))
    }
  }, [])

  const changeZoom = useCallback((delta: number) => {
    setZoom(z => Math.min(200, Math.max(25, z + delta)))
  }, [])

  const barZoom = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = e.currentTarget
    const pct = e.nativeEvent.offsetX / bar.offsetWidth
    setZoom(Math.round(25 + pct * 175))
  }, [])

  const zoomPct = (zoom - 25) / 175

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setBubble(b => ({ ...b, visible: false }))
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className={styles.editorRoot}>
      {/* HEADER BAR */}
      <div className={styles.headerBar}>
        <div className={styles.logoIcon}>∂</div>
        <div>
          <div className={styles.logoText}>Muneri</div>
          <div className={styles.logoSub}>Markdown para Word com equações nativas</div>
        </div>
        <div className={styles.headerSpacer} />
        <div className={styles.modeBtns}>
          <button
            className={`${styles.modeBtn} ${mode === 'trabalho' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('trabalho')}
          >TRABALHO</button>
          <button
            className={`${styles.modeBtn} ${mode === 'tcc' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('tcc')}
          >TCC</button>
          <button
            className={`${styles.modeBtn} ${styles.modeBtnIa} ${mode === 'ia' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('ia')}
          >IA</button>
        </div>
        <div className={styles.headerSep} />
        <button className={styles.iconBtn} title="Desfazer">↶</button>
        <button className={styles.iconBtn} title="Refazer">↷</button>
        <div className={styles.headerSep} />
        <span className={styles.latexLabel}>LATEX → OMML</span>
        <div className={styles.statusDot} />
        <div className={styles.headerSep} />
        <button className={styles.iconBtn} title="Configurações" onClick={() => alert('Configurações')}>⚙</button>
      </div>

      {/* TABS BAR */}
      <div className={styles.tabsBar}>
        {tabs.map((tab, i) => (
          <div
            key={tabKeys[i]}
            className={`${styles.tab} ${activeTab === tabKeys[i] ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tabKeys[i])}
          >{tab}</div>
        ))}
      </div>

      {/* RIBBON */}
      <div className={styles.ribbon}>
        {/* Clipboard */}
        <div className={styles.ribbonGroup}>
          <div className={styles.ribbonControls}>
            <div className={styles.ribbonCol} style={{ gap: 4 }}>
              <button className={`${styles.rBtn} ${styles.rBtnBig}`} title="Colar">
                <span className={styles.rIcon}>📋</span>
                <span className={styles.rLabel}>Colar</span>
              </button>
            </div>
            <div className={styles.ribbonCol}>
              <button className={styles.rBtn} style={{ fontSize: 10 }} title="Cortar">✂ Cortar</button>
              <button className={styles.rBtn} style={{ fontSize: 10 }} title="Copiar">📄 Copiar</button>
              <button className={styles.rBtn} style={{ fontSize: 10 }} title="Colar Dentro">↓ Colar Entr.</button>
            </div>
          </div>
          <div className={styles.ribbonLabel}>Clipboardo</div>
        </div>

        {/* Font */}
        <div className={styles.ribbonGroup} style={{ minWidth: 260 }}>
          <div className={styles.ribbonControls} style={{ flexWrap: 'wrap', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%' }}>
              <select className={styles.fontSelect}>
                <option>Times New Roman</option>
                <option>Arial</option>
                <option>Calibri</option>
                <option>Georgia</option>
                <option>Courier New</option>
              </select>
              <input className={styles.sizeInput} type="number" defaultValue={12} min={8} max={72} />
              <button className={styles.rBtn} title="Aumentar fonte">A↑</button>
              <button className={styles.rBtn} title="Diminuir fonte">A↓</button>
              <button className={styles.rBtn} title="Limpar formatação" style={{ fontSize: 11 }}>⌫</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button className={`${styles.rBtn} ${fmtState.bold ? styles.rBtnActive : ''}`} onClick={() => toggleFmt('bold')} style={{ fontWeight: 700, minWidth: 26 }}>B</button>
              <button className={`${styles.rBtn} ${fmtState.italic ? styles.rBtnActive : ''}`} onClick={() => toggleFmt('italic')} style={{ fontStyle: 'italic', minWidth: 26 }}>I</button>
              <button className={`${styles.rBtn} ${fmtState.ul ? styles.rBtnActive : ''}`} onClick={() => toggleFmt('ul')} style={{ textDecoration: 'underline', minWidth: 26 }}>U</button>
              <button className={styles.rBtn} style={{ minWidth: 26 }} title="Tachado"><s>S</s></button>
              <button className={styles.rBtn} style={{ fontSize: 9, minWidth: 26 }} title="Subscrito">X₂</button>
              <button className={styles.rBtn} style={{ fontSize: 9, minWidth: 26 }} title="Sobrescrito">X²</button>
              <div className={styles.ribbonSep} />
              <button className={styles.rBtn} style={{ minWidth: 24 }} title="Cor do texto"><span style={{ borderBottom: '2px solid #e74c3c', paddingBottom: 1 }}>A</span></button>
              <button className={styles.rBtn} style={{ minWidth: 24 }} title="Realce"><span style={{ background: '#f1c40f', padding: '0 2px' }}>A</span></button>
            </div>
          </div>
          <div className={styles.ribbonLabel}>Fonta</div>
        </div>

        {/* Paragraph */}
        <div className={styles.ribbonGroup} style={{ minWidth: 120 }}>
          <div className={styles.ribbonControls} style={{ flexWrap: 'wrap', gap: 2 }}>
            <div style={{ display: 'flex', gap: 2, width: '100%' }}>
              <button className={styles.rBtn} title="Lista bullets">≡•</button>
              <button className={styles.rBtn} title="Lista numerada">≡1</button>
              <button className={styles.rBtn} title="Recuar">⇤</button>
              <button className={styles.rBtn} title="Avançar">⇥</button>
              <button className={styles.rBtn} title="Ordenar">↕A</button>
              <button className={styles.rBtn} title="Mostrar marcas">¶</button>
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              <button className={`${styles.rBtn} ${styles.rBtnActive}`} title="Alinhar esquerda">⬛◻◻</button>
              <button className={styles.rBtn} title="Centrar">◻⬛◻</button>
              <button className={styles.rBtn} title="Direita">◻◻⬛</button>
              <button className={styles.rBtn} title="Justificar">▬▬▬</button>
              <button className={styles.rBtn} style={{ fontSize: 9 }} title="Espaçamento linhas">↕↕</button>
              <button className={styles.rBtn} title="Sombreamento">🎨</button>
            </div>
          </div>
          <div className={styles.ribbonLabel}>Parágrafo</div>
        </div>

        {/* Styles */}
        <div className={styles.ribbonGroup} style={{ minWidth: 160 }}>
          <div className={styles.ribbonControls} style={{ gap: 3, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 3, width: '100%', alignItems: 'center' }}>
              <button className={`${styles.rBtn} ${styles.rBtnActive}`} style={{ fontSize: 14, fontWeight: 700, minWidth: 64, padding: '4px 8px' }} title="Estilo Título 1">Título 1</button>
              <div className={styles.ribbonCol} style={{ gap: 2 }}>
                <button className={styles.rBtn} style={{ fontSize: 11, minWidth: 72 }} title="Subtítulo">AaBbCc</button>
                <button className={styles.rBtn} style={{ fontSize: 11, minWidth: 72 }} title="Normal">AaBbCc</button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
              <button className={`${styles.rBtn} ${styles.ftBtn}`} onClick={() => setShowStylesPanel(s => !s)} style={{ fontSize: 10, padding: '2px 8px' }}>Estilos ▾</button>
              <button className={`${styles.rBtn} ${styles.ftBtn}`} style={{ fontSize: 10, padding: '2px 8px' }}>Importar</button>
              <button className={`${styles.rBtn} ${styles.ftBtn}`} style={{ fontSize: 10, padding: '2px 8px' }}>Avançado</button>
            </div>
          </div>
          <div className={styles.ribbonLabel}>Estilos</div>
        </div>

        {/* Tables */}
        <div className={styles.ribbonGroup} style={{ minWidth: 80 }}>
          <div className={styles.ribbonControls} style={{ flexDirection: 'column', gap: 4 }}>
            <button className={`${styles.rBtn} ${styles.rBtnBig}`} title="Cabeçalho e Rodapé">
              <span className={styles.rIcon} style={{ fontSize: 16 }}>📄</span>
              <span className={styles.rLabel}>Cabeçalho e Rodapé</span>
            </button>
          </div>
          <div className={styles.ribbonLabel}>Tabelas</div>
        </div>

        {/* Equations */}
        <div className={styles.ribbonGroup} style={{ minWidth: 60 }}>
          <div className={styles.ribbonControls} style={{ flexDirection: 'column', gap: 4 }}>
            <button className={`${styles.rBtn} ${styles.rBtnBig}`} title="Equações">
              <span className={styles.rIcon} style={{ fontSize: 16 }}>π</span>
              <span className={styles.rLabel}>Equações</span>
            </button>
          </div>
          <div className={styles.ribbonLabel}>Equações</div>
        </div>

        {/* Symbols */}
        <div className={styles.ribbonGroup} style={{ border: 'none', minWidth: 50 }}>
          <div className={styles.ribbonControls} style={{ flexDirection: 'column', gap: 4 }}>
            <button className={`${styles.rBtn} ${styles.rBtnBig}`} title="Símbolos">
              <span className={styles.rIcon} style={{ fontSize: 16 }}>Ω</span>
              <span className={styles.rLabel}>Símbolos</span>
            </button>
          </div>
          <div className={styles.ribbonLabel}>Símbolos</div>
        </div>
      </div>

      {/* FILE TOOL BAR */}
      <div className={styles.filetoolBar}>
        <div className={styles.logoIcon} style={{ width: 22, height: 22, fontSize: 11, flexShrink: 0 }}>∂</div>
        <div className={styles.fnameWrap}>
          <input
            className={styles.fnameInput}
            type="text"
            value={fileName}
            onChange={e => setFileName(e.target.value)}
          />
          <span className={styles.fnameExt}>.docx</span>
        </div>
        <button className={styles.ftBtn} onClick={() => alert('Importar ficheiro .md ou .txt')}>IMPORTAR</button>
        <button className={styles.ftBtn} onClick={() => setShowAdvanced(s => !s)}>AVANÇADO</button>
        <button className={styles.ftBtn} onClick={() => alert('Pré-visualização DOCX')}>PRÉ-VISUALIZAÇÃO</button>
        {showAdvanced && (
          <div className={styles.rawModeIndicator}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#000', fontWeight: 700 }}>MODO AVANÇADO ACTIVO</span>
          </div>
        )}
      </div>

      {/* WORKSPACE */}
      <div className={styles.workspace}>
        <div className={styles.leftGutter}>
          <div className={styles.vRule} />
        </div>

        <div className={styles.docArea}>
          {/* Ruler */}
          <div className={styles.ruler}>
            {[
              { pos: 40, label: '-2' }, { pos: 56, tick: 5 }, { pos: 72, label: '-1' }, { pos: 88, tick: 5 },
              { pos: 104, label: '0' }, { pos: 128, tick: 5 }, { pos: 152, label: '1' }, { pos: 168, tick: 4 },
              { pos: 192, label: '2' }, { pos: 216, tick: 4 }, { pos: 240, label: '3' }, { pos: 264, tick: 4 },
              { pos: 288, label: '4' }, { pos: 312, tick: 4 }, { pos: 340, label: '5' }, { pos: 360, tick: 4 },
              { pos: 384, label: '6' }, { pos: 408, tick: 4 }, { pos: 432, label: '7' }, { pos: 456, tick: 4 },
              { pos: 480, label: '8' }, { pos: 504, tick: 4 }, { pos: 528, label: '9' }, { pos: 552, tick: 4 },
              { pos: 576, label: '10' },
            ].map((m, i) =>
              'label' in m && m.label
                ? <span key={i} className={styles.rulerMark} style={{ left: m.pos }}>{m.label}</span>
                : <span key={i} className={styles.rulerTick} style={{ left: m.pos, height: m.tick }} />
            )}
          </div>

          {/* Page */}
          <div
            className={styles.page}
            ref={pageRef}
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            <div
              ref={editorRef}
              className={styles.pageContent}
              contentEditable={viewMode === 'edit' ? true : false}
              suppressContentEditableWarning
              spellCheck
              data-empty="true"
              data-placeholder="Página em branco"
              onInput={onEditorInput}
              onMouseUp={onTextSelect}
              onKeyUp={onTextSelect}
              style={{ caretColor: '#555', color: viewMode === 'read' ? '#222' : '#111' }}
            />
            <div className={styles.pageNumber}>1</div>

            {/* Bubble menu */}
            <div
              ref={bubbleRef}
              className={styles.bubbleMenu}
              style={{ display: bubble.visible ? 'flex' : 'none', top: bubble.y, left: bubble.x }}
            >
              <button className={styles.bBtn} onClick={() => execFmt('cut')}>✂ Cortar</button>
              <button className={styles.bBtn} onClick={() => execFmt('copy')}>📄 Copiar</button>
              <button className={styles.bBtn} onClick={() => execFmt('selectAll')}>⊡ Selec. tudo</button>
              <button className={styles.bBtn} onClick={() => execFmt('paste')}>📋 Colar</button>
              <div className={styles.bSep} />
              <button className={`${styles.bBtn} ${styles.bBtnAi}`} onClick={() => callAI('improve')}>✦ Melhorar</button>
              <button className={styles.bBtn} onClick={() => callAI('summarize')}>↕ Resumir</button>
              <button className={styles.bBtn} onClick={() => callAI('formalize')}>≡ Formalizar</button>
              <button className={styles.bBtn} onClick={() => callAI('expand')}>↔ Expandir</button>
              <button className={styles.bBtn} onClick={() => callAI('correct')}>✓ Corrigir</button>
            </div>
          </div>
        </div>

        {/* RIGHT PANELS */}
        <div className={styles.rightPanels}>
          {/* Styles Panel */}
          {showStylesPanel && (
            <div>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Estilos</span>
                <button className={styles.panelClose} onClick={() => setShowStylesPanel(false)}>×</button>
              </div>
              <div className={styles.panelBody}>
                {[
                  { tag: 'h1', label: 'Título 1', key: 'T↓', style: { fontWeight: 700, fontSize: 13 } },
                  { tag: 'blockquote', label: 'Citação', key: 'Ta', style: { fontStyle: 'italic' } },
                  { tag: 'h2', label: 'Subtítulo', key: 'Ta', style: { fontSize: 12, color: '#aaa' } },
                  { tag: 'h3', label: 'Sent Subtítulo', key: 'Ta', style: { fontSize: 11, color: '#888' } },
                  { tag: 'p', label: 'Normal', key: '—', style: {} },
                ].map(s => (
                  <div
                    key={s.tag}
                    className={`${styles.styleItem} ${activeStyle === s.tag ? styles.styleItemActive : ''}`}
                    style={{ marginTop: 2 }}
                    onClick={() => applyStyle(s.tag)}
                  >
                    <span className={styles.styleName} style={s.style}>{s.label}</span>
                    <span className={`${styles.styleKey} ${activeStyle === s.tag ? styles.styleKeyActive : ''}`}>{s.key}</span>
                  </div>
                ))}
                <div className={styles.panelDivider} />
                <button className={styles.panelImportBtn}>IMPORTAR</button>
                <button className={styles.panelAdvBtn}>AVANÇADO</button>
              </div>
            </div>
          )}

          {/* Work Panel */}
          {mode === 'trabalho' && (
            <div className={styles.workPanel}>
              <div className={styles.panelHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>📚</span>
                  <span className={styles.panelTitle} style={{ color: 'var(--teal)' }}>Trabalho Escolar</span>
                </div>
                <button className={styles.panelClose} onClick={() => setMode('tcc')}>×</button>
              </div>
              <div className={styles.panelBody} style={{ padding: '16px 12px', textAlign: 'center' }}>
                <div className={styles.workIcon}>📚</div>
                <div className={styles.workDesc}>
                  Copiloto para trabalhos do ensino secundário e médio.<br />
                  Gera e desenvolve cada secção —{' '}
                  <strong style={{ color: 'var(--teal)' }}>com base nas tuas fontes.</strong>
                </div>
                <button className={styles.workStartBtn} onClick={() => alert('Modo Trabalho Escolar — integração futura')}>
                  Iniciar trabalho
                </button>
              </div>
            </div>
          )}

          {/* TCC Panel */}
          {mode === 'tcc' && (
            <div className={styles.workPanel}>
              <div className={styles.panelHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16 }}>📝</span>
                  <span className={styles.panelTitle}>Modo TCC</span>
                </div>
                <button className={styles.panelClose} onClick={() => setMode('trabalho')}>×</button>
              </div>
              <div className={styles.panelBody} style={{ padding: '16px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📝</div>
                <div className={styles.workDesc}>
                  Acompanha-te do esboço à conclusão, secção a secção.<br />
                  <strong style={{ color: 'var(--teal)' }}>Compressão de contexto automática.</strong>
                </div>
                <button className={styles.workStartBtn} style={{ background: 'linear-gradient(135deg,var(--green),#4a7c59)' }} onClick={() => alert('Modo TCC — integração futura')}>
                  Iniciar TCC
                </button>
              </div>
            </div>
          )}

          {/* IA Panel */}
          {mode === 'ia' && (
            <div className={styles.workPanel}>
              <div className={styles.panelHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--gold2)', fontSize: 14 }}>✦</span>
                  <span className={styles.panelTitle} style={{ color: 'var(--gold2)' }}>IA · Matemática</span>
                </div>
                <button className={styles.panelClose} onClick={() => setMode('tcc')}>×</button>
              </div>
              <div className={styles.panelBody} style={{ padding: '16px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
                <div className={styles.workDesc}>
                  Descreve o conteúdo que queres gerar.<br />
                  <strong style={{ color: 'var(--teal)' }}>Equações LaTeX prontas para Word.</strong>
                </div>
                <textarea
                  placeholder="Gera exercícios sobre equações do 2.º grau…"
                  className={styles.iaTextarea}
                />
                <button className={styles.iaSendBtn} onClick={() => alert('Chat IA — integração futura')}>↑ Enviar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STATUS BAR */}
      <div className={styles.statusBar}>
        <span className={styles.stat}>Página <span>1</span> de <span>1</span></span>
        <div className={styles.statSep} />
        <span className={styles.stat}>Palavras: <span>{wordCount}</span></span>
        <div className={styles.statSep} />
        <span className={styles.stat}>Idioma: Português</span>
        <div className={styles.statSep} />
        <span className={styles.stat}>{charInfo}</span>
        <div className={styles.statusSpacer} />
        {(['read', 'edit', 'web'] as ViewMode[]).map(v => (
          <button
            key={v}
            className={`${styles.viewBtn} ${viewMode === v ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode(v)}
          >
            {v === 'read' ? 'Modo Leitura' : v === 'edit' ? 'Edição' : 'Web'}
          </button>
        ))}
        <div className={styles.statSep} />
        <div className={styles.zoomCtrl}>
          <button className={styles.zoomBtn} onClick={() => changeZoom(-10)}>−</button>
          <div className={styles.zoomBar} onClick={barZoom}>
            <div className={styles.zoomFill} style={{ width: `${zoomPct * 100}%` }} />
            <div className={styles.zoomThumb} style={{ left: `${zoomPct * 100}%` }} />
          </div>
          <button className={styles.zoomBtn} onClick={() => changeZoom(10)}>+</button>
          <span className={styles.zoomVal}>{zoom}%</span>
        </div>
        <button className={styles.exportBtn} onClick={() => alert(`Exportar ${fileName}.docx`)}>
          <span style={{ fontSize: 11 }}>↗</span>
          Exportar <span>{fileName}</span>
        </button>
      </div>
    </div>
  )
}
