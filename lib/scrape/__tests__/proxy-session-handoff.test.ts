import { describe, expect, it, vi } from "vitest";
import { createProxyPool } from "../proxy-pool";
import { InMemorySessionStore } from "../session-store";
import { createHandoffQueue, InMemoryHandoffStore } from "../handoff";

describe("proxy pool", () => {
  const proxies = [
    { id: "p1", url: "http://p1" },
    { id: "p2", url: "http://p2" },
    { id: "p3", url: "http://p3" },
  ];

  it("round-robins over healthy proxies", () => {
    const pool = createProxyPool(proxies);
    expect(pool.acquire()?.id).toBe("p1");
    expect(pool.acquire()?.id).toBe("p2");
    expect(pool.acquire()?.id).toBe("p3");
    expect(pool.acquire()?.id).toBe("p1"); // wraps
  });

  it("parks a failed proxy for the cooldown and skips it", () => {
    let clock = 0;
    const pool = createProxyPool(proxies, { cooldownMs: 1000, now: () => clock });
    pool.report("p1", false); // park p1
    expect(pool.healthyCount()).toBe(2);
    // acquire never returns p1 while parked
    const ids = [pool.acquire()?.id, pool.acquire()?.id, pool.acquire()?.id];
    expect(ids).not.toContain("p1");
    clock += 1000;
    expect(pool.healthyCount()).toBe(3); // recovered
  });

  it("a success clears prior failures", () => {
    let clock = 0;
    const pool = createProxyPool(proxies, { cooldownMs: 1000, failuresBeforeCooldown: 2, now: () => clock });
    pool.report("p1", false);
    pool.report("p1", true); // reset
    pool.report("p1", false); // only 1 failure again → still healthy
    expect(pool.healthyCount()).toBe(3);
  });

  it("returns undefined when every proxy is cooling down", () => {
    let clock = 0;
    const pool = createProxyPool([{ id: "only", url: "http://only" }], { cooldownMs: 1000, now: () => clock });
    pool.report("only", false);
    expect(pool.acquire()).toBeUndefined();
    clock += 1000;
    expect(pool.acquire()?.id).toBe("only");
  });

  it("empty pool acquires undefined", () => {
    expect(createProxyPool([]).acquire()).toBeUndefined();
  });
});

describe("session store (in-memory)", () => {
  it("saves, reads, and clears a session", async () => {
    let clock = 1000;
    const store = new InMemorySessionStore(() => clock);
    expect(await store.get("1688")).toBeUndefined();
    const saved = await store.save("1688", { cookies: [{ name: "x" }], user_agent: "UA" });
    expect(saved.saved_at).toBeTruthy();
    expect((await store.get("1688"))?.user_agent).toBe("UA");
    await store.clear("1688");
    expect(await store.get("1688")).toBeUndefined();
  });
});

describe("handoff queue", () => {
  it("enqueues a pending request and notifies", async () => {
    const notify = vi.fn();
    let n = 0;
    const queue = createHandoffQueue({ notify, makeId: () => `h${++n}`, now: () => 1000 });
    const req = await queue.enqueue({ platform: "taobao", url: "https://item.taobao.com/x", reason: "slider captcha" });
    expect(req.id).toBe("h1");
    expect(req.status).toBe("pending");
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ platform: "taobao", status: "pending" }));
    expect((await queue.list("pending")).length).toBe(1);
  });

  it("resolves and cancels requests", async () => {
    const queue = createHandoffQueue({ store: new InMemoryHandoffStore(), makeId: () => "h1" });
    await queue.enqueue({ platform: "1688", url: "u", reason: "login wall" });
    const resolved = await queue.resolve("h1");
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolved_at).toBeTruthy();
    expect((await queue.list("pending")).length).toBe(0);
    expect(await queue.resolve("missing")).toBeUndefined();
  });

  it("a failing notifier does not fail the enqueue", async () => {
    const queue = createHandoffQueue({
      notify: () => {
        throw new Error("slack down");
      },
      makeId: () => "h1",
    });
    const req = await queue.enqueue({ platform: "shopee", url: "u", reason: "verify" });
    expect(req.status).toBe("pending");
  });
});
