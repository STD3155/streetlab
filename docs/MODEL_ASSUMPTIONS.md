# Modellannahmen

## Koordinaten und Geometrie

- Kartenkoordinaten/GeoJSON sind WGS84 `[Längengrad, Breitengrad]`; Planung, Flächen und Maße werden ausschließlich in Metern eines projektzentrierten WGS84-AEQD-Systems geführt. Das Zentrum ist Bestandteil der Projektdatei.
- Der Arbeitsbereich ist räumlich klein: maximale Projektdurchmesser 500 m. Das lokale System ist für diesen PoC ausreichend; Maße sind keine Vermessung.
- Feature-Geometrien sind geschlossene Polygonringe. Selbstüberschneidungen werden vor Import und Berechnung abgewiesen. Koordinaten sind endliche Zahlen.
- Fahrbahn ist die erlaubte Fläche im Modus `road_only`; der gesamte Fahrzeugumriss muss darin liegen. Gehwege sind dort nicht befahrbar. Gebäude und harte Hindernisse sind stets unbefahrbar. `curb` ist nicht automatisch eine harte Barriere.
- Im `diagnostic_sidewalk_allowed`-Modus wird die Vereinigung aus Fahrbahn und Gehwegen als befahrbare Prüffläche verwendet. Gehwegkontakt bleibt ein geometrischer Konflikt und wird nicht als wahrscheinliches Fahrverhalten interpretiert.

## Externe Geometriequellen

- **ALKIS RLP:** Straßenverkehrsflächen (`AX_Strassenverkehr`) werden als Straßen-Polygone und Gebäude (`GebaeudeBauwerk`) als harte Hindernisse übernommen. Diese offiziellen Katasterflächen sind nicht zwingend identisch mit der Asphalt-/Bordkante. Der ALKIS-`Weg`-Layer wird nicht pauschal als Gehweg klassifiziert. Die Dienstmetadaten nennen monatliche Aktualität, warnen jedoch vor unterschiedlichen Entstehungsepochen und unvermeidlichen Messungenauigkeiten.
- **OpenStreetMap:** Straßen-Ways werden aus einem expliziten Breiten-Tag, `lanes × 3 m` oder einer dokumentierten `highway`-Klassenannahme gepuffert. OSM-Gehwege werden nur importiert, wenn sie explizit getaggt sind. Straßenlinien-Puffer stellen keine gemessenen Straßenränder dar.
- Der jeweilige externe Objekt-Identifier, einfache Attribute, Datenquelle und Breitenherkunft bleiben am importierten Feature erhalten. Der Projekt-Hinweis nennt die erforderliche Quellenangabe. Externe Dienste werden nur nach Nutzeraktion abgefragt; Antworten sind auf kleine Ausschnitte begrenzt.

## Pkw-Referenzmodell

Die Demo-Vorlage verwendet diese ausdrücklich exemplarischen Modellwerte (keine amtliche Standardisierung):

| Parameter | Wert |
|---|---:|
| Länge | 4,50 m |
| Breite | 1,80 m |
| Radstand | 2,70 m |
| Frontüberhang | 0,90 m |
| Hecküberhang | 0,90 m |
| maximaler Einzelspur-Lenkwinkel | 0,55 rad (ca. 31,5°) |

Die Referenz ist die **Mitte der Hinterachse**, Heading 0 zeigt nach Osten und positiver Heading dreht gegen den Uhrzeigersinn. Der starre Footprint ist ein Rechteck von `-Hecküberhang` bis `Radstand + Frontüberhang`, jeweils `Breite / 2` seitlich.

## Kinematik und Planung

- Langsame Vorwärtsfahrt wird mit dem kinematischen Einspur-/Bicycle-Modell abgebildet. Für konstanten Lenkwinkel gilt die Krümmung $\kappa = \tan(\delta)/L$.
- Kreisbögen werden numerisch mit höchstens 0,10 m Integrationsschritt und höchstens 2° Heading-Änderung pro Schritt ausgewertet.
- Der deterministische State-Lattice-A* nutzt 0,5 m Positionsgitter, 24 Heading-Bins, fünf Lenkwinkelstufen und Vorwärtsprimitiven von max(1,0 m, 2,5 Gitterzellen). Rangieren und Rückwärtsfahrt sind nicht enthalten.
- Suchbudget: 45.000 expandierte Zustände oder 12 s je Planung. Beim Erreichen des Budgets wird `timeout` gemeldet. Die Zielpose darf innerhalb der Gittertoleranz (maximal etwa 0,55 m und 9° bei Standardwerten) angenähert werden; das Ergebnis warnt bei sichtbarer Abweichung.
- Während der Suche sowie in einer feineren unabhängigen Prüfung werden vollständige Fahrzeugumrisse geprüft. Berührung einer harten Barriere gilt als Kollision.
- Ergebnisse sind deterministisch für gleiche Eingaben, Projektparameter und Softwareversion.

## Schleppfläche und Kennzahlen

- Für die Schleppfläche werden Footprints entlang der Pfadposen in ungefähr 0,35-m-Abständen dicht vereinigt. Turf.js führt die Polygonunion aus; alle getrennten Komponenten eines MultiPolygons bleiben erhalten.
- Es handelt sich um eine Abtastungsapproximation der kontinuierlichen Bewegung, nicht um eine exakte kontinuierliche Flächenhülle. Die Abweichung hat keine allgemeine formale Schranke.
- Weglänge ist die Summe der Pfadschritte. Hindernisabstand ist der kleinste euklidische Randabstand entlang der geprüften Pfadposen; Kontakt ist 0 m.
- Gehwegkontakt ist binär geometrisch. Die angezeigte Gehwegüberdeckungsfläche ist die maximale Überdeckung einer einzelnen geprüften Pose; sie ist ausdrücklich nicht die aufsummierte oder über die Fahrt einzigartige Gehwegfläche.
- Playback zeigt den normierten Fortschritt entlang des berechneten Pfads, keine Zeit, Geschwindigkeit oder Beschleunigung.

## Szenarien

Jede Variante erbt den Bestand und speichert explizite Hinzufügungen, entfernte Basis-IDs und geänderte Kopien. Bestands- und Variantenplanung verwenden dieselbe Pose und Fahrzeugvorlage, laufen jedoch unabhängig.
