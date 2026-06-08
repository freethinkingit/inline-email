import { expect, test } from '@playwright/test';

const examples = [
  'auth-welcome-verify.html',
  'marketing-product-launch.html',
  'marketing-feature-roundup.html',
  'marketing-usage-digest.html',
  'marketing-upgrade-offer.html'
];

test.describe('rendered email examples', () => {
  for (const example of examples) {
    test(`${example} matches the approved baseline`, async ({ page }) => {
      await page.goto(`/${example}`);
      await expect(page.locator('body')).toBeVisible();
      await expect(page).toHaveScreenshot(`${example}.png`, {
        fullPage: true
      });
    });
  }
});
