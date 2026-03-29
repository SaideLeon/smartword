## O que foi gerado e como usar

### 1. `006_auth_plans_payments.sql` — executa primeiro
Cola no **Supabase SQL Editor** na ordem correcta. Cria: tabela `plans` (com os 6 planos pré-inseridos), `profiles` (com trigger automático ao registar utilizador), `payment_history`, `expense_items`, `monthly_reports`, e actualiza `tcc_sessions`/`work_sessions` com `user_id`. Também configura todo o RLS.

### 2. Google OAuth no Supabase
No painel Supabase → Authentication → Providers → Google → activa e cola as credenciais do Google Cloud Console. Em **Redirect URLs** adiciona `https://teu-dominio.com/auth/callback`.

### 3. Instalar dependências
```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 4. Onde colocar cada ficheiro
- `006_auth_plans_payments.sql` → executar no Supabase SQL Editor
- `useAuth.ts` → `src/hooks/useAuth.ts`
- `middleware.ts` → `src/middleware.ts` (raiz do src)
- `payment_route.ts` → `src/app/api/payment/route.ts`
- `auth_callback_route.ts` → `src/app/auth/callback/route.ts`
- `truncate-export.ts` → `src/lib/docx/truncate-export.ts`
- `admin_page.tsx` → `src/app/admin/page.tsx`

### 5. Usar a truncagem no export
No `src/app/api/export/route.ts` existente, adicionar:
```ts
import { prepareMarkdownForExport } from '@/lib/docx/truncate-export';
// ...
const finalContent = prepareMarkdownForExport(content, /* canExportFull */ false);
```

### 6. Promover o primeiro admin
No Supabase SQL Editor, após criares a tua conta:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'teu@email.com';
```

### Planos configurados (baseados no teu ficheiro HTML)
| Plano | Preço | Trabalhos | TCC | IA | Export |
|---|---|---|---|---|---|
| Grátis | 0 MT | 20 | ✗ | ✗ | Cortado |
| Avulso | 50 MT | 1 (2 edições) | ✗ | ✗ | Completo |
| Básico | ~320 MT/mês | ∞ | ✗ | ✓ | Completo |
| Standard | ~512 MT/mês | ∞ | ✗ | ✓ | Completo |
| Pro | ~640 MT/mês | ∞ | ✓ | ✓ | Completo |
| Premium | ~960 MT/mês | ∞ | ✓ | ✓ | Completo |