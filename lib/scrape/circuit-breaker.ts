/**
 * Per-key circuit breaker.
 *
 * When a platform starts hard-failing (verification walls, proxy bans, network errors),
 * hammering it makes things worse and burns budget. The breaker trips after N consecutive
 * failures, short-circuits further attempts for a cooldown, then lets a single trial through
 * (half-open) to test recovery. Used per platform (and optionally per proxy) by the managed
 * scrape controller, which falls back to cache / surfaces a clear error while open.
 *
 * Clock is injectable for deterministic tests.
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreaker {
  /** True if a request may proceed now (closed, or half-open trial). */
  canRequest(key: string): boolean;
  onSuccess(key: string): void;
  onFailure(key: string): void;
  state(key: string): CircuitState;
}

export interface CircuitBreakerOptions {
  /** Consecutive failures that trip the breaker. */
  failureThreshold: number;
  /** How long to stay open before allowing a half-open trial (ms). */
  cooldownMs: number;
  now?: () => number;
}

interface Entry {
  failures: number;
  state: CircuitState;
  openedAtMs: number;
}

export function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  const failureThreshold = Math.max(1, options.failureThreshold);
  const cooldownMs = Math.max(0, options.cooldownMs);
  const now = options.now ?? Date.now;
  const entries = new Map<string, Entry>();

  function entry(key: string): Entry {
    let e = entries.get(key);
    if (!e) {
      e = { failures: 0, state: "closed", openedAtMs: 0 };
      entries.set(key, e);
    }
    return e;
  }

  function refreshOpen(e: Entry): void {
    if (e.state === "open" && now() - e.openedAtMs >= cooldownMs) {
      e.state = "half_open"; // allow a single trial request through
    }
  }

  return {
    canRequest(key: string): boolean {
      const e = entry(key);
      refreshOpen(e);
      return e.state !== "open";
    },

    onSuccess(key: string): void {
      const e = entry(key);
      e.failures = 0;
      e.state = "closed";
    },

    onFailure(key: string): void {
      const e = entry(key);
      if (e.state === "half_open") {
        // Trial failed — re-open and restart the cooldown.
        e.state = "open";
        e.openedAtMs = now();
        return;
      }
      e.failures += 1;
      if (e.failures >= failureThreshold) {
        e.state = "open";
        e.openedAtMs = now();
      }
    },

    state(key: string): CircuitState {
      const e = entry(key);
      refreshOpen(e);
      return e.state;
    },
  };
}
