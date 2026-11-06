# StreetLab

StreetLab ist die lokale Arbeitsgrundlage für einen Straßenentwurf innerhalb eines ausgewählten ALKIS-Straßenraums. Der aktuelle Ausbau enthält Karte, Projektbereich, ALKIS-Referenzflächen, einen manuellen Flächeneditor und Varianten.

**Querschnittsgenerator und Regelprüfung sind geplant, aber noch nicht implementiert.** Die Anwendung liefert derzeit keine Aussage zur Gesetzes- oder Regelkonformität eines Entwurfs. Der [Umsetzungsplan](docs/STRASSENENTWURF_PLAN.md) beschreibt die nächsten Schritte.

## Lokal starten

Voraussetzung: Node.js 22.12 oder neuer und npm.

```bash
npm ci
npm run dev
```

Die Anwendung benötigt weder Konto noch Backend. Projekte werden lokal im Browser gespeichert. Karten- und ALKIS-Abrufe benötigen Internetzugang; der Flächeneditor funktioniert auch ohne geladene Kartenkacheln.

## Arbeitsablauf

1. Koordinaten als `Breitengrad, Längengrad` eingeben und das Gebiet öffnen.
2. Mit „Bereich festlegen“ zwei gegenüberliegende Ecken auswählen. Der Projektdurchmesser ist auf 500 m begrenzt.
3. „ALKIS-Flächengrundlage laden“ übernimmt Straßenverkehrsflächen und Gebäude aus Rheinland-Pfalz als unveränderbare Referenz. Ein erneuter Abruf ersetzt diese Referenzen und erhält manuelle Flächen und Varianten.
4. Fahrbahn, Gehweg, Gebäude, Hindernisse und Bordflächen manuell zeichnen. Flächen und Stützpunkte bearbeiten, Abstände messen und Änderungen mit Undo/Redo zurücknehmen.
5. Zwischen Bestand und Variante wechseln. Änderungen in einer Variante lassen den Bestand unverändert.
6. Projekt als JSON sichern und wieder importieren; GeoJSON exportiert die erfassten Flächen einschließlich Quellenangaben und Variantenkennungen.

Projektdateien verwenden Schema v2. Frühere v1-Dateien bleiben importierbar: Fahrzeug- und Manöverdaten werden bei der Übernahme weggelassen; erkennbare ALKIS-Fahrbahnflächen werden zu Straßenraumreferenzen. Der frühere lokale Speicher bleibt erhalten und wird bei Bedarf eingelesen. Neue Änderungen werden unter einem separaten v2-Speicherschlüssel gespeichert.

## Datenquellen

- Hintergrundkarte: © OpenStreetMap-Mitwirkende, mit sichtbarer Attribution und normalem Kachelabruf. Konfigurierbar über `VITE_OSM_TILE_URL`; keine Kachelarchive oder Vorabdownloads. [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
- ALKIS Rheinland-Pfalz: `AX_Strassenverkehr` und `GebaeudeBauwerk` über die öffentlichen GeoPortal.rlp-Features-Dienste. Quellenangabe: ©GeoBasis-DE / LVermGeoRP, dl-de/by-2-0, Daten bearbeitet. Straßenverkehrsflächen beschreiben Nutzungsflächen; sie sind kein Nachweis für genaue Fahrbahnränder oder öffentliche Widmung. Eigentümerdaten werden nicht abgefragt.
- Projekte und Geometrie bleiben lokal. Die genutzten Karten- und Geodatendienste erhalten die technisch notwendigen Anfragen.

## Prüfung und Build

```bash
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Der statische Build liegt unter `dist/`. Die vorhandenen GitHub-Workflows prüfen den Quellcode und unterstützen die Veröffentlichung über GitHub Pages. Bei Projekt-Repositories wird der Vite-Unterpfad im Pages-Build automatisch gesetzt.

Weitere Dokumentation: [Anforderungen](REQUIREMENTS.md), [Grenzen](docs/LIMITATIONS.md), [Entwicklungsstand](docs/DEVELOPMENT.md).
