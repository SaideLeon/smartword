'use client';

import { useCallback, useMemo, useState } from 'react';
import styles from './MuneriEditor.module.css';
import { useDocumentEditor } from '@/hooks/useDocumentEditor';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEditorActions, useEditorMeta, usePanelActions, useSidePanel } from '@/hooks/useEditorStore';
import { RichEditor } from '@/components/RichEditor';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { DocumentPreview } from '@/components/DocumentPreview';
import { TccPanel } from '@/components/TccPanel';
import { WorkPanel } from '@/components/WorkPanel';
import { AiChatDrawer } from '@/components/AiChatDrawer';

export default function MuneriEditor() {
  const {
    markdown,
    previewMarkdown,
    setMarkdown,
    filename,
    setFilename,
    loading,
    exportDocx,
    importTextFile,
    clearDefaultMarkdown,
    setFilenameFromTopic,
  } = useDocumentEditor();

  const sidePanel = useSidePanel();
  const { togglePanel, closePanel } = usePanelActions();
  const { canRedo, canUndo } = useEditorMeta();
  const { redo, undo } = useEditorActions();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState('inicio');
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const tabs = ['PÁGINA INICIAL', 'INSERIR', 'DESIGN', 'LAYOUT DA PÁGINA', 'REFERÊNCIAS', 'REVISÃO'];
  const tabKeys = ['inicio', 'inserir', 'design', 'layout', 'refs', 'revisao'];

  const wordCount = useMemo(() => {
    const words = markdown.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [markdown]);

  const charInfo = useMemo(() => {
    const lines = markdown ? markdown.split('\n').length : 0;
    return `${lines} LINHAS · ${markdown.length} CARACTERES`;
  }, [markdown]);

  const handleInsert = useCallback(
    (text: string) => {
      setMarkdown((prev) => (prev ? `${prev}\n\n${text}` : text));
    },
    [setMarkdown],
  );

  const handleReplace = useCallback(
    (text: string) => {
      setMarkdown(text);
    },
    [setMarkdown],
  );

  const activatePanel = useCallback(
    (panel: 'tcc' | 'work' | 'chat') => {
      clearDefaultMarkdown();
      togglePanel(panel);
    },
    [clearDefaultMarkdown, togglePanel],
  );

  const handleImportClick = useCallback(() => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.md,.txt,text/markdown,text/plain';
    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (file) {
        void importTextFile(file);
      }
    };
    fileInput.click();
  }, [importTextFile]);

  return (
    <div className={styles.editorRoot}>
      <div className={styles.headerBar}>
        <div className={styles.logoIcon}>∂</div>
        <div>
          <div className={styles.logoText}>Muneri</div>
          <div className={styles.logoSub}>Markdown para Word com equações nativas</div>
        </div>
        <div className={styles.headerSpacer} />
        <div className={styles.modeBtns}>
          <button
            className={`${styles.modeBtn} ${sidePanel === 'work' ? styles.modeBtnActive : ''}`}
            onClick={() => activatePanel('work')}
          >
            TRABALHO
          </button>
          <button
            className={`${styles.modeBtn} ${sidePanel === 'tcc' ? styles.modeBtnActive : ''}`}
            onClick={() => activatePanel('tcc')}
          >
            TCC
          </button>
          <button
            className={`${styles.modeBtn} ${styles.modeBtnIa} ${sidePanel === 'chat' ? styles.modeBtnActive : ''}`}
            onClick={() => activatePanel('chat')}
          >
            IA
          </button>
        </div>
        <div className={styles.headerSep} />
        <button className={styles.iconBtn} title="Desfazer" onClick={undo} disabled={!canUndo}>
          ↶
        </button>
        <button className={styles.iconBtn} title="Refazer" onClick={redo} disabled={!canRedo}>
          ↷
        </button>
      </div>

      <div className={styles.tabsBar}>
        {tabs.map((tab, i) => (
          <div
            key={tabKeys[i]}
            className={`${styles.tab} ${activeTab === tabKeys[i] ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tabKeys[i])}
          >
            {tab}
          </div>
        ))}
      </div>

      <div className={styles.ribbon}>
        <div className={styles.ribbonGroup}>
          <div className={styles.ribbonControls}>
            <button className={styles.ftBtn} onClick={handleImportClick}>
              IMPORTAR
            </button>
            <button className={styles.ftBtn} onClick={() => setShowRawMarkdown((v) => !v)}>
              {showRawMarkdown ? 'OCULTAR RAW' : 'RAW'}
            </button>
            <button className={styles.ftBtn} onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? 'OCULTAR PREVIEW' : 'PRÉ-VISUALIZAÇÃO'}
            </button>
          </div>
          <div className={styles.ribbonLabel}>Ferramentas</div>
        </div>
      </div>

      <div className={styles.filetoolBar}>
        <div className={styles.logoIcon} style={{ width: 22, height: 22, fontSize: 11, flexShrink: 0 }}>
          ∂
        </div>
        <div className={styles.fnameWrap}>
          <input
            className={styles.fnameInput}
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
          <span className={styles.fnameExt}>.docx</span>
        </div>
        <button className={styles.ftBtn} onClick={() => exportDocx()} disabled={loading}>
          {loading ? 'A EXPORTAR...' : 'EXPORTAR'}
        </button>
      </div>

      <div className={styles.workspace}>
        <div className={styles.leftGutter}>
          <div className={styles.vRule} />
        </div>

        <div className={styles.docArea}>
          <div className={styles.page} style={{ width: '100%', minHeight: '100%', padding: 16 }}>
            <RichEditor value={markdown} onChange={setMarkdown} isMobile={isMobile} shellless />
            {showRawMarkdown && <MarkdownEditor value={markdown} onChange={setMarkdown} isMobile={isMobile} />}
            {showPreview && (
              <div style={{ marginTop: 12 }}>
                <DocumentPreview markdown={previewMarkdown} originalMarkdown={markdown} isMobile={isMobile} />
              </div>
            )}
          </div>
        </div>

        {!isMobile && sidePanel !== 'none' && sidePanel !== 'chat' && (
          <div className={styles.rightPanels}>
            {sidePanel === 'tcc' && (
              <div className={styles.workPanel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Modo TCC</span>
                  <button className={styles.panelClose} onClick={closePanel}>
                    ×
                  </button>
                </div>
                <TccPanel
                  onInsert={handleInsert}
                  onTopicChange={setFilenameFromTopic}
                  onClose={closePanel}
                  isMobile={isMobile}
                  editorMarkdown={markdown}
                />
              </div>
            )}
            {sidePanel === 'work' && (
              <div className={styles.workPanel}>
                <div className={styles.panelHeader}>
                  <span className={styles.panelTitle}>Trabalho Escolar</span>
                  <button className={styles.panelClose} onClick={closePanel}>
                    ×
                  </button>
                </div>
                <WorkPanel
                  onInsert={handleInsert}
                  onTopicChange={setFilenameFromTopic}
                  onClose={closePanel}
                  isMobile={isMobile}
                  editorMarkdown={markdown}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.statusBar}>
        <span className={styles.stat}>
          Palavras: <span>{wordCount}</span>
        </span>
        <div className={styles.statSep} />
        <span className={styles.stat}>{charInfo}</span>
        <div className={styles.statusSpacer} />
        <button className={styles.exportBtn} onClick={() => exportDocx()} disabled={loading}>
          <span style={{ fontSize: 11 }}>↗</span>
          {loading ? 'A exportar...' : `Exportar ${filename}`}
        </button>
      </div>

      <AiChatDrawer
        open={sidePanel === 'chat'}
        onClose={closePanel}
        onInsert={handleInsert}
        onReplace={handleReplace}
        isMobile={isMobile}
      />
    </div>
  );
}
