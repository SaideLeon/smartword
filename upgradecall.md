## Análise

O LectorBook tem um sistema robusto em `src/server/groq.service.ts` com:
- **`GroqKeyManager`**: rotação round-robin entre chaves
- **Cooldown por chave** após 429 (lê o tempo do corpo do erro)
- **`groqFetch()`**: retry automático com fallback de modelo
- **Suporte a múltiplas chaves** via `GROQ_API_KEY=ch1,ch2,ch3` ou `GROQ_API_KEY_1`, `GROQ_API_KEY_2`…

O Muneri usa uma única chave diretamente em cada route — sem qualquer protecção.

---

## Solução

### 1. Criar o cliente resiliente

```typescript
// src/lib/groq-resilient.ts
// Cliente Groq com rotação de chaves e cooldown automático por 429.
// Uso: substituir todos os fetch directos ao Groq nas routes.

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_COOLDOWN_MS = 15_000;
const MAX_ATTEMPTS = 6;

interface KeyEntry {
  key: string;
  cooldownUntil: number; // 0 = disponível
}

class GroqKeyManager {
  private keys: KeyEntry[] = [];
  private currentIndex = 0;

  constructor() {
    this.loadKeys();
  }

  private loadKeys(): void {
    const collected: string[] = [];

    // Opção A: GROQ_API_KEY=ch1,ch2,ch3
    const raw = process.env.GROQ_API_KEY ?? '';
    collected.push(...raw.split(',').map(k => k.trim()).filter(Boolean));

    // Opção B: GROQ_API_KEY_1, GROQ_API_KEY_2, …
    for (let i = 1; i <= 20; i++) {
      const k = process.env[`GROQ_API_KEY_${i}`]?.trim();
      if (k) collected.push(k);
    }

    // Deduplica mantendo a ordem
    const seen = new Set<string>();
    for (const k of collected) {
      if (!seen.has(k)) {
        seen.add(k);
        this.keys.push({ key: k, cooldownUntil: 0 });
      }
    }

    if (this.keys.length === 0) {
      throw new Error('Nenhuma GROQ_API_KEY configurada no ambiente.');
    }
  }

  /** Devolve a próxima chave disponível. Aguarda se todas estiverem em cooldown. */
  async acquire(): Promise<{ key: string; index: number }> {
    const now = Date.now();

    for (let offset = 0; offset < this.keys.length; offset++) {
      const idx = (this.currentIndex + offset) % this.keys.length;
      if (this.keys[idx].cooldownUntil <= now) {
        this.currentIndex = (idx + 1) % this.keys.length;
        return { key: this.keys[idx].key, index: idx };
      }
    }

    // Todas em cooldown — aguarda a mais próxima de ficar livre
    const soonest = this.keys.reduce((a, b) =>
      a.cooldownUntil < b.cooldownUntil ? a : b,
    );
    const wait = soonest.cooldownUntil - Date.now() + 50;
    console.warn(
      `[GroqKeyManager] Todas as ${this.keys.length} chave(s) em cooldown. Aguardando ${(wait / 1000).toFixed(1)}s…`,
    );
    await new Promise<void>(r => setTimeout(r, wait));
    return this.acquire();
  }

  setCooldown(index: number, ms: number): void {
    this.keys[index].cooldownUntil = Date.now() + ms;
    console.warn(
      `[GroqKeyManager] Chave #${index + 1}/${this.keys.length} em cooldown por ${(ms / 1000).toFixed(1)}s.`,
    );
  }

  get count() {
    return this.keys.length;
  }
}

// Singleton — inicializado uma única vez no processo
let _manager: GroqKeyManager | null = null;
function getManager(): GroqKeyManager {
  if (!_manager) _manager = new GroqKeyManager();
  return _manager;
}

// ── Utilitário: extrai o tempo de cooldown da resposta 429 do Groq ────────────

function parseCooldownMs(errorBody: string): number {
  const match = errorBody.match(/try again in\s+([\d.]+)s/i);
  if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 300;
  return DEFAULT_COOLDOWN_MS;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Faz um POST ao endpoint de chat do Groq com rotação automática de chaves.
 *
 * @param buildBody  Recebe a chave actual e o número da tentativa.
 *                   Permite alterar modelo ou parâmetros por tentativa.
 */
export async function groqFetch(
  buildBody: (key: string, attempt: number) => Record<string, unknown>,
): Promise<Response> {
  const manager = getManager();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { key, index } = await manager.acquire();
    const body = buildBody(key, attempt);

    const response = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) return response;

    const text = await response.text();

    if (response.status === 429) {
      const cooldownMs = parseCooldownMs(text);
      manager.setCooldown(index, cooldownMs);

      if (attempt < MAX_ATTEMPTS - 1) {
        console.warn(
          `[Groq] 429 na chave #${index + 1}. Tentativa ${attempt + 1}/${MAX_ATTEMPTS} — rodando…`,
        );
        continue;
      }

      // Todas as tentativas esgotadas
      throw new Error(
        `Groq: todas as chaves atingiram rate limit. Última resposta: ${text}`,
      );
    }

    // Erro não recuperável
    throw new Error(`Groq API error (${response.status}): ${text}`);
  }

  throw new Error('Groq: número máximo de tentativas atingido.');
}

/**
 * Conveniência: devolve a resposta JSON directamente.
 * Usar quando a route não precisa de streaming.
 */
export async function groqJSON(
  buildBody: (key: string, attempt: number) => Record<string, unknown>,
): Promise<unknown> {
  const response = await groqFetch(buildBody);
  return response.json();
}
```

---

### 2. Actualizar as routes do Muneri

Substituir os `fetch` directos em cada route pelo `groqFetch`. O padrão é sempre o mesmo:

**Antes (padrão actual em todas as routes):**
```typescript
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) return NextResponse.json({ error: '…' }, { status: 500 });

const response = await fetch(GROQ_BASE, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ model: '…', messages: […], stream: true }),
});
```

**Depois (com resiliência):**
```typescript
import { groqFetch } from '@/lib/groq-resilient';

// Remover a verificação manual da apiKey — o manager já trata isso.

const response = await groqFetch((_key, _attempt) => ({
  model: 'openai/gpt-oss-120b',
  messages: […],
  stream: true,
  max_tokens: 4096,
  temperature: 0.7,
}));
```

#### `src/app/api/chat/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { groqFetch } from '@/lib/groq-resilient';
import { enforceRateLimit } from '@/lib/rate-limit';

const SYSTEM_PROMPT = `És um assistente especialista em matemática e ciências.
Quando responderes, usa SEMPRE formatação Markdown bem estruturada:
- Cabeçalhos com # ## ###
- Equações inline com $...$ e em bloco com $$...$$
- Listas, negrito e itálico onde adequado
- Exemplos resolvidos passo a passo

Usa notação LaTeX correcta para equações. Responde em português europeu.`;

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, {
    scope: 'chat:post',
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { messages } = await req.json();

    const response = await groqFetch((_key, _attempt) => ({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages,
      ],
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
    }));

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### `src/app/api/cover/abstract/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { groqFetch } from '@/lib/groq-resilient';
import { enforceRateLimit } from '@/lib/rate-limit';

const SYSTEM = `És um especialista em redacção académica…`; // mantém o mesmo

export async function POST(req: Request) {
  const limited = enforceRateLimit(req, {
    scope: 'cover:abstract',
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { theme, topic, outline } = await req.json();

    if (!theme) {
      return NextResponse.json({ error: 'theme é obrigatório' }, { status: 400 });
    }

    const outlineExcerpt =
      typeof outline === 'string' && outline.trim()
        ? outline.trim().slice(0, 2500)
        : null;

    const userPrompt = outlineExcerpt
      ? `Gera um resumo (abstract)…\n\nTema: "${theme}"\n\nEsboço:\n${outlineExcerpt}`
      : topic
        ? `Gera um resumo…\n\nTópico: "${topic}"\nTema: "${theme}"`
        : `Gera um resumo sobre: "${theme}"`;

    const response = await groqFetch((_key, _attempt) => ({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      max_tokens: 200,
      temperature: 0.4,
    }));

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

O **mesmo padrão** aplica-se a todas as restantes routes que usam Groq diectamente:

| Route | Alteração |
|---|---|
| `api/cover/agent/route.ts` | substituir `fetch` + verificação `apiKey` |
| `api/tcc/outline/route.ts` | idem |
| `api/tcc/develop/route.ts` | idem |
| `api/work/generate/route.ts` | idem |
| `api/work/develop/route.ts` | idem |
| `api/chat/route.ts` | idem (já mostrado) |

Para as routes que usam `stream: false` (ex: `cover/agent` com tool calling), usar `groqJSON` em vez de `groqFetch`:

```typescript
// cover/agent/route.ts — sem streaming
import { groqJSON } from '@/lib/groq-resilient';

const data = await groqJSON((_key, _attempt) => ({
  model: 'openai/gpt-oss-120b',
  messages: [{ role: 'system', content: systemPrompt }, ...(messages ?? [])],
  tools: [COVER_TOOL],
  tool_choice: 'auto',
  stream: false,
  max_tokens: 512,
  temperature: 0.3,
}));

return NextResponse.json(data);
```

---

### 3. Configurar as chaves no `.env`

```bash
# Opção A — múltiplas chaves separadas por vírgula (mais simples)
GROQ_API_KEY=gsk_chave1,gsk_chave2,gsk_chave3

# Opção B — variáveis numeradas (mais legível)
GROQ_API_KEY_1=gsk_chave1
GROQ_API_KEY_2=gsk_chave2
GROQ_API_KEY_3=gsk_chave3

# Ambas as opções são suportadas em simultâneo e deduplica automaticamente
```

---

### Resumo do que muda

Com isso o Muneri passa a ter:
- **Rotação round-robin** entre todas as chaves disponíveis
- **Cooldown inteligente** — quando uma chave recebe 429, é isolada pelo tempo exacto que o Groq indica (`try again in Xs`) em vez de desperdiçar tentativas nela
- **Retry automático** — o pedido passa para a próxima chave sem o utilizador notar nada
- **Zero alteração de lógica de negócio** — apenas o transporte HTTP muda; os prompts e parâmetros ficam intactos
- **Compatível com 1 chave** — se só existir uma, comporta-se exactamente como antes, sem overhead