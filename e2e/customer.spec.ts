import { expect, test } from '@playwright/test'
import { readEnv, resetDb } from './db'
import { adminSetup, fillCheckout } from './helpers'

test.beforeEach(async () => { await resetDb() })

test('closed by default: no checkout until the owner opens pre-orders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Pre-orders opening soon').first()).toBeVisible()
  await page.getByRole('button', { name: 'Add to Cart' }).first().click()
  await page.getByRole('link', { name: 'Continue to checkout' }).click()
  await expect(page.getByText('Pre-orders are not open right now')).toBeVisible()
  await expect(page.getByRole('button', { name: /Place order/ })).toBeDisabled()
})

test('browse, add to cart, pick a slot, pay manually, see confirmation and tracking', async ({ page }) => {
  await adminSetup(page)
  await fillCheckout(page)
    await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page).toHaveURL(/\/order\/.+new=1/)
  await expect(page.getByRole('heading', { name: /RNS-\d{8}-0001/ })).toBeVisible()
  await expect(page.getByText('Payment awaiting verification')).toBeVisible()
  await expect(page.getByText(/not a guaranteed arrival time/)).toBeVisible()
})

test('Ghana phone numbers are validated and normalised', async ({ page }) => {
  await adminSetup(page)
  await fillCheckout(page, { phone: '12345' })
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page.getByText(/valid Ghana phone number/).first()).toBeVisible()
  await page.getByLabel('Phone number').fill('+233 54 755 7772')
  await expect(page.getByText(/\+233547557772 \(MTN\)/)).toBeVisible()
})

test('cart survives a refresh and checkout draft survives too', async ({ page }) => {
  await adminSetup(page)
  await fillCheckout(page, { name: 'Kofi Boateng' })
  await page.reload()
  await expect(page.getByLabel('Full name')).toHaveValue('Kofi Boateng')
  await expect(page.getByText('Order summary')).toBeVisible()
})

test('order lookup needs reference and matching phone', async ({ page }) => {
  await adminSetup(page)
  await fillCheckout(page)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page).toHaveURL(/\/order\//)
  const ref = (await page.getByRole('heading', { name: /RNS-/ }).textContent())!.trim()
  await page.goto('/track')
  await page.getByLabel('Order reference').fill(ref)
  await page.getByLabel('Phone number').fill('0200000000')
  await page.getByRole('button', { name: 'Find my order' }).click()
  await expect(page.getByText(/could not match/)).toBeVisible()
  await page.getByLabel('Phone number').fill('0547557772')
  await page.getByRole('button', { name: 'Find my order' }).click()
  await expect(page).toHaveURL(/\/order\//)
})

test('a slot filled by one customer is unavailable to the next', async ({ page }) => {
  await adminSetup(page)
  await page.goto('/admin/setup?tab=times')
  const meals = page.getByLabel('Meals', { exact: true }).first()
  await meals.fill('1')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('button', { name: 'Saved ✓' })).toBeVisible()
  await fillCheckout(page)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page).toHaveURL(/\/order\//)
  await fillCheckout(page, { name: 'Second Customer' }).catch(() => {})
  // the first window is now full, so only other windows remain selectable
  await page.getByRole('radio').filter({ hasText: 'Order by' }).first().click()
  await expect(page.getByRole('radio', { name: /12:00.*Full/ })).toBeDisabled()
})

test('customer data is not readable by the public once an order exists', async ({ page, request }) => {
  await adminSetup(page)
  await fillCheckout(page)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page).toHaveURL(/\/order\//)
  const url = readEnv('VITE_SUPABASE_URL'), key = readEnv('VITE_SUPABASE_PUBLISHABLE_KEY')
  for (const table of ['orders', 'coupons', 'staff', 'audit_logs']) {
    const res = await request.get(`${url}/rest/v1/${table}?select=*`, { headers: { apikey: key! } })
    expect(await res.json(), table).toEqual([])
  }
  const view = await request.get(`${url}/rest/v1/capacity_orders?select=*`, { headers: { apikey: key! } })
  expect(view.status()).toBeGreaterThanOrEqual(400)
})
