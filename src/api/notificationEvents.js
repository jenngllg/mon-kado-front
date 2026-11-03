/** Reads the bounded notification SSE contract without exposing credentials to callers.
 * @param {Response} response Authenticated event response.
 * @param {(status:{hasUnread:boolean})=>void} receive Notification-only invalidation.
 * @returns {Promise<{data:null,isValid:boolean,isEmpty:boolean}>} Completed stream.
 */
export async function readNotificationEvents(response, receive) {
  if (response.headers.get("content-type")?.split(";")[0] !== "text/event-stream" || !response.body) throw new Error("Invalid notification stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      if (pending.length > 8192) throw new Error("Notification event too large");
      let boundary;
      while ((boundary = pending.indexOf("\n\n")) >= 0) {
        const block = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
        if (!block.startsWith("event: notifications\n")) continue;
        const line = block.split("\n").find(line => line.startsWith("data: "));
        const status = line ? JSON.parse(line.slice(6)) : null;
        if (!status || typeof status.hasUnread !== "boolean" || Object.keys(status).length !== 1) throw new Error("Invalid notification status");
        receive({ hasUnread: status.hasUnread });
      }
    }
    return { data: null, isValid: true, isEmpty: true };
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
