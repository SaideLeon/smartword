// ─────────────────────────────────────────────────────────────────────────────
// PATCH para src/components/WorkPanel.tsx
//
// Alterações necessárias — copiar/substituir os trechos indicados.
//
// 1. Estado workType
// 2. Seletor de tipo de trabalho no step='topic_input'
// 3. normalizeTitleForMatch: suportar prefixo numérico de 3 níveis
// 4. buildSectionMarkdown: heading #### para nível 4
// 5. buildReconstructedContent: heading #### para nível 4
// 6. submitTopic: passar workType ao criar sessão e ao gerar esboço
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Adicionar ao bloco de useState no início do componente WorkPanel ───────

// const [workType, setWorkType] = useState<'academic' | 'project'>('academic');

// ── 2. Substituir normalizeTitleForMatch ──────────────────────────────────────

function normalizeTitleForMatch(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Prefixo romano
    .replace(/^[ivxlcdm]+\.\s*/i, '')
    // Prefixo numérico 3 níveis: 1.1.1.
    .replace(/^\d+\.\d+\.\d+\.?\s*/, '')
    // Prefixo numérico 2 níveis: 1.1.
    .replace(/^\d+\.\d+\.?\s*/, '')
    // Prefixo numérico simples: 1.
    .replace(/^\d+\.?\s*/, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── 3. Substituir buildSectionMarkdown ────────────────────────────────────────
//
// Detecta 3 níveis de subsecção:
//   título com "N.N.N" → ####
//   título com "N.N"   → ###
//   caso contrário     → ##

function getSectionHeading(title: string): '##' | '###' | '####' {
  if (/^\d+\.\d+\.\d+/.test(title)) return '####';
  if (/^\d+\.\d+/.test(title))      return '###';
  return '##';
}

function buildSectionMarkdown(
  title: string,
  content: string,
  isFirstInEditor: boolean,
  parentTitle?: string | null,
): string {
  const heading = getSectionHeading(title);
  const titleAlreadyPresent = contentStartsWithTitle(content, title);
  const body = titleAlreadyPresent ? content : `${heading} ${title}\n\n${content}`;

  if (heading === '####' || heading === '###') {
    if (parentTitle) {
      // Descobrir o heading adequado para o parent
      const parentHeading = getSectionHeading(parentTitle);
      const fullBlock = `${parentHeading} ${parentTitle}\n\n${body}`;
      return isFirstInEditor ? fullBlock : `{pagebreak}\n\n${fullBlock}`;
    }
    return body;
  }

  // ## (secção principal)
  return isFirstInEditor ? body : `{pagebreak}\n\n${body}`;
}

// ── 4. Substituir getParentTitleFromOutline para suportar ### e ## ────────────

function getParentTitleFromOutline(outline: string, parentKey: string): string | null {
  // parentKey pode ser "1" (para ### 1.1) ou "1.1" (para #### 1.1.1)
  const isThreeLevel = /^\d+\.\d+$/.test(parentKey);

  for (const line of outline.split('\n')) {
    if (isThreeLevel) {
      // Procura ### 1.1 Título
      const match = line.match(/^###\s+(\d+\.\d+)\.?\s+(.+)/);
      if (match && match[1] === parentKey) return `${match[1]} ${match[2].trim()}`;
    } else {
      // Procura ## 1. Título ou ## I. Título
      const match = line.match(/^##\s+(\d+)\.?\s+(.+)/);
      if (match && match[1] === parentKey) return `${match[1]}. ${match[2].trim()}`;
    }
  }
  return null;
}

// ── 5. Substituir buildReconstructedContent ───────────────────────────────────

function buildReconstructedContent(sections: WorkSection[], outline: string | null): string {
  const sorted = [...sections].filter(s => s.content.trim()).sort((a, b) => a.index - b.index);
  const parts: string[] = [];
  const insertedParentKeys = new Set<string>();

  for (const section of sorted) {
    const heading = getSectionHeading(section.title);
    const hasHeading = contentStartsWithTitle(section.content, section.title);
    const body = hasHeading ? section.content : `${heading} ${section.title}\n\n${section.content}`;

    if ((heading === '###' || heading === '####') && outline) {
      // Determinar a chave do parent
      const threeLevel = section.title.match(/^(\d+\.\d+)\.\d+/);
      const twoLevel   = section.title.match(/^(\d+)\.\d+/);

      if (threeLevel) {
        // #### → parent é ### (chave "N.N")
        const parentKey = threeLevel[1];
        if (!insertedParentKeys.has(parentKey)) {
          const parentTitle = getParentTitleFromOutline(outline, parentKey);
          if (parentTitle) {
            parts.push(parts.length === 0 ? `### ${parentTitle}` : `{pagebreak}\n\n### ${parentTitle}`);
            insertedParentKeys.add(parentKey);
          }
        }
        parts.push(body);
        continue;
      }

      if (twoLevel) {
        // ### → parent é ## (chave "N")
        const parentKey = twoLevel[1];
        if (!insertedParentKeys.has(parentKey)) {
          const parentTitle = getParentTitleFromOutline(outline, parentKey);
          if (parentTitle) {
            parts.push(parts.length === 0 ? `## ${parentTitle}` : `{pagebreak}\n\n## ${parentTitle}`);
            insertedParentKeys.add(parentKey);
          }
        }
        parts.push(body);
        continue;
      }
    }

    parts.push(parts.length === 0 ? body : `{pagebreak}\n\n${body}`);
  }

  const bodyText = parts.join('\n\n');
  return bodyText ? `{toc}\n\n${bodyText}` : bodyText;
}

// ── 6. Seletor de tipo de trabalho — JSX para o step='topic_input' ────────────
//
// Inserir logo ANTES do <textarea> de topicInput, dentro do div do step topic_input.
// Requer que existas 'workType' e 'setWorkType' no estado do componente.

const WorkTypeSelectorJSX = `
<div className="flex gap-2">
  <button
    type="button"
    onClick={() => setWorkType('academic')}
    className={\`flex-1 rounded border px-3 py-2 font-mono text-xs transition-all \${
      workType === 'academic'
        ? 'border-[var(--panel-accent)] bg-[var(--panel-accent-dim)] text-[var(--panel-accent)]'
        : 'border-[var(--panel-border)] bg-[var(--panel-surface)] text-[var(--panel-text-dim)]'
    }\`}
  >
    📚 Trabalho Escolar
  </button>
  <button
    type="button"
    onClick={() => setWorkType('project')}
    className={\`flex-1 rounded border px-3 py-2 font-mono text-xs transition-all \${
      workType === 'project'
        ? 'border-[var(--panel-accent)] bg-[var(--panel-accent-dim)] text-[var(--panel-accent)]'
        : 'border-[var(--panel-border)] bg-[var(--panel-surface)] text-[var(--panel-text-dim)]'
    }\`}
  >
    💼 Projecto Empresarial
  </button>
</div>
`;

// ── 7. handleTopicSubmit — passar workType ────────────────────────────────────
//
// No hook useWorkSession, o submitTopic deve receber workType.
// Alteração em useWorkSession.ts:
//
//   submitTopic(topic: string, workType: WorkType = 'academic')
//     → POST /api/work/session com { topic, workType }
//     → POST /api/work/generate com { ..., workType }
//
// No WorkPanel, substituir:
//   submitTopic(topic)
// Por:
//   submitTopic(topic, workType)
