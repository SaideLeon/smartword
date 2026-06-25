// lib/work/context-policy.ts
// Decide quando um trabalho escolar deve receber contexto moçambicano.
// A política evita transformar Moçambique num padrão universal do app:
// só aplica exemplos locais quando o tema realmente pede esse enquadramento.

export type WorkContextPolicy = 'mozambique' | 'universal' | 'project';

const MOZAMBIQUE_CONTEXT_SIGNALS = [
  'moçambique', 'mozambique', 'mocambique',
  'maputo', 'quelimane', 'nampula', 'beira', 'tete', 'inhambane',
  'niassa', 'sofala', 'manica', 'gaza', 'zambezia', 'zambézia',
  'africa', 'áfrica', 'africano', 'africana',
  'história de moçambique', 'geografia de moçambique',
  'sociedade moçambicana', 'economia moçambicana', 'cultura moçambicana',
  'legislação moçambicana', 'direito moçambicano',
  'mercado moçambicano', 'comunidade local', 'comunidades rurais',
  'desenvolvimento comunitário', 'desenvolvimento local',
  'saúde pública', 'educação em moçambique', 'ensino em moçambique',
  'agricultura familiar', 'economia informal', 'mercado informal',
  'colonialismo', 'descolonização', 'frelimo', 'renamo', 'guerra civil',
];

const UNIVERSAL_CONTEXT_SIGNALS = [
  'matemática', 'matematica', 'álgebra', 'algebra', 'monómio', 'monomio',
  'polinómio', 'polinomio', 'equação', 'equacao', 'função', 'funcao',
  'geometria', 'trigonometria', 'estatística', 'estatistica',
  'física', 'fisica', 'química', 'quimica', 'biologia',
  'programação', 'programacao', 'algoritmo', 'informática', 'informatica',
  'gramática', 'gramatica', 'classe gramatical', 'redação', 'redaccao',
  'literatura universal', 'filosofia geral', 'lógica', 'logica',
];

function normaliseForPolicy(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function countSignals(text: string, signals: string[]): number {
  return signals.filter(signal => text.includes(normaliseForPolicy(signal))).length;
}

export function detectWorkContextPolicy(topic: string, workType: 'academic' | 'project' = 'academic'): WorkContextPolicy {
  if (workType === 'project') return 'project';

  const text = normaliseForPolicy(topic);
  const mozambiqueScore = countSignals(text, MOZAMBIQUE_CONTEXT_SIGNALS);
  const universalScore = countSignals(text, UNIVERSAL_CONTEXT_SIGNALS);

  if (universalScore > 0 && mozambiqueScore === 0) return 'universal';
  if (mozambiqueScore > 0) return 'mozambique';

  return 'universal';
}

export function buildWorkContextPolicyInstruction(policy: WorkContextPolicy): string {
  switch (policy) {
    case 'mozambique':
      return `
AGENTE DE CONTEXTUALIZAÇÃO — MOÇAMBIQUE
=======================================
O tema tem âncora moçambicana, africana, social, económica, histórica, geográfica ou comunitária.
- Inclui contexto moçambicano quando isso ajudar a explicar o tema.
- Usa exemplos práticos ligados à realidade local apenas nas secções em que forem relevantes.
- Não transformes exemplos locais em desvio do tema central.`.trim();

    case 'project':
      return `
AGENTE DE CONTEXTUALIZAÇÃO — PROJECTO LOCAL
===========================================
Por ser um projecto empresarial/escolar, assume implementação em contexto moçambicano.
- Mantém valores em Metical Moçambicano (MT), localização e viabilidade local.
- Usa contexto moçambicano apenas para justificar mercado, localização, recursos, despesas, receitas e marketing.`.trim();

    case 'universal':
      return `
AGENTE DE CONTEXTUALIZAÇÃO — TEMA UNIVERSAL
===========================================
O tema não pede contexto geográfico específico.
- NÃO incluas contexto moçambicano por padrão.
- NÃO cries exemplos como "monómios em Moçambique", "matemática no quotidiano moçambicano" ou equivalentes artificiais.
- Para Matemática, Física, Química, Biologia, Programação, Gramática e outros temas técnicos/conceptuais, mantém explicações académicas universais, didácticas e focadas no conteúdo.
- Usa exemplos genéricos e directamente relacionados com o conceito apenas quando forem úteis.`.trim();
  }
}
