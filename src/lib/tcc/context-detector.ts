// lib/tcc/context-detector.ts
// Detecta o tipo de contextualização geográfica adequada para o TCC,
// evitando tanto o default silencioso para Portugal como a imposição
// artificial de contexto moçambicano em temas universais.

export type ContextType = 'mozambique' | 'universal' | 'comparative';

// Sinais que indicam que o tema é intrinsecamente moçambicano/africano
// ou que beneficia claramente de dados e exemplos locais.
const MOZAMBIQUE_SIGNALS: string[] = [
  'moçambique', 'mozambique', 'mocambique',
  'maputo', 'quelimane', 'nampula', 'beira', 'tete', 'inhambane',
  'niassa', 'sofala', 'manica', 'gaza', 'zambezia', 'zambézia',
  'africa', 'áfrica', 'africano', 'africana', 'subsariano', 'subsariana',
  'educação básica', 'ensino básico', 'ensino primário', 'ensino secundário',
  'comunidade local', 'comunidades rurais', 'zona rural',
  'saúde pública', 'sistema de saúde',
  'desenvolvimento social', 'desenvolvimento comunitário',
  'direito moçambicano', 'legislação moçambicana',
  'economia local', 'economia informal', 'mercado informal',
  'colonialismo', 'pós-colonial', 'descolonização',
  'frelimo', 'renamo', 'guerra civil',
  'pobreza', 'desigualdade social', 'exclusão social',
  'agricultura familiar', 'camponeses',
  'línguas bantu', 'língua materna',
];

// Sinais que indicam que o tema é universal/científico
// e forçar contexto geográfico seria artificial e prejudicial.
const UNIVERSAL_SIGNALS: string[] = [
  'matemática', 'matematica', 'cálculo', 'calculo', 'álgebra', 'algebra',
  'física', 'fisica', 'termodinâmica', 'termodinamica', 'mecânica', 'mecanica',
  'química', 'quimica', 'bioquímica', 'bioquimica',
  'programação', 'programacao', 'algoritmos', 'estrutura de dados',
  'inteligência artificial', 'machine learning', 'deep learning',
  'filosofia geral', 'epistemologia', 'ontologia', 'lógica formal',
  'literatura clássica', 'literatura universal',
  'genética', 'genetica', 'biologia molecular', 'microbiologia',
  'astronomia', 'astrofísica', 'cosmologia',
  'linguística formal', 'sintaxe', 'fonologia',
  'teoria dos jogos', 'teoria dos grafos',
];

/**
 * Determina o tipo de contextualização com base no tópico e esboço.
 *
 * - 'mozambique' → tema social/educacional/histórico com âncora local clara
 * - 'universal'  → tema científico/técnico onde contextualização geográfica seria artificial
 * - 'comparative' → caso ambíguo: instrução explícita para NÃO defaultar para Portugal
 *
 * A detecção ocorre UMA VEZ em /api/tcc/approve e o resultado é persistido
 * na sessão para evitar recalculação em cada chamada de develop.
 */
export function detectContextType(topic: string, outline: string): ContextType {
  const text = (topic + ' ' + outline)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ' ');

  const mozambiqueScore = MOZAMBIQUE_SIGNALS.filter(s => text.includes(s)).length;
  const universalScore  = UNIVERSAL_SIGNALS.filter(s => text.includes(s)).length;

  // Threshold conservador: pelo menos 2 sinais claros para classificar
  if (mozambiqueScore >= 2) return 'mozambique';
  if (universalScore  >= 2) return 'universal';

  // Caso ambíguo — mantém neutro mas proíbe explicitamente o default para Portugal
  return 'comparative';
}

/**
 * Retorna o bloco de instrução de contextualização para inserir no system prompt.
 */
export function buildContextInstruction(contextType: ContextType): string {
  switch (contextType) {
    case 'mozambique':
      return `
CONTEXTUALIZAÇÃO GEOGRÁFICA — MOÇAMBIQUE
=========================================
Este trabalho enquadra-se num contexto moçambicano e/ou africano.
- Usa dados, exemplos e referências de Moçambique ou da África Subsariana.
- Fontes prioritárias: UNESCO, INE Moçambique, MINED, Banco Mundial,
  UNICEF África, African Development Bank, investigadores africanos.
- Portugal pode aparecer APENAS em comparações explicitamente solicitadas
  pelo esboço ou pelo utilizador — nunca como referência padrão.
`.trim();

    case 'universal':
      return `
CONTEXTUALIZAÇÃO GEOGRÁFICA — TEMA UNIVERSAL
=============================================
Este trabalho aborda um tema científico/técnico sem âncora geográfica específica.
- Usa fontes internacionais de referência (IEEE, ACM, Springer, Nature, etc.).
- NÃO forces contexto geográfico onde seria artificial — prejudica a qualidade.
- Exemplos podem ser genéricos ou de contextos internacionalmente reconhecidos.
`.trim();

    case 'comparative':
      return `
CONTEXTUALIZAÇÃO GEOGRÁFICA — TEMA AMBÍGUO
==========================================
O tema admite múltiplos contextos geográficos.
- Quando deres exemplos concretos, prefere contextos africanos, internacionais
  ou globais em vez de europeus.
- NUNCA uses Portugal como referência geográfica padrão pelo simples facto de
  a língua ser o português — isso constitui um viés injustificado.
- Se o esboço indicar explicitamente um contexto geográfico, segue-o.
  Caso contrário, mantém a análise conceptual sem âncora regional forçada.
`.trim();
  }
}
