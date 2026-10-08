// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/apiError.js";
import { disposeComponent } from "../src/components/index.js";
import { createWishlistReportDialog } from "../src/features/sharing/wishlistReportDialog.js";
import { barrier } from "./sessionTestHelpers.js";
/** @type {HTMLDialogElement[]} */ const dialogs = [];
afterEach(() => { dialogs.splice(0).forEach(disposeComponent); document.body.replaceChildren(); });
function setup() {
  const report = vi.fn(async () => {}), onReported = vi.fn(), onClose = vi.fn(), onUnavailable = vi.fn();
  const controller = new AbortController();
  const dialog = createWishlistReportDialog({ shareLinkId: "019c52dd-56c1-7cc6-8a95-243f3a032e04", wishlistName: "<script>test</script>", report, onReported, onClose, onUnavailable, signal: controller.signal });
  dialogs.push(dialog); document.body.append(dialog); dialog.showModal();
  const reason = /** @type {HTMLSelectElement} */ (dialog.querySelector("select")), details = /** @type {HTMLTextAreaElement} */ (dialog.querySelector("textarea"));
  const submit = /** @type {HTMLButtonElement} */ (dialog.querySelector('[type="submit"]'));
  function fill() { reason.value = "other"; reason.dispatchEvent(new Event("change")); details.value = "Pourquoi"; details.dispatchEvent(new Event("input")); }
  return { dialog, reason, details, submit, fill, report, onReported, onClose, onUnavailable, controller };
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
describe("report confirmation", () => {
  it("validates modified fields on blur and preserves click activation during blur", async () => {
    const ui = setup(); ui.reason.focus(); ui.reason.dispatchEvent(new Event("change")); ui.reason.blur();
    expect(ui.reason.getAttribute("aria-invalid")).toBe("true");
    ui.fill(); ui.details.value = ""; ui.details.focus();
    ui.submit.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    ui.details.dispatchEvent(new FocusEvent("blur", { relatedTarget: ui.submit }));
    expect(ui.details.getAttribute("aria-invalid")).not.toBe("true");
    ui.submit.dispatchEvent(new Event("pointerup", { bubbles: true })); ui.submit.click();
    expect(ui.details.getAttribute("aria-invalid")).toBe("true"); expect(ui.report).not.toHaveBeenCalled();
    ui.details.value = "valide"; ui.details.dispatchEvent(new Event("input")); ui.details.dispatchEvent(new Event("blur"));
    ui.reason.value = "spamOrScam"; ui.reason.dispatchEvent(new Event("change")); expect(ui.details.required).toBe(false);
    ui.submit.click(); await settle(); expect(ui.onReported).toHaveBeenCalledOnce();
  });
  it("flushes deferred validation when a pointer gesture is cancelled", () => {
    const ui = setup(); ui.fill(); ui.details.value = "";
    ui.submit.dispatchEvent(new Event("pointerdown", { bubbles: true })); ui.details.dispatchEvent(new FocusEvent("blur", { relatedTarget: ui.submit }));
    document.dispatchEvent(new Event("pointercancel")); expect(ui.details.getAttribute("aria-invalid")).toBe("true");
  });
  it("opens without HTTP, treats names as text and connects ARIA", () => {
    const ui = setup(); expect(ui.report).not.toHaveBeenCalled(); expect(ui.dialog.querySelector("script")).toBeNull();
    expect(ui.dialog.querySelector(`#${ui.dialog.getAttribute("aria-labelledby")}`)?.textContent).toBe("Signaler cette liste");
    expect(ui.dialog.querySelector(`#${ui.dialog.getAttribute("aria-describedby")}`)?.textContent).toBe("<script>test</script>");
    expect(ui.details.hasAttribute("maxlength")).toBe(false);
  });
  it("validates all fields, marks Other details required and focuses invalid input", () => {
    const ui = setup(); ui.reason.value = "other"; ui.reason.dispatchEvent(new Event("change")); ui.submit.click();
    expect(ui.details.required).toBe(true); expect(document.activeElement).toBe(ui.details); expect(ui.report).not.toHaveBeenCalled(); expect(ui.dialog.textContent).toContain("obligatoire");
    ui.details.value = "test"; ui.details.dispatchEvent(new Event("input")); expect(ui.details.getAttribute("aria-invalid")).not.toBe("true");
  });
  it("cancels and clears the draft without sending", () => {
    const ui = setup(); ui.fill(); ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true })); expect(ui.onClose).toHaveBeenCalledOnce(); expect(ui.details.value).toBe(""); expect(ui.report).not.toHaveBeenCalled();
  });
  it("blocks Escape and duplicate submits while sending, then confirms once", async () => {
    const ui = setup(), gate = barrier(); ui.report.mockImplementation(async () => { await gate.promise; }); ui.fill(); ui.submit.click(); ui.submit.click();
    ui.dialog.dispatchEvent(new Event("cancel", { cancelable: true })); expect(ui.dialog.open).toBe(true); expect(ui.onClose).not.toHaveBeenCalled(); expect(ui.details.disabled).toBe(true); expect(ui.report).toHaveBeenCalledOnce();
    gate.resolve(); await settle(); expect(ui.onReported).toHaveBeenCalledOnce(); expect(ui.onClose).toHaveBeenCalledOnce(); expect(ui.details.value).toBe("");
  });
  it.each([new ApiError({ kind: "network" }), new ApiError({ kind: "timeout" }), new ApiError({ kind: "invalidResponse" }), new ApiError({ kind: "http", statusCode: 503 })])("retains the draft and warns about duplicates before explicit retry", async error => {
    const ui = setup(); ui.report.mockRejectedValueOnce(error); ui.fill(); ui.submit.click(); await settle(); expect(ui.details.value).toBe("Pourquoi"); expect(ui.dialog.textContent).toContain("doublon"); expect(ui.submit.textContent).toBe("Réessayer l’envoi"); expect(document.activeElement?.getAttribute("role")).toBe("alert"); expect(ui.report).toHaveBeenCalledOnce();
    ui.submit.click(); await settle(); expect(ui.report).toHaveBeenCalledTimes(2); expect(ui.onReported).toHaveBeenCalledOnce();
  });
  it.each([401, 403, 413, 429])("keeps operation failures local: %s", async statusCode => {
    const ui = setup(); ui.report.mockRejectedValue(new ApiError({ kind: "http", statusCode, correlationId: "ref", retryAfterSeconds: 5 })); ui.fill(); ui.submit.click(); await settle(); expect(ui.onUnavailable).not.toHaveBeenCalled(); expect(ui.details.value).toBe("Pourquoi"); expect(ui.submit.disabled).toBe(false); expect(ui.onReported).not.toHaveBeenCalled();
  });
  it("reports missing access to its owner", async () => {
    const ui = setup(); ui.report.mockRejectedValue(new ApiError({ kind: "http", statusCode: 404 })); ui.fill(); ui.submit.click(); await settle(); expect(ui.onUnavailable).toHaveBeenCalledOnce(); expect(ui.dialog.isConnected).toBe(false);
  });
  it("maps only known validation paths without backend text", async () => {
    const ui = setup(); ui.report.mockRejectedValue(new ApiError({ kind: "http", statusCode: 400, validationErrors: [{ propertyName: "details", errorMessage: "PRIVATE" }, { propertyName: "unknown", errorMessage: "PRIVATE" }] })); ui.fill(); ui.submit.click(); await settle(); expect(ui.details.getAttribute("aria-invalid")).toBe("true"); expect(document.activeElement).toBe(ui.details); expect(ui.dialog.textContent).not.toContain("PRIVATE");
  });
  it("aborts and ignores late success after leaving", async () => {
    const ui = setup(), gate = barrier(); ui.report.mockImplementation(async () => { await gate.promise; }); ui.fill(); ui.submit.click(); ui.controller.abort(); gate.resolve(); await settle(); expect(ui.dialog.isConnected).toBe(false); expect(ui.details.value).toBe(""); expect(ui.onReported).not.toHaveBeenCalled();
  });
});
