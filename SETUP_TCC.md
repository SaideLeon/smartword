# Implementação do Modo TCC

## Ficheiros criados/modificados

### Novos ficheiros
```
supabase/migrations/001_tcc_sessions.sql  ← executar no Supabase SQL editor
lib/supabase.ts                           ← cliente Supabase
lib/tcc/types.ts                          ← tipos TypeScript
lib/tcc/service.ts                        ← operações CRUD no Supabase
app/api/tcc/session/route.ts              ← GET/POST/DELETE sessões
app/api/tcc/outline/route.ts              ← POST gerar esboço (streaming)
app/api/tcc/approve/route.ts              ← POST aprovar esboço
app/api/tcc/develop/route.ts              ← POST desenvolver secção (streaming)
hooks/useTccSession.ts                    ← hook de estado TCC
components/TccPanel.tsx                   ← painel UI completo
```

### Ficheiros modificados
```
app/page.tsx     ← botão TCC no header + integração do painel
.env.example     ← variáveis Supabase adicionadas
```

## Setup

### 1. Instalar dependência
```bash
npm install @supabase/supabase-js
```

### 2. Criar tabela no Supabase
Abrir o **SQL Editor** no painel do Supabase e executar o conteúdo de:
`supabase/migrations/001_tcc_sessions.sql`

### 3. Variáveis de ambiente
Adicionar ao `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxx
```

E no Vercel: Settings → Environment Variables → adicionar as mesmas.

## Fluxo do utilizador

1. Clica em **📝 TCC** no header
2. Escolhe **Iniciar novo TCC** ou retomar sessão anterior
3. Insere o tópico → IA gera esboço em streaming → guardado no Supabase
4. Revê/edita o esboço → clica **Aprovar** (esboço fica como âncora imutável)
5. Vê lista de secções com progresso
6. Clica **✦** numa secção → IA desenvolve texto limpo com contexto de todas as anteriores
7. Clica **↓ Inserir no editor** → texto inserido no editor Markdown
8. Repete para cada secção até **100% concluído**
9. Fecha o browser → retoma dias depois com toda a sessão guardada

## Arquitectura de contexto (coerência garantida)

Ao desenvolver a secção N, a IA recebe:
- O **esboço aprovado completo** (âncora estrutural)
- O **conteúdo das secções 1..N-1** já desenvolvidas
- Instrução explícita para evitar repetições e manter coerência terminológica
