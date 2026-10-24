import { expect, test } from '@playwright/test'
import { resetDb } from './db'
import { adminSetup, fillCheckout } from './helpers'

test.beforeEach(async () => { await resetDb() })

test('staff must sign in; wrong password is refused', async ({ page }) => {
  await adminSetup(page, false)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL!)
  await page.getByLabel('Password').fill('definitely-wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByText('Incorrect email or password.')).toBeVisible()
})

test('admin verifies payment, accepts, and moves the order to delivered', async ({ page }) => {
  await adminSetup(page)
  await fillCheckout(page)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page).toHaveURL(/\/order\//)

  await page.goto('/admin/orders')
  await page.getByRole('button', { name: /RNS-/ }).first().click()
  await page.getByRole('button', { name: 'Payment verified' }).click()
  await page.getByRole('button', { name: 'Payment received' }).click()
  for (const step of ['Accept order', 'Start preparing', 'Mark ready', 'Dispatch', 'Mark delivered']) {
    await page.getByRole('button', { name: step, exact: true }).click()
  }
  await expect(page.getByRole('dialog').getByText('Delivered', { exact: true })).toBeVisible()
})

test('rejecting a paid order flags a refund that can be recorded', async ({ page }) => {
  await adminSetup(page)
  await fillCheckout(page)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page).toHaveURL(/\/order\//)
  await page.goto('/admin/orders')
  await page.getByRole('button', { name: /RNS-/ }).first().click()
  await page.getByRole('button', { name: 'Payment verified' }).click()
  await page.getByRole('button', { name: 'Payment received' }).click()
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await page.getByRole('button', { name: 'Reject order' }).click()
  await expect(page.getByText('Refund due').first()).toBeVisible()
  await page.getByRole('button', { name: 'Record', exact: true }).click()
  await page.getByRole('button', { name: 'Record refund' }).click()
  await expect(page.getByRole('dialog').getByText('Refunded', { exact: true }).first()).toBeVisible()
})

test('menu change does not rewrite an existing order', async ({ page }) => {
  await adminSetup(page)
  await fillCheckout(page)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page).toHaveURL(/\/order\//)
  await page.goto('/admin/menu')
  await page.getByRole('button', { name: 'Edit' }).first().click()
  await page.getByLabel('Price (GHS)').fill('999')
  await page.getByRole('button', { name: 'Save item' }).click()
  await page.goto('/admin/orders')
  await page.getByRole('button', { name: /RNS-/ }).first().click()
  await expect(page.getByRole('dialog').getByText('GH₵150').first()).toBeVisible()
})

test('analytics counts collected money only', async ({ page }) => {
  await adminSetup(page)
  await fillCheckout(page)
  await page.getByRole('button', { name: /Place order/ }).click()
  await expect(page).toHaveURL(/\/order\//)
  await page.goto('/admin/analytics')
  await expect(page.getByText('Net collected').first()).toBeVisible()
  await expect(page.getByText('GH₵0').first()).toBeVisible() // unpaid order contributes nothing
})
