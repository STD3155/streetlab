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

test('ALKIS-Geometrie lässt sich für einen RLP-Ausschnitt übernehmen', async ({ page }) => {
  await page.route('https://www.geoportal.rlp.de/spatial-objects/**', async (route) => {
    const url = new URL(route.request().url());
    const road = url.pathname.includes('AX_Strassenverkehr');
    const coordinates = road
      ? [[[8.3498, 49.5598], [8.3502, 49.5598], [8.3502, 49.5602], [8.3498, 49.5602], [8.3498, 49.5598]]]
      : [[[8.3497, 49.5603], [8.3499, 49.5603], [8.3499, 49.5605], [8.3497, 49.5605], [8.3497, 49.5603]]];
    await route.fulfill({ status: 200, contentType: 'application/geo+json', body: JSON.stringify({
      type: 'FeatureCollection', links: [], features: [{ type: 'Feature', id: road ? 'AX_Strassenverkehr.1' : 'GebaeudeBauwerk.2', properties: { gml_id: road ? 'AX_Strassenverkehr.1' : 'GebaeudeBauwerk.2' }, geometry: { type: 'Polygon', coordinates } }],
    }) });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.locator('#coordinates').fill('49.56, 8.35');
  await page.locator('button[title="Neues Gebiet öffnen"]').click();
  await page.getByRole('button', { name: 'ALKIS-Geometrie übernehmen' }).click();
  await expect(page.getByRole('status')).toContainText('ALKIS geladen: 1 Straßenflächen, 1 Gebäude', { timeout: 10000 });
  await expect(page.locator('.layer-row').first()).toContainText('2');
  await expect(page.locator('.project-title small')).toContainText('GeoBasis-DE');
});

test('OpenStreetMap-Geometrie wird als beschriftete lokale Fläche importiert', async ({ page }) => {
  await page.route('https://overpass-api.de/api/interpreter', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: [
      { type: 'way', id: 701, tags: { highway: 'residential', name: 'OSM-Teststraße', width: '6', sidewalk: 'both' }, geometry: [{ lat: 50, lon: 8.9998 }, { lat: 50, lon: 9.0002 }] },
      { type: 'way', id: 702, tags: { building: 'yes', name: 'OSM-Testhaus' }, geometry: [{ lat: 50.0001, lon: 9.0001 }, { lat: 50.0001, lon: 9.0002 }, { lat: 50.0002, lon: 9.0002 }, { lat: 50.0002, lon: 9.0001 }, { lat: 50.0001, lon: 9.0001 }] },
    ] }) });
  });
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.getByLabel('Geometriedatenquelle').selectOption('osm');
  await page.getByRole('button', { name: 'OSM-Geometrie übernehmen' }).click();
  await expect(page.getByRole('status')).toContainText('OSM geladen: 1 Straßenflächen, 1 Gebäude, 2 ausdrücklich kartierte Gehwegflächen', { timeout: 10000 });
  await expect(page.locator('.layer-row').first()).toContainText('4');
  await expect(page.locator('.project-title small')).toContainText('OpenStreetMap-Mitwirkende');
});

// End of source-import browser workflows.

