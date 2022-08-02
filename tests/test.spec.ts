import { expect, test } from '@playwright/test'

test('Run all tests', async ({ page }) => {
  page.on('console', msg => {
    if (msg.type() === 'error')
      throw new Error(`Console Error: "${msg.text()}"`)
  })
  await page.goto('https://nullixat.github.io/browstorjs/tests.html')
  await page.locator('button.run-test').click({ force: true })
  await expect(page.locator('h2[data-status="finished"]')).toBeVisible()
})
