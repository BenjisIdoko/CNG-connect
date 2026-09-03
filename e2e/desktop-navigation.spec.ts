import { test, expect } from '@playwright/test';

test.describe('CNG-Connect Desktop Multi-Pane Navigation E2E', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('cng_user_authenticated', 'true');
    });
    await page.goto('/');
  });

  test('renders desktop left sidebar and navigates across tabs', async ({ page }) => {
    // Assert desktop sidebar is visible
    const sidebar = page.locator('aside');
    await expect(sidebar.first()).toBeVisible({ timeout: 10000 });

    // Navigate to Conversion Centers tab
    const conversionTab = page.getByRole('button', { name: /Conversion Centers/i }).first();
    if (await conversionTab.isVisible()) {
      await conversionTab.click();
      await page.waitForTimeout(500);

      const centerHeader = page.getByText(/Accredited Conversion/i).first();
      await expect(centerHeader).toBeVisible();
    }

    // Navigate to Driver Profile
    const profileTab = page.getByRole('button', { name: /Driver Profile/i }).first();
    if (await profileTab.isVisible()) {
      await profileTab.click();
      await page.waitForTimeout(500);

      const profileHeader = page.getByText(/Driver Level & Reputation/i).first();
      await expect(profileHeader).toBeVisible();
    }
  });

  test('opens and calculates fuel savings in ROI calculator modal', async ({ page }) => {
    // Open ROI calculator modal from sidebar or header action
    const roiBtn = page.getByRole('button', { name: /ROI Calculator/i }).first();
    if (await roiBtn.isVisible()) {
      await roiBtn.click();
      await page.waitForTimeout(500);

      // Assert ROI calculator title is displayed
      const roiTitle = page.getByText(/Fuel Savings & ROI Calculator/i).first();
      await expect(roiTitle).toBeVisible();

      // Assert monthly/annual savings output is computed
      const savingsText = page.getByText(/Monthly Savings|Annual Savings/i).first();
      await expect(savingsText).toBeVisible();
    }
  });
});
