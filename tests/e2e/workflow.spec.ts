import { expect, test } from '@playwright/test';

async function mockAlkis(page: import('@playwright/test').Page) {
  await page.route('https://www.geoportal.rlp.de/spatial-objects/**', async (route) => {
    const road = new URL(route.request().url()).pathname.includes('AX_Strassenverkehr');
    const coordinates = road
      ? [[[8.3498, 49.5598], [8.3502, 49.5598], [8.3502, 49.5602], [8.3498, 49.5602], [8.3498, 49.5598]]]
      : [[[8.3497, 49.5603], [8.3499, 49.5603], [8.3499, 49.5605], [8.3497, 49.5605], [8.3497, 49.5603]]];
    await route.fulfill({ status: 200, contentType: 'application/geo+json', body: JSON.stringify({
      type: 'FeatureCollection', links: [], features: [{ type: 'Feature', id: road ? 'street.1' : 'building.2', properties: {}, geometry: { type: 'Polygon', coordinates } }],
    }) });
  });
}

test('ALKIS remains a reference through export, import and reload', async ({ page }) => {
  await mockAlkis(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'ALKIS-Flächengrundlage laden' }).click();
  await expect(page.getByRole('status')).toContainText('ALKIS geladen: 1 Straßenraumflächen, 1 Gebäude');
  await expect(page.locator('.layer-row').filter({ hasText: 'ALKIS-Straßenraum' })).toContainText('1');
  await expect(page.locator('.layer-row').filter({ hasText: 'Fahrbahn' })).toContainText('0');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Projekt exportieren' }).click();
  const download = await downloadEvent;
  await page.locator('input[type="file"]').setInputFiles((await download.path())!);
  await expect(page.getByRole('status')).toContainText('geladen');
  await page.reload();
  await expect(page.locator('.layer-row').filter({ hasText: 'ALKIS-Straßenraum' })).toContainText('1');
  await expect(page.locator('.project-title small')).toContainText('GeoBasis-DE');
});

test('manual geometry survives ALKIS refresh and variant undo', async ({ page }) => {
  await mockAlkis(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Fahrbahn', exact: true }).click();
  const map = page.locator('.street-map');
  const box = (await map.boundingBox())!;
  for (const [x, y] of [[.42, .45], [.58, .45], [.58, .55], [.42, .55]]) {
    await map.click({ position: { x: box.width * x!, y: box.height * y! } });
  }
  await page.getByRole('button', { name: 'Polygon abschließen' }).click();
  await expect(page.locator('.layer-row').filter({ hasText: 'Fahrbahn' })).toContainText('1');
  await page.getByRole('button', { name: 'ALKIS-Flächengrundlage laden' }).click();
  await expect(page.getByRole('status')).toContainText('ALKIS geladen');
  await expect(page.locator('.layer-row').filter({ hasText: 'Fahrbahn' })).toContainText('1');
  await page.getByRole('button', { name: 'Neue Variante' }).click();
  await expect(page.getByLabel('Aktive Variante')).toHaveValue('variant-2');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByLabel('Aktive Variante')).toHaveValue('variant-a');
  await page.getByRole('button', { name: 'Wiederholen' }).click();
  await expect(page.getByLabel('Aktive Variante')).toHaveValue('variant-a');
  await page.getByRole('button', { name: 'ALKIS-Flächengrundlage laden' }).click();
  await expect(page.getByRole('status')).toContainText('ALKIS geladen');
  await expect(page.locator('.layer-row').filter({ hasText: 'ALKIS-Straßenraum' })).toContainText('1');
});

test('invalid coordinates leave the current project intact', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Koordinaten · WGS84 lat, lon').fill('49.56,');
  await page.getByTitle('Neues Gebiet öffnen').click();
  await expect(page.getByRole('status')).toContainText('Koordinatenformat');
  await expect(page.locator('.project-title strong')).toHaveText('Neuer Straßenentwurf');
});
