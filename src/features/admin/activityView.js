import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createButton, createFormField, createLoadingState, disposeComponent } from "../../components/index.js";

const dates = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** Display the private activity journal for the current administrator.
 * @param {import("../../auth/sessionManager.js").SessionManager} session Authenticated transport.
 * @param {AbortSignal} signal Route lifetime.
 * @returns {HTMLElement} Disposable journal.
 */
export function createActivityView(session, signal) {
  const view = document.createElement("section"); view.className = "reported-wishlists-view flow";
  const title = document.createElement("h1"); title.textContent = "Activité des membres";
  const form = document.createElement("form"); form.className = "reported-wishlists-filters cluster";
  const search = document.createElement("input"); search.type = "search"; search.maxLength = 100;
  const kind = document.createElement("select");
  for (const [value, label] of [["", "Tout"], ["pageVisit", "Visites"], ["action", "Actions"]]) {
    const option = document.createElement("option"); option.value = value; option.textContent = label; kind.append(option);
  }
  const level = document.createElement("select");
  for (const [value, label] of [["", "Tous les niveaux"], ["info", "Information"], ["error", "Erreur"]]) {
    const option = document.createElement("option"); option.value = value; option.textContent = label; level.append(option);
  }
  form.append(createFormField({ label: "Membre, activité ou payload", control: search }), createFormField({ label: "Type", control: kind }), createFormField({ label: "Niveau de log", control: level }), createButton({ label: "Filtrer", type: "submit" }));
  const results = document.createElement("div"); results.className = "flow"; results.setAttribute("aria-live", "polite");
  view.append(title, form, results);
  let page = 1, disposed = false;
  /** @type {AbortController | null} */ let pending = null;
  addComponentEventListener(view, form, "submit", event => { event.preventDefault(); page = 1; void read(); });
  registerComponentCleanup(view, () => { disposed = true; pending?.abort(); results.replaceChildren(); });
  addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
  if (!signal.aborted) void read(); else disposeComponent(view);
  return view;

  async function read() {
    pending?.abort(); const operation = new AbortController(); pending = operation;
    results.replaceChildren(createLoadingState({ label: "Chargement de l’activité…" }));
    const query = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (search.value.trim()) query.set("q", search.value.trim());
    if (kind.value) query.set("kind", kind.value);
    if (level.value) query.set("logLevel", level.value);
    try {
      const response = await session.request(`/api/v1/admin/member-activity-events?${query}`, { method: "GET", authentication: "required", signal: operation.signal });
      if (disposed || operation.signal.aborted) return;
      const data = /** @type {{items: {id:string, displayName:string, displayNameTag:string, occurredAt:string, kind:string, activity:string, memberId?:string, actorMemberId?:string|null,actorDisplayName?:string|null,isImpersonated?:boolean, logLevel?:"info"|"error", payload?:unknown}[], currentPage:number, totalPages:number, totalCount:number, hasPreviousPage:boolean, hasNextPage:boolean} | null} */ (response.data);
      if (response.status !== 200 || !data || !Array.isArray(data.items)) throw new Error("Invalid activity response");
      results.replaceChildren();
      if (!data.items.length) { const empty = document.createElement("p"); empty.textContent = "Aucune activité ne correspond à ces filtres."; results.append(empty); }
      for (const item of data.items) {
        if (item.logLevel !== undefined && item.logLevel !== "info" && item.logLevel !== "error") throw new Error("Invalid activity level");
        const row = document.createElement("article"); row.className = "reported-wishlist flow";
        const member = document.createElement("h2"); member.textContent = `${item.displayName} #${item.displayNameTag}`;
        const activity = document.createElement("p"); activity.className = "activity-event__label"; activity.textContent = `${item.kind === "pageVisit" ? "Visite" : "Action"} · ${item.activity}`;
        const time = document.createElement("time"); time.dateTime = item.occurredAt; time.textContent = dates.format(new Date(item.occurredAt));
        const severity = document.createElement("p"); severity.textContent = `Niveau : ${item.logLevel === "error" ? "Erreur" : "Information"}`;
        const author=document.createElement("p");author.textContent=item.isImpersonated ? `Simulation par ${item.actorDisplayName ?? "un administrateur supprimé"}` : "Action de l’utilisateur";
        row.append(member, activity, time, severity,author);
        if(item.memberId && item.memberId!==session.getSnapshot().user?.id){
          row.append(createButton({label:"Simuler cet utilisateur",variant:"secondary",onClick:()=>view.dispatchEvent(new CustomEvent("monkado-impersonate",{bubbles:true,detail:item.memberId}))}));
        }
        if (item.payload !== undefined && item.payload !== null) {
          const details = document.createElement("details"); details.className = "activity-event__details";
          const summary = document.createElement("summary"); summary.textContent = "Voir le payload";
          const payload = document.createElement("pre"); payload.className = "activity-event__payload"; payload.textContent = JSON.stringify(item.payload, null, 2);
          details.append(summary, payload); row.append(details);
        }
        results.append(row);
      }
      const pagination = document.createElement("div"); pagination.className = "cluster";
      const prev = createButton({ label: "Précédent", variant: "secondary", disabled: !data.hasPreviousPage, onClick: () => { page--; void read(); } });
      const next = createButton({ label: "Suivant", variant: "secondary", disabled: !data.hasNextPage, onClick: () => { page++; void read(); } });
      const count = document.createElement("span"); count.textContent = `${data.totalCount} résultat${data.totalCount === 1 ? "" : "s"}`;
      pagination.append(prev, count, next); results.append(pagination);
    } catch {
      if (disposed || operation.signal.aborted) return;
      results.replaceChildren(); const error = document.createElement("p"); error.setAttribute("role", "alert"); error.textContent = "Impossible de charger l’activité.";
      results.append(error, createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void read(); } }));
    }
  }
}
