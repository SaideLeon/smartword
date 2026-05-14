function firstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? cleaned).trim();
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function cleanObjectivesSection(content: string): string {
  const lines = content.split('\n');
  let inGeneral = false;
  let inSpecific = false;
  const specific: string[] = [];
  let generalRaw = '';

  for (const raw of lines) {
    const line = raw.trim();
    if (/^#{1,6}\s*1\.1\.1\s+objetivo\s+geral/i.test(line) || /^#{1,6}\s*objetivo\s+geral/i.test(line)) {
      inGeneral = true;
      inSpecific = false;
      continue;
    }
    if (/^#{1,6}\s*1\.1\.2\s+objetivos?\s+espec/i.test(line) || /^#{1,6}\s*objetivos?\s+espec/i.test(line)) {
      inGeneral = false;
      inSpecific = true;
      continue;
    }

    if (inGeneral && line) generalRaw += `${line} `;
    if (inSpecific && /^[-*•]/.test(line)) {
      const item = line.replace(/^[-*•]\s*/, '').split(/[.;:]/)[0].trim();
      if (item) specific.push(`- ${item};`);
    }
  }

  const general = firstSentence(generalRaw).split(/\s+/).slice(0, 40).join(' ');
  const bullets = specific.slice(0, 5);

  return `**1.1.1 Objetivo Geral**\n\n${general}\n\n**1.1.2 Objetivos Específicos**\n\n${bullets.join('\n')}`.trim();
}

export function cleanProblematizacao(content: string): string {
  const lines = content.split('\n');
  const problemChunks: string[] = [];
  const justLines: string[] = [];
  let inProblem = false;
  let inJust = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (/^#{1,6}\s*2\.1\s+problematiza/i.test(line) || /^#{1,6}\s*problematiza/i.test(line)) {
      inProblem = true;
      inJust = false;
      continue;
    }
    if (/^#{1,6}\s*2\.2\s+justificativa/i.test(line) || /^#{1,6}\s*justificativa/i.test(line)) {
      inProblem = false;
      inJust = true;
      continue;
    }

    if (inProblem && line && !/^[-*•]/.test(line)) problemChunks.push(line);
    if (inJust) justLines.push(raw);
  }

  const problem = firstSentence(problemChunks.join(' ')).split(/\s+/).slice(0, 35).join(' ');
  const justText = cleanJustificativa(justLines.join('\n'));

  return `**2.1 Problematização**\n\n${problem}\n\n**2.2 Justificativa**\n\n${justText}`.trim();
}

export function cleanJustificativa(content: string): string {
  const text = content
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

export function enforceSection(normalizedName: string, content: string): string {
  const name = normalizeName(normalizedName);
  if (name === 'objectivos' || name === 'objetivos') return cleanObjectivesSection(content);
  if (name === 'problematizacao' || name === 'problematização' || name === 'metodologia') return cleanProblematizacao(content);
  if (name === 'justificativa') return cleanJustificativa(content);
  return content;
}

export function deduplicateOutlineSections(outline: string): string {
  const lines = outline.split('\n');
  const lastIndex = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^#{2,4}\s+\d/.test(line)) {
      const key = line.toLowerCase();
      lastIndex.set(key, i);
    }
  }

  return lines
    .filter((line, i) => {
      const trimmed = line.trim();
      if (!/^#{2,4}\s+\d/.test(trimmed)) return true;
      return lastIndex.get(trimmed.toLowerCase()) === i;
    })
    .join('\n');
}
