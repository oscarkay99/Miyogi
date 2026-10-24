import { expect, type Page } from '@playwright/test'

/** The session is already signed in (see auth.setup.ts). Opens the dashboard and loads the sample config once. */
export async function adminSetup(page: Page, loadSample = true) {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  const sample = page.getByRole('button', { name: 'Load sample configuration' })
  if (loadSample && (await sample.isVisible())) {
    // the screen updates optimistically, so wait for the last settings write to really finish before navigating away
    const saved = page.waitForResponse((r) => r.url().includes('/site_settings') && r.request().method() === 'POST' && r.ok())
    await sample.click()
    await saved
    await expect(sample).toBeHidden()
  }
}

/** Adds the meal to the cart and fills checkout up to (not including) the payment submit. */
export async function fillCheckout(page: Page, opts: { phone?: string; name?: string } = {}) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add to Cart' }).first().click()
  await page.getByRole('link', { name: 'Continue to checkout' }).click()
  await page.getByRole('radio').filter({ hasText: 'Order by' }).first().click()
  await page.getByRole('radio').filter({ hasText: 'meals left' }).first().click()
  await page.getByLabel('Full name').fill(opts.name ?? 'Ama Mensah')
  await page.getByLabel('Phone number').fill(opts.phone ?? '054 755 7772')
  await page.getByLabel('Delivery area').fill('North Legon')
  await page.getByLabel('Delivery address').fill('12 Test Street, North Legon')
}
