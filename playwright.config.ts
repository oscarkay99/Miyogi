import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://localhost:4173', channel: 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'app', testMatch: /.*\.spec\.ts/, dependencies: ['setup'], use: { storageState: 'e2e/.auth/staff.json' } },
  ],
  webServer: { command: 'npm run build && npx vite preview --port 4173', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 120_000 },
})
