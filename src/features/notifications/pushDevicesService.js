import { ApiError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
/** @typedef {{id:string,name:string,endpointHash:string,disabledKinds:string[],createdAt:string,version:string}} PushDevice */
/** @typedef {{enabled:boolean,publicKey:string|null}} PushConfig */
const path = "/api/v1/members/current/push-subscriptions";
/** @param {unknown} data @returns {data is PushDevice} Validated server device. */
function isDevice(data) {
    if (!data || typeof data !== "object")
        return false;
    const d = /** @type {PushDevice} */ (data);
    return typeof d.id === "string" && /^[a-f0-9-]{36}$/i.test(d.id) && typeof d.name === "string" && typeof d.endpointHash === "string" && /^[a-f0-9]{64}$/.test(d.endpointHash) && Array.isArray(d.disabledKinds) && d.disabledKinds.every(k => typeof k === "string") && typeof d.createdAt === "string" && isStrongEntityTag(d.version);
}
/** @param {unknown} data @returns {PushDevice} Typed response boundary. */
function device(data) { if (!isDevice(data))
    throw new ApiError({ kind: "invalidResponse", statusCode: 200 }); return data; }
/** @param {Pick<import("../../auth/sessionManager.js").SessionManager,"request">} session Authenticated transport. */
export function createPushDevicesService(session) {
    /** @type {ServiceWorkerRegistration|null} */ let registration = null;
    /** @type {PushConfig|null} */ let config = null;
    /** @type {string|null} */ let currentHash = null;
    const supported = () => globalThis.isSecureContext === true && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const installed = () => window.matchMedia("(display-mode: standalone)").matches || /** @type {Navigator & {standalone?:boolean}} */ (navigator).standalone === true;
    /** @param {AbortSignal} signal View lifetime. @returns {Promise<PushDevice[]>} */
    async function list(signal) { const response = await session.request(path, { authentication: "required", signal }); if (!Array.isArray(response.data))
        throw new ApiError({ kind: "invalidResponse", statusCode: response.status }); return response.data.map(device); }
    /** @param {string} endpoint Browser-local capability URL. */
    async function hash(endpoint) { const data = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint)); return [...new Uint8Array(data)].map(v => v.toString(16).padStart(2, "0")).join(""); }
    return {
        supported, needsInstallation: () => appleMobile && !installed(),
        currentHash: () => currentHash,
        defaultName: () => appleMobile ? "iPhone / iPad" : /Android/.test(navigator.userAgent) ? "Android" : "Mon ordinateur",
        list,
        /** @param {AbortSignal} signal View lifetime. */
        async load(signal) {
            const [response, devices] = await Promise.all([session.request("/api/v1/members/current/push-configuration", { authentication: "required", signal }), list(signal)]);
            const value = /** @type {PushConfig} */ (response.data);
            if (!value || typeof value.enabled !== "boolean" || (value.enabled && typeof value.publicKey !== "string"))
                throw new ApiError({ kind: "invalidResponse", statusCode: response.status });
            config = value;
            if (supported() && !signal.aborted) {
                try {
                    registration = await navigator.serviceWorker.getRegistration("/") ?? null;
                    const sub = await registration?.pushManager.getSubscription();
                    currentHash = sub ? await hash(sub.endpoint) : null;
                }
                catch { /* Other devices remain manageable when this browser blocks workers. */ }
            }
            return { config, devices };
        },
        /** Call directly from a user gesture; permissions are never requested on page load.
         * @param {string} name Internal browser label. @param {AbortSignal} signal View lifetime. @param {string[]} [disabledKinds] Initial channel choices. */
        async enable(name, signal, disabledKinds) {
            if (!supported() || !config?.enabled)
                throw new Error("Les notifications push ne sont pas disponibles sur cet appareil.");
            // The permission request must precede any asynchronous API or service-worker work.
            const permission = await Notification.requestPermission();
            if (permission !== "granted")
                throw new Error("Notifications bloquées. Tu peux les autoriser dans les réglages de ton navigateur.");
            if (signal.aborted)
                throw new DOMException("Aborted", "AbortError");
            await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
            registration = await navigator.serviceWorker.ready;
            if (signal.aborted)
                throw new DOMException("Aborted", "AbortError");
            const key = Uint8Array.from(atob((config.publicKey ?? "").replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
            const sub = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
            currentHash = await hash(sub.endpoint);
            try {
                return device((await session.request(path, { method: "POST", authentication: "required", csrf: true, body: { endpoint: sub.endpoint, name, ...(disabledKinds===undefined?{}:{disabledKinds:[...disabledKinds]}) }, signal })).data);
            }
            catch (error) {
                if (signal.aborted)
                    throw error;
                const found = (await list(signal)).find(d => d.endpointHash === currentHash);
                if (found && (disabledKinds===undefined || found.disabledKinds.length===disabledKinds.length&&disabledKinds.every(kind=>found.disabledKinds.includes(kind))))
                    return found;
                throw error;
            }
        },
        /** @param {PushDevice} value Complete intended state. @param {AbortSignal} signal View lifetime. */
        async save(value, signal) { return device((await session.request(`${path}/${value.id}`, { method: "PUT", authentication: "required", csrf: true, ifMatch: value.version, body: { name: value.name, disabledKinds: [...value.disabledKinds] }, signal })).data); },
        /** @param {PushDevice} value Device to stop. @param {AbortSignal} signal View lifetime. */
        async remove(value, signal) {
            try {
                await session.request(`${path}/${value.id}`, { method: "DELETE", authentication: "required", csrf: true, signal });
            }
            catch (error) {
                if (signal.aborted)
                    throw error;
                if ((await list(signal)).some(d => d.id === value.id))
                    throw error;
            }
            if (value.endpointHash === currentHash && registration) {
                const sub = await registration.pushManager.getSubscription();
                try {
                    await sub?.unsubscribe();
                }
                catch { /* Server removal already stopped delivery. */ }
                currentHash = null;
            }
        },
    };
}
