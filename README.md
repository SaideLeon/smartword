# Muneri

Editor académico em **Markdown** com exportação para **.docx** e conversão de equações **LaTeX → OMML** (equações editáveis no Word).

## Funcionalidades principais

- Editor Markdown com suporte a GFM.
- Exportação para Word (.docx) com formatação académica.
- Conversão de matemática inline e bloco para OMML nativo do Word.
- Assistente de escrita com IA (chat, TCC e trabalhos).
- PWA instalável com suporte offline para recursos essenciais.

## Stack

- Next.js 15 + React 19
- TypeScript
- `docx`, `temml`, `mathml2omml`
- Integrações de IA com Gemini SDK (`@google/genai`) para chat e geração escolar
- Groq dedicado apenas para transcrição de áudio
- Supabase (sessões/contexto)

## Requisitos

- Node.js 20+
- npm 10+

## Configuração de ambiente

Crie um arquivo `.env.local` na raiz do projeto com as variáveis necessárias:

```bash
GEMINI_API_KEY="sua_chave_gemini"
GROQ_API_KEY="sua_chave_groq"
NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<sua_chave_anon>"
NEXT_PUBLIC_APP_URL="https://muneri.nativespeak.app"
APP_URL="https://muneri.nativespeak.app"
PAYSUITE_API_TOKEN="<sua_chave_paysuite>"
PAYSUITE_WEBHOOK_SECRET="<seu_webhook_secret_paysuite>"
SUPABASE_SERVICE_ROLE_KEY="<sua_service_role_key_supabase>"
```

> Observação: `GEMINI_API_KEY` é usada nos fluxos de geração escolar e chat (incluindo capa, TCC e trabalhos) via SDK Gemini no modelo `gemini-3.1-flash-lite-preview`, e aceita uma ou várias chaves separadas por vírgula. `GROQ_API_KEY` fica reservada apenas para transcrição de áudio (`/api/transcribe`).

## Executar localmente

1. Instalar dependências:

   ```bash
   npm install
   ```

2. Iniciar em modo desenvolvimento:

   ```bash
   npm run dev
   ```

3. Abrir no navegador:

   - `http://localhost:3000`

## Scripts disponíveis

- `npm run dev` — ambiente de desenvolvimento
- `npm run build` — build de produção
- `npm run start` — iniciar build de produção
- `npm run lint` — validação de lint
- `npm run test:security` — executar apenas a suíte de testes de segurança (`src/__tests__/security`)
- `npm run test:security:watch` — executar a suíte de segurança em modo watch
- `npm run test:adversarial` — rodar testes adversariais de prompt injection contra `/api/work/generate`

## Estrutura resumida

- `app/landing/page.tsx` — landing page pública
- `app/app/page.tsx` — editor principal
- `app/api/*` — rotas API (export, chat, TCC, trabalho)
- `lib/docx/*` — parsing e geração de .docx
- `public/sw.js` — service worker da PWA


## Testes adversariais (R25)

O script `scripts/adversarial-test.mjs` executa payloads de prompt injection contra `/api/work/generate`.

Uso recomendado:

```bash
APP_URL="http://localhost:3000" ADVERSARIAL_COOKIE="sb-..." npm run test:adversarial
```

- `APP_URL` aponta para o ambiente alvo (local/staging).
- `ADVERSARIAL_COOKIE` é opcional, mas recomendado para endpoints autenticados.
- O script falha (`exit 1`) se detectar possíveis vazamentos de marcadores sensíveis na resposta.

## Fluxo de pagamentos (PaySuite)

- O endpoint `POST /api/payment` cria um pedido na PaySuite e retorna `checkout_url` para redirecionar o utilizador.
- A referência enviada à PaySuite é gerada no backend em formato **alfanumérico** (sem símbolos) para cumprir validações do provider.
- O checkout PaySuite é aplicado apenas para planos pagos (`price_mzn >= 1`); planos gratuitos não criam pedido no provider.
- Após pagamento, a PaySuite chama `POST /api/payment/webhook` com assinatura HMAC (`X-Webhook-Signature`).
- O webhook confirma/rejeita automaticamente o registo em `payment_history` e atualiza o plano do utilizador em `profiles`.
- Como fallback, `GET /api/payment?sync_provider_payment_id=<id>` tenta sincronizar estado diretamente com `GET /payments/{id}` da PaySuite.

### Configuração no dashboard PaySuite (produção)

- **Webhook URL:** `https://muneri.nativespeak.app/api/payment/webhook`
- **Webhook Secret:** copiar do dashboard e guardar em `PAYSUITE_WEBHOOK_SECRET` no ambiente da aplicação.
- Sempre que rodar localmente/staging, use a URL pública correspondente (ex.: `https://staging.seu-dominio.com/api/payment/webhook`).
