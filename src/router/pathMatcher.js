/**
 * @typedef {import("./router.js").RouteDefinition} RouteDefinition
 */

/**
 * @typedef {Readonly<{
 *   definition: RouteDefinition,
 *   segments: ReadonlyArray<CompiledSegment>,
 *   score: number,
 *   registrationIndex: number
 * }>} CompiledRoute
 */

/**
 * @typedef {Readonly<{
 *   kind: "static" | "parameter",
 *   value: string
 * }>} CompiledSegment
 */

/**
 * @typedef {Readonly<{
 *   route: CompiledRoute,
 *   params: Readonly<Record<string, string>>
 * }>} RouteMatch
 */

/**
 * Validates and orders route definitions for deterministic matching.
 *
 * @param {ReadonlyArray<RouteDefinition>} routes Route definitions.
 * @returns {ReadonlyArray<CompiledRoute>} Compiled routes.
 */
export function compileRoutes(routes) {
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new TypeError("routes must contain at least one route definition.");
  }

  const names = new Set();
  const patterns = new Set();
  const compiledRoutes = routes.map((route, registrationIndex) => {
    validateRouteDefinition(route);

    if (names.has(route.name)) {
      throw new TypeError(`Duplicate route name: ${route.name}.`);
    }

    names.add(route.name);
    const normalizedInputPath = normalizePathname(route.path);
    const normalizedPath = new URL(
      normalizedInputPath,
      "https://router.mon-kado.invalid",
    ).pathname;
    const segments = compileSegments(normalizedPath);
    const pattern = segments
      .map((segment) => segment.kind === "parameter" ? ":" : segment.value)
      .join("/");

    if (patterns.has(pattern)) {
      throw new TypeError(`Duplicate route pattern: ${normalizedPath}.`);
    }

    patterns.add(pattern);

    return Object.freeze({
      definition: Object.freeze({
        ...route,
        path: normalizedPath,
      }),
      segments,
      score: segments.filter((segment) => segment.kind === "static").length,
      registrationIndex,
    });
  });

  return Object.freeze(compiledRoutes.sort(compareRoutes));
}

/**
 * Matches an application pathname.
 *
 * @param {ReadonlyArray<CompiledRoute>} routes Compiled routes.
 * @param {string} pathname Browser pathname.
 * @returns {RouteMatch | null} Matching route and decoded parameters.
 */
export function matchRoute(routes, pathname) {
  const segments = splitPathname(normalizePathname(pathname));

  for (const route of routes) {
    const params = matchSegments(route.segments, segments);

    if (params !== null) {
      return Object.freeze({
        route,
        params: Object.freeze(params),
      });
    }
  }

  return null;
}

/**
 * Removes trailing slashes while preserving the root path.
 *
 * @param {string} pathname Pathname to normalize.
 * @returns {string} Normalized pathname.
 */
export function normalizePathname(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) {
    throw new TypeError("A route pathname must start with a slash.");
  }

  if (pathname.startsWith("//")) {
    throw new TypeError("Protocol-relative route paths are not supported.");
  }

  const normalizedPathname = pathname.replace(/\/+$/, "");

  return normalizedPathname || "/";
}

/**
 * @param {RouteDefinition} route Route definition.
 */
function validateRouteDefinition(route) {
  if (route === null || typeof route !== "object") {
    throw new TypeError("Each route must be an object.");
  }

  if (typeof route.name !== "string" || route.name.trim().length === 0) {
    throw new TypeError("Each route must have a non-empty name.");
  }

  if (typeof route.path !== "string" || /[?#]/.test(route.path)) {
    throw new TypeError("Route paths cannot contain a query or fragment.");
  }

  if (
    typeof route.title !== "string" &&
    typeof route.title !== "function"
  ) {
    throw new TypeError("Each route must provide a title.");
  }

  if (typeof route.render !== "function") {
    throw new TypeError("Each route must provide a render function.");
  }

  if (
    route.beforeEnter !== undefined &&
    typeof route.beforeEnter !== "function"
  ) {
    throw new TypeError("beforeEnter must be a function when provided.");
  }
}

/**
 * @param {string} pathname Normalized route path.
 * @returns {ReadonlyArray<CompiledSegment>} Compiled segments.
 */
function compileSegments(pathname) {
  const parameterNames = new Set();
  const segments = splitPathname(pathname).map((segment) => {
    if (segment.includes("*")) {
      throw new TypeError("Wildcard route segments are not supported.");
    }

    if (!segment.startsWith(":")) {
      return Object.freeze({
        kind: /** @type {const} */ ("static"),
        value: segment,
      });
    }

    const parameterName = segment.slice(1);

    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(parameterName)) {
      throw new TypeError(`Invalid route parameter: ${segment}.`);
    }

    if (parameterNames.has(parameterName)) {
      throw new TypeError(`Duplicate route parameter: ${parameterName}.`);
    }

    parameterNames.add(parameterName);

    return Object.freeze({
      kind: /** @type {const} */ ("parameter"),
      value: parameterName,
    });
  });

  return Object.freeze(segments);
}

/**
 * @param {ReadonlyArray<CompiledSegment>} routeSegments Route segments.
 * @param {ReadonlyArray<string>} pathnameSegments Encoded URL segments.
 * @returns {Record<string, string> | null} Decoded parameters when matched.
 */
function matchSegments(routeSegments, pathnameSegments) {
  if (routeSegments.length !== pathnameSegments.length) {
    return null;
  }

  /** @type {Record<string, string>} */
  const params = {};

  for (let index = 0; index < routeSegments.length; index += 1) {
    const routeSegment = routeSegments[index];
    const pathnameSegment = pathnameSegments[index];

    if (routeSegment.kind === "static") {
      if (routeSegment.value !== pathnameSegment) {
        return null;
      }

      continue;
    }

    const decodedValue = decodeSegment(pathnameSegment);

    if (decodedValue === null) {
      return null;
    }

    params[routeSegment.value] = decodedValue;
  }

  return params;
}

/**
 * @param {string} segment Encoded URL segment.
 * @returns {string | null} Decoded segment, or null when malformed.
 */
function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/**
 * @param {string} pathname Normalized pathname.
 * @returns {ReadonlyArray<string>} Path segments.
 */
function splitPathname(pathname) {
  if (pathname === "/") {
    return Object.freeze([]);
  }

  return Object.freeze(pathname.slice(1).split("/"));
}

/**
 * @param {CompiledRoute} left Left route.
 * @param {CompiledRoute} right Right route.
 * @returns {number} Sort order.
 */
function compareRoutes(left, right) {
  const scoreDifference = right.score - left.score;

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const segmentDifference = right.segments.length - left.segments.length;

  if (segmentDifference !== 0) {
    return segmentDifference;
  }

  return left.registrationIndex - right.registrationIndex;
}
