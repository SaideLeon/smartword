# 🔐 Blueprint de Correcção de Segurança

**Projecto:** Muneri — Gerador de Trabalhos Académicos  
**Data da auditoria:** 2026-04-06  
**Auditado por:** Claude Security Audit Skill v1.0  

---

## Pontuação de Segurança

| Métrica | Valor |
|---------|-------|
| Pontuação actual | 25/100 |
| Pontuação esperada após correcções | 100/100 |
| Vulnerabilidades CRÍTICO | 3 |
| Vulnerabilidades ALTO | 5 |
| Vulnerabilidades MÉDIO | 1 |
| **Resultado actual** | **REPROVADO — não apto para produção** |

---

## Índice de Vulnerabilidades

| # | Regra | Severidade | Localização | Esforço | Estado |
|---|-------|-----------|-------------|---------|--------|
| 1 | [R17](#r17-rls-permissivo) | 🔴 CRÍTICO | `supabase/migrations/001,007` | Médio | ⬜ Pendente |
| 2 | [R08/CTF-R07](#r08-race-condition-em-pagamentos) | 🔴 CRÍTICO | `src/app/api/payment/route.ts` | Alto | ⬜ Pendente |
| 3 | [R22](#r22-rate-limiter-em-memória) | 🔴 CRÍTICO | `src/lib/rate-limit.ts` | Alto | ⬜ Pendente |
| 4 | [R18](#r18-mass-assignment-work_session_id) | 🟠 ALTO | `src/app/api/payment/route.ts` | Baixo | ⬜ Pendente |
| 5 | [R07](#r07-limite-de-tamanho-de-input) | 🟠 ALTO | `src/app/api/payment/route.ts` | Baixo | ⬜ Pendente |
| 6 | [R16](#r16-sem-auditoria-de-acesso-admin) | 🟠 ALTO | `src/app/api/payment/route.ts` (GET) | Médio | ⬜ Pendente |
| 7 | [R21](#r21-sem-detecção-automática-de-fraude) | 🟠 ALTO | Sistema de pagamentos | Alto | ⬜ Pendente |
| 8 | [R23](#r23-testes-de-segurança-incompletos) | 🟠 ALTO | `src/tests/security/` | Médio | ⬜ Pendente |
| 9 | [R13](#r13-validação-de-logobase64) | 🟡 MÉDIO | `src/app/api/cover/export/route.ts` | Baixo | ⬜ Pendente |

> **Esforço:** Baixo (< 1h) · Médio (1–4h) · Alto (> 4h)

---

## [R17] RLS Permissivo — CRÍTICO

### Contexto

**O que existe actualmente:**

```sql
-- migrations/001_tcc_sessions.sql (pode persistir em produção)
create policy "allow_all_anon" on tcc_sessions
  for all using (true) with check (true);

-- migrations/007: tenta remover mas falha silenciosamente se já foi removida
DROP POLICY IF EXISTS "allow_all_anon" ON tcc_sessions;

-- Nova política depende de user_id NOT NULL — mas sessões antigas têm NULL
CREATE POLICY "tcc_user_access" ON tcc_sessions
  FOR ALL
  USING (auth.uid() = user_id OR is_admin())
```

**Por que é explorável:**  
Qualquer utilizador anónimo com a URL do Supabase e a chave `anon` pode ler/escrever todas as sessões TCC se a política permissiva estiver activa. Mesmo com a política correcta, sessões com `user_id = NULL` ficam inacessíveis para o utilizador legítimo mas continuam acessíveis a admins comprometidos.

**Impacto potencial:**  
Exposição de todos os trabalhos académicos de todos os utilizadores; possibilidade de alteração/eliminação de sessões de outros utilizadores.

---

### Arquitectura da Correcção

```
ESTADO ACTUAL:
  Cliente anon → Supabase anon key → tcc_sessions (sem restrição se policy permissiva activa)

ESTADO CORRECTO:
  Cliente auth → JWT verificado → RLS: auth.uid() = user_id (NOT NULL) → acesso restrito
  Admin auth  → JWT verificado → RLS: is_admin() → acesso auditado
```

---

### Implementação Passo a Passo

#### Passo 1 — Verificar estado actual das políticas em produção

```sql
-- Executar no Supabase SQL Editor para confirmar o estado real
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('tcc_sessions', 'work_sessions', 'profiles', 'payment_history')
ORDER BY tablename, policyname;

-- ALERTA: se aparecer "allow_all_anon" com qual = 'true', executar imediatamente:
DROP POLICY IF EXISTS "allow_all_anon" ON tcc_sessions;
DROP POLICY IF EXISTS "allow_all_anon_work" ON work_sessions;
```

#### Passo 2 — Adicionar NOT NULL + DEFAULT em user_id (migração 010)

```sql
-- supabase/migrations/010_fix_rls_user_id.sql

-- 1. Backfill: sessões sem user_id são irrecuperáveis — mover para tabela de arquivo
CREATE TABLE IF NOT EXISTS tcc_sessions_orphaned AS
  SELECT * FROM tcc_sessions WHERE user_id IS NULL;

-- 2. Eliminar sessões órfãs da tabela principal
DELETE FROM tcc_sessions WHERE user_id IS NULL;

-- 3. Tornar user_id obrigatório
ALTER TABLE tcc_sessions
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE tcc_sessions
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Repetir para work_sessions
CREATE TABLE IF NOT EXISTS work_sessions_orphaned AS
  SELECT * FROM work_sessions WHERE user_id IS NULL;
DELETE FROM work_sessions WHERE user_id IS NULL;
ALTER TABLE work_sessions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE work_sessions ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 4. Verificação final: não deve retornar linhas
SELECT COUNT(*) FROM tcc_sessions WHERE user_id IS NULL;
SELECT COUNT(*) FROM work_sessions WHERE user_id IS NULL;
```

#### Passo 3 — Confirmar que as políticas correctas estão activas

```sql
-- Verificar: apenas estas políticas devem existir para tcc_sessions
-- tcc_user_access: USING (auth.uid() = user_id OR is_admin())
-- Nenhuma política com USING (true)

-- Se necessário recriar:
DROP POLICY IF EXISTS "allow_all_anon" ON tcc_sessions;
DROP POLICY IF EXISTS "tcc_user_access" ON tcc_sessions;

CREATE POLICY "tcc_user_access" ON tcc_sessions
  FOR ALL
  USING  (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());
```

---

### Teste de Validação

```typescript
// src/tests/security/rls.test.ts
// Executar com: npx vitest run src/tests/security/rls.test.ts

import { createClient } from '@supabase/supabase-js';

describe('RLS — tcc_sessions', () => {
  it('utilizador anónimo não consegue ler sessões', async () => {
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await anonClient.from('tcc_sessions').select('id');
    // Com RLS correcta: data deve ser [] ou error deve existir
    expect(data?.length ?? 0).toBe(0);
  });

  it('utilizador autenticado só vê as suas sessões', async () => {
    // Criar sessão com user A, tentar ler com user B
    // (requer dois clientes com JWTs distintos)
    const { data } = await userBClient.from('tcc_sessions')
      .select('id')
      .eq('user_id', userAId);
    expect(data?.length ?? 0).toBe(0);
  });
});
```

**Resultado esperado:** Ambos os testes passam sem retornar dados de outros utilizadores.

---

### Lista de Verificação antes do Lançamento

- [ ] Executar query de verificação de políticas em produção — sem `USING (true)`
- [ ] Migração 010 aplicada e sessões órfãs arquivadas
- [ ] `user_id NOT NULL` confirmado via `information_schema.columns`
- [ ] Teste de RLS com dois utilizadores a passar
- [ ] Chave `service_role` nunca exposta no código cliente

---

## [R08] Race Condition em Pagamentos — CRÍTICO

### Contexto

**O que existe actualmente:**

```typescript
// src/app/api/payment/route.ts — três operações separadas
const { data: plan } = await supabase.from('plans').select(...).single();
// ← janela de race condition aqui ←
const { data: payment, error } = await supabase
  .from('payment_history').insert({...}).select().single();
// ← segundo pedido pode chegar aqui ←
await supabase.from('profiles').update({...}).eq('id', user.id);
```

**Por que é explorável:**  
Dois pedidos simultâneos passam ambos pela verificação do plano, ambos tentam inserir em `payment_history` (um falha pela constraint UNIQUE), mas se o timing for exacto, o `UPDATE profiles` pode correr duas vezes ou numa ordem inesperada. Em planos com `works_limit`, o contador `works_used` pode ser manipulado.

**Impacto potencial:**  
Activação de plano sem pagamento válido; corrupção do estado do perfil do utilizador.

---

### Arquitectura da Correcção

```
ACTUAL:
  API Route → SELECT plan → INSERT payment_history → UPDATE profiles
              (3 operações independentes, sem garantia de atomicidade)

CORRECTO:
  API Route → supabase.rpc('register_payment', {...})
                └─ BEGIN
                   ├─ SELECT plan FOR UPDATE (lock)
                   ├─ INSERT payment_history
                   ├─ UPDATE profiles (status pending)
                   └─ COMMIT
```

---

### Implementação Passo a Passo

#### Passo 1 — Criar função PostgreSQL atómica

```sql
-- supabase/migrations/011_atomic_payment.sql

CREATE OR REPLACE FUNCTION register_payment(
  p_user_id       uuid,
  p_plan_key      text,
  p_transaction_id text,
  p_payment_method text,
  p_work_session_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan          plans%ROWTYPE;
  v_payment_id    uuid;
BEGIN
  -- 1. Verificar autenticação: só o próprio utilizador pode registar
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  -- 2. Verificar plano (com lock para evitar race condition)
  SELECT * INTO v_plan
  FROM plans
  WHERE key = p_plan_key AND is_active = true
  FOR SHARE; -- partilhado: múltiplos podem ler, nenhum pode alterar

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano inválido ou inactivo' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Verificar se o transaction_id já existe (idempotência)
  IF EXISTS (SELECT 1 FROM payment_history WHERE transaction_id = p_transaction_id) THEN
    RAISE EXCEPTION 'Transação já registada' USING ERRCODE = 'P0003';
  END IF;

  -- 4. Inserir pagamento com preço do SERVIDOR (nunca do cliente)
  INSERT INTO payment_history (
    user_id, plan_key, transaction_id,
    amount_mzn, payment_method, work_session_id, status
  ) VALUES (
    p_user_id, p_plan_key, p_transaction_id,
    v_plan.price_mzn, p_payment_method, p_work_session_id, 'pending'
  )
  RETURNING id INTO v_payment_id;

  -- 5. Actualizar perfil com status pending
  UPDATE profiles SET
    transaction_id   = p_transaction_id,
    payment_method   = p_payment_method,
    payment_status   = 'pending',
    updated_at       = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('payment_id', v_payment_id, 'amount_mzn', v_plan.price_mzn);

EXCEPTION
  WHEN SQLSTATE 'P0001' THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  WHEN SQLSTATE 'P0002' THEN
    RAISE EXCEPTION 'Plano inválido ou inactivo' USING ERRCODE = 'P0002';
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Transação já registada' USING ERRCODE = '23505';
END;
$$;
```

#### Passo 2 — Simplificar o handler da API

```typescript
// src/app/api/payment/route.ts — POST handler corrigido
export async function POST(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'payment:post', maxRequests: 5, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const body = await req.json();

    // Validação com whitelist explícita
    const ALLOWED_METHODS = ['mpesa', 'emola', 'bank_transfer', 'card'] as const;
    type PaymentMethod = typeof ALLOWED_METHODS[number];

    const plan_key        = typeof body.plan_key === 'string' ? body.plan_key.trim().slice(0, 50) : null;
    const transaction_id  = typeof body.transaction_id === 'string' ? body.transaction_id.trim().slice(0, 100) : null;
    const payment_method  = ALLOWED_METHODS.includes(body.payment_method) ? body.payment_method as PaymentMethod : null;
    const work_session_id = typeof body.work_session_id === 'string' ? body.work_session_id : null;

    if (!plan_key || !transaction_id || !payment_method) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta ou inválidos' }, { status: 400 });
    }

    // Verificar ownership de work_session_id (R18)
    if (work_session_id) {
      const { data: ws } = await supabase
        .from('work_sessions')
        .select('id')
        .eq('id', work_session_id)
        .eq('user_id', user.id)
        .single();
      if (!ws) {
        return NextResponse.json({ error: 'Sessão de trabalho inválida' }, { status: 403 });
      }
    }

    // Operação atómica via RPC
    const { data, error } = await supabase.rpc('register_payment', {
      p_user_id:        user.id,
      p_plan_key:       plan_key,
      p_transaction_id: transaction_id,
      p_payment_method: payment_method,
      p_work_session_id: work_session_id ?? null,
    });

    if (error?.code === '23505' || error?.message?.includes('já registada')) {
      return NextResponse.json({ error: 'Transação já registada' }, { status: 409 });
    }
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, payment_id: data.payment_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

---

### Teste de Validação

```typescript
// src/tests/security/payment-race-condition.test.ts
// Executar com: npx vitest run src/tests/security/payment-race-condition.test.ts

describe('Race Condition — register_payment', () => {
  it('dois pedidos simultâneos com o mesmo transaction_id: apenas um deve ter sucesso', async () => {
    const requests = [
      fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
        body: JSON.stringify({ plan_key: 'basico', transaction_id: 'TRX-RACE-001', payment_method: 'mpesa' }),
      }),
      fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
        body: JSON.stringify({ plan_key: 'basico', transaction_id: 'TRX-RACE-001', payment_method: 'mpesa' }),
      }),
    ];

    const results = await Promise.all(requests);
    const statuses = results.map(r => r.status);

    // Exactamente um deve ser 200, o outro 409
    expect(statuses.filter(s => s === 200).length).toBe(1);
    expect(statuses.filter(s => s === 409).length).toBe(1);
  });
});
```

**Resultado esperado:** Apenas um dos pedidos simultâneos tem sucesso; o outro recebe 409.

---

### Lista de Verificação antes do Lançamento

- [ ] Função `register_payment` criada e testada no Supabase
- [ ] Handler POST simplificado a usar `supabase.rpc()`
- [ ] Teste de race condition a passar
- [ ] `amount_mzn` nunca aceite do cliente (vem sempre do plano no servidor)
- [ ] `work_session_id` verificado contra `user_id` antes de usar

---

## [R22] Rate Limiter em Memória — CRÍTICO

### Contexto

**O que existe actualmente:**

```typescript
// src/lib/rate-limit.ts
const store = new Map<string, Bucket>(); // estado volátil — reseta a cada cold start

export function enforceRateLimit(req: Request, config: RateLimitConfig): NextResponse | null {
  const bucket = store.get(key); // Map local — não partilhado entre instâncias
  // ...
}
```

**Por que é explorável:**  
Next.js em Vercel é serverless: cada pedido pode iniciar uma nova instância, o `Map` começa vazio, e o rate limit é contornado trivialmente. Um atacante pode forçar cold starts ou simplesmente aguardar que as instâncias rodem em paralelo.

**Impacto potencial:**  
Bypass completo do rate limiting em endpoints financeiros (`payment:post` — 5 req/min) e de autenticação; possibilidade de brute force e abuso de recursos.

---

### Arquitectura da Correcção

```
ACTUAL:
  Request → Rate Limit (Map em memória, volátil) → Handler
  ↑ cada instância Vercel tem o seu próprio Map

CORRECTO:
  Request → Rate Limit (Upstash Redis, persistente e partilhado) → Handler
  ↑ todas as instâncias partilham o mesmo estado Redis
```

---

### Implementação Passo a Passo

#### Passo 1 — Instalar dependência

```bash
npm install @upstash/ratelimit @upstash/redis
```

#### Passo 2 — Configurar variáveis de ambiente

```bash
# .env.local (nunca commitar)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

#### Passo 3 — Substituir rate-limit.ts

```typescript
// src/lib/rate-limit.ts — versão corrigida com Upstash
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// Singleton Redis (reutiliza conexão entre invocações quentes)
const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache de instâncias de rate limiter por scope
const limiters = new Map<string, Ratelimit>();

function getRateLimiter(scope: string, maxRequests: number, windowMs: number): Ratelimit {
  const key = `${scope}:${maxRequests}:${windowMs}`;
  if (!limiters.has(key)) {
    limiters.set(key, new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs}ms`),
      prefix:  `muneri:rl:${scope}`,
    }));
  }
  return limiters.get(key)!;
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

type RateLimitConfig = {
  scope: string;
  maxRequests: number;
  windowMs: number;
};

export async function enforceRateLimit(
  req: Request,
  config: RateLimitConfig,
): Promise<NextResponse | null> {
  // Fallback em desenvolvimento (sem Redis configurado)
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    console.warn('[rate-limit] UPSTASH_REDIS_REST_URL não configurado — rate limiting desactivado');
    return null;
  }

  const ip = getClientIp(req);
  const limiter = getRateLimiter(config.scope, config.maxRequests, config.windowMs);
  const { success, reset, remaining } = await limiter.limit(ip);

  if (!success) {
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'Demasiados pedidos. Tenta novamente em instantes.', retryAfterSec },
      {
        status: 429,
        headers: {
          'Retry-After':       String(retryAfterSec),
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Reset': String(reset),
        },
      },
    );
  }

  return null;
}
```

#### Passo 4 — Actualizar todos os handlers para usar `await`

```typescript
// Todos os handlers que usam enforceRateLimit devem adicionar await:
// ANTES:
const limited = enforceRateLimit(req, { scope: 'payment:post', maxRequests: 5, windowMs: 60_000 });

// DEPOIS:
const limited = await enforceRateLimit(req, { scope: 'payment:post', maxRequests: 5, windowMs: 60_000 });
```

> **Nota:** `enforceRateLimit` passa a ser `async`. Actualizar todas as chamadas nos seguintes ficheiros:
> - `src/app/api/payment/route.ts`
> - `src/app/api/chat/route.ts`
> - `src/app/api/cover/abstract/route.ts`
> - `src/app/api/cover/agent/route.ts`
> - `src/app/api/cover/export/route.ts`
> - `src/app/api/export/route.ts`
> - `src/app/api/tcc/approve/route.ts`
> - `src/app/api/tcc/compress/route.ts`
> - `src/app/api/tcc/develop/route.ts`
> - `src/app/api/tcc/outline/route.ts`
> - `src/app/api/tcc/session/route.ts`
> - `src/app/api/work/approve/route.ts`
> - `src/app/api/work/develop/route.ts`
> - `src/app/api/work/generate/route.ts`
> - `src/app/api/work/session/route.ts`

---

### Teste de Validação

```typescript
// src/tests/security/rate-limit.test.ts
describe('Rate Limiting — Redis persistente', () => {
  it('respeita o limite mesmo em instâncias paralelas simuladas', async () => {
    // Simula 6 pedidos rápidos (limite é 5/min para payment:post)
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        fetch('/api/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-real-ip': '1.2.3.4' },
          body: JSON.stringify({}),
        })
      )
    );
    const statuses = results.map(r => r.status);
    expect(statuses.filter(s => s === 429).length).toBeGreaterThanOrEqual(1);
  });
});
```

**Resultado esperado:** Pelo menos 1 dos 6 pedidos recebe 429; o limite é respeitado globalmente.

---

### Lista de Verificação antes do Lançamento

- [ ] Conta Upstash criada e Redis configurado
- [ ] `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` em produção (Vercel Environment Variables)
- [ ] Todos os handlers actualizados para `await enforceRateLimit(...)`
- [ ] Teste de rate limit a passar
- [ ] Verificar que o fallback de desenvolvimento não desactiva proteção em produção

---

## [R18] Mass Assignment — work_session_id — ALTO

### Contexto

**O que existe actualmente:**

```typescript
// src/app/api/payment/route.ts
const { plan_key, transaction_id, payment_method, work_session_id } = await req.json();
// work_session_id inserido sem verificar se pertence ao utilizador autenticado
await supabase.from('payment_history').insert({ ..., work_session_id: work_session_id ?? null });
```

**Por que é explorável:**  
Um atacante pode associar o seu pagamento à sessão de trabalho de outro utilizador, interferindo com o estado dessa sessão ou obtendo acesso a funcionalidades pagas indevidas.

**Impacto potencial:**  
Interferência com dados de outros utilizadores; possível acesso não autorizado a funcionalidades premium.

---

### Implementação Passo a Passo

#### Passo 1 — Validar ownership de work_session_id

```typescript
// Adicionar antes do INSERT em payment_history
if (work_session_id) {
  // Verificar que a sessão pertence ao utilizador autenticado
  const { data: ws, error: wsError } = await supabase
    .from('work_sessions')
    .select('id')
    .eq('id', work_session_id)
    .eq('user_id', user.id) // garantia de ownership
    .maybeSingle();

  if (wsError || !ws) {
    return NextResponse.json(
      { error: 'Sessão de trabalho inválida ou não autorizada' },
      { status: 403 }
    );
  }
}
```

#### Passo 2 — Whitelist explícita de campos do body

```typescript
// Campos aceites do cliente com tipos e limites explícitos
const ALLOWED_METHODS = ['mpesa', 'emola', 'bank_transfer', 'card'] as const;

const plan_key        = typeof body.plan_key === 'string'        ? body.plan_key.trim().slice(0, 50)        : null;
const transaction_id  = typeof body.transaction_id === 'string'  ? body.transaction_id.trim().slice(0, 100) : null;
const payment_method  = ALLOWED_METHODS.includes(body.payment_method) ? body.payment_method : null;
// work_session_id é o único campo UUID aceite — validado abaixo
const work_session_id = typeof body.work_session_id === 'string' && /^[0-9a-f-]{36}$/.test(body.work_session_id)
  ? body.work_session_id : null;

// NUNCA aceitar: amount_mzn, role, plan_expires_at, payment_status do body
```

---

### Teste de Validação

```typescript
describe('Mass Assignment — work_session_id', () => {
  it('rejeita work_session_id de outro utilizador', async () => {
    // userB tenta usar a sessão de userA
    const res = await fetch('/api/payment', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': userBAuthCookie },
      body: JSON.stringify({
        plan_key:        'basico',
        transaction_id:  'TRX-IDOR-001',
        payment_method:  'mpesa',
        work_session_id: userASessionId, // sessão pertence a outro utilizador
      }),
    });
    expect(res.status).toBe(403);
  });
});
```

**Resultado esperado:** 403 Forbidden ao tentar usar sessão de outro utilizador.

---

### Lista de Verificação antes do Lançamento

- [ ] Verificação de ownership de `work_session_id` implementada
- [ ] Whitelist explícita de campos do body (sem aceitar `amount_mzn` do cliente)
- [ ] Teste de IDOR a passar
- [ ] Campos sensíveis como `role` e `payment_status` nunca aceites do body

---

## [R07] Limite de Tamanho de Input — ALTO

### Contexto

**O que existe actualmente:**

```typescript
// Apenas verificação de presença — sem limites de tamanho ou validação de enum
const { plan_key, transaction_id, payment_method, work_session_id } = await req.json();
if (!plan_key || !transaction_id || !payment_method) {
  return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 });
}
```

**Por que é explorável:**  
`transaction_id` sem limite permite payloads de megabytes que podem causar DoS. `payment_method` sem enum gera erro 500 (expõe informação interna) em vez de 400 controlado.

**Impacto potencial:**  
DoS por payloads grandes; exposição de stack traces via erros 500.

---

### Implementação Passo a Passo

#### Passo 1 — Adicionar validação com Zod

```bash
npm install zod
```

#### Passo 2 — Schema de validação para pagamento

```typescript
// src/lib/validation/payment-schema.ts
import { z } from 'zod';

export const paymentPostSchema = z.object({
  plan_key:        z.string().trim().min(1).max(50),
  transaction_id:  z.string().trim().min(3).max(100),
  payment_method:  z.enum(['mpesa', 'emola', 'bank_transfer', 'card']),
  work_session_id: z.string().uuid().optional().nullable(),
});

export const paymentPatchSchema = z.object({
  payment_id: z.string().uuid(),
  action:     z.enum(['confirm', 'reject']),
  notes:      z.string().max(500).optional().nullable(),
});

export type PaymentPostInput  = z.infer<typeof paymentPostSchema>;
export type PaymentPatchInput = z.infer<typeof paymentPatchSchema>;
```

#### Passo 3 — Usar schema no handler

```typescript
// src/app/api/payment/route.ts — POST
const parseResult = paymentPostSchema.safeParse(await req.json());
if (!parseResult.success) {
  return NextResponse.json(
    { error: 'Dados inválidos', details: parseResult.error.flatten() },
    { status: 400 }
  );
}
const { plan_key, transaction_id, payment_method, work_session_id } = parseResult.data;
```

---

### Teste de Validação

```typescript
describe('Validação de Input — payment POST', () => {
  it('rejeita transaction_id com mais de 100 caracteres', async () => {
    const res = await fetch('/api/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({
        plan_key: 'basico',
        transaction_id: 'A'.repeat(101),
        payment_method: 'mpesa',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('rejeita payment_method inválido com 400 (não 500)', async () => {
    const res = await fetch('/api/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({ plan_key: 'basico', transaction_id: 'TRX-001', payment_method: 'bitcoin' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    // Não deve expor stack trace
    expect(JSON.stringify(body)).not.toContain('stack');
  });
});
```

**Resultado esperado:** Inputs inválidos retornam 400 com mensagem controlada, nunca 500.

---

### Lista de Verificação antes do Lançamento

- [ ] Zod instalado e schemas criados
- [ ] Todos os handlers de pagamento a usar `safeParse`
- [ ] Teste de inputs inválidos a passar
- [ ] Stack traces nunca expostos em respostas de erro

---

## [R16] Sem Auditoria de Acesso Admin — ALTO

### Contexto

**O que existe actualmente:**

```typescript
// GET /api/payment — admin acede a dados pessoais de todos os utilizadores sem registo
if (isAdmin) {
  // paymentsQuery sem filtro de user_id — retorna todos os pagamentos
  // Enriquece com profiles (email, full_name) — dados pessoais
  // Nenhum log desta operação
}
```

**Por que é explorável:**  
Um admin comprometido (ou um utilizador com `role = 'admin'` indevidamente atribuído) tem acesso silencioso a todos os dados pessoais sem deixar rasto auditável.

**Impacto potencial:**  
Violação de privacidade; incumprimento de obrigações legais de protecção de dados; dificuldade de detecção de abusos internos.

---

### Implementação Passo a Passo

#### Passo 1 — Adicionar tabela de auditoria

```sql
-- supabase/migrations/012_audit_log.sql
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz DEFAULT now(),
  actor_id    uuid REFERENCES profiles(id),
  action      text NOT NULL,  -- 'admin_list_payments', 'admin_confirm_payment', etc.
  resource    text,           -- 'payment_history', 'profiles'
  metadata    jsonb           -- detalhes adicionais (IDs acedidos, etc.)
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- Só admins podem ler; inserção via SECURITY DEFINER function
CREATE POLICY "audit_admin_read" ON audit_log FOR SELECT USING (is_admin());
-- Proibir DELETE e UPDATE mesmo para admins
CREATE POLICY "audit_immutable" ON audit_log FOR DELETE USING (false);
```

#### Passo 2 — Registar acesso admin no GET

```typescript
// src/app/api/payment/route.ts — GET handler
if (isAdmin) {
  // Registar acesso antes de retornar dados
  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action:   'admin_list_payments',
    resource: 'payment_history',
    metadata: { count: payments?.length ?? 0, timestamp: new Date().toISOString() },
  });
}
```

---

### Teste de Validação

```typescript
describe('Auditoria — acesso admin', () => {
  it('regista entrada em audit_log quando admin lista pagamentos', async () => {
    await fetch('/api/payment', { headers: { 'Cookie': adminAuthCookie } });
    const { data } = await adminSupabase
      .from('audit_log')
      .select('*')
      .eq('action', 'admin_list_payments')
      .order('created_at', { ascending: false })
      .limit(1);
    expect(data?.[0]?.actor_id).toBe(adminUserId);
  });
});
```

**Resultado esperado:** Cada acesso admin gera uma entrada em `audit_log`.

---

### Lista de Verificação antes do Lançamento

- [ ] Tabela `audit_log` criada e RLS configurado
- [ ] Todos os endpoints admin a registar acesso
- [ ] Política de retenção de logs definida (mín. 90 dias)
- [ ] Alertas configurados para acessos fora do horário normal

---

## [R21] Sem Detecção Automática de Fraude — ALTO

### Contexto

**O que existe actualmente:**

Todo o fluxo de pagamento depende de revisão humana manual. O utilizador submete qualquer string como `transaction_id` e aguarda que um admin confirme. Não existe verificação automática junto das operadoras.

**Por que é explorável:**  
Um utilizador pode submeter IDs fictícios repetidamente, tentando que um admin distraído confirme por engano. Sem alertas automáticos, padrões de fraude passam despercebidos.

**Impacto potencial:**  
Activação de planos pagos sem pagamento real; perda de receita; dificuldade de detecção de abuso sistemático.

---

### Implementação Passo a Passo

#### Passo 1 — Regras heurísticas automáticas (curto prazo)

```typescript
// src/lib/payment-fraud-detection.ts

export interface FraudCheckResult {
  flagged: boolean;
  reasons: string[];
}

export async function checkPaymentFraud(
  userId: string,
  transactionId: string,
  supabase: any,
): Promise<FraudCheckResult> {
  const reasons: string[] = [];

  // 1. Mesmo transaction_id submetido por IPs diferentes
  const { data: dupTxn } = await supabase
    .from('payment_history')
    .select('id, user_id')
    .eq('transaction_id', transactionId)
    .neq('user_id', userId);
  if (dupTxn?.length > 0) {
    reasons.push('transaction_id já usado por outro utilizador');
  }

  // 2. Utilizador com mais de 3 pagamentos pendentes simultâneos
  const { count } = await supabase
    .from('payment_history')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('status', 'pending');
  if ((count ?? 0) >= 3) {
    reasons.push('mais de 3 pagamentos pendentes simultâneos');
  }

  // 3. transaction_id com padrão suspeito (muito curto, só letras repetidas, etc.)
  if (transactionId.length < 6 || /^(.)\1{4,}/.test(transactionId)) {
    reasons.push('transaction_id com padrão suspeito');
  }

  return { flagged: reasons.length > 0, reasons };
}
```

#### Passo 2 — Integrar no handler POST

```typescript
// Após validação e antes do insert
const fraudCheck = await checkPaymentFraud(user.id, transaction_id, supabase);
if (fraudCheck.flagged) {
  // Registar mas não bloquear imediatamente — alertar admin
  console.warn('[payment] Fraude potencial detectada', { userId: user.id, reasons: fraudCheck.reasons });
  await supabase.from('audit_log').insert({
    actor_id: user.id,
    action:   'payment_fraud_flag',
    metadata: { transaction_id, reasons: fraudCheck.reasons },
  });
}
```

---

### Lista de Verificação antes do Lançamento

- [ ] Regras heurísticas implementadas e testadas
- [ ] Alertas ao admin para pagamentos flagged
- [ ] A longo prazo: integração com API M-Pesa/e-Mola para verificação de `transaction_id`
- [ ] Documentação das regras de fraude actualizada

---

## [R23] Testes de Segurança Incompletos — ALTO

### Contexto

**O que existe actualmente:**

```typescript
// src/tests/security/payment-security.test.ts — cobre apenas:
// ✅ 401 sem autenticação
// ✅ 403 sem role admin
// ✅ ignora amount_mzn do cliente
// ✅ 400 com plan_key inválido
// ✅ 429 com rate limit
// ❌ race condition
// ❌ work_session_id de outro utilizador (IDOR)
// ❌ payment_method inválido
// ❌ transaction_id com tamanho excessivo
// ❌ PATCH em pagamento já confirmado
```

---

### Implementação Passo a Passo

#### Passo 1 — Adicionar casos de teste em falta

```typescript
// src/tests/security/payment-security.test.ts — casos adicionais

it('PATCH em pagamento já confirmado retorna 409', async () => {
  // Configurar: payment já com status 'confirmed'
  const paymentSingle = vi.fn().mockResolvedValue({ data: { id: 'payment-1', status: 'confirmed' } });
  const paymentEq2 = vi.fn().mockResolvedValue({ count: 0, error: null }); // count = 0 → já processado
  const paymentEq = vi.fn().mockReturnValue({ eq: paymentEq2 });
  const paymentUpdate = vi.fn().mockReturnValue({ eq: paymentEq });

  // ... setup supabase mock com admin role ...

  const res = await PATCH(makeReq('http://localhost/api/payment', {
    method: 'PATCH',
    body: JSON.stringify({ payment_id: 'payment-1', action: 'confirm' }),
  }));
  expect(res.status).toBe(409);
});

it('POST com payment_method inválido retorna 400', async () => {
  const supabase: MockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn(),
  };
  mockCreateServerClient.mockReturnValue(supabase);

  const res = await POST(makeReq('http://localhost/api/payment', {
    method: 'POST',
    body: JSON.stringify({ plan_key: 'basico', transaction_id: 'TRX-001', payment_method: 'bitcoin' }),
  }));
  expect(res.status).toBe(400);
});

it('POST com transaction_id de 200 caracteres retorna 400', async () => {
  const supabase: MockSupabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn(),
  };
  mockCreateServerClient.mockReturnValue(supabase);

  const res = await POST(makeReq('http://localhost/api/payment', {
    method: 'POST',
    body: JSON.stringify({ plan_key: 'basico', transaction_id: 'A'.repeat(200), payment_method: 'mpesa' }),
  }));
  expect(res.status).toBe(400);
});
```

---

### Teste de Validação

```bash
# Executar suite completa
npx vitest run src/tests/security/
# Todos os testes devem passar — incluindo os novos
```

**Resultado esperado:** 100% dos testes de segurança a passar após implementação das correcções.

---

### Lista de Verificação antes do Lançamento

- [ ] Casos de teste adicionados e a passar
- [ ] Coverage de segurança > 80% nos handlers de pagamento
- [ ] CI/CD configurado para executar testes de segurança em cada PR

---

## [R13] Validação de logoBase64 — MÉDIO

### Contexto

**O que existe actualmente:**

```typescript
// src/app/api/cover/export/route.ts
if (coverData.logoBase64 || coverData.logoMediaType) {
  // Verifica magic bytes (bom) mas não verifica o prefixo da data URL
  const imageBuffer = validateBase64Image(coverData.logoBase64, coverData.logoMediaType);
}
```

**Por que é explorável:**  
Se `logoBase64` for uma URL HTTP externa (ex.: `http://attacker.com/img.png`) e o `replace` na função `validateBase64Image` falhar silenciosamente, o buffer pode conter dados inesperados. Também não existe verificação explícita do prefixo `data:image/`.

**Impacto potencial:**  
Processamento de dados arbitrários como imagem; possível DoS ou comportamento inesperado na geração do DOCX.

---

### Implementação Passo a Passo

#### Passo 1 — Verificar prefixo explicitamente

```typescript
// src/lib/validation/image-validator.ts — versão corrigida

export function validateBase64Image(
  base64: string,
  mediaType: 'image/png' | 'image/jpeg',
): Buffer | null {
  try {
    // 1. Verificar prefixo explícito (impede URLs externas)
    const expectedPrefix = `data:${mediaType};base64,`;
    if (!base64.startsWith(expectedPrefix)) {
      console.warn('[image-validator] Prefixo inválido:', base64.slice(0, 30));
      return null;
    }

    const rawBase64 = base64.slice(expectedPrefix.length);

    // 2. Verificar que é base64 válido
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(rawBase64)) {
      return null;
    }

    const buffer = Buffer.from(rawBase64, 'base64');

    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
    if (!validateImageBuffer(buffer, mediaType)) return null;

    return buffer;
  } catch {
    return null;
  }
}
```

---

### Teste de Validação

```typescript
// src/lib/validation/__tests__/image-validator.test.ts — casos adicionais

it('rejeita URL HTTP externa disfarçada de base64', () => {
  expect(validateBase64Image('http://evil.com/malware.png', 'image/png')).toBeNull();
});

it('rejeita base64 sem prefixo data:', () => {
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
  expect(validateBase64Image(pngBuffer.toString('base64'), 'image/png')).toBeNull();
});
```

**Resultado esperado:** URLs externas e base64 sem prefixo correctos são rejeitados.

---

### Lista de Verificação antes do Lançamento

- [ ] Verificação de prefixo implementada
- [ ] Testes de casos edge a passar
- [ ] Limite de tamanho de imagem mantido (2MB)

---

## Lista de Verificação Global Pré-Lançamento

### Obrigatório (CRÍTICO e ALTO)

- [ ] RLS verificado em produção — sem `USING (true)` activo em nenhuma tabela
- [ ] `user_id NOT NULL` em `tcc_sessions` e `work_sessions`
- [ ] Função `register_payment` RPC criada e testada
- [ ] Rate limiter migrado para Upstash Redis
- [ ] `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` configurados em produção
- [ ] `work_session_id` verificado contra `user_id` antes de usar
- [ ] Validação Zod para todos os campos do body de pagamento
- [ ] Tabela `audit_log` criada e acesso admin registado
- [ ] Regras heurísticas de fraude implementadas
- [ ] Suite de testes de segurança completa e a passar

### Recomendado (MÉDIO e Boas Práticas)

- [ ] Verificação de prefixo de `logoBase64` implementada
- [ ] Integração com API M-Pesa/e-Mola para verificação de `transaction_id`
- [ ] Testes de penetração com IA (R25) realizados
- [ ] Política de retenção de logs definida (mín. 90 dias)
- [ ] Rotação de secrets Gemini/Groq agendada
- [ ] Documentação de regras de acesso actualizada

---

## Referências e Recursos

| Recurso | Descrição |
|---------|-----------|
| [OWASP Top 10](https://owasp.org/www-project-top-ten/) | Top 10 vulnerabilidades mais críticas da web |
| [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security) | Configuração correcta de Row Level Security |
| [Upstash Rate Limit](https://github.com/upstash/ratelimit) | Rate limiting distribuído para serverless |
| [Zod](https://zod.dev/) | Validação de schema server-side em TypeScript |
| [Supabase RPC](https://supabase.com/docs/reference/javascript/rpc) | Transacções atómicas via funções PostgreSQL |

---

_Blueprint gerado automaticamente pela Security Audit Skill v1.0_  
_Baseado em: Relatório CTF v1.0 + Plataforma de Análise de Segurança de Código v1.0_
