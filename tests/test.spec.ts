import { test, expect } from '@playwright/test'

test('Run all tests', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error')
      throw new Error(`Console Error: "${msg.text()}"`)
  })
  //await page.goto('https://local.0x.at/easy-pwa-data-storage/docs/tests.html')
  await page.goto('https://nullixat.github.io/browstorjs/tests.html')
  await expect(page.locator('h2[data-status="finished"]')).toBeVisible()
})
