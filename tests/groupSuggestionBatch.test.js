import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { createGroupSuggestionBatch } from "../src/features/groups/groupSuggestionBatch.js";

const values = { name: "Un livre", note: "Une édition illustrée", url: "", price: "25", quantity: "2" };
const saved = /** @type {import("../src/features/groups/groupSuggestionsService.js").Suggestion} */ ({ id: "idea", entityTag: '"created"' });
function target(id = "one") {
  return { id, name: `Liste ${id}`, groupName: "Famille", href: `/groups/group/wishlists/${id}`,
    service: { create: vi.fn(async () => saved), uploadImage: vi.fn(async () => saved) } };
}
describe("private idea batches", () => {
  it("creates one idea in each selected scope and propagates the signal", async () => {
    const first = target(), second = target("two"), batch = createGroupSuggestionBatch(), signal = new AbortController().signal;
    const result = await batch.run([first, second], values, null, signal);
    expect(result.complete).toBe(true); expect(batch.hasConfirmed()).toBe(true);
    for (const item of [first, second]) { expect(item.service.create).toHaveBeenCalledExactlyOnceWith(values, signal); expect(item.service.uploadImage).not.toHaveBeenCalled(); }
    await batch.run([first, second], values, null, signal);
    expect(first.service.create).toHaveBeenCalledOnce(); expect(second.service.create).toHaveBeenCalledOnce();
  });
  it("retries only destinations explicitly refused after a partial success", async () => {
    const first = target(), second = target("two"), batch = createGroupSuggestionBatch(), signal = new AbortController().signal;
    second.service.create.mockRejectedValueOnce(new ApiError({ kind: "http", statusCode: 409 }));
    const result = await batch.run([first, second], values, null, signal);
    expect(result.outcomes.map(item => item.state)).toEqual(["saved", "refused"]); expect(result.retryable).toBe(true);
    const retry = await batch.run([first, second], values, null, signal);
    expect(retry.complete).toBe(true); expect(first.service.create).toHaveBeenCalledOnce(); expect(second.service.create).toHaveBeenCalledTimes(2);
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 500 })])("stops after an uncertain write and never replays it", async error => {
    const first = target(), second = target("two"), third = target("three"), batch = createGroupSuggestionBatch(), signal = new AbortController().signal;
    second.service.create.mockRejectedValueOnce(error);
    const result = await batch.run([first, second, third], values, null, signal);
    expect(result.uncertain).toBe(true); expect(result.outcomes.map(item => item.state)).toEqual(["saved", "uncertain", "notSent"]);
    await batch.run([first, second, third], values, null, signal);
    expect(first.service.create).toHaveBeenCalledOnce(); expect(second.service.create).toHaveBeenCalledOnce(); expect(third.service.create).not.toHaveBeenCalled();
  });
  it("retains a confirmed idea when its photo result is uncertain", async () => {
    const first = target(), batch = createGroupSuggestionBatch(), signal = new AbortController().signal, image = new Blob(["photo"]);
    first.service.uploadImage.mockRejectedValueOnce(new ApiError({ kind: "timeout" }));
    const result = await batch.run([first], values, image, signal);
    expect(result.complete).toBe(true); expect(result.outcomes[0].state).toBe("imageUnconfirmed");
    await batch.run([first], values, image, signal);
    expect(first.service.create).toHaveBeenCalledOnce(); expect(first.service.uploadImage).toHaveBeenCalledExactlyOnceWith(saved.id, image, saved.entityTag, signal);
  });
  it("does not send further destinations after route cancellation", async () => {
    const first = target(), second = target("two"), batch = createGroupSuggestionBatch(), controller = new AbortController();
    first.service.create.mockImplementationOnce(async () => { controller.abort(); return saved; });
    await expect(batch.run([first, second], values, null, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(second.service.create).not.toHaveBeenCalled();
  });
});
