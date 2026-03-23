import { NextResponse } from 'next/server';
import type { WorkConfig, WorkSection, WorkGroup } from '@/hooks/useWorkSession';

const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

const TYPE_LABELS: Record<string, string> = {
  grupo: 'Trabalho de Investigação em Grupo',
  individual: 'Relatório Individual',
  resumo: 'Resumo / Síntese',
  campo: 'Trabalho de Campo',
};

interface RequestBody {
  config: WorkConfig;
  section: WorkSection;
  outline: string;
  groups: WorkGroup[];
  previousSections: WorkSection[];
}

export async function POST(req: Request) {
  try {
    const { config, section, outline, groups, previousSections }: RequestBody = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });

    const typeLabel = TYPE_LABELS[config.type] ?? config.type;

    const groupsContext = groups.length > 0
      ? `\nGRUPOS E TEMAS:\n${groups.map(g =>
          `Grupo ${g.number}: ${g.topic}\n  Membros: ${g.members.join(', ')}`
        ).join('\n')}\n`
      : '';

    const previousContext = previousSections.length > 0
      ? `\nSECÇÕES JÁ DESENVOLVIDAS (para manter coerência):\n${previousSections.map(s =>
          `### ${s.title}\n${s.content.slice(0, 600)}${s.content.length > 600 ? '...' : ''}`
        ).join('\n\n')}\n`
      : '';

    const systemPrompt = `És um especialista académico a desenvolver conteúdo para um "${typeLabel}" do ensino secundário/médio em Moçambique.

CONTEXTO DO TRABALHO:
- Escola: ${config.school || 'Instituto Politécnico'}
- Curso/Disciplina: ${config.course} — ${config.subject} ${config.module ? `(${config.module})` : ''}
- Turma: ${config.className}
${groupsContext}
ESBOÇO GERAL:
${outline}
${previousContext}
A TUA TAREFA:
Desenvolve APENAS a secção: "${section.title}"

REGRAS:
- Texto académico em português europeu/moçambicano
- Sem introduções do tipo "Nesta secção vamos..." — começa directamente
- Usa Markdown: negrito, listas, sub-títulos com ### quando adequado
- Para "Capa" ou "Índice": formata como um modelo real preenchido com os dados da instituição
- Para "Referências Bibliográficas": lista no mínimo 5 referências no formato APA adaptado ao contexto moçambicano
- Para "Tabela de Grupos" ou similar: cria tabela Markdown bem formatada
- Extensão adequada: 300-600 palavras para secções de conteúdo, mais conciso para capa/índice
- Mantém coerência com o contexto e secções anteriores`;

    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Desenvolve agora a secção "${section.title}".` },
        ],
        stream: true,
        max_tokens: 2048,
        temperature: 0.5,
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
