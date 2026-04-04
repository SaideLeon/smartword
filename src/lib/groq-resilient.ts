const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_COOLDOWN_MS = 15_000;
const MAX_ATTEMPTS = 6;

interface KeyEntry {
  key: string;
  cooldownUntil: number;
}

function normaliseKey(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

class GroqKeyManager {
  private keys: KeyEntry[] = [];
  private currentIndex = 0;

  constructor() {
    this.loadKeys();
  }

  private loadKeys(): void {
    const collected: string[] = [];

    const raw = process.env.GROQ_API_KEY ?? '';
    collected.push(...raw.split(',').map(normaliseKey).filter(Boolean));

    for (let i = 1; i <= 20; i++) {
      const k = normaliseKey(process.env[`GROQ_API_KEY_${i}`] ?? '');
      if (k) collected.push(k);
    }

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

  async acquire(): Promise<{ key: string; index: number }> {
    const now = Date.now();

    for (let offset = 0; offset < this.keys.length; offset++) {
      const idx = (this.currentIndex + offset) % this.keys.length;
      if (this.keys[idx].cooldownUntil <= now) {
        this.currentIndex = (idx + 1) % this.keys.length;
        return { key: this.keys[idx].key, index: idx };
      }
    }

    const soonest = this.keys.reduce((a, b) =>
      a.cooldownUntil < b.cooldownUntil ? a : b,
    );
    const wait = Math.max(soonest.cooldownUntil - Date.now() + 50, 50);
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
}

let manager: GroqKeyManager | null = null;

function getManager(): GroqKeyManager {
  if (!manager) manager = new GroqKeyManager();
  return manager;
}

function parseCooldownMs(errorBody: string): number {
  const match = errorBody.match(/try again in\s+([\d.]+)s/i);
  if (match) return Math.ceil(Number.parseFloat(match[1]) * 1000) + 300;
  return DEFAULT_COOLDOWN_MS;
}

export async function groqFetch(
  buildBody: (_key: string, attempt: number) => Record<string, unknown>,
): Promise<Response> {
  const keyManager = getManager();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { key, index } = await keyManager.acquire();
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
      keyManager.setCooldown(index, parseCooldownMs(text));

      if (attempt < MAX_ATTEMPTS - 1) {
        console.warn(
          `[Groq] 429 na chave #${index + 1}. Tentativa ${attempt + 1}/${MAX_ATTEMPTS} — rodando…`,
        );
        continue;
      }

      throw new Error(
        `Groq: todas as chaves atingiram rate limit. Última resposta: ${text}`,
      );
    }

    throw new Error(`Groq API error (${response.status}): ${text}`);
  }

  throw new Error('Groq: número máximo de tentativas atingido.');
}

export async function groqJSON(
  buildBody: (_key: string, attempt: number) => Record<string, unknown>,
): Promise<unknown> {
  const response = await groqFetch(buildBody);
  return response.json();
}
