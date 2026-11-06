# Entwicklungsprotokoll

## Umsetzungsplan

- **M1 — App/Karte/Geometrie:** React + TypeScript + Vite, Leaflet/OSM, AEQD-Metersystem, synthetische Demo, versioniertes JSON/GeoJSON und lokale Speicherung.
- **M2 — Fahrzeugmodell:** kinematisches Einspurmodell, kompletter Pkw-Footprint, Kollisions- und Schleppflächenberechnung, Kennzahlen.
- **M3 — Planer:** deterministischer Vorwärts-State-Lattice-A*, unabhängige Footprint-Prüfung, Worker, Status/Abbruch und sichere/diagnostische Modi.
- **M4 — Szenarien/UI:** Bestand/Variante, Eingriffe, Neuberechnung, Playback, lokales Speichern, vollständiger Browserablauf.
- **M5 — Lieferumfang:** Dokumentation, reproduzierbarer Build, Grenzen und Abschlussprüfung.

## M1 — App-Skelett und Kartengeometrie

**Umgesetzt:** React/TypeScript/Vite, Leaflet mit OSM-Attribution, frei konfigurierbare Tile-URL, WGS84↔AEQD-Projektion, lokale Demo-L-Kurve, versioniertes JSON, GeoJSON-Export, Importprüfung und LocalStorage.

**Prüfung:** `npm test` (5 Tests), `npm run typecheck`, `npm run lint`, `npm run build` — bestanden.

**Entscheidung/Grenze:** Die Kartengeometrie ist synthetisch und metrisch. OSM-Kacheln sind nur Hintergrund; daraus wird keine Geometrie extrahiert. Leaflet-Geoman wird nicht benötigt: Der PoC verwendet einfache eigene Leaflet-Zeichenwerkzeuge und vermeidet damit eine nicht zwingend nötige Editor-Abhängigkeit.

## M2 — Fahrzeugkinematik und Geometrie

**Umgesetzt:** Pkw-Modell am Referenzpunkt Hinterachsmitte; exakte Kreisbogenintegration mit höchstens 0,1 m Wegschritt und höchstens 2° Gierwinkeländerung; vollständiger Rechteck-Footprint inklusive Überhängen; Polygon-Kollisionsprüfung; Schleppfläche als Turf-Polygonunion mit 0,35 m Pose-Sampling; Weglänge, Hindernisabstand und Gehwegkontakt/-überlappung.

**Prüfung:** `npm test` (12 Tests), Typecheck, Lint und Build — bestanden.

**Entscheidung/Grenze:** Pkw-Maße sind dokumentierte Modellannahmen, kein amtlicher Fahrzeugstandard. Schleppflächen sind Polygonunionen aus dicht abgetasteten Footprints, keine exakte kontinuierliche Minkowski-Summe. Die angezeigte Gehwegfläche ist die maximale Überdeckung einer einzelnen geprüften Pose, nicht die über die gesamte Fahrt summierte einzigartige Fläche.

## M3 — Automatische Fahrlinie

**Umgesetzt:** Deterministische A*-Suche auf quantisierten (x, y, Heading)-Zuständen mit fünf diskreten Lenkwinkeln, Vorwärtsprimitiven und vollständiger Footprint-Prüfung; fein abgetastete unabhängige Pfadvalidierung; Worker mit Fortschrittsmeldungen und Abbruch durch Worker-Terminierung; Status `invalid_input`, `no_path_found` und `timeout`.

**Prüfung:** `npm test` (17 Tests), Typecheck, Lint und Build — bestanden. Die synthetische L-Kurve ist im Bestand und mit Variante-Insel lösbar; der Pfad unterscheidet sich tatsächlich. Eine voll gesperrte Gerade erhält keinen Erfolg.

**Entscheidung/Grenze:** Nur Vorwärtsfahrt; Suchgitter 0,5 m, 24 Heading-Bins, primitive Weglänge max(1,0 m, 2,5 Gitterzellen), höchstens 45.000 Expansionen/12 s. Die Zielpose wird innerhalb der dokumentierten Gittertoleranz angenähert; ein Suchfehlschlag ist kein Unmöglichkeitsbeweis.

## M4 — Szenarien und vollständige Bedienoberfläche

**Umgesetzt:** Bestand und Variante bleiben getrennt; Szenarioänderungen können Flächen hinzufügen, entfernen oder als lokale Kopie verändern. Verkehrsinsel, konfigurierbarer Poller (0,1–2,0 m Durchmesser) und Gehwegschutz; Polygon zeichnen, Fläche verschieben, Stützpunkt ziehen, auswählen/löschen, 20-Schritt Undo/Redo, Layer je Feature-Art ein-/ausblenden, Projektbereich aufziehen, Abstand messen, Start/Ziel/Winkel, Fahrzeugparameter, Wiedergabe/Regler, Abbruch, automatische Speicherung und Vergleich.

**Prüfung:** `npm test` (19 Tests), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` (2 Browserabläufe) — bestanden. Die E2E-Prüfung zeichnet eine neue Insel auf der Karte, berechnet Bestand und Variante, exportiert/importiert JSON und bricht eine laufende Worker-Berechnung ab.

**Entscheidung/Grenze:** Baseline-Geometrie wird bei Variantenänderungen nicht verändert; Änderungen werden als Entfernen/Override/Additions gespeichert. Das Editieren nutzt eigene Leaflet-Interaktionen statt Leaflet-Geoman. Änderungen am Projekt leeren Berechnungsergebnisse. Kartendarstellung und lokale Simulation bleiben auch bei nicht verfügbaren Kacheln funktionsfähig.

## M5 — Dokumentation und Abschluss

**Umgesetzt:** README mit Start-/Testanleitung, Daten-/Lizenzhinweisen und Ergebnisinterpretation; Modellannahmen; Einschränkungen; Akzeptanzmatrix T01–T17; MIT-Lizenz; GitHub-CI-Workflow. Vite-Build ist in Framework-, Karten- und Geometrie-Chunks geteilt. Das optionale RLP-WMS wurde nicht ergänzt, da es kein P0 ist und aktuelle Verfügbarkeit/Lizenz/CORS sonst gesondert belastbar geprüft werden müssten.

**Abschließende Prüfung:** `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` (21 Tests), `npm run test:e2e` (2 Tests), `npm run build`, `npm audit` — erfolgreich; keine bekannten npm-Audits.

**Offene Punkte:** keine P0-Funktion absichtlich durch vorgezeichnete Pfade ersetzt. Nicht Bestandteil des PoC bleiben echte Rathauskurven-Vermessung, RLP-Luftbild, komplexe/mehrteilige Fahrzeuge und reale Verkehrssicherheitsbewertung.

## Geodatenimport — ALKIS und OSM

**Fachliche Prüfung:** Die offiziellen ALKIS-OGC-API-Features-Schnittstellen `ave:AX_Strassenverkehr` und `ave:GebaeudeBauwerk` liefern für kleine Ausschnitte direkt GeoJSON in WGS84. Die ALKIS-Metadaten bezeichnen den Dienst als monatlich aktuell und warnen, dass Koordinaten unterschiedlicher Vermessungsepochen stammen können. Der separate ALKIS-Weg-Layer ist keine Gehweggarantie und wird deshalb nicht als Gehweg importiert. RLP-Daten tragen DL-DE-BY-2.0-Attribution. OSM/Overpass bleibt die Alternative außerhalb von RLP; OSM-Mittellinien werden für die Vorschau anhand von expliziten Tags oder klar markierten Klassenannahmen gepuffert. Overpass ist ein öffentlicher Community-Dienst und kann ausgelastet sein.

**Umgesetzt:** Quelle wählbar, kleine Bounding-Box, ALKIS Straße/Gebäude oder OSM Straßen/Gebäude/ausdrücklich getaggte Gehwege, AEQD-Transformation in Meter, Quellen-ID/Attribut-/Breitenherkunft an jedem Feature, sichtbare Quelle/Lizenz und fachliche Warnungen, ersetzende Übernahme nach Bestätigung. Maximal 500-m-Projektgrenze und beschränkte Netzwerk-/Objektmengen.

**Prüfung:** Unit-Tests mit servicekonformen GeoJSON-Beispielen sowie Browser-E2E mit simulierten ALKIS-Antworten; zusätzlich wurde die tatsächliche ALKIS-GeoJSON-Antwort und der CORS-Header für einen kleinen Beindersheim-Ausschnitt geprüft.

**Grenze:** Import ist keine automatische Fahrbahnrand-Extraktion. ALKIS-Straßenverkehrsflächen können größer/anders abgegrenzt als die befahrbare Asphaltfläche sein. OSM-Puffermaße sind Annahmen, nicht Vermessung. Overpass-Verfügbarkeit ist nicht garantiert; Fehlermeldungen nennen die genutzten Instanzen.
