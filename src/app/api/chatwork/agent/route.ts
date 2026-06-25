import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';
import { GeminiApiError, geminiGenerateText } from '@/lib/gemini-resilient';
import { PROMPT_INJECTION_GUARD, wrapUserInput } from '@/lib/prompt-sanitizer';
import { parseChatworkAgentJson, parseChatworkAgentPayload } from '@/lib/chatwork/agent';

const CHATWORK_SYSTEM = `${PROMPT_INJECTION_GUARD}

És o agente do Chatwork, uma interface de escrita académica por fases.
Tens acesso ao documento actual em Markdown e ao comando do utilizador.
O teu trabalho é conversar, planear e editar apenas a área necessária do documento.

REGRAS OBRIGATÓRIAS:
- Não recries o documento inteiro se o pedido for localizado.
- Se houver texto seleccionado, prioriza editar apenas esse excerto.
- Mantém estrutura académica, português europeu e normas moçambicanas quando aplicável.
- Não forces contexto moçambicano em temas universais/técnicos quando não fizer sentido.
- Responde sempre em JSON válido, sem Markdown fora do JSON.

Formato de resposta:
{
  "reply": "explicação breve do que foi feito ou pergunta de clarificação",
  "documentMarkdown": "documento completo actualizado em Markdown",
  "edits": [
    {
      "type": "replace-selection|replace-document|append-note",
      "target": "texto original afectado ou vazio",
      "replacement": "novo texto",
      "summary": "resumo da alteração"
    }
  ]
}`;

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'chatwork:agent', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const planError = await requireFeatureAccess(user.id, 'ai_chat', req);
  if (planError) return planError;

  try {
    const payload = parseChatworkAgentPayload(await req.json());
    if (!payload) {
      return NextResponse.json({ error: 'Payload inválido ou demasiado longo' }, { status: 400 });
    }

    const history = (payload.messages ?? [])
      .map(message => `${message.role === 'user' ? 'Utilizador' : 'Agente'}: ${message.content}`)
      .join('\n');

    const raw = await geminiGenerateText({
      model: 'gemini-3.1-flash-lite',
      temperature: 0.35,
      maxOutputTokens: 4096,
      messages: [
        { role: 'system', content: CHATWORK_SYSTEM },
        {
          role: 'user',
          content: [
            '[HISTÓRICO RECENTE]',
            wrapUserInput('chat_history', history || 'Sem histórico.'),
            '',
            '[DOCUMENTO ACTUAL]',
            wrapUserInput('current_document_markdown', payload.documentMarkdown),
            '',
            '[TEXTO SELECCIONADO PELO UTILIZADOR]',
            wrapUserInput('selected_text', payload.selectedText || 'Nenhum texto seleccionado.'),
            '',
            '[COMANDO DO UTILIZADOR]',
            wrapUserInput('user_command', payload.command),
          ].join('\n'),
        },
      ],
    });

    return NextResponse.json(parseChatworkAgentJson(raw, payload.documentMarkdown));
  } catch (error: any) {
    const status = error instanceof GeminiApiError ? error.status : null;
    if (status === 429 || status === 503 || (typeof status === 'number' && status >= 500)) {
      return NextResponse.json(
        { error: 'Serviço de IA temporariamente indisponível. Tenta novamente em alguns segundos.' },
        { status: 503, headers: { 'Retry-After': '5' } },
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
