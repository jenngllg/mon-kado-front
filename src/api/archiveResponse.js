/** Reads an authenticated ZIP under the caller's existing deadline and exact metadata size.
 * @param {Response} response Successful response from the trusted API origin.
 * @param {number} expectedBytes Size previously returned by the owned export resource.
 * @returns {Promise<{data: Blob | null, isValid: boolean, isEmpty: boolean}>} Complete archive only.
 */
export async function readArchiveResponse(response, expectedBytes) {
  const invalid = { data: null, isValid: false, isEmpty: false };
  if (response.status !== 200 || response.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase() !== "application/zip" ||
    !response.body) return invalid;
  const reader = response.body.getReader();
  /** @type {Uint8Array<ArrayBuffer>[]} */ const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > expectedBytes) return invalid;
      chunks.push(new Uint8Array(value));
    }
    if (size !== expectedBytes) return invalid;
    return { data: new Blob(chunks, { type: "application/zip" }), isValid: true, isEmpty: false };
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
