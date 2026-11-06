# StreetLab — Anforderungsdokument für Codex

**Version:** 1.0 · **Stand:** 06.11.2026 · **Status:** verbindliche Spezifikation für einen lauffähigen Open-Source-Proof-of-Concept (PoC)

> **Arbeitsauftrag an Codex:** Implementiere auf Basis dieses Dokuments eine ausführbare Webanwendung in einem Git-Repository. Liefere echten, typisierten, getesteten Code und keine bloßen Mockups. Arbeite inkrementell; halte die Anwendung nach jedem Meilenstein startbar. Bei technischen Detailfragen triff vernünftige, dokumentierte Entscheidungen statt den Umfang eigenmächtig auszuweiten. Die mit **MUSS** markierten Anforderungen sind verpflichtend; **SOLL** ist erwünscht, aber nachgeordnet; **SPÄTER** gehört ausdrücklich nicht zum PoC. Eine Funktion gilt nur als fertig, wenn die zugehörigen Akzeptanztests bestehen. Ist eine Anforderung nicht zuverlässig realisierbar, kennzeichne die Einschränkung transparent und liefere keine irreführende Ersatzsimulation.

## 1. Ziel, Problem und Nutzen

StreetLab soll Nutzern ermöglichen, einen realen Straßenabschnitt auf einer Karte auszuwählen, den relevanten Straßenraum als maßstäbliche 2D-Geometrie zu erfassen, verschiedene Fahrzeugbewegungen zu simulieren und die Auswirkungen baulicher Änderungen unmittelbar zu vergleichen. Hauptnutzen ist die **nachvollziehbare geometrische Bewertung von Befahrbarkeit und potenziellen Konflikten mit Gehwegen, Gebäuden und Hindernissen**. StreetLab ist keine amtliche Straßenplanung, keine Unfallprognose und kein realitätsgetreues Verkehrsverhaltensmodell.

**Beispielproblem:** Die Rathauskurve in Beindersheim (Schenkelstraße / Frankenthaler Straße / Kirchenstraße) besitzt zwei schwer einsehbare Kurveninnenecken. Fahrzeuge können Kurven schneiden, Gehwege überfahren und Gebäuden nahe kommen. Eine kleine Verkehrsinsel könnte eine Fahrspur verändern, muss aber zugleich für größere Fahrzeuge befahrbar bleiben. Dieser Ort ist ein **Anwendungsfall**, nicht die fest codierte App-Geometrie. Die vorliegende Bestandsskizze ist ausdrücklich *nicht vermessen* und dient nur zur visuellen Orientierung. Niemals daraus präzise Maße oder echte Simulationsergebnisse behaupten.

### 1.1 Erfolgskriterium des PoC

Ein Anwender kann:

1. auf einer frei wählbaren Karte einen Ort finden und einen überschaubaren Ausschnitt öffnen;
2. Fahrbahn, Gehweg und Gebäude/Hindernisse als geometrische Flächen erfassen oder bearbeiten;
3. eine Einfahrts- und eine Ausfahrtspose sowie einen Fahrzeugtyp festlegen;
4. im **Bestand** eine kinematisch plausible Fahrbewegung mitsamt Fahrzeugumriss/überstrichener Fläche berechnen;
5. eine **Variante** anlegen und eine Verkehrsinsel oder einen Poller zeichnen;
6. automatisch eine neue kollisionsgeprüfte Fahrbewegung suchen und den Bestand mit der Variante vergleichen;
7. geometrische Konflikte und Ergebnisgrenzen verstehen und Projekte lokal speichern/exportieren.

**Wichtig:** Nicht nur eine optische Linie um ein Symbol verschieben. Die Fahrzeugkinematik sowie die **gesamte Fahrzeugfläche** müssen berücksichtigt werden. Wenn keine gültige Trajektorie gefunden wird, lautet das Ergebnis „keine Trajektorie gefunden“, nicht „unbefahrbar“.

## 2. Umfang und Prioritäten

| Prio | Lieferumfang | Definition |
|---|---|---|
| P0 / MUSS | Kartenausschnitt auswählen; Straßenraum maßstäblich digitalisieren | Ortsunabhängige Karte und lokales metrisches Koordinatensystem |
| P0 / MUSS | Fahrbahnen, Gehwege, feste Hindernisse, Start/Ziel, Szenarien | Persistente, editierbare Datenstruktur |
| P0 / MUSS | Pkw mit kinematischem Modell, animiertem Footprint und Schleppfläche | Berechnungen im metrischen Koordinatensystem |
| P0 / MUSS | Automatische Neuberechnung von Fahrlinien nach Hindernisänderung | Deterministischer, beschränkter Pfadplaner mit Kollisionsprüfung |
| P0 / MUSS | Geometrische Konfliktanalyse und Vorher/Nachher-Ansicht | Verständliche, technisch korrekt beschriftete Kennzahlen |
| P0 / MUSS | Demo, Tests, Dokumentation, Export/Import, lokales Speichern | End-to-End nutzbarer PoC ohne Server |
| P1 / SOLL | Mehrere Fahrzeugvorlagen (Transporter, kleiner Lkw) | Nur soweit Modell/Tests korrekt parametriert |
| P1 / SOLL | Optionaler Luftbild-WMS für Rheinland-Pfalz | Als Hintergrund, nicht als automatisch extrahierte Geometrie |
| P1 / SOLL | Analyse von mehreren Fahrstilen / Konfliktpotenzial | Transparent als Modellannahme, nicht als reale Fahrerprognose |
| P2 / SPÄTER | Lkw-Sattelzüge, mehrteilige Anhänger, Landwirtschaftszüge | Separate Mehrkörper- und Gelenkkinematik erforderlich |
| P2 / SPÄTER | Sichtlinien, Sichtdreiecke, Reaktionswege, Geschwindigkeitsprofile | Erfordert zusätzliche Parameter, ggf. Höhendaten |
| P2 / SPÄTER | Automatische Bordsteinerkennung aus Luftbildern, KI, 3D | Nicht Bestandteil dieses Projekts |
| P2 / SPÄTER | Gegenverkehr, Verkehrsmengen, Stau-/Unfallprognosen | Nicht Bestandteil dieses Projekts |

### 2.1 Nicht-Ziele für P0

Keine Google-Maps-API, keine kostenpflichtige Lizenz oder API, keine Benutzerkonten, keine Datenbank, keine Cloud-Synchronisierung, keine Online-Zusammenarbeit, keine amtlichen Verkehrssicherheitsbewertungen, kein automatisch angenommenes tatsächliches Fahrerverhalten, keine Behauptung von vermessungstechnischer Genauigkeit. Keine Behauptung, dass ein „kürzester“ Weg die tatsächlich gewählte Fahrweise abbildet. Kein Versuch, aus Kartenkacheln ohne Rechte Geometrien abzuleiten.

## 3. Technische Vorgaben

- **Frontend:** React + TypeScript (strict) + Vite; deutschsprachige Oberfläche, semantische HTML-Controls.
- **Karte:** Leaflet und ein lizenzkonformer OSM-Kartenlayer mit korrekter Attribution; Tile-Quelle zentral konfigurierbar. Keine Vorab-/Massendownloads.
- **Geometrieeditor:** Leaflet-Geoman Free, nur tatsächlich kostenlose und lizenzierte Funktionen verwenden. Falls einzelne gewünschte Operationen nicht frei verfügbar sind, lokal selbst implementieren.
- **Geometrieoperationen:** Turf.js und/oder bewährte freie Polygonbibliothek. Keine selbst entwickelte allgemeine Polygon-Boolean-Engine. Polygonvalidierung vor Berechnungen.
- **Projektion:** `proj4` oder gleichwertige freie Bibliothek; pro Projekt ein lokal zentriertes metrisches Projektionssystem (z. B. azimutal-äquidistant mit WGS84-Zentrum). Darstellung und GeoJSON in WGS84 `[Längengrad, Breitengrad]`; Physik/Planung **ausschließlich** in lokalen `[x, y]`-Metern. Gültigkeitsbereich auf räumlich kleine Projekte (MUSS: maximal 500 m Ausdehnung) begrenzen. Projektionsgenauigkeit dokumentieren.
- **Anwendungszustand:** eine kleine klare State-Lösung (z. B. Zustand oder React Context), ohne komplexes State-Framework.
- **Simulation:** eigenständige, UI-unabhängige TypeScript-Module; rechenintensive Planungen in einem Web Worker mit Abbruchmöglichkeit.
- **Persistenz:** `localStorage` für das kleine Projekt, JSON-Download/Upload für Portabilität. Keine Luftbild-Kacheln speichern. Speicherfehler abfangen.
- **Testen:** Vitest für Unit- und Integrationstests; Playwright für mindestens einen vollständigen UI-Ablauf. ESLint/Prettier und `tsc --noEmit`.
- **Build/Hosting:** statisch über `npm run build`, optional Veröffentlichung über GitHub Pages; Vite-`base` bei Unterpfad korrekt setzen. Projekt muss ohne kostenpflichtiges Konto lokal laufen.
- **Abhängigkeiten:** geprüfte, zum Implementierungszeitpunkt stabile Versionen; `package-lock.json` festschreiben. Keine geheimen API-Keys in Frontend-Code.

**Quellen und Nutzungsbedingungen vor der Implementierung prüfen:**
- Geoman: https://geoman.io/docs/leaflet
- OSM-Tile-Richtlinie: https://operations.osmfoundation.org/policies/tiles/
- RLP-DOP20 / WMS-Metadaten: https://geoportal.rlp.de/mapbender/php/mod_showMetadata.php?id=3398&resource=wms
- Offene Geodaten RLP: https://vermka-rheinpfalz.rlp.de/geodaten-geoshop/open-data
- Vite-Deployment: https://vite.dev/guide/static-deploy
- Projektionsprinzip `aeqd`: https://proj.org/en/stable/operations/projections/aeqd.html

### 3.1 Rechtliche und technische Kartenvorgaben

1. OSM-Kacheln nur im normalen sichtbaren Kartenbetrieb abrufen; Quellenhinweis ständig sichtbar und Kartenanbieter austauschbar halten.
2. Keine automatisierte Kopie oder Vektorisierung von Google-Maps-/Street-View-Bildern. Nutzererstellte Geometrien müssen auf zulässigen Quellen bzw. eigenen Messungen beruhen.
3. Falls RLP-Orthofoto per WMS verfügbar: mit korrekten Parametern aus den *aktuellen* GetCapabilities in Leaflet einbinden; CORS/Verfügbarkeit testen; Lizenz- und Quellenhinweise anzeigen. Bei Ausfall automatisch auf Basiskarte zurückfallen. Andere Regionen funktionieren weiterhin ohne diesen WMS.
4. Hintergrundkarten/-fotos sind nicht die Kollisionsgeometrie. Erst explizit digitalisierte, metrisch skalierte Flächen sind simulierbar.
5. Kein Screenshot-Export einschließlich fremder Hintergrundbilder, solange Rechte und technische Freigaben nicht sicher sind. Export der **eigenen** Geometrie und Ergebnisdaten ist erlaubt.

## 4. Fachliches Datenmodell

Die Anwendung unterscheidet strikt **Projekt**, **Bestandsgeometrie**, **Szenarioänderungen**, **Fahrzeugparameter**, **Fahrmanöver** und **Simulationsergebnisse**. Keine Vermischung von geographischen Koordinaten und Metern.

```ts
type Id = string;
type LocalPoint = { x: number; y: number }; // Meter, lokales CRS
type Pose = { x: number; y: number; headingRad: number }; // 0 = Ost, gegen Uhrzeigersinn
type PolygonXY = LocalPoint[][]; // Außenring + optionale Löcher, geschlossen

type FeatureKind =
  | 'road' | 'sidewalk' | 'building' | 'hard_obstacle' | 'curb';

type SurfaceFeature = {
  id: Id;
  kind: FeatureKind;
  geometry: PolygonXY; // curb als polygonale Barriere oder schmales Polygon
  properties?: { name?: string; source?: string; uncertaintyM?: number };
};

type VehicleSpec = {
  id: Id;
  label: string;
  lengthM: number;
  widthM: number;
  wheelbaseM: number;
  frontOverhangM: number;
  rearOverhangM: number;
  maxSteerRad: number; // angenommener Einzelspur-/Bicycle-Lenkwinkel
};

type Maneuver = {
  id: Id;
  name: string;
  start: Pose; // Referenzpunkt: Hinterachsmitte
  goal: Pose;
  vehicleId: Id;
  driveMode: 'road_only' | 'diagnostic_sidewalk_allowed';
};

type Scenario = {
  id: Id;
  name: string;
  baseScenarioId?: Id;
  additions: SurfaceFeature[];
  removedBaseFeatureIds: Id[];
  modifiedBaseFeatures: SurfaceFeature[];
};

type Project = {
  schemaVersion: 1;
  id: Id;
  title: string;
  centerWgs84: { lon: number; lat: number };
  boundsWgs84: [number, number, number, number];
  geometrySource: string;
  geometryAccuracyNote: string;
  baseFeatures: SurfaceFeature[];
  vehicleSpecs: VehicleSpec[];
  maneuvers: Maneuver[];
  scenarios: Scenario[];
};

type SimulationResult = {
  scenarioId: Id;
  maneuverId: Id;
  status: 'success' | 'no_path_found' | 'timeout' | 'invalid_input';
  path: Pose[];
  sweptArea: PolygonXY | null;
  lengthM?: number;
  minObstacleClearanceM?: number;
  sidewalkOverlapAreaM2?: number;
  sidewalkTouched?: boolean;
  hardCollision?: boolean;
  computeTimeMs: number;
  settings: Record<string, unknown>;
  warnings: string[];
};
```

**Datenregeln:**

- Koordinaten in Dateien nur nach eindeutig definiertem Format; GeoJSON-Austausch nach RFC 7946 in WGS84; eigene Projektdatei enthält Projektionszentrum und Metersystem-Definition.
- Beim Import Schema validieren (z. B. Zod), inkompatible Versionen mit verständlichem Hinweis ablehnen; keine stille Übernahme korrupter Dateien.
- Geometrie: Ringe geschlossen, keine Selbstüberschneidungen, Mindestfläche und gültige Orientierung nach Bibliothekskonvention, keine NaN/Infinity-Werte; auf maximal 500 m Projektdurchmesser prüfen.
- Gebäude und harte Hindernisse sind stets unbefahrbar. Gehwege sind im sicheren Modus unbefahrbar; im diagnostischen Modus bewusst für eine *hypothetische* riskante Linie freigegeben, jedoch als Konflikt zu markieren. Ein als `curb` modellierter Bord schützt nur, wenn er ausdrücklich als harte Barriere deklariert wird; Bordkanten allein dürfen nicht als massiver Kollisionsschutz behandelt werden.
- Ein Szenario erbt die Bestandsgeometrie und überlagert nur explizit hinzugefügte/entfernte/geänderte Elemente. Änderungen an Szenario A verändern den Bestand niemals.
- Fahrzeugdaten sind exemplarische Annahmen und einzeln editierbar. Zum Start: ein plausibel parametrisiertes Pkw-Modell mit exakt dokumentierten Abmessungen, keine willkürlichen Maße als offizieller Fahrzeugstandard ausgeben.
- `sweptArea` darf rechnerisch als MultiPolygon auftreten; bei Bedarf Typ entsprechend erweitern und nicht still abschneiden. `minObstacleClearanceM` nur bei erfolgreicher, überprüfter Berechnung ausgeben.

## 5. Funktionsanforderungen

### F-01 Karte und Auswahl (MUSS)

- Startansicht mit OSM-Basiskarte, Zoom, Verschieben, Maßstabsanzeige, Quellennachweis.
- Suche: **keine kostenpflichtige Geocoding-API erforderlich**. Mindestlösung: Karte manuell verschieben, Koordinaten `lat, lon` eingeben und auf Auswahl zentrieren. Eine freie Geocodierung ist optional und muss ihre Nutzungsrichtlinien beachten.
- Befehl „Projektbereich festlegen“: rechteckigen Ausschnitt aufziehen; Zentrum/Grenzen übernehmen. Mehr als 500 m maximaler Projektdurchmesser wird abgewiesen.
- Optional Umschalten auf RLP-DOP20 in Abdeckungsregion. Fehlt WMS, bleibt alles funktionstüchtig.

**Abnahme:** beliebige zwei auseinanderliegende Orte in Deutschland öffnen; an beiden lokal zeichnen, Entfernungen in Metern nachvollziehbar; keinerlei hart codierte Rathauskurven-Koordinaten in Simulationsmodulen.

### F-02 Geometrie digitalisieren (MUSS)

- Werkzeuge `Fahrbahn`, `Gehweg`, `Gebäude`, `Hindernis`; frei gezeichnete Polygone mit editierbaren Stützpunkten. Optional `Bordkante` als Linie mit ausdrücklich festgelegter Breite/Klasse.
- Gebäude dürfen an Gehwege angrenzen, müssen aber für die Simulation als harte Hindernisse gelten.
- Selektion, Löschen, Verschieben/Bearbeiten von Flächen, Undo/Redo für mindestens die letzten 20 Bearbeitungsschritte.
- Sichtbare Layer-Legende und Layer ein-/ausblenden, ohne Geometrie aus der Simulation zu entfernen.
- Konflikte im Editor: ungültige Polygone anzeigen und Simulation sperren; fehlende Fahrbahn / fehlender Start / Ziel verständlich melden.
- Werkzeug „Abstand messen“ (zwei Punkte, Meter).

**Abnahme:** Eine L-förmige Straße mit Gehweg, zwei Häusern und einem Hindernis lässt sich ohne JSON- oder Codekenntnisse anlegen, ändern, speichern und wiederherstellen.

### F-03 Fahrmanöver (MUSS)

- Start- und Zielpose **einschließlich Fahrtrichtung** über Marker plus rotierbare Richtungspfeile setzen. Gegebenenfalls Winkel zusätzlich numerisch editierbar.
- Pkw als erster voll unterstützter Fahrzeugtyp. Fahrzeugdaten in einem Informationspanel, mit Einheiten und Referenzpunkt *Hinterachsmitte*.
- Ein Manöver kann für zwei Szenarien identisch benutzt werden. Alle Vergleiche beruhen auf exakt denselben Start-/Zielposen und Fahrzeugparametern.
- Bei falscher Start-/Zielposition (außerhalb erlaubter Fläche oder Kollision) aussagekräftiger Fehler statt unechter Linie.

### F-04 Fahrzeugbewegung und Schleppfläche (MUSS)

**Physikalische Mindestmodellierung:**

Kinematisches Einspurmodell für langsame Vorwärtsfahrt mit Pose `(x, y, θ)`, Radstand `L`, Lenkwinkel `δ` und Schrittweg `ds`. Beispielhafte Differentialbeziehungen:

- `dx/ds = cos(θ)`
- `dy/ds = sin(θ)`
- `dθ/ds = tan(δ) / L`
- `|δ| <= maxSteerRad`

Für die Integration numerisch hinreichend kleine Schritte (z. B. `ds <= 0,10 m` und Winkeländerung je Schritt höchstens `2°`) verwenden; die Wahl testen und dokumentieren. `headingRad` ist konsistent definiert. **Keine Animation als Ersatz für numerische Berechnung.**

- Fahrzeug-Footprint aus Länge/Breite sowie Radstand und Überhängen um Hinterachsmitte korrekt ableiten. Überhänge müssen bei jeder Pose korrekt mitschwenken.
- Animation: Fahrzeugumriss und Orientierung entlang des berechneten Pfads; Play/Pause/Schieberegler. Der Zeitregler bezeichnet im PoC **Fortschritt**, nicht reale Fahrzeit oder tatsächliche Geschwindigkeit.
- Schleppfläche als **Approximation** der Vereinigungsmenge aller durch das Fahrzeug überstrichenen Flächen berechnen. Dichtes Sampling plus Polygonunion, toleranzbasierte Genauigkeit und Tests; die approximationbedingte Abweichung dokumentieren. Nicht bloß die Fahrlinie puffern.
- Harte Kollisionen anhand des gesamten Fahrzeug-Footprints an Zwischenposen prüfen, nicht nur anhand eines Punktes oder der Hinterachse.
- Zwei Fahrten mit gleichem Input und denselben Einstellungen liefern dasselbe Ergebnis.

### F-05 Automatische Fahrlinienplanung (MUSS, Kernfunktion)

**Ziel:** Nach Hinzufügen einer Insel wird tatsächlich eine neue kinematisch und geometrisch geprüfte Fahrtrajektorie gesucht; das Verschieben von Linienpixeln genügt nicht.

- Implementiere einen deterministischen, begrenzten Suchalgorithmus auf `(x, y, heading)`-Zuständen, bevorzugt **Hybrid A\*** oder vergleichbaren State-Lattice-Planer mit endlichem Lenkwinkelsatz und kollisionsgeprüften Bewegungsprimitiven.
- Für den PoC nur **Vorwärtsfahrt ohne Rangieren**. Keine unphysikalischen Seitwärtsbewegungen, teleportierten Sprünge, spontanen Drehungen auf der Stelle oder ungebundenen Kurvenradien.
- Eingänge: Start-/Zielpose, Fahrzeug, befahrbare Fahrbahnfläche, Szenariohindernisse, Planungsmodus.
- Ausgänge: `success` mit geprüftem Pose-Pfad oder eindeutig markierter Fehlerstatus.
- In `road_only` darf **keine Stelle des Fahrzeug-Footprints** außerhalb der Fahrbahn liegen oder Gehweg/Gebäude/Hindernis schneiden. Wenn die Modellierung lückenhafte Randpolygone enthält, vorab validieren.
- `diagnostic_sidewalk_allowed` darf als ausdrücklich hypothetisches Szenario den Gehweg kreuzen, niemals aber Gebäude oder bauliche Hindernisse. Es wird *nicht* als regelkonform, üblich oder wahrscheinlich bezeichnet. Der Gehwegkontakt ist auszuwerten.
- Zielfunktion (Parametrisierungswerte dokumentieren): Weglänge + Lenkungsänderung/Unruhe + optionaler Gehwegkontakt-Penalty; niemals notwendige harte Kollisionsfreiheit durch weiche Kosten ersetzen. Unterschiedliche Fahrstile erst P1.
- Fehlermeldungen unterscheiden `invalid_input`, `no_path_found` und `timeout`. Ein Suchfehlschlag ist **kein mathematischer Unmöglichkeitsbeweis**.
- Begrenzungen und sinnvolle Defaults: z. B. Suchgitter `0,25–0,5 m`, Winkel-Bins `10–15°`, maximal `10–20 s` Worker-Rechenzeit, Limit für expandierte Zustände. Für robuste Ergebnisse Gitter/Parameter konfigurierbar und in Resultaten protokolliert.
- Planergebnisse gegen feinere unabhängige Kollisionsprüfung des kontinuierlich integrierten Pfads validieren; fehlerhafte Ergebnisse verwerfen.
- Berechnungen im Worker, Fortschrittsstatus, Abbrechen und robuste Behandlung fehlender Lösungen. Keine UI-Blockierung.

**Abnahme:** In einem synthetischen, maßstäblichen L-Kurven-Testfall findet der Planer einen Weg ohne Insel. Nach Einzeichnen einer passend platzierten Insel findet er, **falls geometrisch machbar**, eine andere gültige Route um die Insel, die die volle Fahrzeugfläche von ihr fernhält. Der Testfall muss so gewählt und dokumentiert werden, dass *beide* Varianten tatsächlich lösbar sind. Separater Test: bewusst versperrte Straße liefert keinen vorgetäuschten Erfolg.

### F-06 Szenarien und Eingriffe (MUSS)

- Ein Projekt hat unveränderliche „Bestand“-Basis und mindestens ein bearbeitbares Szenario „Variante A“.
- Im Szenario hinzufügen: `Verkehrsinsel` als Polygon, `Poller` als Punkt mit einstellbarem physischem Durchmesser (für Kollisionsprüfung Kreis als Polygon), `Gehwegschutz` als festes Hindernispolygon oder lineares Element mit Breite.
- Eigenschaften: Position, Geometrie, Beschriftung. Verschieben, Entfernen, Undo/Redo.
- „Bestand und Variante berechnen“ startet **zwei voneinander unabhängige** Planungen mit identischen Manöver- und Fahrzeugparametern.
- Änderungen an Geometrie oder Fahrzeug invalidieren veraltete Simulationsergebnisse klar sichtbar; keine stillschweigend weiter angezeigten Zahlen. Debounce oder expliziter „Berechnen“-Button.

### F-07 Konfliktanalyse und Vergleich (MUSS)

- Anzeige für jede erfolgreiche Fahrt: Weglänge (m), farbig markierte Schleppfläche, Gehwegüberfahrt (ja/nein) und bei diagnostischem Modus ungefähr betroffene Gehwegfläche (m²), kleinster Abstand zu harten Hindernissen (m; Berührung = 0), Kollisionsstatus.
- Fußgänger werden nicht modelliert. „Gehwegüberfahrt“ ist ein **geometrischer Indikator** und keine geschätzte Unfallwahrscheinlichkeit.
- Wenn Berechnung fehlgeschlagen ist: keine erfundenen Nullwerte oder falsch interpretierbaren Prozentvergleiche anzeigen; statt dessen Status und Grund.
- Vorher/Nachher: beide Routen in zwei eindeutigen Farben übereinander oder per Umschalter anzeigen; Legende, konkrete Zahlen, Änderungsrichtung und Warnhinweise.
- Wenn eine Variante im sicheren Modus nur mit Gehwegüberfahrt lösbar erscheint, lautet das sichere Ergebnis „keine gültige Route gefunden“. Eine gesondert gestartete diagnostische Analyse darf den entsprechenden Konflikt zeigen.
- Ergebnistexte nie „sicher“, „verkehrsrechtlich zulässig“ oder „geprüfte Planung“ nennen. Statt dessen „unter diesen Modellannahmen geometrisch kollisionsfrei“.

### F-08 Projektverwaltung / Export (MUSS)

- Projekt erstellen, benennen, automatisch lokal speichern, laden, zurücksetzen.
- Projekt als **versioniertes JSON** exportieren/importieren. Zusätzlich Geometrie als GeoJSON (WGS84) exportierbar, mit Attributen je Feature.
- Simulationsergebnisse dürfen neu berechnet werden; maßgeblich gespeichert werden Inputs und Simulationseinstellungen.
- Demo-Datensatz `Demo-L-Kurve` vollständig offline im Repository mit synthetischer, eindeutiger Geometrie; frei von Rechteproblemen.
- `Rathauskurve Beindersheim` darf als vorgefertigte **Projektvorlage ohne vermessene Geometrie** enthalten sein (Standort/Name, Hinweis, ggf. leerer Zeichenbereich), **nicht** als reale, präzise digitalisierte Bestandsaufnahme auf Grundlage der schematischen Grafik. Ein späteres echtes Ortsprojekt wird aus zulässigem Orthofoto/eigener Erfassung manuell erstellt und als unvermessen gekennzeichnet.
- Fehlerfall: korrupte Datei, falsche Schemaversion, fehlender Speicherplatz, ungültige Koordinaten, Netzwerkfehler bei Kacheln → verständlicher Status, keine verlorenen aktiven Änderungen ohne Warnung.

## 6. Benutzeroberfläche und Ablauf

**Desktop-first** (ca. 1280 px Breite als primärer Anwendungsfall), aber ohne horizontales Überlaufen bei kleineren Fenstern. Die Karte ist der Fokus.

```text
+------------------------------------------------------------------+
| StreetLab | Projekt | Bestand / Variante | Import | Export        |
+------------------+--------------------------------+--------------+
| LINKS            | KARTE                          | RECHTS       |
| Projektbereich   | Fahrbahn/Gehweg/Gebäude        | Fahrzeug     |
| Geometrie-Werkz. | Start- und Ziel-Pfeile         | Fahrmodus    |
| Szenarien        | Insel/Poller                   | Berechnen    |
| Layer            | Fahrlinien + Schleppflächen    | Ergebnisse   |
+------------------+--------------------------------+--------------+
| Unten: Playback / Fortschritt / Fehlermeldungen                  |
+------------------------------------------------------------------+
```

### 6.1 Standard-Workflow

1. Nutzer öffnet App → Demo kann mit einem Klick geladen werden.
2. Karte zeigt editierbare 2D-Flächen mit Legende und Maßstab.
3. Nutzer wählt ein Fahrzeug, setzt Start- und Zielpose, klickt „Bestand berechnen“.
4. Route und Schleppfläche erscheinen, Playback ist bedienbar.
5. Nutzer erzeugt „Variante A“ und zeichnet eine Verkehrsinsel.
6. Klick auf „Beide berechnen“ führt **neue** Berechnung aus; Vergleich zeigt zwei Routen und Differenzen.
7. Nutzer speichert/exportiert und kann nach Reload/import fortfahren.

### 6.2 Bedienprinzipien

- Jede Zeichenfunktion ist als eigenständiger Modus eindeutig aktiv/inaktiv; keine unbeabsichtigte Bearbeitung beim Kartenschwenken.
- Beschriftungen und Einheiten in Deutsch; `m`, `m²`, `°`. Kontrastreiche Farben nicht als alleiniger Informationskanal (Linienmuster/Legende zusätzlich).
- Vor dem Start eines Workers Eingabe prüfen; während Berechnung Status zeigen; Abbrechen möglich.
- Tooltips für „Fahrlinie“, „Schleppfläche“, „kollisionsfrei“, „diagnostischer Modus“; dauerhaft sichtbarer Hinweis „Experimentelles Werkzeug – keine amtliche Verkehrsplanung“.
- Bei unvermessenem Digitalisierungsstand Hinweis: „Ergebnisse nur so genau wie die erfassten Maße und Fahrzeugparameter“.

## 7. Algorithmische Präzisierung

### 7.1 Geometrisches Modell

1. User-Polygone in lokale Meterkoordinaten transformieren, auf Gültigkeit prüfen.
2. Straßengeometrie definiert zulässige Fahrzeugfläche. Gehweg und Gebäude bilden separate Materialklassen.
3. Je Pose den starren Fahrzeug-Footprint geometrisch exakt relativ zum Hinterachsreferenzpunkt erzeugen (rechteckiges Grundmodell).
4. Für Kollisionsprüfung Zwischenpositionen fein interpolieren/integrieren, statt nur Suche-Gitterknoten zu testen.
5. Für Schleppfläche Pose-Footprints dicht vereinigen. Approximationsfehler sichtbar dokumentieren; bei Polygon-Boolean-Fehler nicht stillschweigend eine leere Fläche liefern.

### 7.2 Geometrische Sicherheit ≠ reale Sicherheit

- `road_only` prüft ausschließlich die modellierten Flächen. Das sagt nichts über Sicht, Verkehr, Geschwindigkeit oder Fußgänger aus.
- `diagnostic_sidewalk_allowed` zeigt eine *mögliche* Gehwegüberfahrt, nicht die Wahrscheinlichkeit, dass Menschen so fahren.
- Abstände und Überlappungen sind **modellbasierte** Werte; ihre Genauigkeit ist von Karten- und Eingabedaten abhängig.
- Eine harte Barriere verhindert eine Fahrtrajektorie im Modell; in der Wirklichkeit sind Höhe, Material, Anfahrverhalten und Überfahrbarkeit gesondert zu bewerten.

### 7.3 Qualitäts- und Performancegrenzen

- Ergebnisberechnung im Worker, UI bleibt bedienbar.
- Zielgröße für die kleine Offline-Demo: Routineberechnung in wenigen Sekunden auf normalem Laptop; harte Abbruchgrenze konfigurierbar (Standard höchstens 20 s pro Planung). Kein Echtzeitversprechen für beliebige Geometrien.
- Stabile reproduzierbare Reihenfolge bei Priority Queue / Nachbar-Expansion; keine ungesetzten Zufallszahlen.
- Geometrische Prüfungen mit Toleranzen im Zehntel- bis Zentimeterbereich implementieren, Testschwellen definieren; keine scheinbare Millimetergenauigkeit in der Ergebnisanzeige.
- Vorsicht bei den Randbedingungen: Flächenberührung gilt standardmäßig als Kontakt/0 m Abstand; harte Hindernisse brauchen einen parametrisierbaren Sicherheitsabstand, Standard 0 m, damit Modell und Messwert transparent sind.

## 8. Dateistruktur und Schnittstellen

Die Ordnerstruktur darf äquivalent gestaltet werden, die fachliche Entkopplung ist zwingend:

```text
streetlab/
  README.md
  REQUIREMENTS.md
  package.json
  src/
    app/               # React, Zustand, Layout
    map/               # Leaflet, Geoman, Layer, Projektion
    editor/            # Zeichnen, Modifizieren, Undo/Redo
    domain/            # Typen, Validation, Projekt/Scenario
    simulation/
      vehicle.ts        # kinematische Integration + Footprint
      collision.ts      # Kollisionen und Fahrbahnkontakt
      planner.ts        # Hybrid A* / State Lattice
      sweptArea.ts      # Polygonunion / Approximation
      metrics.ts        # Messgrößen
      worker.ts         # Worker Entry und Cancellation
    persistence/       # JSON / GeoJSON / localStorage
    demo/              # synthetische Demo-L-Kurve
  tests/
    unit/
    integration/
    e2e/
  docs/
    MODEL_ASSUMPTIONS.md
    LIMITATIONS.md
    DEVELOPMENT.md
  .github/workflows/     # optional CI und Pages
```

**Stabile fachliche Schnittstellen** (genaue Signaturen nach Bedarf):

```ts
projectToLocal(project: Project): LocalProject
getVehicleFootprint(pose: Pose, spec: VehicleSpec): PolygonXY
integrateStep(pose: Pose, steerRad: number, dsM: number, spec: VehicleSpec): Pose
isPoseValid(pose: Pose, spec: VehicleSpec, world: LocalWorld, mode: DriveMode): boolean
planPath(request: PlanningRequest, control: CancellationToken): PlanningResult
calculateSweptArea(path: Pose[], spec: VehicleSpec): PolygonXY | null
calculateMetrics(path: Pose[], swept: PolygonXY, world: LocalWorld): Metrics
resolveScenario(project: Project, scenarioId: Id): SurfaceFeature[]
```

Die reine Simulationsengine darf **nicht** auf React, Leaflet, Browser-DOM oder Kartenkacheln zugreifen; Worker-Protokoll typisiert und testbar implementieren.

## 9. Testdaten und verbindliche Akzeptanztests

Testgeometrien ausschließlich synthetisch in **lokalen Metern**, damit die erwarteten Ergebnisse rechnerisch nachvollziehbar sind. Speichere die Fixtures versioniert im Repository. Mindestens:

| ID | Test | Muss-Ergebnis |
|---|---|---|
| T01 | Fahrzeug fährt 10 m geradeaus, Lenkwinkel 0 | Endpose innerhalb 1 cm, Heading unverändert |
| T02 | Konstanter Lenkwinkel und Radstand | Krümmung entspricht `tan(δ)/L`, korrektes Drehvorzeichen |
| T03 | Fahrzeug-Footprint einer bekannten Pose | Abmessungen/Lage/Überhänge innerhalb 1 cm |
| T04 | Geradeaus-Schleppfläche ohne Überlappungsfehler | Fläche entspricht näherungsweise `Breite × (Weglänge + Fahrzeuglänge)`; Toleranz begründen |
| T05 | Hindernis nur im vorderen Überhang, Hinterachse frei | Kollision wird erkannt |
| T06 | Hindernis dicht an Kurveninnenkante | Keine Trajektorie darf es mit irgendeinem Fahrzeugteil schneiden |
| T07 | Synthetische L-Kurve, ohne Insel | `success`, gültiger Pfad, keine Gebäudeberührung |
| T08 | Gleiche L-Kurve mit sinnvoll platzierter Insel | falls testgeometrisch lösbar: `success`, veränderter Pfad, Hindernis frei |
| T09 | Vollständig gesperrte Fahrbahn | `no_path_found` oder `timeout`, nie falsches `success` |
| T10 | Diagnostischer Modus, vorgegebener Gehwegkontakt | `sidewalkTouched=true`, positive Überlappungsfläche |
| T11 | `road_only`, Gehwegkontakt wäre nötig | Kein als gültig gekennzeichneter Pfad mit Gehwegkontakt |
| T12 | Import → Export → Import | Geometrie/CRS/Szenario/Fahrzeugdaten bleiben erhalten |
| T13 | Bestand nach Szenariobearbeitung | Bestandsgeometrie bleibt bitweise bzw. semantisch unverändert |
| T14 | Verschobene Start-/Zielpose außerhalb Fahrbahn | Validierungsfehler und kein Schein-Ergebnis |
| T15 | Worker-Abbruch oder Budgetablauf | UI bleibt bedienbar, sauberer Status |
| T16 | Übertragung einer lokalen Testgeometrie an zwei beliebige Kartenorte | Berechnete metrische Eigenschaften bleiben innerhalb begründeter Projektions-/Numerik-Toleranz erhalten |
| T17 | Browser-E2E: Demo laden → berechnen → Insel hinzufügen → neu berechnen → exportieren/importieren | Durchgängiger Workflow ohne manuelle Codeeingriffe |

**Zusätzlich:** Gegenproben für ungültige Polygone, Selbstüberschneidungen, NaN, leere Fahrbahn, fehlerhafte JSON-Daten, MultiPolygon-Ergebnisse, tangentiale Kollision und fast berührende Ränder. Mindestens ein Integrationsfall muss nachweislich mit einer **neu berechneten** Route funktionieren. Keine Tests, die eine im Voraus gezeichnete Fake-Linie als Simulationsresultat akzeptieren.

## 10. Nichtfunktionale Anforderungen

- **Kosten:** kein Backend, keine Bezahl-API, keine Lizenzkosten zur lokalen Ausführung.
- **Datenschutz:** Projekte bleiben lokal; keine Analytik, kein Tracking, keine automatische Uploadfunktion. Kartendienste sehen technisch bedingte Requests; in `README`/UI transparent machen.
- **Robustheit:** bei Karten-WMS-Ausfall im Editor weiterarbeiten; Simulationsengine ohne Internet testbar.
- **Wartbarkeit:** TypeScript strict; einheitliche Codeformatierung; Module klein und testbar; mathematische Annahmen dokumentiert.
- **Barrierearmut:** semantische Buttons, Tastaturbedienbarkeit der wichtigsten Panels, Farbkennzeichnung plus Text, ausreichend Kontrast; geometrisches Zeichnen primär mausgeführt.
- **Transparenz:** Ergebnisversion, Fahrzeugparameter, Szenarien, Planner-Einstellungen und Warnungen sichtbar bzw. exportierbar.
- **Sicherheit:** keine dynamische Codeausführung aus importierten Projekten, keine unsicheren HTML-Inhalte, Eingaben begrenzen und validieren.
- **Kompatibilität:** aktuelle Desktop-Versionen von Chromium und Firefox, mindestens ein automatisierter Browserlauf.

## 11. Entwicklungsreihenfolge mit Stop/Go-Kriterien

### M1 — App-Skelett und Kartengeometrie

React/Vite/TypeScript, Kartenansicht, lokales metrisches CRS, Editor-Polygone, Import/Export, Demo-L-Kurve, Validierung. **Go nur, wenn** zwei beliebige Orte funktionieren und T12/T13/T16 bestehen.

### M2 — Fahrzeugkinematik und geometrische Analyse

Ein Pkw mit korrekt parametriertem Footprint, manueller Testpfad als Entwicklungsdiagnostik, Animation, Schleppfläche, Kollision und Gehwegkontakt. **Go nur, wenn** T01–T06 und T10 bestehen. Eine händisch vorgegebene Testtrajektorie darf nicht als fertige automatische Planung ausgegeben werden.

### M3 — Automatischer Planer

State-Lattice/Hybrid-A*-Suche im Worker, zwei Modi, Validator, Timeouts und Status. **Go nur, wenn** T07–T11 und T14/T15 bestehen; kein Fake-Rerouting.

### M4 — Szenarien, Vergleich und vollständige UI

Bestand/Variante, Zeichnen von Insel/Poller, Neuberechnung, Messwerte, Warnhinweise, Undo/Redo, lokaler Speicher, E2E. **Go nur, wenn** T17 besteht, Build/Typecheck/Tests grün sind und die App offline mit Demo rechnen kann.

### M5 — Dokumentation und optionaler Luftbild-Layer

README mit Installations-/Betriebsanleitung, Modellannahmen/Grenzen, verwendeten Quellen/Lizenzen, optional RLP-WMS. Deployment-Konfiguration für GitHub Pages. **Go nur, wenn** die Demo auf einer frischen lokalen Installation mit dokumentierten Befehlen funktioniert.

**Entwicklungsdisziplin:** Nach jedem Meilenstein ein kurzes Protokoll (`docs/DEVELOPMENT.md`): implementiert, Tests, offene Limitierungen, nächster Schritt. Nicht von M1 direkt zu komplexen Anhänger-/KI-Funktionen springen.

## 12. Abnahmekriterien für das Gesamtprojekt (Definition of Done)

Das Projekt ist **fertig als PoC**, wenn alle Punkte zutreffen:

- [ ] `npm ci && npm run dev` startet ohne private Schlüssel oder kostenpflichtige Services.
- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e` funktionieren und sind dokumentiert.
- [ ] Karte, Editor, Projektbereich und skalierte Meterkoordinaten sind funktionsfähig.
- [ ] Fahrbahn, Gehwege, Gebäude und Hindernisse werden getrennt modelliert.
- [ ] Der Pkw bewegt sich entsprechend einem geprüften kinematischen Modell.
- [ ] Der vollständige Footprint wird zur Kollisionsprüfung und Schleppfläche herangezogen.
- [ ] Für ein synthetisches Beispiel wird nach Hinzufügen einer Insel eine **neue, gültige** Trajektorie berechnet (nicht nur angezeigt).
- [ ] Bestand und Variante lassen sich mit identischen Eingaben vergleichen.
- [ ] Gehwegkontakt/Abstand/Misserfolg werden technisch korrekt und nachvollziehbar angezeigt.
- [ ] Daten sind nach Neuladen erhalten und als Projektdatei exportierbar/importierbar.
- [ ] Mindestens ein Playwright-E2E-Test demonstriert den vollständigen Ablauf.
- [ ] Keine Behauptungen über reale Unfallwahrscheinlichkeit, Fahrerwahrscheinlichkeit oder Vermessungsgenauigkeit.
- [ ] Alle verwendeten Bild-/Kartendaten sind lizenzkonform eingebunden und attribuiert.
- [ ] Die Dokumentation erklärt Modellgrenzen, Fehlermeldungen und die Bedeutung des diagnostischen Modus.

## 13. Arbeitsanweisung und abschließendes Lieferformat an Codex

1. Lies dieses Dokument vollständig und erstelle zuerst einen knappen Umsetzungsplan mit den Meilensteinen M1–M5.
2. Implementiere **den gesamten P0-Funktionsumfang**, nicht lediglich eine Oberfläche. Priorisiere mechanische Korrektheit vor optischem Feinschliff.
3. Erstelle die synthetische L-Kurven-Demo als reproduzierbares Testprojekt mit begründeten Maßen und lösbarem Insel-Szenario. Eine Karte oder ein reales Orthofoto darf durch die synthetische Demo nicht als vermessen ausgegeben werden.
4. Verwende bewährte Bibliotheken, vermeide Abhängigkeiten, die Gebühren/Schlüssel benötigen. Recherchiere API und Lizenzen vor Verwendung; bei Unsicherheit auf eine dokumentierte freie Alternative ausweichen.
5. Arbeite nacheinander M1 bis M5 ab, prüfe jedes Mal Tests/Typecheck/Build; behebe Fehler vor dem nächsten Meilenstein.
6. Wenn die Planungsheuristik eine Lösung nicht findet, melde den Status ehrlich und dokumentiere Limitierungen. Ersetze niemals eine fehlende Simulation durch geschönte Visualisierung.
7. Liefere am Ende: Quellcode, `README.md`, `docs/MODEL_ASSUMPTIONS.md`, `docs/LIMITATIONS.md`, `docs/DEVELOPMENT.md`, Testfixtures, ausführbare Tests, ein lauffähiges Demo-Projekt und eine Liste der erfüllten/nicht erfüllten Akzeptanztests.
8. Berichte zum Abschluss kurz, wie die Demo zu starten ist, welche P0-Funktionen wirklich funktionieren und was für einen belastbaren Realversuch an der Rathauskurve noch vermessen/validiert werden müsste.

### Minimales Startkommando für den Anwender

```bash
npm ci
npm run dev
```

### Leitprinzip

**StreetLab zeigt geometrisch mögliche und durch Änderungen verhinderte Fahrbewegungen unter expliziten Annahmen. Es ersetzt keine Verkehrsplanung und sagt nicht vorher, wie reale Fahrer sich verhalten.**
