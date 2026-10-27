/* global document, window, getComputedStyle */
import { test, expect } from "@playwright/test";
import { controlledApi, frontendOrigin } from "./controlledApi.js";

for (const width of [320, 390, 768, 1024, 1280, 1440]) {
  test(`header magnifier opens, searches and closes without overflow at ${width}px`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const api = await controlledApi(context); api.state.authenticated = true;
    /** @type {string[]} */ const searches = [];
    await context.route('http://localhost:7000/api/v1/members?**', async route => {
      if (route.request().method() === 'OPTIONS') return route.fallback();
      expect(route.request().headers().authorization).toBeUndefined();
      searches.push(new URL(route.request().url()).searchParams.get('displayName') ?? '');
      return route.fulfill({ json: { items: [], currentPage: 1, pageSize: 20, totalCount: 0 }, headers: { 'Access-Control-Allow-Origin': frontendOrigin, 'Access-Control-Allow-Credentials': 'true' } });
    });
    await page.goto('/lists');
    const header = page.locator('header'), search = header.getByRole('search', { name: 'Recherche de membres' });
    const toggle = search.getByRole('button', { name: 'Rechercher un membre', exact: true });
    const field = search.getByRole('searchbox', { name: 'Pseudo ou identifiant', exact: true });
    const menu = header.locator('.app-menu-button');
    await expect(toggle).toBeVisible(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(header.getByRole('link', { name: 'Rechercher un membre' })).toHaveCount(0);
    await expect(field).toHaveCount(0); expect(searches).toEqual([]);
    if (width < 1280) { await menu.click(); await expect(menu).toHaveAttribute('aria-expanded', 'true'); }
    await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(field).toBeVisible(); await expect(field).toBeFocused();
    await expect(search.locator('.app-member-search__panel')).toHaveCSS('opacity', '1');
    if (width < 1280) await expect(menu).toHaveAttribute('aria-expanded', 'false');
    const triggerBox = await toggle.boundingBox(), fieldBox = await field.boundingBox();
    expect(triggerBox?.width).toBe(44); expect(triggerBox?.height).toBe(44);
    if (width >= 1280) {
      expect(fieldBox?.x).toBeGreaterThan((triggerBox?.x ?? 0) + 40);
      expect(Math.abs((fieldBox?.y ?? 0) - (triggerBox?.y ?? 0))).toBeLessThan(2);
      expect(await header.evaluate(node => node.getBoundingClientRect().height)).toBeLessThan(110);
    } else expect(fieldBox?.y).toBeGreaterThan((triggerBox?.y ?? 0) + 44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await field.fill('a'); await field.press('Enter'); await expect(field).toHaveAttribute('aria-invalid', 'true'); expect(searches).toEqual([]);
    await field.fill('Camille'); expect(searches).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`header-search-${width}.png`), fullPage: true });
    await field.press('Escape'); await expect(toggle).toBeFocused(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click(); await field.fill(' Camille '); await field.press('Enter');
    await expect(page).toHaveURL('/members?q=Camille');
    await expect(page.getByText('Aucun membre trouvé', { exact: true }).last()).toBeVisible();
    expect(searches).toEqual(['Camille']); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click(); await field.fill('Alex#0428'); await search.getByRole('button', { name: 'Lancer la recherche', exact: true }).click();
    await expect(page).toHaveURL('/members?q=Alex%230428'); expect(searches).toEqual(['Camille', 'Alex#0428']);
    await toggle.click(); await page.getByRole('heading', { name: 'Rechercher un membre', exact: true }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(api.unexpected).toEqual([]);
  });
}

test('anonymous tablet search respects reduced motion and compact menu exclusion', async ({ page, context }) => {
  await page.setViewportSize({ width: 820, height: 700 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const api = await controlledApi(context);
  await page.goto('/');
  const header = page.locator('header'), toggle = header.getByRole('button', { name: 'Rechercher un membre', exact: true });
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(header.getByRole('searchbox')).toBeFocused();
  expect(await header.locator('.app-member-search__panel').evaluate(node => getComputedStyle(node).transitionDuration)).toBe('0s');
  await header.getByRole('button', { name: 'Ouvrir le menu principal', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(header.getByRole('link', { name: 'Connexion', exact: true })).toBeVisible();
  expect(api.unexpected).toEqual([]);
});
