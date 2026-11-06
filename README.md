# StreetLab

StreetLab ist ein lokaler, experimenteller PoC zur maßstäblichen Erfassung kleiner Straßenräume und zur geometrischen Prüfung von Pkw-Fahrbewegungen. Die Anwendung berechnet Fahrlinien tatsächlich; sie verschiebt keine vorgezeichneten Routen. Sie ist **keine amtliche Verkehrsplanung**, keine Unfallprognose und keine Aussage über das Verhalten realer Fahrer.

## Start

Voraussetzungen: Node.js **22.12 oder neuer** (für den verwendeten Test-Stack) und npm.

```bash
npm ci
npm run dev
```

Vite zeigt anschließend die lokale URL an. Die synthetische Demo ist beim ersten Aufruf geladen. Eine Karte benötigt eine Internetverbindung zu den OpenStreetMap-Kacheln; wenn Kacheln ausfallen oder offline sind, bleiben Geometrieeditor, Simulation, Projektimport und Demo-Daten verfügbar. Berechnungen und Projekte laufen vollständig im Browser; es gibt kein Backend, keine Konten und keine bezahlten Dienste.

Für die Browser-E2E-Prüfung Chromium einmalig installieren:

```bash
npx playwright install chromium
```

## Entwicklungsbefehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | lokale Entwicklung |
| `npm run build` | TypeScript-Prüfung und statischer Produktionsbuild nach `dist/` |
| `npm run typecheck` | strikter TypeScript-Check |
| `npm run lint` | ESLint |
| `npm test` | Vitest-Unit-/Integrationstests |
| `npm run test:e2e` | Playwright-Browserabläufe |

Abhängigkeiten sind in `package-lock.json` eingefroren. `npm audit` ist mit der mitgelieferten Auflösung ohne bekannte Advisories.

## Demo-Workflow

1. `Demo laden` öffnet die reproduzierbare, synthetische `Demo-L-Kurve` (lokale Maße in Metern, ausdrücklich nicht vermessen).
2. Links können Fahrbahn, Gehweg, Gebäude, Hindernis und weitere Polygone durch Kartenklicks erstellt werden; `Polygon abschließen` übernimmt die Fläche.
3. `Bereich aufziehen` begrenzt den Arbeitsbereich auf höchstens 500 m Durchmesser. Koordinaten werden als `Breitengrad, Längengrad` (WGS84) eingegeben; ein neues Gebiet startet bewusst leer.
4. Start und Ziel auf der Karte anklicken, Richtungswinkel in Grad setzen und Fahrzeugdaten bei Bedarf bearbeiten. Der Fahrzeugreferenzpunkt ist die Hinterachsmitte.
5. Zwischen Bestands- und Variantenbearbeitung wechseln. Die Demo enthält bereits eine Insel; zusätzlich lassen sich Inseln, Poller (Ø 0,1–2,0 m) oder Gehwegschutz zeichnen. Variantenänderungen verändern den Bestand nicht.
6. `Bestand & Variante berechnen` startet zwei unabhängige Vorwärtsplanungen mit denselben Manöver- und Fahrzeugparametern. „Nur Fahrbahn“ verlangt, dass der gesamte Fahrzeugumriss innerhalb der erfassten Fahrbahn bleibt. Das Ergebnis enthält Status, Linien, approximierte Schleppflächen, Gehwegkontakt, Überdeckung, Abstand und Weglänge.
7. Projektdatei als versioniertes JSON oder Geometrie als WGS84-GeoJSON exportieren. JSON kann importiert werden; der aktuelle Projektstand wird zusätzlich automatisch in `localStorage` gehalten.

Zeichenwerkzeuge umfassen Polygon-Erstellung, Flächenverschiebung, Stützpunktverschiebung, Auswahl/Löschen, Messung und 20 Schritte Undo/Redo. Layer können nach Szenario und Feature-Art ausgeblendet werden; das ändert nicht die Simulationsgeometrie.

## Datenquellen und Datenschutz

- OSM-Basiskarte: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, mit sichtbarer Attribution „© OpenStreetMap-Mitwirkende“. Die Tile-URL ist über `VITE_OSM_TILE_URL` konfigurierbar. Kacheln werden im normalen Kartenbetrieb angefragt und nicht gespeichert/vorabgeladen. Siehe [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
- Kernbibliotheken: React, Zustand, Proj4, Turf.js und Vitest unter MIT; Leaflet unter BSD-2-Clause; Playwright unter Apache-2.0. Die aufgelösten Versionen sind in `package-lock.json` eingefroren. Leaflet-Geoman wird nicht genutzt; Zeichen- und Verschiebewerkzeuge sind lokal implementiert.
- Es wird keine Geocoding-API verwendet. Ortssuche erfolgt durch Kartenverschiebung oder WGS84-Koordinaten.
- Keine Geometrie wird aus Kartenkacheln abgeleitet. Projekte bleiben lokal; der Kartenanbieter erhält bei Nutzung technisch notwendige Tile-Anfragen.
- Es ist kein Luftbild-WMS eingebaut. Die optionale Rheinland-Pfalz-Abdeckung ist keine Voraussetzung der Anwendung.
- `reference/Problematik_der_Rathauskurve.txt` ist fachlicher Kontext. Die schematische Skizze wird nicht als Messgrundlage benutzt. Die Demo ist vollständig synthetisch und behauptet keinerlei reale Ortsmaße.

## Veröffentlichung als GitHub Page

Ein Deployment-Workflow liegt unter `.github/workflows/pages.yml`. Für die Veröffentlichung:

1. Ein leeres Repository auf GitHub erstellen und den lokalen Projektstand auf den Branch `main` pushen.
2. Im GitHub-Repository **Settings → Pages → Build and deployment → Source: GitHub Actions** auswählen.
3. Der Push auf `main` startet den Workflow; nach erfolgreichem Lauf steht die URL im Bereich **Actions** beziehungsweise **Settings → Pages**.

Die Vite-Basis wird im Pages-Build automatisch aus `GITHUB_REPOSITORY` abgeleitet. Ein Projekt-Repository wird unter `https://<konto>.github.io/<repository>/` bereitgestellt; ein Repository namens `<konto>.github.io` verwendet `/`. Lokal bleibt die Basis `/`. Der Workflow benötigt keine API-Schlüssel. Die Karte selbst lädt OSM-Kacheln im Browser und benötigt daher weiterhin Netzwerkzugriff.

## Technische Dokumentation

- [Modellannahmen](docs/MODEL_ASSUMPTIONS.md)
- [Grenzen und nicht implementierte Funktionen](docs/LIMITATIONS.md)
- [Meilensteinprotokoll](docs/DEVELOPMENT.md)
- [Akzeptanztest-Status T01–T17](docs/ACCEPTANCE.md)
- Verbindliche Anforderungen: [REQUIREMENTS.md](REQUIREMENTS.md)

## Ergebnisinterpretation

„Unter diesen Modellannahmen geometrisch kollisionsfrei“ bedeutet ausschließlich, dass die erfassten Fahrzeugumrisse innerhalb der modellierten Flächen liegen und keine erfassten harten Hindernisse berühren. Es sagt nichts über Sicht, Geschwindigkeit, Fußgänger, Oberflächenhöhe, tatsächliche Fahrzeugabmessungen oder verkehrsrechtliche Zulässigkeit aus. „Keine Trajektorie gefunden“ ist kein Beweis der Unbefahrbarkeit.
