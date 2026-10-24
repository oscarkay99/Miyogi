import { expect, test as setup } from '@playwright/test'

/** Signs in once as the staff test user and saves the session for every other test. */
setup('sign in as staff', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL, password = process.env.E2E_ADMIN_PASSWORD
  if (!email || !password) throw new Error('Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (a staff account on a TEST project).')
  await page.goto('/admin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await page.context().storageState({ path: 'e2e/.auth/staff.json' })
})
