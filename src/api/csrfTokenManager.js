/**
 * Keeps the CSRF request token in memory and serializes concurrent loads.
 */
export class CsrfTokenManager {
  /** @type {{ promise: Promise<string>, version: number } | null} */
  #inFlight = null;
  #loadToken;
  /** @type {string | null} */
  #token = null;
  #version = 0;

  /**
   * @param {() => Promise<string>} loadToken Loads a token from the API.
   */
  constructor(loadToken) {
    this.#loadToken = loadToken;
  }

  /**
   * Gets the current token, loading it once when necessary.
   *
   * @returns {Promise<string>} Current CSRF request token.
   */
  async getToken() {
    if (this.#token !== null) {
      return this.#token;
    }

    if (this.#inFlight !== null) {
      return this.#inFlight.promise;
    }

    const version = this.#version;
    const promise = this.#loadAndStoreToken(version);
    const inFlight = { promise, version };
    this.#inFlight = inFlight;

    try {
      return await promise;
    } finally {
      if (this.#inFlight === inFlight) {
        this.#inFlight = null;
      }
    }
  }

  /**
   * Invalidates the cached token and any pending load result.
   */
  invalidateToken() {
    this.#version += 1;
    this.#token = null;
    this.#inFlight = null;
  }

  /**
   * Loads and caches a fresh token.
   *
   * @returns {Promise<string>} Fresh CSRF request token.
   */
  async refreshToken() {
    this.invalidateToken();

    return this.getToken();
  }

  /**
   * @param {number} version Cache version active when loading starts.
   * @returns {Promise<string>} Loaded token.
   */
  async #loadAndStoreToken(version) {
    const token = await this.#loadToken();

    if (typeof token !== "string" || token.trim().length === 0) {
      throw new TypeError("The CSRF token response is invalid.");
    }

    if (this.#version === version) {
      this.#token = token;
    }

    return token;
  }
}
