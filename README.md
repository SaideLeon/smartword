<div align="center">
  <img width="1200" height="475" alt="Muneri Banner" src="https://muneri.vercel.app" />
</div>

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

## Estrutura resumida

- `app/landing/page.tsx` — landing page pública
- `app/app/page.tsx` — editor principal
- `app/api/*` — rotas API (export, chat, TCC, trabalho)
- `lib/docx/*` — parsing e geração de .docx
- `public/sw.js` — service worker da PWA
