/**
 * Health-aware proxy pool.
 *
 * Rotates outbound IPs so a single proxy isn't hammered (and so one ban doesn't sink the
 * whole run). Round-robins over healthy proxies; a proxy that reports a failure is parked in
 * a cooldown and skipped until it recovers. Per-proxy failure tracking lets the managed
 * controller also feed proxy health into a circuit breaker if desired.
 *
 * Clock is injectable for deterministic tests.
 */

export interface Proxy {
  id: string;
  /** Proxy URL, e.g. "http://user:pass@host:port". Opaque to the pool. */
  url: string;
}

export interface ProxyPool {
  /** Next healthy proxy (round-robin), or undefined if all are cooling down. */
  acquire(): Proxy | undefined;
  /** Report the outcome of using a proxy; failures trigger a cooldown. */
  report(id: string, ok: boolean): void;
  size(): number;
  healthyCount(): number;
}

export interface ProxyPoolOptions {
  /** How long a failed proxy is parked before it's eligible again (ms). */
  cooldownMs?: number;
  /** Consecutive failures before parking (default 1). */
  failuresBeforeCooldown?: number;
  now?: () => number;
}

interface ProxyState {
  proxy: Proxy;
  failures: number;
  cooldownUntilMs: number;
}

export function createProxyPool(proxies: Proxy[], options: ProxyPoolOptions = {}): ProxyPool {
  const cooldownMs = Math.max(0, options.cooldownMs ?? 60_000);
  const failuresBeforeCooldown = Math.max(1, options.failuresBeforeCooldown ?? 1);
  const now = options.now ?? Date.now;
  const states = proxies.map<ProxyState>((proxy) => ({ proxy, failures: 0, cooldownUntilMs: 0 }));
  const byId = new Map(states.map((s) => [s.proxy.id, s]));
  let cursor = 0;

  function isHealthy(s: ProxyState): boolean {
    return now() >= s.cooldownUntilMs;
  }

  return {
    acquire(): Proxy | undefined {
      if (states.length === 0) return undefined;
      // Scan at most `length` slots from the round-robin cursor for a healthy proxy.
      for (let i = 0; i < states.length; i += 1) {
        const s = states[(cursor + i) % states.length];
        if (isHealthy(s)) {
          cursor = (cursor + i + 1) % states.length;
          return s.proxy;
        }
      }
      return undefined; // all cooling down
    },

    report(id: string, ok: boolean): void {
      const s = byId.get(id);
      if (!s) return;
      if (ok) {
        s.failures = 0;
        s.cooldownUntilMs = 0;
        return;
      }
      s.failures += 1;
      if (s.failures >= failuresBeforeCooldown) {
        s.cooldownUntilMs = now() + cooldownMs;
        s.failures = 0;
      }
    },

    size(): number {
      return states.length;
    },

    healthyCount(): number {
      return states.filter(isHealthy).length;
    },
  };
}
