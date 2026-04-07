# 🔐 Blueprint de Correcção de Segurança

**Projecto:** Muneri — Gerador de Trabalhos Académicos  
**Data da auditoria:** 2026-04-07  
**Auditado por:** Claude Security Audit Skill v1.0

---

## Score de Segurança

| Métrica | Valor |
|---------|-------|
| Score actual | 35/100 |
| Score esperado após correcções | 100/100 |
| Vulnerabilidades CRÍTICO | 1 |
| Vulnerabilidades ALTO | 3 |
| Vulnerabilidades MÉDIO | 2 |
| **Resultado actual** | **⛔ REPROVADO — Não apto para produção** |

---

## Índice de Vulnerabilidades

| # | Regra | Severidade | Localização | Esforço | Status |
|---|-------|------------|-------------|---------|--------|
| 1 | [R22 — Defesa em Profundidade](#r22--defesa-em-profundidade) | 🔴 CRÍTICO | cover/export, cover/abstract, cover/agent, chat | Médio | 🔧 Pendente |
| 2 | [R16 — Autenticação ausente em features pagas](#r16--autenticação-ausente-em-features-pagas) | 🟠 ALTO | cover/export, cover/abstract, cover/agent, chat | Médio | 🔧 Pendente |
| 3 | [R07 — Inputs sem limite em aprovação e agente](#r07--inputs-sem-limite-em-aprovação-e-agente) | 🟠 ALTO | cover/agent, tcc/approve, work/approve | Baixo | 🔧 Pendente |
| 4 | [R07 — Tamanho de áudio sem validação](#r07--tamanho-de-áudio-sem-validação) | 🟠 ALTO | transcribe | Baixo | 🔧 Pendente |
| 5 | [R12 — MIME Type de áudio não verificado](#r12--mime-type-de-áudio-não-verificado) | 🟡 MÉDIO | transcribe | Baixo | 🔧 Pendente |
| 6 | [R07 — Campo markdown sem limite em cover/export](#r07--campo-markdown-sem-limite-em-coverexport) | 🟡 MÉDIO | cover/export | Baixo | 🔧 Pendente |

> **Esforço:** Baixo (< 1h) · Médio (1–4h) · Alto (> 4h)

---

## [R22] Defesa em Profundidade — CRÍTICO

### Contexto

**O que existe actualmente:**

```ts
// src/app/api/chat/route.ts  (padrão idêntico em cover/export, cover/abstract, cover/agent)
export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'chat:post', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;
  // ← ÚNICA camada de protecção: rate limiting via Upstash externo
  const { messages } = await req.json();
  // Gemini é chamado imediatamente, sem verificar quem fez o pedido
```

**Por que é explorável:**  
A segurança depende exclusivamente de um serviço externo (Upstash Redis). Se este não estiver configurado em desenvolvimento (`redisUrl` ausente), `enforceRateLimit` devolve `null` e os endpoints ficam completamente abertos. Um atacante com múltiplos IPs ou proxies circula o rate limit por endpoint e usa Gemini/geração de DOCX de forma ilimitada. Não existe camada independente (autenticação) que impeça o abuso.

**Impacto potencial:**  
Custos ilimitados de API Gemini; esgotamento de quotas; geração de documentos sem conta ou plano pago; degradação de serviço para utilizadores legítimos.

---

### Arquitectura da Correcção

```
ANTES:
  Request → Rate Limit (Upstash) → Gemini / DOCX
                 ↑ único ponto de falha

DEPOIS:
  Request → Rate Limit (Upstash)  →  Auth Check (Supabase)  →  Plan Check  →  Gemini / DOCX
                 ↑ falha → 503          ↑ sem sessão → 401       ↑ plano errado → 403
  Cada camada é independente; falha de uma não abre as outras.
```

---

### Implementação Passo a Passo

#### Passo 1 — Criar helper reutilizável de autenticação para API routes

```ts
// src/lib/api-auth.ts  (NOVO FICHEIRO)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * Verifica se o pedido pertence a um utilizador autenticado.
 * Retorna { user } ou { error: NextResponse } para devolver imediatamente.
 */
export async function requireAuth(): Promise<
  | { user: { id: string }; error: null }
  | { user: null; error: NextResponse }
> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    };
  }

  return { user: { id: user.id }, error: null };
}

/**
 * Verifica se o utilizador tem acesso à funcionalidade via a função check_user_access do Supabase.
 */
export async function requireFeatureAccess(
  userId: string,
  feature: 'cover' | 'ai_chat' | 'export_full' | 'tcc',
): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    },
  );

  const { data: hasAccess, error } = await supabase.rpc('check_user_access', {
    p_user_id: userId,
    p_feature: feature,
  });

  if (error || !hasAccess) {
    return NextResponse.json(
      { error: 'Plano insuficiente para esta funcionalidade.' },
      { status: 403 },
    );
  }

  return null;
}
```

#### Passo 2 — Aplicar auth em `/api/chat/route.ts`

```ts
// src/app/api/chat/route.ts — ANTES do bloco try
import { requireAuth } from '@/lib/api-auth';

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'chat:post', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  // ← NOVO: verificação de autenticação independente do rate limit
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  // Opcional: verificar plano ai_chat
  // const planError = await requireFeatureAccess(user.id, 'ai_chat');
  // if (planError) return planError;

  try {
    const { messages } = await req.json();
    // ... resto do handler inalterado
```

#### Passo 3 — Aplicar auth em `/api/cover/export/route.ts`

```ts
// src/app/api/cover/export/route.ts
import { requireAuth, requireFeatureAccess } from '@/lib/api-auth';

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'cover:export', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  // ← NOVO
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const planError = await requireFeatureAccess(user.id, 'cover');
  if (planError) return planError;

  try {
    // ... resto inalterado
```

#### Passo 4 — Aplicar auth em `/api/cover/abstract/route.ts` e `/api/cover/agent/route.ts`

```ts
// Mesmo padrão dos Passos 2–3.
// cover/abstract → requireAuth() + requireFeatureAccess(user.id, 'cover')
// cover/agent    → requireAuth() + requireFeatureAccess(user.id, 'cover')
```

---

### Teste de Validação

```ts
// src/__tests__/security/ai-endpoints-auth.test.ts
import { describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: mockGetUser } })),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }),
}));

import { POST as chatPost } from '@/app/api/chat/route';
import { POST as coverExportPost } from '@/app/api/cover/export/route';

describe('R22 / R16 — Auth em endpoints de IA', () => {
  it('POST /api/chat retorna 401 sem autenticação', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Olá' }] }),
    });
    const res = await chatPost(req);
    expect(res.status).toBe(401);
  });

  it('POST /api/cover/export retorna 401 sem autenticação', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = new Request('http://localhost/api/cover/export', {
      method: 'POST',
      body: JSON.stringify({ coverData: { institution: 'X' }, markdown: '# Test' }),
    });
    const res = await coverExportPost(req);
    expect(res.status).toBe(401);
  });
});
// Executar com: npx vitest run src/__tests__/security/ai-endpoints-auth.test.ts
```

**Resultado esperado:** Ambos os testes passam com 401.

---

### Checklist de Deploy

- [ ] `requireAuth()` adicionado em `/api/chat`, `/api/cover/export`, `/api/cover/abstract`, `/api/cover/agent`
- [ ] `requireFeatureAccess()` configurado para `cover` e `ai_chat` conforme aplicável
- [ ] Testes `ai-endpoints-auth.test.ts` a passar
- [ ] Verificar que o helper `requireAuth` não cria um cliente Supabase diferente do que cria o middleware (reutilizar padrão de `makeSupabase` já existente noutros handlers)
- [ ] Variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas em todos os ambientes
- [ ] Revisão de código por par antes do merge

---

## [R16] Autenticação ausente em features pagas — ALTO

### Contexto

**O que existe actualmente:**

```ts
// src/app/api/cover/export/route.ts — sem getUser()
export async function POST(req: Request) {
  const limited = await enforceRateLimit(...);
  if (limited) return limited;
  // ← qualquer chamada fetch() passa aqui sem autenticação
  const { coverData, markdown, filename = 'trabalho' } = await req.json();
```

**Por que é explorável:**  
O middleware Next.js redireciona browsers para `/auth/login`, mas não devolve 401 para chamadas `fetch()` programáticas a rotas `/api/`. Um script externo pode chamar `/api/cover/export` com dados arbitrários e receber um `.docx` válido, sem conta e sem plano pago.

**Impacto potencial:**  
Bypass de paywall; features `cover_enabled` acessíveis sem subscrição; custos de geração suportados pelo operador sem receita correspondente.

---

### Arquitectura da Correcção

```
Middleware (browser redirect)  ←→  API Route Auth Check (fetch programático)
Ambos devem existir independentemente — complementam-se, não substituem.
```

---

### Implementação Passo a Passo

#### Passo 1 — Correcção é partilhada com R22 (Passo 1–4 acima)

A correcção de R16 é implementada pelo mesmo helper `requireAuth()` + `requireFeatureAccess()` descrito em R22. Não há código adicional além do já documentado.

#### Passo 2 — Verificar que `/api/tcc/outline` e `/api/work/generate` não chamam Gemini para utilizadores não autenticados

```ts
// src/app/api/tcc/outline/route.ts — adicionar antes do try
const { user, error: authError } = await requireAuth();
if (authError) return authError;
// Gemini só é chamado depois desta linha
```

```ts
// src/app/api/work/generate/route.ts — mesmo padrão
const { user, error: authError } = await requireAuth();
if (authError) return authError;
```

---

### Teste de Validação

```ts
// Incluído nos testes de R22 acima.
// Adicionar cobertura para /api/cover/abstract e /api/cover/agent:
it('POST /api/cover/abstract retorna 401 sem autenticação', async () => {
  mockGetUser.mockResolvedValue({ data: { user: null } });
  const req = new Request('http://localhost/api/cover/abstract', {
    method: 'POST',
    body: JSON.stringify({ theme: 'Impacto das TIC na Educação' }),
  });
  const { POST } = await import('@/app/api/cover/abstract/route');
  const res = await POST(req);
  expect(res.status).toBe(401);
});
```

**Resultado esperado:** 401 para todos os endpoints de IA sem sessão activa.

---

### Checklist de Deploy

- [ ] Todos os endpoints de IA verificam `requireAuth()` antes de qualquer chamada externa
- [ ] Testes de autenticação a passar para todos os 4 endpoints afectados
- [ ] Confirmar que utilizadores `free` recebem 403 (não 401) nas features pagas
- [ ] Revisão de código por par antes do merge

---

## [R07] Inputs sem limite em aprovação e agente de capa — ALTO

### Contexto

**O que existe actualmente:**

```ts
// src/app/api/tcc/approve/route.ts
const { sessionId, outline } = await req.json();
if (!sessionId || !outline?.trim()) {
  return NextResponse.json({ error: '...' }, { status: 400 });
}
// outline pode ter qualquer tamanho — sem limite
const session = await approveOutline(sessionId, outline.trim());
```

```ts
// src/app/api/cover/agent/route.ts
const { topic, outline, messages, mode, phase } = await req.json();
if (!topic) { return NextResponse.json({ error: 'topic é obrigatório' }, { status: 400 }); }
// topic, outline e messages sem limite de tamanho
```

**Por que é explorável:**  
Um payload `outline` de 5–50 MB é aceite e enviado directamente para o contexto do Gemini. Cada chamada pode custar dezenas de tokens desnecessários e causar timeouts ou erros de `request_too_large` do Gemini. Em `/api/cover/agent`, `messages` sem limite permite enviar historial de conversação de tamanho arbitrário.

**Impacto potencial:**  
Custo excessivo de API; timeouts cascata; potencial DoS por esgotamento de quotas Gemini.

---

### Implementação Passo a Passo

#### Passo 1 — Reutilizar `parseOutlinePayload` em `/api/tcc/approve/route.ts`

```ts
// src/app/api/tcc/approve/route.ts
import { parseOutlinePayload } from '@/lib/validation/input-guards';

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'tcc:approve', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const body = await req.json();
    // parseOutlinePayload valida: sessionId (≤100), topic omitido aqui,
    // e outline através do campo "suggestions" — mas para outline precisamos
    // de validação directa:
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : null;
    const outline   = typeof body.outline  === 'string' ? body.outline.trim()   : null;

    if (!sessionId || sessionId.length > 100) {
      return NextResponse.json({ error: 'sessionId inválido' }, { status: 400 });
    }
    if (!outline || outline.length > 15_000) {
      return NextResponse.json({ error: 'outline obrigatório ou demasiado longo (máx 15 000 chars)' }, { status: 400 });
    }
    // ... resto inalterado
```

#### Passo 2 — Mesma lógica em `/api/work/approve/route.ts`

```ts
// src/app/api/work/approve/route.ts — idêntico ao Passo 1
if (!outline || outline.length > 15_000) {
  return NextResponse.json({ error: 'outline demasiado longo' }, { status: 400 });
}
```

#### Passo 3 — Validar `/api/cover/agent/route.ts`

```ts
// src/app/api/cover/agent/route.ts — adicionar após extrair os campos
const MAX_TOPIC    = 500;
const MAX_OUTLINE  = 15_000;
const MAX_MESSAGES = 30;
const MAX_MSG_CHARS = 8_000;

const topicStr   = typeof topic   === 'string' ? topic.trim()   : '';
const outlineStr = typeof outline === 'string' ? outline.trim() : '';

if (!topicStr || topicStr.length > MAX_TOPIC) {
  return NextResponse.json({ error: 'topic inválido ou demasiado longo' }, { status: 400 });
}
if (outlineStr.length > MAX_OUTLINE) {
  return NextResponse.json({ error: 'outline demasiado longo' }, { status: 400 });
}
if (!Array.isArray(messages) || messages.length > MAX_MESSAGES) {
  return NextResponse.json({ error: 'messages inválidas' }, { status: 400 });
}
for (const msg of messages) {
  if (typeof msg?.content !== 'string' || msg.content.length > MAX_MSG_CHARS) {
    return NextResponse.json({ error: 'mensagem demasiado longa' }, { status: 400 });
  }
}
```

---

### Teste de Validação

```ts
// src/__tests__/security/input-size-limits.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null) }));
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn(() => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) } })) }));
vi.mock('next/headers', () => ({ cookies: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }) }));
vi.mock('@/lib/tcc/service', () => ({ approveOutline: vi.fn() }));

import { POST as tccApprove } from '@/app/api/tcc/approve/route';

describe('R07 — Limites de tamanho em approve', () => {
  it('rejeita outline com mais de 15 000 caracteres', async () => {
    const req = new Request('http://localhost/api/tcc/approve', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'sess-1', outline: 'x'.repeat(15_001) }),
    });
    const res = await tccApprove(req);
    expect(res.status).toBe(400);
  });
});
// Executar com: npx vitest run src/__tests__/security/input-size-limits.test.ts
```

**Resultado esperado:** 400 para outline > 15 000 chars nos três endpoints.

---

### Checklist de Deploy

- [ ] Limite `outline.length > 15_000` adicionado em `tcc/approve` e `work/approve`
- [ ] Limites `topic`, `outline`, `messages` adicionados em `cover/agent`
- [ ] Testes de limites a passar
- [ ] Verificar que os limites são consistentes com `LIMITS` em `input-guards.ts`
- [ ] Revisão de código por par antes do merge

---

## [R07] Tamanho de áudio sem validação — ALTO

### Contexto

**O que existe actualmente:**

```ts
// src/app/api/transcribe/route.ts
const audio = form.get('audio');
if (!(audio instanceof File)) {
  return NextResponse.json({ error: 'Ficheiro de áudio ausente.' }, { status: 400 });
}
// ← sem verificação de audio.size
const groqForm = new FormData();
groqForm.append('file', audio, audio.name || 'speech.webm');
```

**Por que é explorável:**  
Sem limite de tamanho, um atacante envia ficheiros de centenas de MB, consumindo largura de banda do servidor, memória do processo Next.js e potencialmente atingindo limites da Groq API. O endpoint não tem autenticação forte, tornando o abuso trivial.

**Impacto potencial:**  
DoS por esgotamento de memória/largura de banda; custos de API desnecessários; timeouts em outros utilizadores.

---

### Implementação Passo a Passo

#### Passo 1 — Adicionar validação de tamanho

```ts
// src/app/api/transcribe/route.ts
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB — limite Groq Whisper

export async function POST(request: Request) {
  try {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ API key não configurada.' }, { status: 500 });
    }

    const form = await request.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Ficheiro de áudio ausente.' }, { status: 400 });
    }

    // ← NOVO: verificação de tamanho
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `Ficheiro demasiado grande. Máximo: ${MAX_AUDIO_BYTES / 1024 / 1024} MB.` },
        { status: 413 },
      );
    }

    // ... resto inalterado
```

---

### Teste de Validação

```ts
// src/__tests__/security/transcribe-limits.test.ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({}));

import { POST } from '@/app/api/transcribe/route';

describe('R07 — Limite de tamanho do áudio', () => {
  it('rejeita áudio maior que 25 MB com status 413', async () => {
    // Simular ficheiro de 26 MB
    const largeBuffer = new Uint8Array(26 * 1024 * 1024);
    const file = new File([largeBuffer], 'speech.webm', { type: 'audio/webm' });
    const form = new FormData();
    form.append('audio', file);

    const req = new Request('http://localhost/api/transcribe', {
      method: 'POST',
      body: form,
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });
});
// Executar com: npx vitest run src/__tests__/security/transcribe-limits.test.ts
```

**Resultado esperado:** 413 para ficheiros > 25 MB.

---

### Checklist de Deploy

- [ ] Constante `MAX_AUDIO_BYTES = 25 * 1024 * 1024` definida
- [ ] Verificação `audio.size > MAX_AUDIO_BYTES` antes de `FormData.append`
- [ ] Resposta 413 com mensagem clara em português
- [ ] Teste a passar
- [ ] Revisão de código por par antes do merge

---

## [R12] MIME Type de áudio não verificado — MÉDIO

### Contexto

**O que existe actualmente:**

```ts
// src/app/api/transcribe/route.ts
const groqForm = new FormData();
groqForm.append('file', audio, audio.name || 'speech.webm');
groqForm.append('model', 'whisper-large-v3-turbo');
// audio.type nunca inspeccionado — qualquer Content-Type aceite
```

**Por que é explorável:**  
Um cliente pode enviar um PDF ou executável com `Content-Type: audio/webm`. O ficheiro é encaminhado directamente para a Groq API, que devolve erros internos potencialmente com informação sobre a infraestrutura. Além disso, elimina uma camada de defesa básica.

**Impacto potencial:**  
Erros inesperados com informação exposta; comportamento não determinístico da Groq API; potencial abuso de SSRF indirecto.

---

### Implementação Passo a Passo

#### Passo 1 — Verificar MIME Type do ficheiro de áudio

```ts
// src/app/api/transcribe/route.ts
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
  'audio/aac',
]);

// Após a verificação de audio instanceof File e antes do size check:
const declaredType = audio.type || 'audio/webm';
if (!ALLOWED_AUDIO_TYPES.has(declaredType)) {
  return NextResponse.json(
    { error: `Tipo de ficheiro não suportado: ${declaredType}. Use WebM, MP4 ou MP3.` },
    { status: 415 },
  );
}
```

---

### Teste de Validação

```ts
// src/__tests__/security/transcribe-mime.test.ts
import { describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/transcribe/route';

describe('R12 — MIME Type de áudio', () => {
  it('rejeita ficheiro com MIME type não permitido (ex: application/pdf)', async () => {
    const file = new File([new Uint8Array(1024)], 'evil.pdf', { type: 'application/pdf' });
    const form = new FormData();
    form.append('audio', file);
    const req = new Request('http://localhost/api/transcribe', { method: 'POST', body: form });
    const res = await POST(req);
    expect(res.status).toBe(415);
  });

  it('aceita audio/webm', async () => {
    // Mock do Groq seria necessário aqui — testar apenas a validação
    const file = new File([new Uint8Array(1024)], 'speech.webm', { type: 'audio/webm' });
    expect(ALLOWED_AUDIO_TYPES.has(file.type)).toBe(true);
  });
});
```

**Resultado esperado:** 415 para MIME types não permitidos.

---

### Checklist de Deploy

- [ ] `ALLOWED_AUDIO_TYPES` definido como `Set` imutável
- [ ] Verificação antes do FormData.append à Groq
- [ ] Teste de MIME a passar
- [ ] Revisão de código por par antes do merge

---

## [R07] Campo `markdown` sem limite em `/api/cover/export` — MÉDIO

### Contexto

**O que existe actualmente:**

```ts
// src/app/api/cover/export/route.ts
const { coverData, markdown, filename = 'trabalho' } = await req.json();
const safeFilename = sanitizeExportFilename(filename);
// markdown sem validação de tamanho — generateDocxWithCover recebe qualquer coisa
const buffer = await generateDocxWithCover(coverData as CoverData, markdown ?? '');
```

**Por que é explorável:**  
Um `markdown` de 50 MB é aceite e processado pelo parser AST e pelo builder DOCX em memória, podendo causar picos de memória no processo Node.js e degradar o serviço para outros utilizadores.

**Impacto potencial:**  
Consumo excessivo de memória; timeouts; degradação de serviço.

---

### Implementação Passo a Passo

#### Passo 1 — Aplicar o mesmo limite de 500 KB já usado em `/api/export`

```ts
// src/app/api/cover/export/route.ts
const DEFAULT_MAX_CONTENT_BYTES = 500_000; // 500 KB — consistente com /api/export

export async function POST(req: Request) {
  // ... rate limit e auth (R22/R16)
  try {
    const { coverData, markdown, filename = 'trabalho' } = await req.json();
    const safeFilename = sanitizeExportFilename(filename);

    // ← NOVO: limite de tamanho do markdown
    if (markdown && Buffer.byteLength(markdown, 'utf8') > DEFAULT_MAX_CONTENT_BYTES) {
      return NextResponse.json(
        { error: 'Conteúdo demasiado grande. Máximo: 500 KB.' },
        { status: 400 },
      );
    }

    if (!coverData) { ... }
    // ... resto inalterado
```

---

### Teste de Validação

```ts
// Adicionar ao ficheiro src/__tests__/security/cover-export-security.test.ts já existente:
it('rejeita markdown com mais de 500 KB', async () => {
  const req = new Request('http://localhost/api/cover/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coverData: {},
      markdown: 'x'.repeat(600_000),
      filename: 'teste',
    }),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
  expect(mockGenerateDocxWithCover).not.toHaveBeenCalled();
});
```

**Resultado esperado:** 400 para markdown > 500 KB, sem chamada ao gerador DOCX.

---

### Checklist de Deploy

- [ ] `Buffer.byteLength(markdown, 'utf8') > DEFAULT_MAX_CONTENT_BYTES` adicionado
- [ ] Constante `DEFAULT_MAX_CONTENT_BYTES` partilhada ou replicada consistentemente
- [ ] Teste no ficheiro existente `cover-export-security.test.ts` a passar
- [ ] Revisão de código por par antes do merge

---

## Checklist Global Pré-Deploy

### Obrigatório (CRÍTICO e ALTO)

- [ ] `requireAuth()` implementado e testado em `/api/chat`, `/api/cover/export`, `/api/cover/abstract`, `/api/cover/agent`
- [ ] `requireAuth()` adicionado em `/api/tcc/outline` e `/api/work/generate` (antes da chamada Gemini)
- [ ] `requireFeatureAccess()` verificando `cover` e `ai_chat` conforme endpoint
- [ ] Limites de tamanho aplicados em `tcc/approve`, `work/approve`, `cover/agent`
- [ ] Limite de 25 MB no upload de áudio em `/api/transcribe`
- [ ] Suite completa de testes de segurança a passar (`npx vitest run src/__tests__/security/`)
- [ ] Upstash configurado em **todos** os ambientes (dev, staging, prod)
- [ ] RLS activo e testado (migrations 007–010 aplicadas)
- [ ] Logs de auditoria activos para operações financeiras (migration 012 aplicada)

### Recomendado (MÉDIO e Boas Práticas)

- [ ] Validação de MIME Type de áudio implementada (R12)
- [ ] Limite de 500 KB no `markdown` de `/api/cover/export` implementado
- [ ] Testes de penetração com IA (R25) — usar `scripts/adversarial-test.mjs` com scope alargado
- [ ] Adicionar testes adversariais para os novos endpoints de autenticação
- [ ] Rate limiting em `/api/auth/callback` (actualmente sem limite)
- [ ] Documentação dos níveis de acesso por plano actualizada

---

## Referências e Recursos

| Recurso | Descrição |
|---------|-----------|
| [OWASP Top 10](https://owasp.org/www-project-top-ten/) | Top 10 vulnerabilidades mais críticas da web |
| [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security) | Configuração correcta de Row Level Security |
| [Supabase Auth — Server-Side](https://supabase.com/docs/guides/auth/server-side/nextjs) | Verificação de sessão em Next.js App Router |
| [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware) | Diferença entre redirect (browser) e 401 (API) |
| [Groq Whisper Limits](https://console.groq.com/docs/speech-text) | Limites de tamanho e MIME types suportados |

---

_Blueprint gerado automaticamente pela Security Audit Skill v1.0_  
_Baseado em: Relatório CTF v1.0 + Plataforma de Análise de Segurança de Código v1.0_  
_Projecto: Muneri · Quelimane, Moçambique · 2026_
