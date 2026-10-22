import { expect, test } from '@playwright/test';

const examples = [
  'auth-welcome-verify.html',
  'marketing-product-launch.html',
  'marketing-feature-roundup.html',
  'marketing-usage-digest.html',
  'marketing-upgrade-offer.html',
  'guides-transactional.html',
  'guides-cli-preview.html',
  'guides-marketing.html',
  'guides-digest.html'
];

test.describe('rendered email examples', () => {
  for (const example of examples) {
    test(`${example} matches the approved baseline`, async ({ page }) => {
      await page.goto(`/${example}`);
      const email = page.locator('.ie-container');
      await expect(email).toBeVisible();
      await expect(email).toHaveScreenshot(`${example}.png`);
    });
  }
});
