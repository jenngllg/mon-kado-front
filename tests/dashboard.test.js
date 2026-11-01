// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { createDashboardView } from '../src/features/home/dashboardView.js';
import { createDashboardService } from '../src/features/home/dashboardService.js';
import { disposeComponent } from '../src/components/index.js';
import { createSessionHomeView } from '../src/views/applicationViews.js';

/** @type {import('../src/features/wishlists/wishlistsService.js').Wishlist} */
const list = { id: 'own', name: 'Mon anniversaire', occasion: 'birthday', eventDate: '2026-11-08', isSuspended: false };
const group = { id: 'family', name: 'La famille', ownerId: 'member', profileImageUrl: null, memberCount: 3, createdAt: '', updatedAt: null };
/** @type {import('../src/features/subscriptions/wishlistSubscriptionsService.js').WishlistSubscription} */
const followed = { id: '019c52dd-56c1-7cc6-8a95-243f3a032e01', wishlistId: '019c52dd-56c1-7cc6-8a95-243f3a032e0a', name: 'Liste suivie', ownerDisplayName: 'Camille', occasion: 'birthday', eventDate: '2026-11-01', createdAt: '2026-10-20T12:00:00Z', shareHref: '/shared-wishlists/019c52dd-56c1-7cc6-8a95-243f3a032e02#' + 'A'.repeat(43) };
/** @param {Partial<import('../src/features/home/dashboardView.js').DashboardService>} [overrides] */
function fixture(overrides = {}) {
  const service = { lists: vi.fn(async () => [list]), groups: vi.fn(async () => [group]), occasions: vi.fn(async () => []), ...overrides };
  const view = createDashboardView({ displayName: 'Jenn', service, now: () => new Date('2026-10-31T12:00:00Z') });
  return { view, service };
}
describe('authenticated dashboard', () => {
  it('removes private dashboard data immediately when the session ends', async () => {
    const f = fixture();
    let state = /** @type {import('../src/auth/sessionManager.js').SessionSnapshot} */ ({ status: 'authenticated', user: { id: 'member', displayName: 'Jenn' } });
    let notify = () => {};
    const root = createSessionHomeView({ getSnapshot: () => state, subscribe: listener => { notify = () => listener(state); return () => {}; } }, { service: f.service, signal: new AbortController().signal, apiBaseUrl: '' });
    await vi.waitFor(() => expect(root.textContent).toContain(list.name));
    state = { ...state, status: 'anonymous', user: null }; notify();
    expect(root.querySelector('.dashboard')).toBeNull();
    expect(root.textContent).not.toContain(list.name);
    expect(root.textContent).toContain('Petites envies, grandes occasions.');
    disposeComponent(root); disposeComponent(f.view);
  });
  it('links group occasions, deduplicates owned lists and excludes past dates', async () => {
    const { view } = fixture({ occasions: async () => [
      { ...list, href: '/groups/family/wishlists/own' },
      { id: 'past', name: 'Passé', eventDate: '2026-10-30', href: '/past' },
      { id: 'today', name: 'Aujourd’hui', eventDate: '2026-10-31', href: '/groups/family/wishlists/today' },
    ] });
    await vi.waitFor(() => expect(view.querySelectorAll('.dashboard-occasion')).toHaveLength(2));
    const links = [...view.querySelectorAll('.dashboard-occasion')];
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/groups/family/wishlists/today', '/lists/own']);
    expect(view.querySelector('a[href="/groups/family"]')?.textContent).toContain('La famille');
    disposeComponent(view);
  });
  it('offers first-list creation and group admission with empty collections', async () => {
    const { view } = fixture({ lists: async () => [], groups: async () => [] });
    await vi.waitFor(() => expect(view.textContent).toContain('Aucune occasion à venir'));
    expect(view.querySelector('a[href="/lists/new"]')?.textContent).toBe('Créer ma première liste');
    expect(view.querySelector('a[href="/groups/join"]')?.textContent).toBe('Rejoindre un groupe');
    disposeComponent(view);
  });
  it('keeps lists usable when groups fail and retries only after an explicit command', async () => {
    const { view, service } = fixture({ groups: vi.fn().mockRejectedValueOnce(new Error()).mockResolvedValue([]) });
    await vi.waitFor(() => expect(view.textContent).toContain('Impossible de charger tes groupes'));
    expect(view.querySelector('a[href="/lists/own"]')).not.toBeNull();
    expect(service.groups).toHaveBeenCalledTimes(1);
    view.querySelector('button')?.click();
    await vi.waitFor(() => expect(view.textContent).toContain('Rejoindre un groupe'));
    expect(service.groups).toHaveBeenCalledTimes(2);
    disposeComponent(view);
  });
  it('aborts requests and prevents late data from repopulating a disposed view', async () => {
    let finish = /** @type {(items: typeof list[]) => void} */ (() => {});
    const { view, service } = fixture({ lists: vi.fn(({ signal }) => { expect(signal.aborted).toBe(false); return new Promise(resolve => { finish = resolve; }); }) });
    disposeComponent(view); finish([list]);
    await Promise.resolve(); await Promise.resolve();
    expect(view.textContent).not.toContain(list.name);
    expect(service.occasions).not.toHaveBeenCalled();
  });
  it('reads all group and occasion pages with the supplied signal', async () => {
    const signal = new AbortController().signal;
    const load = vi.fn().mockResolvedValueOnce({ items: [group], hasNextPage: true }).mockResolvedValueOnce({ items: [], hasNextPage: false });
    const wishlists = vi.fn().mockResolvedValueOnce({ items: [list], hasNextPage: true }).mockResolvedValueOnce({ items: [], hasNextPage: false });
    const secondFollowed = { ...followed, id: '019c52dd-56c1-7cc6-8a95-243f3a032e03', wishlistId: '019c52dd-56c1-7cc6-8a95-243f3a032e04' };
    const subscriptions = { load: vi.fn()
      .mockResolvedValueOnce({ items: [followed], currentPage: 1, pageSize: 1, totalCount: 2 })
      .mockResolvedValueOnce({ items: [secondFollowed], currentPage: 2, pageSize: 1, totalCount: 2 }) };
    const service = createDashboardService({ wishlists: { load: async () => [] }, groups: /** @type {never} */ ({ load, wishlists }), subscriptions });
    expect(await service.groups({ signal })).toEqual([group]);
    expect(await service.occasions([group], { signal })).toEqual([
      { id: followed.wishlistId, name: followed.name, eventDate: followed.eventDate, href: followed.shareHref },
      { id: secondFollowed.wishlistId, name: secondFollowed.name, eventDate: secondFollowed.eventDate, href: secondFollowed.shareHref },
      expect.objectContaining({ href: '/groups/family/wishlists/own' }),
    ]);
    expect(load).toHaveBeenLastCalledWith({ signal, page: 2 });
    expect(wishlists).toHaveBeenLastCalledWith('family', { signal, page: 2 });
    expect(load).toHaveBeenCalledTimes(2);
    expect(wishlists).toHaveBeenCalledTimes(2);
    expect(subscriptions.load.mock.calls).toEqual([[{ signal, page: 1 }], [{ signal, page: 2 }]]);
  });
  it('deduplicates followed, owned and group lists by list identifier and keeps the best access link', async () => {
    const own = { ...list, id: '019c52dd-56c1-7cc6-8a95-243f3a032e0b', name: 'Envies' };
    const shared = { ...list, id: '019c52dd-56c1-7cc6-8a95-243f3a032e0c', name: 'Envies', eventDate: '2026-11-01' };
    const subscriptions = { load: vi.fn(async () => ({
      items: [
        { ...followed, name: 'Envies', eventDate: '2026-10-31' },
        { ...followed, wishlistId: own.id.toUpperCase(), eventDate: own.eventDate },
        { ...followed, wishlistId: shared.id.toUpperCase(), eventDate: shared.eventDate },
        { ...followed, wishlistId: 'later', name: 'Plus tard', eventDate: '2026-12-01' },
        { ...followed, wishlistId: 'past', name: 'Passé', eventDate: '2026-10-30' },
        { ...followed, wishlistId: 'undated', name: 'Sans date', eventDate: null },
      ], currentPage: 1, pageSize: 20, totalCount: 6,
    })) };
    const service = createDashboardService({ wishlists: { load: async () => [own] }, subscriptions,
      groups: /** @type {never} */ ({ load: async () => ({ items: [group], hasNextPage: false }), wishlists: async () => ({ items: [shared, own], hasNextPage: false }) }) });
    const view = createDashboardView({ displayName: 'Jenn', service, now: () => new Date('2026-10-31T12:00:00Z') });
    await vi.waitFor(() => expect(view.querySelectorAll('.dashboard-occasion')).toHaveLength(3));
    const links = [...view.querySelectorAll('.dashboard-occasion')];
    expect(links.map(link => link.getAttribute('href'))).toEqual([followed.shareHref, `/groups/family/wishlists/${shared.id}`, `/lists/${own.id}`]);
    expect(links.every(link => link.textContent?.startsWith('Envies'))).toBe(true);
    expect(subscriptions.load).toHaveBeenCalledTimes(1);
    disposeComponent(view);
    expect(links.every(link => !link.hasAttribute('href'))).toBe(true);
  });
  it('keeps owner and group panels usable when followed-list loading fails without showing partial occasions', async () => {
    const load = vi.fn().mockRejectedValue(new Error('Unavailable subscriptions'));
    const service = createDashboardService({ wishlists: { load: async () => [list] }, subscriptions: { load },
      groups: /** @type {never} */ ({ load: async () => ({ items: [group], hasNextPage: false }), wishlists: async () => ({ items: [], hasNextPage: false }) }) });
    const view = createDashboardView({ displayName: 'Jenn', service, now: () => new Date('2026-10-31T12:00:00Z') });
    await vi.waitFor(() => expect(view.querySelector('.dashboard-occasions')?.textContent).toContain('Impossible de charger les prochaines occasions.'));
    expect(view.querySelectorAll('.dashboard-occasion')).toHaveLength(0);
    expect(view.querySelector('a[href="/lists/own"]')).not.toBeNull();
    expect(view.querySelector('a[href="/groups/family"]')).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    disposeComponent(view);
  });
  it('stops followed-list pagination after disposal and ignores a late response', async () => {
    let finish = /** @type {(value: {items: typeof followed[], currentPage:number, pageSize:number, totalCount:number}) => void} */ (() => {});
    let subscriptionSignal = /** @type {AbortSignal|null} */ (null);
    const load = vi.fn(({ signal }) => { subscriptionSignal = signal; return new Promise(resolve => { finish = resolve; }); });
    const service = createDashboardService({ wishlists: { load: async () => [] }, subscriptions: { load },
      groups: /** @type {never} */ ({ load: async () => ({ items: [], hasNextPage: false }), wishlists: vi.fn() }) });
    const occasions = vi.fn(service.occasions);
    const view = createDashboardView({ displayName: 'Jenn', service: { ...service, occasions } });
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    disposeComponent(view);
    expect(/** @type {AbortSignal|null} */ (subscriptionSignal)?.aborted).toBe(true);
    finish({ items: [followed], currentPage: 1, pageSize: 1, totalCount: 2 });
    await occasions.mock.results[0].value;
    expect(view.querySelectorAll('.dashboard-occasion')).toHaveLength(0);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
