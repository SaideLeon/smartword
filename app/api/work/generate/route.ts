import { NextResponse } from 'next/server';
import type { WorkConfig } from '@/hooks/useWorkSession';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

const TYPE_LABELS: Record<string, string> = {
  grupo: 'Trabalho de Investigação em Grupo',
  individual: 'Relatório Individual',
  resumo: 'Resumo / Síntese',
  campo: 'Trabalho de Campo',
};

function buildSystemPrompt(config: WorkConfig): string {
  const typeLabel = TYPE_LABELS[config.type] ?? config.type;

  const groupInstructions = config.type === 'grupo' ? `
GRUPOS E TEMAS:
- Gera ${config.numGroups} grupos com ${config.membersPerGroup} membros fictícios cada (nomes moçambicanos típicos)
- Para cada grupo, atribui um tema específico relacionado com o módulo/disciplina
- ${config.customTopics ? `Usa estes temas indicados: ${config.customTopics}` : 'Cria temas variados e complementares entre si'}
- Cada tema deve ter 3-4 sub-tópicos (iniciados com "- ")
` : '';

  const sectionsByType: Record<string, string[]> = {
    grupo: ['Capa e Contra-capa', 'Índice', 'Introdução', 'Desenvolvimento Teórico', 'Conclusão', 'Referências Bibliográficas'],
    individual: ['Capa', 'Índice', 'Introdução', 'Revisão da Literatura', 'Metodologia', 'Resultados e Discussão', 'Conclusão', 'Referências Bibliográficas'],
    resumo: ['Identificação do Texto Original', 'Introdução', 'Síntese dos Pontos Principais', 'Análise Crítica', 'Conclusão'],
    campo: ['Capa', 'Índice', 'Introdução', 'Objectivos', 'Metodologia de Campo', 'Resultados Obtidos', 'Análise e Discussão', 'Conclusão', 'Referências Bibliográficas'],
  };

  const sections = sectionsByType[config.type] ?? sectionsByType.individual;

  return `És um especialista em pedagogia e metodologia académica moçambicana.
Vais gerar a estrutura completa de um "${typeLabel}" para uma turma do ensino secundário/médio em Moçambique.

DADOS DA INSTITUIÇÃO:
- Escola: ${config.school || 'Instituto Politécnico'}
- Curso: ${config.course || 'Curso Técnico'}
- Disciplina/Módulo: ${config.subject || 'Módulo Genérico'} ${config.module ? `— ${config.module}` : ''}
- Turma: ${config.className || 'Turma A'}
- Data de entrega: ${config.deliveryDate || '(a definir)'}
- Formador: ${config.formatorName || 'Dr./Dra.'} ${config.formatorContact ? `— Contacto: ${config.formatorContact}` : ''}

${groupInstructions}

SECÇÕES OBRIGATÓRIAS DO TRABALHO:
${sections.map((s, i) => `${i + 1}. ${s}`).join('\n')}

RECOMENDAÇÕES PADRÃO A INCLUIR NO ENUNCIADO:
- Usar Microsoft Office Word
- Tipo de letra: Times New Roman, tamanho 12
- Espaçamento entre linhas: 1.5
- Alinhamento: Justificado
- Margens: 2.5cm

RESPONDE EXCLUSIVAMENTE em JSON válido com esta estrutura exacta (sem texto fora do JSON, sem blocos de código markdown):
{
  "enunciado": "texto completo do enunciado em Markdown, incluindo cabeçalho da instituição, tabela de grupos/temas (se aplicável), e recomendações",
  "groups": [
    { "number": 1, "members": ["Nome1", "Nome2", ...], "topic": "Tema do grupo 1", "subtopics": ["sub1", "sub2", "sub3"] }
  ],
  "outline": "esboço Markdown das secções que cada grupo/aluno deve desenvolver",
  "sections": [
    { "title": "Nome da secção" }
  ]
}

Para o campo "enunciado", formata como Markdown profissional com:
- Cabeçalho com nome da escola em maiúsculas e negrito
- Curso e turma
- Título do tipo de trabalho
- Tabela Markdown dos grupos/membros/temas (se tipo grupo)
- Lista de recomendações formatadas
- Data de entrega em negrito e itálico
- Nome e contacto do formador no rodapé

Para tipo "individual", "resumo" ou "campo", adapta sem grupos — apenas o enunciado e estrutura para o aluno individual.`;
}

export async function POST(req: Request) {
  try {
    const { config } = await req.json() as { config: WorkConfig };

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });

    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: buildSystemPrompt(config) },
          { role: 'user', content: 'Gera o enunciado, grupos, esboço e secções agora.' },
        ],
        stream: true,
        max_tokens: 4096,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: response.status });
    }

    return new NextResponse(response.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
