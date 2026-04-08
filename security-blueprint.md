# 🔐 Blueprint de Correcção de Segurança

**Projecto:** Muneri  
**Data da auditoria:** 2026-04-08  
**Auditado por:** Claude Security Audit Skill v1.0

---

## Score de Segurança

| Métrica | Valor |
|---------|-------|
| Score actual | 55/100 |
| Score esperado após correcções | 100/100 |
| Vulnerabilidades CRÍTICO | 1 |
| Vulnerabilidades ALTO | 2 |
| Vulnerabilidades MÉDIO | 0 |
| **Resultado actual** | **❌ REPROVADO — não apto para produção** |

---

## Índice de Vulnerabilidades

| # | Regra | Severidade | Localização | Esforço | Status |
|---|-------|-----------|-------------|---------|--------|
| 1 | [R18] Mass Assignment em `profiles` | 🔴 CRÍTICO | `supabase/migrations/007_multi_user_safe.sql` | Médio (2–3h) | ⬜ Pendente |
| 2 | [R07] Tópico de sessão sem limite de tamanho | 🟠 ALTO | `api/tcc/session/route.ts`, `api/work/session/route.ts` | Baixo (< 30min) | ⬜ Pendente |
| 3 | [R12] Áudio sem verificação de Magic Bytes | 🟠 ALTO | `api/transcribe/route.ts` | Baixo (1h) | ⬜ Pendente |

> **Esforço:** Baixo (< 1h) · Médio (1–4h) · Alto (> 4h)

---

## [R18] Mass Assignment em `profiles` via RLS — 🔴 CRÍTICO

### Contexto

**O que existe actualmente:**

```sql
-- supabase/migrations/007_multi_user_safe.sql
-- Política demasiado permissiva: FOR ALL permite UPDATE em QUALQUER coluna
CREATE POLICY "profiles_self" ON profiles
  FOR ALL
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

**Por que é explorável:**

A política `FOR ALL` com `WITH CHECK (auth.uid() = id)` concede ao utilizador autenticado total liberdade para actualizar **qualquer campo** da sua própria linha em `profiles`. As chaves `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` são públicas (prefixo `NEXT_PUBLIC_`). Qualquer utilizador pode instanciar o cliente Supabase no browser e executar:

```js
// Execução directa pelo utilizador no browser
const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(PUBLIC_URL, PUBLIC_ANON_KEY)
await supabase.auth.signIn(...)  // sessão legítima

// Escalada de privilégios: self-promotion a admin
await supabase.from('profiles')
  .update({ role: 'admin' })
  .eq('id', supabase.auth.user().id)

// Activação de plano premium gratuitamente
await supabase.from('profiles')
  .update({
    plan_key: 'premium',
    plan_expires_at: '2099-12-31',
    payment_status: 'active'
  })
  .eq('id', supabase.auth.user().id)
```

**Impacto potencial:**
- Qualquer utilizador pode tornar-se admin, acedendo a dados financeiros e ao painel admin
- Qualquer utilizador pode activar o plano Premium gratuitamente, contornando o sistema de pagamento
- Receita nula para um produto pago

---

### Arquitectura da Correcção

```
SITUAÇÃO ACTUAL (vulnerável):
  Browser → supabase.from('profiles').update({role:'admin'}) → ✅ RLS permite

SITUAÇÃO CORRIGIDA:
  Browser → supabase.from('profiles').update({role:'admin'}) → ❌ RLS bloqueia UPDATE directo
  Browser → supabase.rpc('update_own_profile', {full_name, avatar_url}) → ✅ RPC SECURITY DEFINER (apenas campos seguros)
  Admin    → supabase.rpc('admin_update_profile', {user_id, plan_key}) → ✅ verifica is_admin() internamente
```

---

### Implementação Passo a Passo

#### Passo 1 — Criar nova migração `016_fix_profiles_mass_assignment.sql`

```sql
-- supabase/migrations/016_fix_profiles_mass_assignment.sql
-- Corrige R18: separa políticas de profiles por operação
-- e restringe UPDATE a campos não-sensíveis via RPC SECURITY DEFINER.

-- ── 1. REMOVER política FOR ALL permissiva ─────────────────────────────────
DROP POLICY IF EXISTS "profiles_self"  ON profiles;
DROP POLICY IF EXISTS "profiles_admin" ON profiles;

-- ── 2. RECRIAR políticas granulares por operação ───────────────────────────

-- SELECT: utilizador lê apenas o seu próprio perfil
CREATE POLICY "profiles_self_select" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- INSERT: bloqueado — perfil criado apenas pelo trigger handle_new_user()
-- (nenhuma política INSERT para o role 'authenticated')

-- UPDATE: bloqueado directamente — apenas via RPC abaixo
-- (sem CREATE POLICY UPDATE para 'authenticated')

-- DELETE: bloqueado para utilizadores normais
-- (sem CREATE POLICY DELETE para 'authenticated')

-- Admin: acesso total via função is_admin() (imutável via SECURITY DEFINER)
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL
  USING  (is_admin())
  WITH CHECK (is_admin());

-- ── 3. RPC segura para actualização do próprio perfil ─────────────────────
-- Permite ao utilizador alterar apenas full_name e avatar_url.
CREATE OR REPLACE FUNCTION update_own_profile(
  p_full_name  text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = 'P0001';
  END IF;

  -- Validação de tamanho dos campos permitidos
  IF p_full_name IS NOT NULL AND length(p_full_name) > 200 THEN
    RAISE EXCEPTION 'full_name demasiado longo' USING ERRCODE = 'P0002';
  END IF;

  IF p_avatar_url IS NOT NULL AND length(p_avatar_url) > 500 THEN
    RAISE EXCEPTION 'avatar_url demasiado longo' USING ERRCODE = 'P0003';
  END IF;

  UPDATE profiles
  SET
    full_name  = COALESCE(p_full_name,  full_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = now()
  WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION update_own_profile(text, text) TO authenticated;

-- ── 4. (Opcional) RPC admin para actualizar plano manualmente ─────────────
-- Já existe confirm_payment() que gere plan_key via fluxo de pagamento.
-- Esta função serve apenas para correcções manuais de emergência pelo admin.
CREATE OR REPLACE FUNCTION admin_set_user_plan(
  p_user_id    uuid,
  p_plan_key   text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = 'P0001';
  END IF;

  -- Validar que o plano existe
  IF NOT EXISTS (SELECT 1 FROM plans WHERE key = p_plan_key AND is_active = true) THEN
    RAISE EXCEPTION 'Plano inválido ou inactivo' USING ERRCODE = 'P0002';
  END IF;

  UPDATE profiles
  SET
    plan_key        = p_plan_key,
    plan_expires_at = p_expires_at,
    payment_status  = CASE WHEN p_plan_key = 'free' THEN 'none' ELSE 'active' END,
    updated_at      = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilizador não encontrado' USING ERRCODE = 'P0003';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_user_plan(uuid, text, timestamptz) TO authenticated;
```

#### Passo 2 — Actualizar o cliente Next.js para usar a RPC em vez de `.update()` directo

```ts
// src/lib/profile-service.ts (NOVO FICHEIRO)
// Todas as actualizações de perfil passam por aqui — nunca .update() directo.

import { createClient } from '@/lib/supabase';

export async function updateOwnProfile(params: {
  fullName?: string;
  avatarUrl?: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_own_profile', {
    p_full_name:  params.fullName  ?? null,
    p_avatar_url: params.avatarUrl ?? null,
  });

  if (error) throw new Error(error.message);
}
```

#### Passo 3 — Verificar e substituir todas as chamadas `.update()` directas a `profiles`

```bash
# Executar na raiz do projecto para detectar chamadas directas à tabela profiles
grep -rn "\.from('profiles').*\.update\|\.from(\"profiles\").*\.update" src/
# Cada ocorrência deve ser substituída por updateOwnProfile() ou pela RPC admin adequada
```

---

### Teste de Validação

```ts
// src/__tests__/security/profiles-mass-assignment.test.ts
// Executar com: npx vitest run src/__tests__/security/profiles-mass-assignment.test.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('R18 — Protecção Mass Assignment em profiles', () => {
  it('utilizador comum NÃO consegue actualizar role para admin via UPDATE directo', async () => {
    // Autenticar com utilizador de teste (role = 'user')
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
    const { data: { user } } = await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    });

    const { error } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user!.id);

    // RLS deve bloquear — não deve haver nenhum erro de "permissão concedida"
    // A query deve falhar OU não actualizar nenhuma linha
    expect(error).not.toBeNull(); // RLS deve retornar erro de permissão
  });

  it('utilizador comum NÃO consegue actualizar plan_key para premium', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    });

    const { error } = await supabase
      .from('profiles')
      .update({ plan_key: 'premium', payment_status: 'active' })
      .eq('id', (await supabase.auth.getUser()).data.user!.id);

    expect(error).not.toBeNull();
  });

  it('update_own_profile() permite actualizar full_name sem elevar privilégios', async () => {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
    await supabase.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL!,
      password: process.env.TEST_USER_PASSWORD!,
    });

    const { error } = await supabase.rpc('update_own_profile', {
      p_full_name: 'Novo Nome',
      p_avatar_url: null,
    });

    expect(error).toBeNull(); // deve funcionar
  });
});
```

**Resultado esperado:** Os dois primeiros testes lançam erro de RLS; o terceiro passa sem erro.

---

### Checklist de Deploy

- [ ] Migração `016_fix_profiles_mass_assignment.sql` executada no Supabase SQL Editor
- [ ] Confirmar no SQL Editor: `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles'` — não deve existir nenhuma política `FOR ALL` para o role `authenticated`
- [ ] Confirmar que `update_own_profile` e `admin_set_user_plan` existem em `pg_proc`
- [ ] Substituir todas as chamadas `.from('profiles').update()` do lado cliente por `updateOwnProfile()` ou RPC admin
- [ ] Executar testes: `npx vitest run src/__tests__/security/profiles-mass-assignment.test.ts`
- [ ] Revisão de código por par antes do merge

---

## [R07] Tópico de Sessão sem Validação de Tamanho Server-side — 🟠 ALTO

### Contexto

**O que existe actualmente:**

```ts
// src/app/api/tcc/session/route.ts — handler POST
// src/app/api/work/session/route.ts — handler POST (idêntico)
const topic = body.topic?.trim();
if (!topic) return NextResponse.json({ error: 'Tópico obrigatório' }, { status: 400 });
// ⚠️ Sem validação de tamanho máximo — topic pode ter megabytes
const session = await createSession(topic);
```

**Por que é explorável:**
Os limites `topicMin: 3` e `topicMax: 500` estão definidos em `input-guards.ts` mas **não são aplicados** nestas rotas. Um atacante pode enviar um `topic` com centenas de kilobytes por cada chamada autenticada (20 req/min × 60 = 1200/hora), sobrecarregando a coluna `topic` na BD, consumindo contexto dos modelos de IA e aumentando o custo da API.

**Impacto potencial:**
Abuso de recursos (custo de API e armazenamento), potencial degradação do serviço, injecção de contexto excessivo nos prompts de IA.

---

### Implementação Passo a Passo

#### Passo 1 — Adicionar validação de tamanho em `tcc/session/route.ts`

```ts
// src/app/api/tcc/session/route.ts — handler POST (secção de criação de sessão)
// Substituir:
const topic = body.topic?.trim();
if (!topic) return NextResponse.json({ error: 'Tópico obrigatório' }, { status: 400 });

// Por:
const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
if (!topic || topic.length < 3) {
  return NextResponse.json({ error: 'Tópico obrigatório (mínimo 3 caracteres)' }, { status: 400 });
}
if (topic.length > 500) {
  return NextResponse.json({ error: 'Tópico demasiado longo (máx 500 caracteres)' }, { status: 400 });
}
```

#### Passo 2 — Aplicar a mesma correcção em `work/session/route.ts`

```ts
// src/app/api/work/session/route.ts — handler POST (secção de criação de sessão)
// Mesma substituição acima — copiar exactamente o bloco corrigido.
const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
if (!topic || topic.length < 3) {
  return NextResponse.json({ error: 'Tópico obrigatório (mínimo 3 caracteres)' }, { status: 400 });
}
if (topic.length > 500) {
  return NextResponse.json({ error: 'Tópico demasiado longo (máx 500 caracteres)' }, { status: 400 });
}
```

---

### Teste de Validação

```ts
// src/__tests__/security/input-size-limits.test.ts
// (adicionar ao ficheiro existente)
// Executar com: npx vitest run src/__tests__/security/input-size-limits.test.ts

describe('R07 — Limite de tamanho de tópico nas rotas de sessão', () => {
  const ENDPOINTS = ['/api/tcc/session', '/api/work/session'];

  it.each(ENDPOINTS)('%s rejeita tópico acima de 500 caracteres', async (endpoint) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: TEST_AUTH_COOKIE },
      body: JSON.stringify({ topic: 'A'.repeat(501) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/demasiado longo|máx/i);
  });

  it.each(ENDPOINTS)('%s rejeita tópico abaixo de 3 caracteres', async (endpoint) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: TEST_AUTH_COOKIE },
      body: JSON.stringify({ topic: 'AB' }),
    });
    expect(res.status).toBe(400);
  });

  it.each(ENDPOINTS)('%s aceita tópico dentro dos limites', async (endpoint) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: TEST_AUTH_COOKIE },
      body: JSON.stringify({ topic: 'Impacto da industrialização em Moçambique' }),
    });
    // 201 ou 200
    expect(res.status).toBeLessThan(400);
  });
});
```

**Resultado esperado:** Tópicos longos retornam 400; tópico válido retorna 2xx.

---

### Checklist de Deploy

- [ ] Correcção aplicada em `src/app/api/tcc/session/route.ts`
- [ ] Correcção aplicada em `src/app/api/work/session/route.ts`
- [ ] Confirmar que os limites são consistentes com `LIMITS.topicMax` em `input-guards.ts` (500 chars)
- [ ] Testes a passar: `npx vitest run src/__tests__/security/input-size-limits.test.ts`
- [ ] Revisão de código por par antes do merge

---

## [R12] Transcrição de Áudio sem Verificação de Magic Bytes — 🟠 ALTO

### Contexto

**O que existe actualmente:**

```ts
// src/app/api/transcribe/route.ts
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm', 'audio/wav', 'audio/x-wav',
  'audio/mpeg', 'audio/mp3', 'audio/mp4',
  'audio/ogg', 'audio/flac',
]);

// Valida apenas o tipo MIME DECLARADO pelo cliente — não o conteúdo real
if (!ALLOWED_AUDIO_MIME_TYPES.has(audio.type)) {
  return NextResponse.json({ error: 'Tipo MIME de áudio não suportado.' }, { status: 400 });
}
// Sem verificação de magic bytes — qualquer ficheiro passa desde que declare MIME correcto
```

**Por que é explorável:**
O campo `audio.type` no FormData é controlado pelo cliente. Um atacante pode enviar qualquer ficheiro binário (ex: executável, arquivo comprimido) com `Content-Type: audio/webm` e este será aceite e reencaminhado à API da Groq. Embora a Groq provavelmente rejeite ficheiros inválidos, a validação server-side deve ser independente de validações de terceiros (R22 — defesa em profundidade).

**Impacto potencial:**
Envio de ficheiros arbitrários a serviços externos, potencial abuso de quota da API Groq com ficheiros inválidos, superfície de ataque para futuros processamentos locais.

---

### Arquitectura da Correcção

```
FLUXO ACTUAL (vulnerável):
  Cliente → FormData(audio.type='audio/webm', ficheiro=qualquer_coisa)
           → Validação MIME (passa) → Groq API ← ficheiro inválido chega à Groq

FLUXO CORRIGIDO:
  Cliente → FormData(audio.type='audio/webm', ficheiro=qualquer_coisa)
           → Validação MIME (passa)
           → Leitura dos primeiros N bytes do ficheiro
           → Comparação com magic bytes de 'audio/webm'
           → ✅ Match → Groq API
           → ❌ Mismatch → 400 Bad Request (ficheiro rejeitado localmente)
```

---

### Implementação Passo a Passo

#### Passo 1 — Criar utilitário de validação de magic bytes de áudio

```ts
// src/lib/validation/audio-validator.ts (NOVO FICHEIRO)

// Magic bytes para os formatos de áudio suportados.
// Fonte: https://en.wikipedia.org/wiki/List_of_file_signatures
const AUDIO_MAGIC_BYTES: Record<string, Array<number | null>> = {
  // WebM: começa com EBML (0x1A 0x45 0xDF 0xA3)
  'audio/webm': [0x1a, 0x45, 0xdf, 0xa3],

  // WAV: começa com "RIFF" (0x52 0x49 0x46 0x46)
  'audio/wav': [0x52, 0x49, 0x46, 0x46],
  'audio/x-wav': [0x52, 0x49, 0x46, 0x46],

  // MP3 com ID3 tag (0x49 0x44 0x33) ou frame sync (0xFF 0xFB / 0xFF 0xFA)
  'audio/mpeg': [0xff, 0xfb],   // verificar alternativas abaixo
  'audio/mp3':  [0xff, 0xfb],

  // MP4/M4A: ftyp box — bytes 4-7 são "ftyp" (0x66 0x74 0x79 0x70)
  // Verificamos offset 4 com null nos primeiros 4 bytes
  'audio/mp4': [null, null, null, null, 0x66, 0x74, 0x79, 0x70],

  // OGG: começa com "OggS" (0x4F 0x67 0x67 0x53)
  'audio/ogg': [0x4f, 0x67, 0x67, 0x53],

  // FLAC: começa com "fLaC" (0x66 0x4C 0x61 0x43)
  'audio/flac': [0x66, 0x4c, 0x61, 0x43],
};

// MP3 pode começar com ID3 tag em vez de frame sync
const MP3_ID3_MAGIC = [0x49, 0x44, 0x33]; // "ID3"

export function validateAudioMagicBytes(
  buffer: Uint8Array,
  declaredMimeType: string,
): boolean {
  const magic = AUDIO_MAGIC_BYTES[declaredMimeType];
  if (!magic) return false; // tipo não suportado
  if (buffer.length < magic.length) return false;

  const matches = magic.every((byte, i) =>
    byte === null || buffer[i] === byte,
  );

  // Para MP3: aceitar também ID3 tag como alternativa ao frame sync
  if (!matches && (declaredMimeType === 'audio/mpeg' || declaredMimeType === 'audio/mp3')) {
    return MP3_ID3_MAGIC.every((byte, i) => buffer[i] === byte);
  }

  return matches;
}
```

#### Passo 2 — Integrar a validação em `transcribe/route.ts`

```ts
// src/app/api/transcribe/route.ts — adicionar após a verificação de MIME type

import { validateAudioMagicBytes } from '@/lib/validation/audio-validator';

// ... (após verificação de audio.size > MAX_AUDIO_BYTES)

// ── NOVO: Verificar magic bytes ──────────────────────────────────────
const MAGIC_BYTES_TO_READ = 12; // suficiente para todos os formatos
const audioArrayBuffer = await audio.slice(0, MAGIC_BYTES_TO_READ).arrayBuffer();
const audioHeader = new Uint8Array(audioArrayBuffer);

if (!validateAudioMagicBytes(audioHeader, audio.type)) {
  return NextResponse.json(
    { error: 'Ficheiro de áudio inválido: assinatura não corresponde ao tipo declarado.' },
    { status: 400 },
  );
}
// ── FIM: Verificar magic bytes ───────────────────────────────────────

const groqForm = new FormData();
// ... resto do código inalterado
```

---

### Teste de Validação

```ts
// src/__tests__/security/transcribe-audio-size.test.ts
// (adicionar ao ficheiro existente, ou criar novo)
// Executar com: npx vitest run src/__tests__/security/transcribe-audio-size.test.ts

import { validateAudioMagicBytes } from '@/lib/validation/audio-validator';

describe('R12 — Validação de Magic Bytes de áudio', () => {
  it('aceita ficheiro WebM real (magic bytes correctos)', () => {
    // Primeiros bytes de um ficheiro WebM válido
    const webmHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
    expect(validateAudioMagicBytes(webmHeader, 'audio/webm')).toBe(true);
  });

  it('rejeita executável .exe disfarçado de audio/webm', () => {
    // Magic bytes de um PE executable (MZ header)
    const exeHeader = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    expect(validateAudioMagicBytes(exeHeader, 'audio/webm')).toBe(false);
  });

  it('aceita ficheiro OGG com magic bytes correctos', () => {
    const oggHeader = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
    expect(validateAudioMagicBytes(oggHeader, 'audio/ogg')).toBe(true);
  });

  it('rejeita ficheiro ZIP disfarçado de audio/ogg', () => {
    // Magic bytes ZIP (PK)
    const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
    expect(validateAudioMagicBytes(zipHeader, 'audio/ogg')).toBe(false);
  });

  it('aceita MP3 com ID3 tag', () => {
    const mp3Id3Header = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00]);
    expect(validateAudioMagicBytes(mp3Id3Header, 'audio/mpeg')).toBe(true);
  });

  it('aceita FLAC com magic bytes correctos', () => {
    const flacHeader = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0x00, 0x00, 0x00, 0x22]);
    expect(validateAudioMagicBytes(flacHeader, 'audio/flac')).toBe(true);
  });
});
```

**Resultado esperado:** Todos os 6 testes passam; ficheiros disfarçados são rejeitados.

---

### Checklist de Deploy

- [ ] Ficheiro `src/lib/validation/audio-validator.ts` criado
- [ ] Integração em `src/app/api/transcribe/route.ts` completa (leitura dos primeiros 12 bytes + chamada a `validateAudioMagicBytes`)
- [ ] Testes a passar: `npx vitest run src/__tests__/security/transcribe-audio-size.test.ts`
- [ ] Testar manualmente com um ficheiro WebM real gerado pelo browser (AudioInputButton)
- [ ] Revisão de código por par antes do merge

---

## Checklist Global Pré-Deploy

### Obrigatório (CRÍTICO e ALTO)
- [ ] **[R18]** Migração `016_fix_profiles_mass_assignment.sql` aplicada e verificada no Supabase
- [ ] **[R18]** Todas as chamadas `.from('profiles').update()` do lado cliente substituídas por `updateOwnProfile()` ou RPC admin
- [ ] **[R18]** Teste de mass assignment a passar: tentativa de `update({role:'admin'})` retorna erro de RLS
- [ ] **[R07]** Validação de tamanho de `topic` aplicada em ambas as rotas de sessão (tcc e work)
- [ ] **[R12]** Validação de magic bytes implementada em `/api/transcribe`
- [ ] Suite completa de testes de segurança a passar (`npx vitest run src/__tests__/security/`)
- [ ] RLS verificado após migração 016: `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'profiles'`

### Recomendado (Boas Práticas)
- [ ] Activar Column Level Security (CLS) no Supabase para a tabela `profiles` como camada adicional
- [ ] Executar `scripts/adversarial-test.mjs` após todas as correcções para validação adversarial
- [ ] Rever se outras tabelas têm políticas `FOR ALL` que possam ter o mesmo problema de mass assignment
- [ ] Considerar adicionar `audit_log` para tentativas de actualização directa em `profiles` (R21)

---

## Referências e Recursos

| Recurso | Descrição |
|---------|-----------|
| [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security) | Configuração correcta de Row Level Security e políticas granulares |
| [Supabase Column Level Security](https://supabase.com/docs/guides/auth/column-level-security) | Restrição por coluna em PostgreSQL |
| [OWASP Mass Assignment](https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/07-Input_Validation_Testing/20-Testing_for_Mass_Assignment) | Referência OWASP sobre Mass Assignment |
| [File Signatures / Magic Bytes](https://en.wikipedia.org/wiki/List_of_file_signatures) | Catálogo completo de assinaturas de ficheiros |

---

_Blueprint gerado automaticamente pela Security Audit Skill v1.0_  
_Baseado em: Relatório CTF v1.0 + Plataforma de Análise de Segurança de Código v1.0_
