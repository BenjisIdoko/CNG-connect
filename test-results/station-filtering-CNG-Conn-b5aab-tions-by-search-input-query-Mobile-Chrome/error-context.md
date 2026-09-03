# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: station-filtering.spec.ts >> CNG-Connect Station Filtering E2E >> filters stations by search input query
- Location: e2e/station-filtering.spec.ts:25:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3002/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('CNG-Connect Station Filtering E2E', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Authenticate user in localStorage to bypass onboarding splash during automated tests
  6  |     await page.addInitScript(() => {
  7  |       localStorage.setItem('cng_user_authenticated', 'true');
  8  |     });
> 9  |     await page.goto('/');
     |                ^ Error: page.goto: Test timeout of 30000ms exceeded.
  10 |   });
  11 | 
  12 |   test('renders station locator map and station cards list', async ({ page }) => {
  13 |     // Assert page title
  14 |     await expect(page).toHaveTitle(/CNG-Connect/i);
  15 | 
  16 |     // Verify main navigation header logo or title
  17 |     const headerTitle = page.locator('header');
  18 |     await expect(headerTitle).toBeVisible();
  19 | 
  20 |     // Verify station cards or list elements render
  21 |     const stationCards = page.locator('div:has-text("NIPCO")');
  22 |     await expect(stationCards.first()).toBeVisible({ timeout: 10000 });
  23 |   });
  24 | 
  25 |   test('filters stations by search input query', async ({ page }) => {
  26 |     const searchInput = page.locator('input[placeholder*="Search"]').first();
  27 |     if (await searchInput.isVisible()) {
  28 |       await searchInput.fill('Jiwa');
  29 |       await page.waitForTimeout(500);
  30 | 
  31 |       // Verify Jiwa station appears in filtered results
  32 |       const stationMatch = page.getByText(/Jiwa/i);
  33 |       await expect(stationMatch.first()).toBeVisible();
  34 |     }
  35 |   });
  36 | 
  37 |   test('filters stations by status pill buttons', async ({ page }) => {
  38 |     // Click Full Stock filter pill if present
  39 |     const fullStockPill = page.getByRole('button', { name: /Full Stock/i }).first();
  40 |     if (await fullStockPill.isVisible()) {
  41 |       await fullStockPill.click();
  42 |       await page.waitForTimeout(500);
  43 | 
  44 |       const statusBadge = page.getByText(/Full Stock|Available/i);
  45 |       await expect(statusBadge.first()).toBeVisible();
  46 |     }
  47 |   });
  48 | });
  49 | 
```