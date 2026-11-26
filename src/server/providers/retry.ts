/** Extracts an HTTP status from SDK errors (Anthropic / OpenAI / Google all expose `status`). */
export function errorStatus(e: unknown): number | undefined {
  if (e && typeof e === "object") {
    const s = (e as { status?: unknown; code?: unknown }).status ?? (e as { code?: unknown }).code;
    if (typeof s === "number") return s;
  }
  return undefined;
}

export function isRetryable(e: unknown): boolean {
  const s = errorStatus(e);
  if (s === undefined) {
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    return /timeout|timed out|econnreset|fetch failed|network|socket/.test(msg);
  }
  return s === 408 || s === 409 || s === 429 || s >= 500;
}

/** Retry with exponential backoff + jitter on 429/5xx/network errors. */
export async function withRetry<T>(fn: () => Promise<T>, opts: { retries?: number; baseMs?: number; sleep?: (ms: number) => Promise<void> } = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseMs ?? 1000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries || !isRetryable(e)) throw e;
      await sleep(base * 2 ** attempt + Math.random() * base * 0.3);
      attempt++;
    }
  }
}

/** Clear Romanian error messages for the UI. */
export function humanizeError(e: unknown, provider: string): string {
  const s = errorStatus(e);
  const raw = e instanceof Error ? e.message : String(e);
  if (s === 401 || s === 403) return `${provider}: cheia API e invalidă sau nu are acces (${s}).`;
  if (s === 429) return `${provider}: prea multe cereri sau limită de cost atinsă (429). Încearcă din nou peste un minut.`;
  if (s === 400) return `${provider}: cerere respinsă (400): ${raw.slice(0, 200)}`;
  if (s === 404) return `${provider}: modelul nu există sau nu e disponibil pe cont (404). Verifică numele modelului în .env.`;
  if (s !== undefined && s >= 500) return `${provider}: serviciul are probleme acum (${s}). Încearcă mai târziu.`;
  if (/timeout|timed out/i.test(raw)) return `${provider}: cererea a durat prea mult (timeout).`;
  return `${provider}: ${raw.slice(0, 300)}`;
}

/** Rejects after `ms` with a timeout error. */
export function withTimeout<T>(p: Promise<T>, ms: number, label = "operația"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout: ${label} a depășit ${Math.round(ms / 1000)} s`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err: unknown) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}
