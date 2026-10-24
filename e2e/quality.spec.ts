import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { resetDb } from './db'
import { adminSetup } from './helpers'

const PUBLIC = ['/', '/menu', '/menu/fried-rice-with-grilled-chicken', '/checkout', '/track', '/about', '/contact', '/policies/terms']

test.beforeEach(async () => { await resetDb() })

for (const path of PUBLIC) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path)
    await page.locator('[aria-busy="true"]').waitFor({ state: 'detached' })
    await page.waitForTimeout(300)
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
  })
}

for (const path of PUBLIC) {
  test(`mobile has no horizontal scroll: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto(path)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}

test('a11y + mobile: admin screens', async ({ page }) => {
  await adminSetup(page)
  for (const p of ['', '/orders', '/menu', '/setup', '/setup?tab=delivery', '/setup?tab=payments', '/setup?tab=website', '/setup?tab=business', '/customers', '/promotions', '/analytics']) {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/admin' + p)
    await page.locator('[aria-busy="true"]').waitFor({ state: 'detached' })
    await page.waitForTimeout(250)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow on /admin${p}`).toBe(true)
    await page.setViewportSize({ width: 1280, height: 800 })
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(r.violations.map((v) => `${p}: ${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([])
  }
})
