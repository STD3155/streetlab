import { expect, test } from '@playwright/test';

test('Demo laden, Bestand und Inselvariante berechnen, exportieren und importieren', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Konfliktanalyse' })).toBeVisible();
  await expect(page.getByText('Demo-L-Kurve', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Verkehrsinsel' }).click();
  const map = page.locator('.map-frame');
  const box = await map.boundingBox();
  expect(box).toBeTruthy();
  for (const [x, y] of [[0.78, 0.75], [0.82, 0.75], [0.82, 0.79], [0.78, 0.79]]) {
    await page.mouse.click(box!.x + box!.width * x, box!.y + box!.height * y);
  }
  await page.getByRole('button', { name: 'Polygon abschließen' }).click();
  await expect(page.getByRole('status')).toContainText('Geometrie geändert');

  await page.getByRole('button', { name: 'Bestand & Variante berechnen' }).click();
  await expect(page.locator('.result-card .result-title span').first()).toHaveText('Berechnet', { timeout: 20000 });
  await expect(page.locator('.variant-card .result-title span')).toHaveText('Berechnet', { timeout: 20000 });
  await expect(page.locator('.map-legend')).toContainText('Bestand');
  await expect(page.locator('.map-legend')).toContainText('Variante');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Projekt exportieren' }).click(),
  ]);
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.locator('input[type="file"]').setInputFiles(path!);
  await expect(page.getByRole('status')).toContainText('Demo-L-Kurve', { timeout: 5000 });
});

test('Worker-Berechnung lässt sich abbrechen, ohne die Oberfläche zu blockieren', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Bestand & Variante berechnen' }).click();
  const cancel = page.getByRole('button', { name: 'Abbrechen' });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(page.getByRole('status')).toContainText('abgebrochen', { timeout: 5000 });
  await page.getByRole('button', { name: 'Demo laden' }).click();
  await expect(page.getByText('Demo-L-Kurve', { exact: true })).toBeVisible();
});
