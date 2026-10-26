import { expect, test } from '@playwright/test';

test('log weight, template meal, workout set, then Copy for Claude', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByTestId('kcal-left')).toHaveText('2000');

  // 1. Weight
  await page.getByLabel('Weight', { exact: true }).fill('87.9');
  await page.getByLabel('Weight', { exact: true }).press('Enter');
  await expect(page.getByText('Weight saved: 87.9 kg')).toBeVisible();

  // 2. One-tap template meal (Lunch = 200 g chicken + 150 g rice + 200 g veg = 497 kcal)
  await page.getByRole('button', { name: /^Lunch/ }).click();
  await expect(page.getByTestId('kcal-left')).toHaveText('1503');

  // 3. Workout set
  await page.getByRole('link', { name: 'Train' }).click();
  await page.getByRole('button', { name: /^Push/ }).click();
  await expect(page.getByRole('heading', { name: 'Bench press' })).toBeVisible();
  await page.getByLabel('Bench press weight').fill('80');
  await page.getByLabel('Bench press reps').fill('8');
  await page.getByRole('button', { name: 'Add set' }).first().click();
  await expect(page.getByText('80 kg × 8')).toBeVisible();
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await expect(page.getByText('✓ Push done')).toBeVisible();

  // 4. Copy for Claude
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('link', { name: /Export & import/ }).click();
  await page.getByRole('button', { name: 'Copy for Claude' }).click();
  await expect(page.getByTestId('copy-status')).toContainText('Copied');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('# Cut Tracker report');
  expect(clip).toContain('## Weekly summary');
  expect(clip).toMatch(/\| 87\.9 \| 497 \|/);
  expect(clip).toMatch(/\| Bench press \| 80\.0×8/);

  expect(errors).toEqual([]);
});
