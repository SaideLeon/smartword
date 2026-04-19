-- ============================================================
-- MIGRAÇÃO 019 — Muneri · Plano Premium 30 dias para contas edu via Google
--
-- REGRAS DE NEGÓCIO (exactas):
--   ✅ Google OAuth + domínio edu   → 30 dias Premium (UMA ÚNICA VEZ)
--   ❌ Google OAuth + domínio normal → sem benefício
--   ❌ Email/senha + domínio edu    → sem benefício
--   ❌ Email/senha + domínio normal  → sem benefício
--
-- "30 dias" = período de avaliação gratuito, concedido apenas no
-- primeiro registo. Após expirar, o utilizador volta ao plano free
-- e paga normalmente como qualquer outro utilizador.
--
-- Domínio edu válido: o domínio (parte após @) deve conter 'edu'
-- como segmento ISOLADO delimitado por pontos.
--   unisced.edu.mz  → ✅ (segmento 'edu' existe)
--   up.edu.mz       → ✅
--   harvard.edu     → ✅
--   estudante.com   → ❌ (não há segmento 'edu')
--   educacao.gov.mz → ❌ ('educacao' não é 'edu')
-- ============================================================


-- ── 1. FUNÇÃO: detectar domínio edu ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_edu_domain(p_email text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_domain   text;
  v_segment  text;
  v_segments text[];
BEGIN
  v_domain := lower(trim(split_part(p_email, '@', 2)));
  IF v_domain = '' THEN RETURN false; END IF;

  v_segments := string_to_array(v_domain, '.');
  FOREACH v_segment IN ARRAY v_segments
  LOOP
    IF v_segment = 'edu' THEN RETURN true; END IF;
  END LOOP;

  RETURN false;
END;
$$;


-- ── 2. FUNÇÃO: detectar Google OAuth exclusivo ────────────────────────────────
--
-- Retorna true APENAS se o provider principal é 'google' E não existe
-- 'email' no array de providers (conta não misturada com email/senha).

CREATE OR REPLACE FUNCTION is_google_only_oauth_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_meta jsonb;
BEGIN
  SELECT raw_app_meta_data INTO v_meta
  FROM auth.users
  WHERE id = p_user_id;

  IF v_meta IS NULL THEN RETURN false; END IF;

  -- Provider principal tem de ser 'google'
  IF (v_meta->>'provider') != 'google' THEN RETURN false; END IF;

  -- Se houver 'email' no array de providers, a conta foi também criada
  -- com email/senha — não elegível para o benefício
  IF v_meta->'providers' ? 'email' THEN RETURN false; END IF;

  RETURN true;
END;
$$;


-- ── 3. COLUNA: rastrear se o trial já foi concedido (evitar repetição) ────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS edu_trial_granted_at timestamptz;

COMMENT ON COLUMN profiles.edu_trial_granted_at IS
  'Data em que foi concedido o período experimental Premium para conta edu via Google. '
  'NULL = ainda não recebeu. Preenchido UMA VEZ — o benefício não renova automaticamente.';


-- ── 4. FUNÇÃO PRINCIPAL: conceder 30 dias de Premium edu ─────────────────────

CREATE OR REPLACE FUNCTION grant_edu_premium_trial(
  p_user_id uuid,
  p_email   text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_already_granted boolean;
BEGIN
  -- Condição 1: Google OAuth exclusivo
  IF NOT is_google_only_oauth_user(p_user_id) THEN
    RETURN false;
  END IF;

  -- Condição 2: domínio edu
  IF NOT is_edu_domain(p_email) THEN
    RETURN false;
  END IF;

  -- Condição 3: ainda não recebeu (concessão única)
  SELECT (edu_trial_granted_at IS NOT NULL)
  INTO v_already_granted
  FROM profiles
  WHERE id = p_user_id;

  IF COALESCE(v_already_granted, false) THEN
    RETURN false;
  END IF;

  -- Conceder 30 dias de Premium
  UPDATE profiles
  SET
    plan_key             = 'premium',
    plan_expires_at      = now() + interval '30 days',
    payment_status       = 'active',
    edu_trial_granted_at = now(),
    updated_at           = now()
  WHERE id = p_user_id;

  -- Auditoria (não crítica)
  BEGIN
    INSERT INTO audit_log (actor_id, action, resource, metadata)
    VALUES (
      p_user_id,
      'edu_premium_trial_granted',
      'profiles',
      jsonb_build_object(
        'email',       p_email,
        'expires_at',  (now() + interval '30 days')::text,
        'reason',      'google_oauth_edu_domain_first_month'
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION grant_edu_premium_trial(uuid, text) IS
  'Concede 30 dias Premium a utilizadores com Google OAuth + domínio edu. '
  'Executado UMA ÚNICA VEZ por conta (controlado por edu_trial_granted_at).';


-- ── 5. TRIGGER: activar no primeiro registo ───────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Criar perfil
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Tentar conceder trial edu (função verifica todas as condições internamente)
  PERFORM grant_edu_premium_trial(NEW.id, NEW.email);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- ── 6. APLICAR RETROACTIVAMENTE (utilizadores existentes elegíveis) ───────────

DO $$
DECLARE
  v_user    RECORD;
  v_granted boolean;
  v_count   int := 0;
BEGIN
  FOR v_user IN
    SELECT au.id, au.email
    FROM auth.users au
    INNER JOIN profiles p ON p.id = au.id
    WHERE
      -- Google OAuth exclusivo
      (au.raw_app_meta_data->>'provider') = 'google'
      AND NOT (au.raw_app_meta_data->'providers' ? 'email')
      -- Domínio edu
      AND is_edu_domain(au.email)
      -- Plano free (não degradar pagantes)
      AND p.plan_key = 'free'
      -- Ainda não recebeu o trial
      AND p.edu_trial_granted_at IS NULL
  LOOP
    SELECT grant_edu_premium_trial(v_user.id, v_user.email) INTO v_granted;
    IF v_granted THEN
      v_count := v_count + 1;
      RAISE NOTICE 'Trial edu concedido retroactivamente: %', v_user.email;
    END IF;
  END LOOP;

  RAISE NOTICE 'Total de trials edu concedidos retroactivamente: %', v_count;
END;
$$;


-- ── 7. TESTES INLINE ──────────────────────────────────────────────────────────

DO $$
BEGIN
  ASSERT is_edu_domain('aluno@unisced.edu.mz')  = true,  'FALHOU: unisced.edu.mz';
  ASSERT is_edu_domain('prof@up.edu.mz')         = true,  'FALHOU: up.edu.mz';
  ASSERT is_edu_domain('x@harvard.edu')          = true,  'FALHOU: harvard.edu';
  ASSERT is_edu_domain('x@school.edu.com')       = true,  'FALHOU: school.edu.com';
  ASSERT is_edu_domain('X@UNISCED.EDU.MZ')       = true,  'FALHOU: maiúsculas';
  ASSERT is_edu_domain('user@gmail.com')          = false, 'FALHOU: gmail.com';
  ASSERT is_edu_domain('user@estudante.com')      = false, 'FALHOU: estudante.com';
  ASSERT is_edu_domain('user@educacao.gov.mz')    = false, 'FALHOU: educacao != edu';
  ASSERT is_edu_domain('invalido-sem-arroba')     = false, 'FALHOU: sem @';
  ASSERT is_edu_domain('')                        = false, 'FALHOU: vazio';
  RAISE NOTICE 'Todos os testes is_edu_domain passaram ✓';
END;
$$;
