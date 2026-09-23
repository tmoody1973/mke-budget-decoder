import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  // Mobile-first: most residents arrive from a phone (CLAUDE.md).
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: { command: 'pnpm dev', url: 'http://localhost:3000', reuseExistingServer: true },
})
