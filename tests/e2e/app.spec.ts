import { expect, test } from '@playwright/test'

test('renders the KomikaID shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('KomikaID beranda')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible()
})
