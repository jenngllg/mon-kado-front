/** Opens the owner's secondary list actions without toggling an already open disclosure.
 * @param {import('@playwright/test').Page} page Current owner page.
 */
export async function openListOptions(page) {
  const menu = page.locator(".wishlist-details-options");
  if (await menu.getAttribute("open") === null) await menu.locator("summary").click();
}
