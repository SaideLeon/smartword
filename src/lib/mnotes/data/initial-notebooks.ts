import { Notebook } from '@/types/mnotes';

export const INITIAL_NOTEBOOKS: Notebook[] = [
  {
    id: 'bio-1',
    title: 'Fundamentos de Biologia Celular e Molecular',
    icon: '🧬',
    sources: [
      { id: 's1', name: 'Biologia_Celular.pdf', type: 'pdf', selected: true }
    ],
    lastModified: '19 de abr. de 2026',
    description: 'Estudo das estruturas celulares e processos moleculares.'
  },
  {
    id: 'mkt-1',
    title: 'Marketing Digital da Recheio Cash & Carry em Moçambique',
    icon: '🛒',
    sources: [
      { id: 's2', name: 'Trabalho_Redes_Sociais.pdf', type: 'pdf', selected: true }
    ],
    lastModified: '26 de abr. de 2026',
    description: 'Análise estratégica do uso de redes sociais pela Recheio Moçambique.'
  },
  {
    id: 'form-1',
    title: 'Manual de Concepção e Gestão da Formação',
    icon: '🎓',
    sources: [
      { id: 's3', name: 'Manual_Gestao.pdf', type: 'pdf', selected: true },
      { id: 's4', name: 'Curriculo_V1.pdf', type: 'pdf', selected: true }
    ],
    lastModified: '18 de abr. de 2026',
    description: 'Guia completo para desenvolvimento de programas de formação.'
  }
];
