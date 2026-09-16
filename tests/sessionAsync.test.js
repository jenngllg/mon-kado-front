import { describe, expect, it, vi } from "vitest";
import { waitForSession } from "../src/auth/sessionAsync.js";

function deferred() {
  /** @type {(value: string) => void} */
  let resolve = () => {};
  /** @type {(reason: Error) => void} */
  let reject = () => {};
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("independent session waiters", () => {
  it("returns shared work unchanged when no signal is supplied", () => {
    const work = Promise.resolve("ready");
    expect(waitForSession(work)).toBe(work);
  });

  it("rejects an already cancelled waiter while observing a rejected shared operation", async () => {
    const controller = new AbortController();
    controller.abort();
    const work = Promise.reject(new Error("shared failure"));
    await expect(waitForSession(work, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not cancel shared work or another waiter when one caller leaves", async () => {
    const pending = deferred();
    const first = new AbortController();
    const second = new AbortController();
    const cancelled = waitForSession(pending.promise, first.signal);
    const surviving = waitForSession(pending.promise, second.signal);
    first.abort();
    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    pending.resolve("ready");
    await expect(surviving).resolves.toBe("ready");
    expect(second.signal.aborted).toBe(false);
  });

  it.each([true, false])("removes the abort listener after shared work settles (success=%s)", async (success) => {
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const pending = deferred();
    const waiting = waitForSession(pending.promise, controller.signal);
    const error = new Error("failure");
    if (success) {
      pending.resolve("ready");
      await expect(waiting).resolves.toBe("ready");
    } else {
      pending.reject(error);
      await expect(waiting).rejects.toBe(error);
    }
    expect(remove).toHaveBeenCalledExactlyOnceWith("abort", add.mock.calls[0][1]);
  });
});
