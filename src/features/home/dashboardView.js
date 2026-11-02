import { createActionLink, createButton, createLoadingState, disposeComponent } from '../../components/index.js';
import { registerComponentCleanup } from '../../components/componentLifecycle.js';
import { createGroupAvatar } from '../groups/groupPhoto.js';
import { wishlistArtwork } from '../wishlists/wishlistArtwork.js';

/** @typedef {ReturnType<typeof import('./dashboardService.js').createDashboardService>} DashboardService */

/** Authenticated home, composed exclusively from authorized API data.
 * @param {{displayName:string,service:DashboardService,signal?:AbortSignal,apiBaseUrl?:string,now?:()=>Date}} options Dependencies.
 */
export function createDashboardView({ displayName, service, signal, apiBaseUrl = '', now = () => new Date() }) {
  const root = node('section', '', 'dashboard');
  const lifetime = new AbortController();
  const readSignal = signal ? AbortSignal.any([signal, lifetime.signal]) : lifetime.signal;
  registerComponentCleanup(root, () => lifetime.abort());
  const occasions = node('section', '', 'dashboard-occasions');
  occasions.setAttribute('aria-label', 'Prochaines occasions');
  const title = node('h1', displayName ? `Bonjour ${displayName}` : 'Bonjour');
  const shortcuts = node('nav', '', 'dashboard-shortcuts'); shortcuts.setAttribute('aria-label', 'Accès rapides');
  shortcuts.append(action('Mes listes', '/lists'), action('Mes groupes', '/groups'));
  const listIntroduction = node('p', '', 'dashboard-intro');
  const create = action('Créer une liste', '/lists/new', true);
  const createLabel = node('span', 'Créer une liste');
  const addIcon = node('span', '', 'dashboard-intro__add');
  addIcon.setAttribute('aria-hidden', 'true');
  create.replaceChildren(addIcon, createLabel);
  listIntroduction.append('Commence par ', create, ' pour rassembler tes envies.');
  const groupIntroduction = node('p', '', 'dashboard-intro');
  const join = action('Rejoindre un groupe', '/groups/join');
  groupIntroduction.append('Tu peux ', join, ' pour retrouver les listes de tes proches.');
  listIntroduction.hidden = true;
  groupIntroduction.hidden = true;
  const columns = node('div', '', 'dashboard-columns');
  const lists = panel('Mes listes', '/lists', 'Toutes mes listes');
  const groups = panel('Mes groupes', '/groups', 'Tous mes groupes');
  lists.header.after(listIntroduction);
  groups.header.after(groupIntroduction);
  columns.append(lists.section, groups.section);
  root.append(title, shortcuts, occasions, columns);
  let busy = false;
  void load();
  return root;

  async function load() {
    if (busy || readSignal.aborted) return;
    busy = true;
    listIntroduction.hidden = true;
    groupIntroduction.hidden = true;
    for (const region of [occasions, lists.content, groups.content]) {
      clear(region); region.append(createLoadingState({ label: 'Chargement…' }));
    }
    const [listResult, groupResult] = await Promise.allSettled([
      service.lists({ signal: readSignal }), service.groups({ signal: readSignal }),
    ]);
    if (readSignal.aborted) return;
    const occasionResult = listResult.status === 'fulfilled' && groupResult.status === 'fulfilled'
      ? await service.occasions(groupResult.value, { signal: readSignal }).then(value => ({ value, error: null })).catch(error => ({ value: [], error })) : null;
    if (readSignal.aborted) return;
    const today = now();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    listIntroduction.hidden = true; groupIntroduction.hidden = true;
    clear(lists.content); clear(groups.content);
    create.remove(); join.remove();
    if (listResult.status === 'fulfilled') {
      const values = listResult.value;
      lists.all.hidden = !values.length;
      createLabel.textContent = values.length ? 'Créer une liste' : 'Créer ma première liste';
      if (values.length) lists.header.append(create);
      else {
        listIntroduction.replaceChildren('Commence par ', create, ' pour rassembler tes envies.');
        listIntroduction.hidden = false;
      }
      for (const list of values.slice(0, 3)) {
        const row = rowLink(list.name, `/lists/${list.id}`, list.eventDate ? formatDate(list.eventDate) : '');
        const image = document.createElement('img');
        image.src = wishlistArtwork(list.occasion); image.alt = ''; image.width = 112; image.height = 80;
        row.prepend(image); lists.content.append(row);
      }
    } else failure(lists.content, 'Impossible de charger tes listes.');
    if (groupResult.status === 'fulfilled') {
      const values = groupResult.value;
      groups.all.hidden = !values.length;
      if (values.length) groups.header.append(join);
      else {
        groupIntroduction.replaceChildren('Tu peux ', join, ' pour retrouver les listes de tes proches.');
        groupIntroduction.hidden = false;
      }
      for (const group of values.slice(0, 3)) {
        const row = rowLink(group.name, `/groups/${group.id}`, `${group.memberCount} membre${group.memberCount > 1 ? 's' : ''}`);
        row.prepend(createGroupAvatar(group, apiBaseUrl)); groups.content.append(row);
      }
    } else failure(groups.content, 'Impossible de charger tes groupes.');
    clear(occasions); occasions.append(node('h2', 'Prochaines occasions'));
    if (listResult.status === 'rejected' || groupResult.status === 'rejected') {
      failure(occasions, 'Impossible de charger les prochaines occasions.');
    } else {
      try {
        if (occasionResult?.error) throw occasionResult.error;
        const shared = occasionResult?.value ?? [];
        if (readSignal.aborted) return;
        const own = listResult.value.filter(list => !list.isSuspended).map(list => ({ ...list, ownerDisplayName: displayName, href: `/lists/${list.id}` }));
        const unique = new Map([...shared, ...own].map(list => [list.id.toLowerCase(), list]));
        const upcoming = [...unique.values()].filter(list => list.eventDate && list.eventDate >= todayKey)
          .sort((a, b) => (a.eventDate ?? '').localeCompare(b.eventDate ?? '') || a.name.localeCompare(b.name, 'fr')).slice(0, 3);
        if (!upcoming.length) occasions.append(node('p', 'Aucune occasion à venir pour le moment.'));
        for (const list of upcoming) {
          const occasion = node('div', '', 'dashboard-occasion');
          const link = rowLink(list.name, list.href, formatDate(list.eventDate ?? ''));
          link.classList.add('dashboard-occasion__link');
          occasion.append(link, node('span', `Par ${list.ownerDisplayName}`, 'dashboard-occasion__author'));
          occasions.append(occasion);
        }
      } catch {
        if (!readSignal.aborted) failure(occasions, 'Impossible de charger les prochaines occasions.');
      }
    }
    busy = false;
  }
  /** @param {HTMLElement} target @param {string} message */
  function failure(target, message) {
    const feedback = node('p', message); feedback.setAttribute('role', 'status');
    target.append(feedback, createButton({ label: 'Réessayer', variant: 'secondary', onClick: () => { void load(); } }));
  }
}

/** @param {string} title @param {string} href @param {string} label */
function panel(title, href, label) {
  const section = node('section', '', 'dashboard-panel');
  const heading = node('h2', title);
  const header = node('div', '', 'dashboard-panel__header'); header.append(heading);
  const content = node('div', '', 'dashboard-panel__content');
  const all = createActionLink({ label, href }); all.classList.add('dashboard-all');
  all.hidden = true;
  section.append(header, content, all);
  return { section, header, content, all };
}
/** @param {string} label @param {string} href @param {boolean} [primary] */
function action(label, href, primary = false) {
  const link = createActionLink({ label, href });
  link.classList.add('ui-button', primary ? 'ui-button--primary' : 'ui-button--secondary', 'dashboard-action');
  return link;
}
/** @param {string} title @param {string} href @param {string} subtitle */
function rowLink(title, href, subtitle) {
  const link = createActionLink({ label: title, href }); link.classList.add('dashboard-row');
  registerComponentCleanup(link, () => link.removeAttribute('href'));
  const copy = node('span', '', 'dashboard-row__copy'); copy.append(node('strong', title));
  if (subtitle) copy.append(node('span', subtitle));
  link.replaceChildren(copy); return link;
}
/** @param {string} value Calendar date. */
function formatDate(value) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
/** @param {HTMLElement} element */
function clear(element) { disposeComponent(element); element.replaceChildren(); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag @param {string} [text] @param {string} [className] @returns {HTMLElementTagNameMap[T]} */
function node(tag, text = '', className = '') {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
}
