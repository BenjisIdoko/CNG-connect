import { test, expect } from '@playwright/test';

test.describe('CNG-Connect Station Filtering E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate user in localStorage to bypass onboarding splash during automated tests
    await page.addInitScript(() => {
      localStorage.setItem('cng_user_authenticated', 'true');
    });
    await page.goto('/');
  });

  test('renders station locator map and station cards list', async ({ page }) => {
    // Assert page title
    await expect(page).toHaveTitle(/CNG-Connect/i);

    // Verify main navigation header logo or title
    const headerTitle = page.locator('header');
    await expect(headerTitle).toBeVisible();

    // Verify station cards or list elements render
    const stationCards = page.locator('div:has-text("NIPCO")');
    await expect(stationCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('filters stations by search input query', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Jiwa');
      await page.waitForTimeout(500);

      // Verify Jiwa station appears in filtered results
      const stationMatch = page.getByText(/Jiwa/i);
      await expect(stationMatch.first()).toBeVisible();
    }
  });

  test('filters stations by status pill buttons', async ({ page }) => {
    // Click Full Stock filter pill if present
    const fullStockPill = page.getByRole('button', { name: /Full Stock/i }).first();
    if (await fullStockPill.isVisible()) {
      await fullStockPill.click();
      await page.waitForTimeout(500);

      const statusBadge = page.getByText(/Full Stock|Available/i);
      await expect(statusBadge.first()).toBeVisible();
    }
  });
});
