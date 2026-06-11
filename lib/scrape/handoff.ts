import { randomUUID } from "node:crypto";

/**
 * Human-handoff queue for verification challenges.
 *
 * When a scrape hits a slider / captcha / login wall, we do NOT try to bypass it. Instead
 * we record a pending handoff and notify a human, who clears the challenge in a controlled
 * session; the refreshed session is then saved (see SessionStore) for reuse. This keeps the
 * system honest about access controls (refactor plan §4 / §13) and prevents the scraper from
 * silently degrading or fabricating data.
 *
 * The persistence store and notifier are injectable so this is fully testable and so the
 * notifier can be wired to Slack / Twilio / email later.
 */

export type HandoffStatus = "pending" | "resolved" | "cancelled";

export interface HandoffRequest {
  id: string;
  platform: string;
  url: string;
  reason: string;
  status: HandoffStatus;
  created_at: string;
  resolved_at?: string;
}

export interface HandoffStore {
  put(request: HandoffRequest): Promise<void>;
  get(id: string): Promise<HandoffRequest | undefined>;
  list(status?: HandoffStatus): Promise<HandoffRequest[]>;
}

export type HandoffNotifier = (request: HandoffRequest) => void | Promise<void>;

export interface HandoffQueueOptions {
  store?: HandoffStore;
  notify?: HandoffNotifier;
  now?: () => number;
  makeId?: () => string;
}

export interface HandoffQueue {
  enqueue(input: { platform: string; url: string; reason: string }): Promise<HandoffRequest>;
  resolve(id: string): Promise<HandoffRequest | undefined>;
  cancel(id: string): Promise<HandoffRequest | undefined>;
  list(status?: HandoffStatus): Promise<HandoffRequest[]>;
}

/** Default in-memory store (swap for a filesystem/DB store in production). */
export class InMemoryHandoffStore implements HandoffStore {
  private readonly map = new Map<string, HandoffRequest>();
  async put(request: HandoffRequest): Promise<void> {
    this.map.set(request.id, request);
  }
  async get(id: string): Promise<HandoffRequest | undefined> {
    return this.map.get(id);
  }
  async list(status?: HandoffStatus): Promise<HandoffRequest[]> {
    const all = Array.from(this.map.values()).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return status ? all.filter((r) => r.status === status) : all;
  }
}

export function createHandoffQueue(options: HandoffQueueOptions = {}): HandoffQueue {
  const store = options.store ?? new InMemoryHandoffStore();
  const notify = options.notify;
  const now = options.now ?? Date.now;
  const makeId = options.makeId ?? (() => randomUUID());

  return {
    async enqueue(input): Promise<HandoffRequest> {
      const request: HandoffRequest = {
        id: makeId(),
        platform: input.platform,
        url: input.url,
        reason: input.reason,
        status: "pending",
        created_at: new Date(now()).toISOString(),
      };
      await store.put(request);
      if (notify) {
        // Notification must never fail the enqueue.
        try {
          await notify(request);
        } catch {
          /* best-effort */
        }
      }
      return request;
    },

    async resolve(id): Promise<HandoffRequest | undefined> {
      const existing = await store.get(id);
      if (!existing) return undefined;
      const updated: HandoffRequest = { ...existing, status: "resolved", resolved_at: new Date(now()).toISOString() };
      await store.put(updated);
      return updated;
    },

    async cancel(id): Promise<HandoffRequest | undefined> {
      const existing = await store.get(id);
      if (!existing) return undefined;
      const updated: HandoffRequest = { ...existing, status: "cancelled", resolved_at: new Date(now()).toISOString() };
      await store.put(updated);
      return updated;
    },

    list(status): Promise<HandoffRequest[]> {
      return store.list(status);
    },
  };
}
