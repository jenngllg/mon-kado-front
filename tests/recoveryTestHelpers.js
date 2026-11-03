/** Return one failed identity GET, then let a fresh GET succeed; login/refresh POSTs stay unchanged.
 * @param {ReturnType<typeof import("./sessionTestHelpers.js").createSessionTransport>} transport Synthetic external transport. */
export function recoverIdentityAfterOneFailure(transport) {
  const original = transport.fetch.getMockImplementation();
  transport.fetch.mockImplementation(async (input, init) => {
    if (!original) throw new Error("Missing fixture transport.");
    const response = await original(input, init);
    if (String(input).endsWith("/auth/sessions/current") && response.status === 503) transport.state.identityStatus = 200;
    return response;
  });
}
