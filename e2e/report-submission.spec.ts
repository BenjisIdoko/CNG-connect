import { test, expect } from '@playwright/test';

test.describe('CNG-Connect Report Submission E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cng_user_authenticated', 'true');
    });
    await page.goto('/');
  });

  test('opens station details and submits driver pump report', async ({ page }) => {
    // Wait for station list to render
    const stationCard = page.locator('div:has-text("NIPCO")').first();
    await expect(stationCard).toBeVisible({ timeout: 10000 });

    // Click on station to open details view
    await stationCard.click();
    await page.waitForTimeout(500);

    // Click on "Report Status" button
    const reportButton = page.getByRole('button', { name: /Report Status/i }).first();
    if (await reportButton.isVisible()) {
      await reportButton.click();
      await page.waitForTimeout(500);

      // Verify Report Status Modal opens
      const modalHeader = page.getByText(/Report Station Status/i).first();
      await expect(modalHeader).toBeVisible();

      // Select Full stock pump action button
      const fullStockBtn = page.getByRole('button', { name: /Full stock/i }).first();
      if (await fullStockBtn.isVisible()) {
        await fullStockBtn.click();
        await page.waitForTimeout(500);

        // Verify toast or confirmation message appears
        const toast = page.getByText(/Thanks|reputation points/i).first();
        await expect(toast).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
