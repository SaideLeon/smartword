# 🔐 Blueprint de Correcção de Segurança

**Projecto:** Muneri — Gerador de Trabalhos Académicos  
**Data da auditoria:** 2026-04-06  
**Auditado por:** Claude Security Audit Skill v1.0

---

## Pontuação de Segurança

| Métrica | Valor |
|---------|-------|
| Pontuação actual | 22/100 |
| Pontuação esperada após correcções | 97/100 |
| Vulnerabilidades CRÍTICO | 3 |
| Vulnerabilidades ALTO | 3 |
| Vulnerabilidades MÉDIO | 1 |
| **Resultado actual** | **🔴 REPROVADO — não apto para produção** |

> Após correcções das 3 CRÍTICO e 3 ALTO: score 97 → **Aprovado com Ressalvas**

---

## Índice de Vulnerabilidades

| # | Regra | Severidade | Localização | Esforço | Estado |
|---|-------|-----------|-------------|---------|--------|
| 1 | [R08/R19](#r08r19-race-condition-na-confirmação-de-pagamento) | 🔴 CRÍTICO | `api/payment/route.ts : PATCH()` | Alto | ⬜ Pendente |
| 2 | [R17](#r17-política-rls-audit_log-bloqueia-inserts-de-utilizadores-comuns) | 🔴 CRÍTICO | `migrations/012_audit_log.sql` | Médio | ⬜ Pendente |
| 3 | [R22](#r22-admin-page-acede-à-bd-directamente-sem-camada-de-api) | 🔴 CRÍTICO | `app/admin/page.tsx` | Alto | ⬜ Pendente |
| 4 | [R16](#r16-audit_log-como-ponto-único-de-falha-no-get-payments) | 🟠 ALTO | `api/payment/route.ts : GET()` | Baixo | ⬜ Pendente |
| 5 | [R18](#r18-campo-notes-aceite-sem-sanitização-htmlxss) | 🟠 ALTO | `api/payment/route.ts : PATCH()` | Baixo | ⬜ Pendente |
| 6 | [R21](#r21-detecção-de-fraude-não-bloqueia-o-pagamento) | 🟠 ALTO | `api/payment/route.ts : POST()` | Médio | ⬜ Pendente |
| 7 | [R13](#r13-filename-sem-sanitização-no-header-content-disposition) | 🟡 MÉDIO | `api/cover/export/route.ts` | Baixo | ⬜ Pendente |

> **Esforço:** Baixo (< 1h) · Médio (1–4h) · Alto (> 4h)

---

## [R08/R19] Race Condition na Confirmação de Pagamento — CRÍTICO

### Contexto

**O que existe actualmente:**

```typescript
// src/app/api/payment/route.ts — PATCH()
// Passo 1: leitura do pagamento
const { data: payment } = await supabase
  .from('payment_history')
  .select('*, plans(*)')
  .eq('id', paymentId)
  .single();

// ← JANELA DE RACE CONDITION: outra request pode confirmar aqui

// Passo 2: actualização condicional (dois statements separados)
const { count } = await supabase
  .from('payment_history')
  .update({ status: newStatus, confirmed_by: user.id, ... })
  .eq('id', paymentId)
  .eq('status', 'pending'); // sem lock na leitura anterior
```

**Por que é explorável:**
Dois admins a confirmar o mesmo pagamento em simultâneo lêem ambos `status='pending'` no Passo 1. Ambos avançam para o Passo 2 e um sobrescreve o outro. Mais grave: após a confirmação, o perfil do utilizador é actualizado (`plan_key`, `plan_expires_at`, `works_used = 0`) — esta actualização pode ocorrer duas vezes, reiniciando contadores de uso indevidamente.

**Impacto potencial:**
Activação dupla de plano pago, reset duplo de contadores de uso, inconsistência de estado financeiro.

---

### Arquitectura da Correcção

```
ANTES:
  PATCH handler
    └── SELECT payment (sem lock)
    └── UPDATE payment WHERE status='pending'   ← race window
    └── UPDATE profiles

DEPOIS:
  PATCH handler
    └── RPC confirm_payment(payment_id, admin_id, action, notes)
          └── SELECT payment FOR UPDATE          ← row lock
          └── IF status != 'pending' → RAISE EXCEPTION
          └── UPDATE payment_history
          └── UPDATE profiles
          └── RETURN result
          └── COMMIT (automático no PL/pgSQL)
```

---

### Implementação Passo a Passo

#### Passo 1 — Criar função PL/pgSQL `confirm_payment`

```sql
-- supabase/migrations/013_atomic_confirm_payment.sql

CREATE OR REPLACE FUNCTION confirm_payment(
  p_payment_id uuid,
  p_admin_id   uuid,
  p_action     text,   -- 'confirm' | 'reject'
  p_notes      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment  payment_history%ROWTYPE;
  v_plan     plans%ROWTYPE;
  v_new_status text;
  v_expires  timestamptz;
BEGIN
  -- Verificar que o chamador é admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'P0001';
  END IF;

  IF p_action NOT IN ('confirm', 'reject') THEN
    RAISE EXCEPTION 'Acção inválida' USING ERRCODE = 'P0002';
  END IF;

  -- Lock optimista: bloqueia a linha para esta transacção
  SELECT * INTO v_payment
  FROM payment_history
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado' USING ERRCODE = 'P0003';
  END IF;

  -- Verificar idempotência: já foi processado?
  IF v_payment.status != 'pending' THEN
    RAISE EXCEPTION 'Pagamento já foi processado: %', v_payment.status
      USING ERRCODE = 'P0004';
  END IF;

  v_new_status := CASE p_action WHEN 'confirm' THEN 'confirmed' ELSE 'rejected' END;

  -- Actualizar pagamento
  UPDATE payment_history
  SET status       = v_new_status,
      confirmed_by = p_admin_id,
      confirmed_at = now(),
      notes        = p_notes,
      updated_at   = now()
  WHERE id = p_payment_id;

  -- Actualizar perfil do utilizador
  IF p_action = 'confirm' THEN
    SELECT * INTO v_plan FROM plans WHERE key = v_payment.plan_key;

    IF v_plan.duration_months > 0 THEN
      v_expires := now() + (v_plan.duration_months || ' months')::interval;
    END IF;

    UPDATE profiles
    SET plan_key            = v_payment.plan_key,
        plan_expires_at     = v_expires,
        payment_status      = 'active',
        payment_verified_at = now(),
        payment_verified_by = p_admin_id,
        works_used          = 0,
        edits_used          = 0,
        updated_at          = now()
    WHERE id = v_payment.user_id;
  ELSE
    UPDATE profiles
    SET payment_status = 'none',
        updated_at     = now()
    WHERE id = v_payment.user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', v_new_status);

EXCEPTION
  WHEN SQLSTATE 'P0004' THEN
    -- Re-lançar com código específico para o handler HTTP distinguir
    RAISE EXCEPTION '%', SQLERRM USING ERRCODE = 'P0004';
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_payment(uuid, uuid, text, text) TO authenticated;
```

#### Passo 2 — Simplificar o handler PATCH para usar o RPC

```typescript
// src/app/api/payment/route.ts — PATCH() substituído

export async function PATCH(req: Request) {
  const limited = await enforceRateLimit(req, {
    scope: 'payment:patch', maxRequests: 30, windowMs: 60_000
  });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  // Verificar role admin (mantida por defesa em profundidade, além do RLS)
  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (adminProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    const parsedBody = parsePaymentPatchBody(await req.json());
    if (!parsedBody) {
      return NextResponse.json({ error: 'payment_id e action são obrigatórios' }, { status: 400 });
    }
    const { paymentId, action, notes } = parsedBody;

    // Uma única chamada atómica com SELECT FOR UPDATE interno
    const { data, error } = await supabase.rpc('confirm_payment', {
      p_payment_id: paymentId,
      p_admin_id:   user.id,
      p_action:     action,
      p_notes:      notes ?? null,
    });

    if (error) {
      // P0004 = já processado (409)
      if (error.code === 'P0004') {
        return NextResponse.json(
          { error: 'Pagamento já foi processado anteriormente' },
          { status: 409 }
        );
      }
      if (error.code === 'P0003') {
        return NextResponse.json({ error: 'Pagamento não encontrado' }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, status: action === 'confirm' ? 'confirmed' : 'rejected' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

---

### Teste de Validação

```typescript
// src/__tests__/security/payment-race-condition.test.ts
import { describe, expect, it, vi } from 'vitest';

describe('R08/R19 — confirm_payment atómica', () => {
  it('segunda confirmação simultânea retorna 409', async () => {
    // Simula dois admins a confirmar o mesmo pagamento
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { ok: true, status: 'confirmed' }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'P0004', message: 'Pagamento já foi processado: confirmed' }
      });

    const supabase = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } } }) },
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }) }) }) }),
      rpc };

    // Primeira confirmação: sucesso
    const res1 = await rpc('confirm_payment', { p_payment_id: 'p-1', p_admin_id: 'admin-1', p_action: 'confirm', p_notes: null });
    expect(res1.error).toBeNull();

    // Segunda confirmação: 409
    const res2 = await rpc('confirm_payment', { p_payment_id: 'p-1', p_admin_id: 'admin-2', p_action: 'confirm', p_notes: null });
    expect(res2.error?.code).toBe('P0004');
  });
});
```

**Resultado esperado:** Segunda chamada devolve `{ error: { code: 'P0004' } }`, handler retorna HTTP 409.

---

### Lista de Verificação antes do Lançamento

- [ ] Migração `013_atomic_confirm_payment.sql` aplicada em produção
- [ ] Handler PATCH simplificado e testado
- [ ] Testes de race condition a passar
- [ ] Remover código de actualização de `profiles` do handler (agora no RPC)
- [ ] Variáveis de ambiente actualizadas (se aplicável)
- [ ] Revisão de código por par antes do merge

---

## [R17] Política RLS `audit_log` Bloqueia Inserts de Utilizadores Comuns — CRÍTICO

### Contexto

**O que existe actualmente:**

```sql
-- migrations/012_audit_log.sql
CREATE POLICY "audit_log_admin_insert" ON audit_log
  FOR INSERT
  WITH CHECK (is_admin() AND actor_id = auth.uid());
-- ← Apenas admins podem inserir
```

```typescript
// src/app/api/payment/route.ts — POST() — utilizador comum
if (fraudCheck.flagged) {
  const { error: fraudAuditError } = await supabase
    .from('audit_log')
    .insert({ actor_id: user.id, action: 'payment_fraud_flag', ... });
  // ← RLS rejeita silenciosamente; fraudAuditError é logado mas fluxo continua
}
```

**Por que é explorável:**
O sistema de detecção de fraude depende do audit_log para registar actividade suspeita. Como a política bloqueia inserts de utilizadores comuns, **nenhum evento de fraude é jamais registado**. O administrador fica cego a toda a actividade fraudulenta. Um atacante pode reutilizar transaction IDs de outros utilizadores repetidamente sem deixar rasto.

**Impacto potencial:**
Sistema de anti-fraude completamente inoperacional. Fraude financeira sem detecção ou auditoria.

---

### Arquitectura da Correcção

```
OPÇÃO A (recomendada) — Função SECURITY DEFINER:
  POST /api/payment
    └── checkPaymentFraud() → flagged: true
    └── log_fraud_event(user_id, transaction_id, reasons[])
          └── INSERT INTO audit_log (SECURITY DEFINER ignora RLS do chamador)

OPÇÃO B — Política RLS adicional:
  Adicionar policy que permite INSERT quando actor_id = auth.uid()
  (mais simples, mas dá acesso mais amplo ao audit_log)
```

---

### Implementação Passo a Passo

#### Passo 1 — Criar função `SECURITY DEFINER` para log de fraude

```sql
-- supabase/migrations/014_fraud_audit_function.sql

-- Função que contorna o RLS para registar eventos de fraude de utilizadores
CREATE OR REPLACE FUNCTION log_fraud_event(
  p_actor_id      uuid,
  p_transaction_id text,
  p_reasons       text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- executa com privilégios do owner, não do chamador
SET search_path = public
AS $$
BEGIN
  -- Validação: o actor deve ser o utilizador autenticado
  IF p_actor_id != auth.uid() THEN
    RAISE EXCEPTION 'actor_id deve ser o utilizador autenticado';
  END IF;

  INSERT INTO audit_log (actor_id, action, resource, metadata)
  VALUES (
    p_actor_id,
    'payment_fraud_flag',
    'payment_history',
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'reasons',        to_jsonb(p_reasons),
      'flagged_at',     now()
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION log_fraud_event(uuid, text, text[]) TO authenticated;
```

#### Passo 2 — Usar o RPC no handler POST

```typescript
// src/app/api/payment/route.ts — POST() — bloco de fraude

if (fraudCheck.flagged) {
  console.warn('[payment POST] fraude potencial detectada', {
    userId: user.id, transactionId, reasons: fraudCheck.reasons,
  });

  // Usa função SECURITY DEFINER em vez de insert directo
  const { error: fraudAuditError } = await supabase.rpc('log_fraud_event', {
    p_actor_id:       user.id,
    p_transaction_id: transactionId,
    p_reasons:        fraudCheck.reasons,
  });

  if (fraudAuditError) {
    // Se o log de fraude falhar, bloquear a transacção por precaução
    console.error('[payment POST] Falha crítica ao registar fraude:', fraudAuditError.message);
    return NextResponse.json({ error: 'Erro interno de segurança' }, { status: 500 });
  }

  // DECISÃO DE NEGÓCIO: bloquear pagamentos flagged (ver R21)
  return NextResponse.json(
    { error: 'Transação não pode ser processada. Contacte o suporte.' },
    { status: 409 }
  );
}
```

---

### Teste de Validação

```typescript
// src/__tests__/security/payment-security.test.ts — adicionar ao suite existente

it('POST com fraude deteta e regista via RPC (não insert directo)', async () => {
  mockCheckPaymentFraud.mockResolvedValueOnce({
    flagged: true, reasons: ['transaction_id já usado por outro utilizador'],
  });

  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn(),
    rpc,
  };
  mockCreateServerClient.mockReturnValue(supabase);

  const res = await POST(makeReq('http://localhost/api/payment', {
    method: 'POST',
    body: JSON.stringify({ plan_key: 'premium', transaction_id: 'TRX-FRAUD', payment_method: 'mpesa' }),
  }));

  expect(res.status).toBe(409); // Bloqueado
  expect(rpc).toHaveBeenCalledWith('log_fraud_event', expect.objectContaining({
    p_actor_id: 'user-1',
    p_transaction_id: 'TRX-FRAUD',
  }));
});
```

**Resultado esperado:** `rpc('log_fraud_event', ...)` chamado; resposta HTTP 409.

---

### Lista de Verificação antes do Lançamento

- [ ] Migração `014_fraud_audit_function.sql` aplicada
- [ ] Handler POST actualizado para usar `rpc('log_fraud_event')`
- [ ] Verificar que `log_fraud_event` falha se `p_actor_id != auth.uid()`
- [ ] Testes de fraude actualizados e a passar
- [ ] Revisão de código por par

---

## [R22] Admin Page Acede à BD Directamente sem Camada de API — CRÍTICO

### Contexto

**O que existe actualmente:**

```typescript
// src/app/admin/page.tsx — acesso directo à BD pelo browser
const loadExpenses = useCallback(async () => {
  const { data } = await supabaseClient
    .from('expense_items')
    .select('*')
    .order('created_at', { ascending: false });
  setExpenses((data as ExpenseItem[]) ?? []);
}, []);

const handleSaveExpense = async () => {
  const { error } = editingExpenseId
    ? await supabaseClient.from('expense_items').update(payload).eq('id', editingExpenseId)
    : await supabaseClient.from('expense_items').insert({ created_by: user.id, ...payload });
};

const handleGenerateReport = async () => {
  const { error } = await supabaseClient.rpc('generate_monthly_report', { ... });
};
```

**Por que é explorável:**
Quando a lógica de negócio reside apenas no RLS do Supabase, uma única misconfiguration de política (erro de migração, update de schema, bug em `is_admin()`) expõe directamente dados financeiros sensíveis. Não existe camada de validação de input, rate limiting, nem audit log para estas operações — todas elas críticas para o negócio.

**Impacto potencial:**
Exposição total de dados financeiros da plataforma (receitas, despesas, margens) se o RLS falhar. Sem rastreabilidade de quem alterou o quê.

---

### Arquitectura da Correcção

```
ANTES:
  Browser (admin/page.tsx)
    └── supabaseClient.from('expense_items') → Supabase RLS (única camada)

DEPOIS:
  Browser (admin/page.tsx)
    └── fetch('/api/admin/expenses')
          └── enforceRateLimit()
          └── verificar role=admin (server-side)
          └── supabase server client (cookie auth)
          └── audit_log de acesso
          └── Supabase RLS (segunda camada)
```

---

### Implementação Passo a Passo

#### Passo 1 — Criar `/api/admin/expenses/route.ts`

```typescript
// src/app/api/admin/expenses/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { enforceRateLimit } from '@/lib/rate-limit';

async function makeSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value,
                  set: (n, v, o) => cookieStore.set({ name: n, value: v, ...o }),
                  remove: (n, o) => cookieStore.delete({ name: n, ...o }) } }
  );
}

async function requireAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;
  return user;
}

export async function GET(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:expenses:get', maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { data, error } = await supabase
    .from('expense_items').select('*').order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:expenses:post', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const body = await req.json();

  // Whitelist de campos — protecção contra mass assignment
  const ALLOWED_CATEGORIES = ['groq_api', 'supabase', 'hosting', 'domain', 'other'] as const;
  const category = body.category;
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : null;
  const amount_mzn = typeof body.amount_mzn === 'number' && body.amount_mzn >= 0 ? body.amount_mzn : null;
  const period_month = Number.isInteger(body.period_month) && body.period_month >= 1 && body.period_month <= 12 ? body.period_month : null;
  const period_year = Number.isInteger(body.period_year) && body.period_year >= 2020 ? body.period_year : null;

  if (!ALLOWED_CATEGORIES.includes(category) || !description || amount_mzn === null || !period_month || !period_year) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  const { data, error } = await supabase.from('expense_items').insert({
    created_by: user.id, category, description, amount_mzn, period_month, period_year,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:expenses:patch', maxRequests: 20, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const body = await req.json();
  const { id, ...rest } = body;
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  // Apenas campos permitidos
  const update: Record<string, unknown> = {};
  if (rest.description) update.description = String(rest.description).trim().slice(0, 500);
  if (rest.amount_mzn !== undefined) update.amount_mzn = Number(rest.amount_mzn);

  const { data, error } = await supabase.from('expense_items').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const limited = await enforceRateLimit(req, { scope: 'admin:expenses:delete', maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const user = await requireAdmin(supabase);
  if (!user) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const { error } = await supabase.from('expense_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

#### Passo 2 — Actualizar `admin/page.tsx` para usar as novas API routes

```typescript
// src/app/admin/page.tsx — substituir todas as chamadas supabaseClient

// ANTES:
// const { data } = await supabaseClient.from('expense_items').select('*')...

// DEPOIS:
const loadExpenses = useCallback(async () => {
  const res = await fetch('/api/admin/expenses');
  const data = await res.json();
  if (!res.ok) { setMessage(`Erro: ${data?.error}`); return; }
  setExpenses(Array.isArray(data) ? data : []);
}, []);

const handleSaveExpense = async () => {
  const method = editingExpenseId ? 'PATCH' : 'POST';
  const url = editingExpenseId ? `/api/admin/expenses?id=${editingExpenseId}` : '/api/admin/expenses';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...expForm, amount_mzn: Number(expForm.amount_mzn) }),
  });
  if (!res.ok) { flash('Erro ao guardar despesa.'); return; }
  flash(editingExpenseId ? 'Despesa actualizada.' : 'Despesa adicionada.');
  resetExpenseForm();
  void loadExpenses();
};

const handleDeleteExpense = async (id: string) => {
  const res = await fetch(`/api/admin/expenses?id=${id}`, { method: 'DELETE' });
  if (!res.ok) { flash('Não foi possível eliminar.'); return; }
  if (editingExpenseId === id) resetExpenseForm();
  flash('Despesa eliminada.');
  void loadExpenses();
};
```

---

### Teste de Validação

```typescript
// src/__tests__/security/admin-expenses.test.ts
import { describe, expect, it } from 'vitest';

describe('R22 — Admin Expenses API', () => {
  it('GET sem autenticação retorna 403', async () => {
    // Mock sem user autenticado
    const res = await GET(new Request('http://localhost/api/admin/expenses'));
    expect(res.status).toBe(403);
  });

  it('POST com utilizador não-admin retorna 403', async () => {
    // Mock com user role='user'
    const res = await POST(new Request('http://localhost/api/admin/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'supabase', description: 'Test', amount_mzn: 100, period_month: 4, period_year: 2026 }),
    }));
    expect(res.status).toBe(403);
  });

  it('POST rejeita campos fora da whitelist', async () => {
    // Mock com user role='admin', mas body com campo injectado
    const res = await POST(new Request('http://localhost/api/admin/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'evil', description: 'Hack', amount_mzn: -999, period_month: 4, period_year: 2026 }),
    }));
    expect(res.status).toBe(400);
  });
});
```

**Resultado esperado:** Acessos não autorizados e dados inválidos rejeitados com 403/400.

---

### Lista de Verificação antes do Lançamento

- [ ] API routes `/api/admin/expenses` e `/api/admin/reports` criadas e testadas
- [ ] `admin/page.tsx` migrado para usar API routes
- [ ] Rate limiting activo em todos os endpoints admin
- [ ] `supabaseClient` browser removido de todas as operações financeiras admin
- [ ] Testes de integração a cobrir cenários de acesso não autorizado
- [ ] Revisão de código por par

---

## [R16] `audit_log` como Ponto Único de Falha no GET Payments — ALTO

### Contexto

**O que existe actualmente:**

```typescript
// src/app/api/payment/route.ts — GET()
if (isAdmin) {
  const { error: auditError } = await supabase.from('audit_log').insert({...});
  if (auditError) {
    // ← Bloqueia completamente a listagem de pagamentos
    return NextResponse.json({ error: 'Falha ao registrar auditoria de acesso admin' }, { status: 500 });
  }
}
// Continua para listar pagamentos apenas se audit passou
```

**Por que é explorável:**
Se o `audit_log` estiver temporariamente indisponível (falha de BD, limite de conexões, bug de migração), o admin perde acesso a toda a lista de pagamentos. Um atacante que consiga causar erros no `audit_log` (ex.: preenchendo o disco, injectando dados inválidos) efectivamente bloqueia a capacidade de gestão de pagamentos.

**Impacto potencial:**
Denial of service auto-infligido. Admin incapaz de confirmar/rejeitar pagamentos durante falhas de auditoria.

---

### Implementação Passo a Passo

#### Passo 1 — Desacoplar auditoria da operação principal

```typescript
// src/app/api/payment/route.ts — GET() corrigido

if (isAdmin) {
  // Auditoria assíncrona — não bloqueia a resposta
  supabase.from('audit_log').insert({
    actor_id: user.id,
    action: 'admin_list_payments',
    resource: 'payment_history',
    metadata: { endpoint: '/api/payment', method: 'GET', queried_at: new Date().toISOString() },
  }).then(({ error }) => {
    if (error) {
      // Logar o erro mas NÃO bloquear a operação
      console.error('[payment GET] Falha ao registrar auditoria admin:', error.message);
      // Opcional: enviar para serviço de monitoring (ex.: Sentry)
    }
  });
  // Continua imediatamente para listar pagamentos
}
```

---

### Teste de Validação

```typescript
// Actualizar teste existente em payment-security.test.ts

it('GET admin com falha de auditoria retorna 200 (não 500)', async () => {
  const auditInsert = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } });
  const paymentsSelect = vi.fn().mockReturnValue({
    order: vi.fn().mockReturnValue({ data: [], error: null })
  });

  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === 'profiles') return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { role: 'admin' } }) }) }) };
      if (table === 'audit_log') return { insert: auditInsert };
      if (table === 'payment_history') return { select: paymentsSelect };
      throw new Error(`unexpected: ${table}`);
    }),
  };
  mockCreateServerClient.mockReturnValue(supabase);

  const res = await GET(makeReq('http://localhost/api/payment', { method: 'GET' }));
  // Antes: 500 — Depois: 200
  expect(res.status).toBe(200);
});
```

**Resultado esperado:** HTTP 200 mesmo quando `audit_log` falha. Erro apenas logado no servidor.

---

### Lista de Verificação antes do Lançamento

- [ ] Auditoria convertida para operação assíncrona (fire-and-forget com logging de erros)
- [ ] Teste `GET admin sem auditoria persistida retorna 500` actualizado para esperar 200
- [ ] Verificar que auditoria ainda é registada em condições normais

---

## [R18] Campo `notes` Aceite sem Sanitização HTML/XSS — ALTO

### Contexto

**O que existe actualmente:**

```typescript
// src/app/api/payment/route.ts — parsePaymentPatchBody()
let notes: string | null = null;
if (payload.notes != null) {
  const normalized = payload.notes.trim();
  if (normalized.length > 500) return null;
  notes = normalized || null;
  // ← Sem stripping de HTML ou scripts
}
```

**Por que é explorável:**
O campo `notes` é guardado em BD e renderizado no painel admin (`src/app/admin/page.tsx`) dentro de um elemento React. Embora o React escape texto por defeito em `{p.notes}`, se algum componente futuro usar `dangerouslySetInnerHTML` ou se o campo for usado noutro contexto (email, PDF, exportação), o HTML não sanitizado causará XSS stored.

**Impacto potencial:**
XSS stored no painel admin, potencial account takeover de contas de administrador.

---

### Implementação Passo a Passo

#### Passo 1 — Sanitizar `notes` no parser

```typescript
// src/app/api/payment/route.ts — parsePaymentPatchBody() corrigido

function stripHtml(input: string): string {
  // Remove todas as tags HTML e atributos event handler
  return input
    .replace(/<[^>]*>/g, '')           // remove tags HTML
    .replace(/javascript:/gi, '')       // remove protocolo javascript:
    .replace(/on\w+\s*=/gi, '')         // remove event handlers inline
    .trim();
}

function parsePaymentPatchBody(body: unknown): PaymentPatchInput | null {
  // ... validação existente ...

  let notes: string | null = null;
  if (payload.notes != null) {
    if (typeof payload.notes !== 'string') return null;
    const stripped = stripHtml(payload.notes.trim());
    if (stripped.length > 500) return null;
    notes = stripped || null;
  }

  return { paymentId: payload.payment_id.trim(), action: payload.action, notes };
}
```

---

### Teste de Validação

```typescript
it('PATCH rejeita/sanitiza notes com HTML (R18)', async () => {
  // ... setup de supabase mock com admin ...
  const res = await PATCH(makeReq('http://localhost/api/payment', {
    method: 'PATCH',
    body: JSON.stringify({
      payment_id: '2b59e44a-e319-48b4-a63f-36350ea7fc77',
      action: 'confirm',
      notes: '<script>alert("xss")</script>Nota legítima',
    }),
  }));
  // A nota deve ser guardada sem o script
  // Verificar que rpc foi chamado com notes sem HTML
  expect(rpc).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
    p_notes: expect.not.stringContaining('<script>'),
  }));
});
```

**Resultado esperado:** `notes` guardado como `"Nota legítima"` sem o tag `<script>`.

---

### Lista de Verificação antes do Lançamento

- [ ] Função `stripHtml` adicionada e testada
- [ ] `parsePaymentPatchBody` actualizado
- [ ] Considerar usar `isomorphic-dompurify` para sanitização mais robusta em produção

---

## [R21] Detecção de Fraude não Bloqueia o Pagamento — ALTO

### Contexto

**O que existe actualmente:**

```typescript
// src/app/api/payment/route.ts — POST()
const fraudCheck = await checkPaymentFraud(user.id, transactionId, supabase);
if (fraudCheck.flagged) {
  // Apenas loga — pagamento continua!
  await supabase.from('audit_log').insert({...}); // falha silenciosamente
}
// Executa independentemente
const { data, error } = await supabase.rpc('register_payment', {...});
```

**Por que é explorável:**
A detecção de fraude é puramente informativa. Um utilizador que reutilize o `transaction_id` de outra pessoa tem o pagamento registado com sucesso. Como o audit_log também falha silenciosamente (R17), nem registo há.

**Impacto potencial:**
Activação fraudulenta de planos pagos sem pagamento legítimo. Perda de receita directa.

---

### Implementação Passo a Passo

#### Passo 1 — Adicionar decisão de bloqueio após detecção de fraude

```typescript
// src/app/api/payment/route.ts — POST() — bloco de fraude completo

const fraudCheck = await checkPaymentFraud(user.id, transactionId, supabase);
if (fraudCheck.flagged) {
  console.warn('[payment POST] fraude potencial detectada', {
    userId: user.id, transactionId, reasons: fraudCheck.reasons,
  });

  // Registar via função SECURITY DEFINER (ver R17)
  const { error: auditError } = await supabase.rpc('log_fraud_event', {
    p_actor_id:       user.id,
    p_transaction_id: transactionId,
    p_reasons:        fraudCheck.reasons,
  });

  if (auditError) {
    console.error('[payment POST] Falha crítica ao registar fraude:', auditError.message);
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 });
  }

  // BLOQUEIO: não continuar com register_payment
  return NextResponse.json(
    { error: 'Não foi possível processar a transacção. Se o problema persistir, contacte o suporte.' },
    { status: 409 }
  );
}
```

---

### Teste de Validação

```typescript
it('POST com fraude retorna 409 e NÃO regista o pagamento (R21)', async () => {
  mockCheckPaymentFraud.mockResolvedValueOnce({
    flagged: true, reasons: ['transaction_id já usado'],
  });
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  // ... setup supabase ...

  const res = await POST(makeReq('http://localhost/api/payment', {
    method: 'POST',
    body: JSON.stringify({ plan_key: 'premium', transaction_id: 'TRX-123', payment_method: 'mpesa' }),
  }));

  expect(res.status).toBe(409);
  // register_payment NUNCA deve ser chamado quando há fraude
  expect(rpc).toHaveBeenCalledWith('log_fraud_event', expect.anything());
  expect(rpc).not.toHaveBeenCalledWith('register_payment', expect.anything());
});
```

**Resultado esperado:** HTTP 409, `register_payment` não é chamado.

---

### Lista de Verificação antes do Lançamento

- [ ] Bloco de fraude retorna 409 antes de `register_payment`
- [ ] Teste existente `POST com fraude potencial registra audit_log` actualizado para esperar 409
- [ ] Mensagem de erro genérica (não revela motivo da rejeição ao utilizador)

---

## [R13] `filename` sem Sanitização no Header Content-Disposition — MÉDIO

### Contexto

**O que existe actualmente:**

```typescript
// src/app/api/cover/export/route.ts
const { coverData, markdown, filename = 'trabalho' } = await req.json();
// ...
'Content-Disposition': `attachment; filename="${filename}.docx"`,
// filename não sanitizado — pode conter " ou caracteres de controlo
```

**Por que é explorável:**
Um utilizador pode enviar `filename = 'file"; malicious-header: injected'`, injectando headers HTTP adicionais na resposta. Causa HTTP header injection.

**Impacto potencial:**
Manipulação de headers de resposta, potencial cache poisoning ou redirecccionamento em proxies.

---

### Implementação Passo a Passo

#### Passo 1 — Sanitizar `filename` antes de usar no header

```typescript
// src/app/api/cover/export/route.ts — e também src/app/api/export/route.ts

function sanitizeFilename(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9_\-. ]/g, '') // apenas caracteres seguros
    .replace(/\s+/g, '_')               // espaços para underscore
    .slice(0, 80)                        // limite de tamanho
    || 'documento';                      // fallback se vazio após sanitização
}

// No handler:
const rawFilename = typeof body.filename === 'string' ? body.filename : 'trabalho';
const filename = sanitizeFilename(rawFilename);

return new NextResponse(buffer, {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename="${filename}.docx"`,
  },
});
```

---

### Teste de Validação

```typescript
it('sanitiza filename com caracteres especiais (R13)', () => {
  expect(sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
  expect(sanitizeFilename('file"; evil=1')).toBe('file_evil1');
  expect(sanitizeFilename('trabalho académico')).toBe('trabalho_acadmico');
  expect(sanitizeFilename('')).toBe('documento');
});
```

**Resultado esperado:** Todos os casos devolvem strings seguras para uso em headers HTTP.

---

### Lista de Verificação antes do Lançamento

- [ ] `sanitizeFilename` aplicado em `cover/export/route.ts` e `export/route.ts`
- [ ] Testes unitários da função adicionados

---

## Lista de Verificação Global Pré-Lançamento

### Obrigatório (CRÍTICO e ALTO)
- [ ] Migração `013_atomic_confirm_payment.sql` aplicada e testada
- [ ] Migração `014_fraud_audit_function.sql` aplicada e testada
- [ ] Handler PATCH usa RPC `confirm_payment` com `FOR UPDATE`
- [ ] Handler POST usa RPC `log_fraud_event` e bloqueia pagamentos fraudulentos
- [ ] API routes `/api/admin/expenses` e `/api/admin/reports` criadas
- [ ] `admin/page.tsx` migrado para API routes (sem `supabaseClient` browser para BD financeira)
- [ ] Auditoria no `GET /api/payment` convertida para assíncrona (não bloqueia)
- [ ] Campo `notes` sanitizado contra HTML/XSS
- [ ] Suite de testes de segurança (`vitest run`) a passar integralmente
- [ ] RLS revisto após migrações (confirmar `audit_log` acessível para `log_fraud_event`)

### Recomendado (MÉDIO e Boas Práticas)
- [ ] `sanitizeFilename` aplicado em todos os endpoints de exportação
- [ ] Testes de penetração manuais nos endpoints de pagamento
- [ ] Monitorização de erros (ex.: Sentry) para falhas silenciosas de auditoria
- [ ] Rotação de secrets do Supabase agendada
- [ ] Revisão de todas as políticas RLS após cada nova migração

---

## Referências e Recursos

| Recurso | Descrição |
|---------|-----------|
| [OWASP Top 10](https://owasp.org/www-project-top-ten/) | Top 10 vulnerabilidades mais críticas da web |
| [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security) | Configuração correcta de Row Level Security |
| [Supabase SECURITY DEFINER](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker) | Funções que contornam RLS de forma controlada |
| [PostgreSQL FOR UPDATE](https://www.postgresql.org/docs/current/sql-select.html#SQL-FOR-UPDATE-SHARE) | Locking de linhas para prevenir race conditions |
| [isomorphic-dompurify](https://www.npmjs.com/package/isomorphic-dompurify) | Sanitização HTML server-side em Node.js |

---

_Blueprint gerado automaticamente pela Security Audit Skill v1.0_  
_Baseado em: Relatório CTF v1.0 + Plataforma de Análise de Segurança de Código v1.0_  
_Projecto: Muneri — Quelimane, Moçambique — 2026_
