# Grenzen und Einschränkungen

StreetLab ist ein experimenteller Geometrie-PoC und ersetzt weder Vermessung noch Verkehrsplanung, Straßenentwurf oder Sicherheitsprüfung.

## Modell und Eingabedaten

- Die `Demo-L-Kurve` ist künstlich konstruiert. Die Rathauskurve in Beindersheim wurde **nicht** vermessen oder digitalisiert. Für einen Realversuch wären zulässige, aktuelle Geodaten und/oder eine eigene Vor-Ort-Vermessung der Fahrbahnränder, Gehwege, Gebäudefluchten, Hindernisse sowie Start-/Zielposen erforderlich.
- Kartenkacheln sind nur Hintergrund. Sie bestimmen keine simulierbare Fläche. Fehler und Unsicherheit in manuell erfassten Polygonen übertragen sich unmittelbar in das Ergebnis.
- ALKIS RLP liefert amtliche Straßenverkehrs- und Gebäudegeometrien, aber die Kataster-Nutzungsfläche ist nicht zwingend die Asphalt-/Bordkante. Der Dienst weist auf unterschiedliche Vermessungsepochen hin. Der ALKIS-Weg-Layer wird daher nicht pauschal als Gehweg behandelt.
- OSM-Straßen sind oft Mittellinien. Für die Visualisierung gepufferte Breiten beruhen auf Tags oder dokumentierten Annahmen und sind keine vermessenen Fahrbahnränder. Gehweg-Tags können fehlen oder veraltet sein; OSM-Gebäude-Multipolygonrelationen sind im PoC nicht im Importumfang.
- Das Projekt bleibt auf maximal 500 m Durchmesser und ein ebenes 2D-Modell beschränkt. Höhen, Bordsteinhöhen, Oberflächenmaterial, Überfahrbarkeit und tatsächliche Schutzwirkung von Pollern/Inseln werden nicht modelliert.
- Der Pkw ist ein starres, exemplarisches Einspurmodell. Keine Anhänger, Sattelzüge, landwirtschaftlichen Fahrzeuge, Mehrkörperkinematik, Rückwärtsfahrt, Gegenverkehr, Federung oder Reifenschlupf.
- Es gibt kein Geschwindigkeits-, Beschleunigungs-, Sichtlinien-, Reaktionszeit-, Fußgänger-, Unfall- oder Verhaltensmodell. Der Modus „Gehweg erlaubt“ ist nur eine hypothetische Diagnose.

## Algorithmus

- Der deterministische Vorwärts-State-Lattice-Planer ist endlich und beschränkt. Gitterauflösung, Lenkwinkelmenge und Budget können eine mögliche Route übersehen. `no_path_found`/`timeout` beweisen keine geometrische Unmöglichkeit.
- Der Pfad endet innerhalb der im Modellannahmen-Dokument beschriebenen Position-/Heading-Toleranz, nicht zwingend exakt auf dem Zielmarker.
- Kollisionsfreiheit gilt nur für die digitalisierten Flächen, das rechteckige Fahrzeugmodell und die ausgewerteten Schritte. Sie ist keine amtliche Sicherheits- oder Zulässigkeitsbewertung.
- Schleppflächen sind abgetastete Polygonunionen. Boolesche Geometriefehler werden als fehlende Schleppfläche mit Warnung gemeldet; sie werden nicht durch eine Linie-Pufferung ersetzt.
- Gehwegfläche ist der maximale Überdeckungswert einer Pose, keine kumulative Fläche. Clearance ist ein Modellabstand ohne Messunsicherheitsaufschlag.

## Betrieb und Daten

- Die öffentliche OSM-Kachelquelle benötigt Netzwerkzugriff und unterliegt der [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/). Bei Nichterreichbarkeit bleibt die Arbeitsfläche funktional, aber ohne Hintergrundkarte.
- Geometrieimport fragt nach ausdrücklichem Klick ALKIS GeoPortal.rlp oder öffentliche Overpass-Instanzen ab. Die Dienste können zeitweise ausfallen, Anfragen begrenzen oder auslastungsbedingt keine Daten liefern. Dann Fehlermeldung abwarten und später erneut versuchen. Für OSM-Daten ist © OpenStreetMap-Mitwirkende / ODbL 1.0, für ALKIS die im Projekt und in der Oberfläche angezeigte DL-DE-BY-2.0-Attribution zu beachten.
- Optionaler RLP-Orthofoto-WMS und andere Luftbilder sind nicht implementiert. Es werden keine fremden Kartenbilder gespeichert oder als Screenshot exportiert.
- Projektdateien liegen lokal im Browser-`localStorage` und in nutzerinitiierten Downloads. Browser-Löschung, privater Modus, Speicherlimit oder Geräteverlust können lokale Daten entfernen; regelmäßig JSON exportieren.
- Kein Multiuser-Betrieb, keine Cloud, kein automatisches Backup, keine Kollaboration.
