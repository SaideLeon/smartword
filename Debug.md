
problema: " quando entro como administrador não consigo ver toda a lista de usuários que fizeram pagamento e enviaram código para eu verificar como administrador todo código está pendente só que no painel administrativo não aparece as contas que estão pendentes"
Analisando o código, identifiquei a causa raiz do problema. São na verdade **dois bugs combinados**:

**Bug 1 — Erros silenciados no frontend**: O `loadPayments` descarta qualquer resposta que não seja array (incluindo erros 401/500) sem mostrar nada ao utilizador.

**Bug 2 — Falha no join `profiles` por RLS**: A query `payment_history` usa `profiles(email, full_name)` como join embutido. O RLS da tabela `profiles` pode bloquear o acesso aos perfis de outros utilizadores mesmo para o admin, fazendo a query falhar silenciosamente ou retornar erro.

Vamos corrigir os dois:

**Passo 1 — Verificar/aplicar a migration 007 no SQL Editor do Supabase** (garante que `is_admin()` existe e não há recursão no RLS):Aqui está o fluxo do bug para visualizar onde a falha acontece:Agora as correções concretas:

---

**Passo 1 — Executar este diagnóstico no Supabase SQL Editor:**

```sql
-- Verificar se a função is_admin() existe
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'is_admin';

-- Verificar políticas actuais na payment_history
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'payment_history';

-- Testar directamente (substitui pelo UUID do teu admin)
SELECT * FROM payment_history 
WHERE status = 'pending';
```

Se `is_admin` não aparecer, a **migration 007 não foi aplicada** — aplica-a no SQL Editor antes de continuar.

---

**Passo 2 — Corrigir `src/app/api/payment/route.ts`** (GET handler):

```typescript
// ── GET: listar pagamentos ───────────────────────────────────────────────────
export async function GET(req: Request) {
  const limited = enforceRateLimit(req, { scope: 'payment:get', maxRequests: 30, windowMs: 60_000 });
  if (limited) return limited;

  const supabase = await makeSupabase();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    console.error('[payment GET] Sessão inválida:', userError?.message);
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('[payment GET] Erro ao ler perfil:', profileError.message);
  }

  const isAdmin = profile?.role === 'admin';

  // Para admin: evitar o join embutido de profiles que pode ser bloqueado por RLS.
  // Fazer duas queries separadas é mais robusto.
  let paymentsQuery = supabase
    .from('payment_history')
    .select('id, user_id, created_at, plan_key, transaction_id, amount_mzn, payment_method, status, notes, confirmed_at')
    .order('created_at', { ascending: false });

  if (!isAdmin) {
    paymentsQuery = paymentsQuery.eq('user_id', user.id);
  }

  const { data: payments, error: paymentsError } = await paymentsQuery;

  if (paymentsError) {
    console.error('[payment GET] Erro na query de pagamentos:', paymentsError.message, 'isAdmin:', isAdmin);
    return NextResponse.json({ error: paymentsError.message }, { status: 500 });
  }

  if (!payments || payments.length === 0) {
    return NextResponse.json([]);
  }

  // Enriquecer com dados de perfil e plano em queries separadas
  // (evita bloqueio de RLS no join embutido)
  const userIds = [...new Set(payments.map(p => p.user_id))];
  const planKeys = [...new Set(payments.map(p => p.plan_key))];

  const [profilesResult, plansResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds),
    supabase
      .from('plans')
      .select('key, label, price_mzn')
      .in('key', planKeys),
  ]);

  const profilesMap = Object.fromEntries(
    (profilesResult.data ?? []).map(p => [p.id, p])
  );
  const plansMap = Object.fromEntries(
    (plansResult.data ?? []).map(p => [p.key, p])
  );

  const enriched = payments.map(payment => ({
    ...payment,
    profiles: profilesMap[payment.user_id] ?? null,
    plans: plansMap[payment.plan_key] ?? null,
  }));

  return NextResponse.json(enriched);
}
```

---

**Passo 3 — Corrigir `src/app/admin/page.tsx`** (loadPayments com tratamento de erro):

```typescript
const loadPayments = useCallback(async () => {
  setLoading(true);
  setMessage('');
  try {
    const response = await fetch('/api/payment');
    const data = await response.json();

    if (!response.ok) {
      // Mostra o erro real em vez de engolir silenciosamente
      console.error('[Admin] Erro ao carregar pagamentos:', data);
      setMessage(
        `Erro ao carregar pagamentos: ${data?.error ?? `HTTP ${response.status}`}`
      );
      setPayments([]);
      return;
    }

    setPayments(Array.isArray(data) ? data : []);
  } catch (err: any) {
    console.error('[Admin] Falha de rede:', err);
    setMessage('Falha de rede ao carregar pagamentos.');
    setPayments([]);
  } finally {
    setLoading(false);
  }
}, []);
```

---

**Resumo das três causas e correcções:**

A causa mais provável (sem precisar de diagnóstico) é a segunda — o join embutido `profiles(email, full_name)` dentro do `.select()` do PostgREST faz uma sub-query sujeita ao RLS da tabela `profiles`. Mesmo que o admin passe pelo filtro de `payment_history`, o join a perfis de outros utilizadores pode falhar ou retornar erro dependendo de como as policies estão configuradas. Separar as queries elimina este problema completamente e é mais robusto independentemente do estado das migrations.
