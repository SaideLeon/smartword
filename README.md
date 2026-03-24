<div align="center">
  <img width="1200" height="475" alt="Muneri Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
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
- Integrações de IA com Groq
- Supabase (sessões/contexto)

## Requisitos

- Node.js 20+
- npm 10+

## Configuração de ambiente

Crie um arquivo `.env.local` na raiz do projeto com as variáveis necessárias:

```bash
GROQ_API_KEY="sua_chave_groq"
NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<sua_chave_anon>"
```

> Observação: o ficheiro `.env.example` ainda contém variáveis legadas de template (AI Studio/Gemini). Para o funcionamento atual deste projeto, utilize as variáveis acima.

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
