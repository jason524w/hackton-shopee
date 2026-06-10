import { describe, expect, it, vi } from "vitest";
import { InProcessJobQueue } from "../job-queue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("InProcessJobQueue", () => {
  it("runs an enqueued job via the handler", async () => {
    const seen: string[] = [];
    const queue = new InProcessJobQueue(async (id) => {
      seen.push(id);
    });
    await queue.enqueue("run_a");
    await queue.drain();
    expect(seen).toEqual(["run_a"]);
  });

  it("respects the concurrency limit", async () => {
    const gates = [deferred(), deferred(), deferred()];
    let active = 0;
    let maxActive = 0;
    const queue = new InProcessJobQueue(
      async (id) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gates[Number(id)].promise;
        active -= 1;
      },
      { concurrency: 2 },
    );

    await queue.enqueue("0");
    await queue.enqueue("1");
    await queue.enqueue("2");

    // Two should be active, one pending (concurrency=2).
    await new Promise((r) => setTimeout(r, 10));
    expect(queue.activeCount()).toBe(2);
    expect(queue.pendingCount()).toBe(1);

    gates[0].resolve();
    gates[1].resolve();
    gates[2].resolve();
    await queue.drain();
    expect(maxActive).toBe(2);
  });

  it("isolates handler failures and keeps draining (onError invoked, queue not wedged)", async () => {
    const onError = vi.fn();
    const done: string[] = [];
    const queue = new InProcessJobQueue(
      async (id) => {
        if (id === "bad") throw new Error("boom");
        done.push(id);
      },
      { concurrency: 1, onError },
    );

    await queue.enqueue("bad");
    await queue.enqueue("good");
    await queue.drain();

    expect(onError).toHaveBeenCalledWith("bad", expect.any(Error));
    expect(done).toEqual(["good"]); // a failed job doesn't block the next one
  });

  it("drain() resolves immediately when idle", async () => {
    const queue = new InProcessJobQueue(async () => {});
    await expect(queue.drain()).resolves.toBeUndefined();
  });
});
