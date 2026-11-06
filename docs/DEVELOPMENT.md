# Entwicklungsstand

## Reduktion auf den Straßenentwurf · 06.11.2026

Der frühere Fahrzeugsimulator wurde auf die benötigte Grundlage für Straßenentwurf und Regelprüfung reduziert.

Erhalten: Karte, lokale metrische Projektion, Projektbereich, ALKIS-Import, allgemeiner Flächeneditor, Varianten, Undo/Redo und JSON/GeoJSON.

Entfernt: Fahrzeugkinematik, Pfadplaner und Worker, Schleppflächen, Kollisionskennzahlen, Start/Ziel, Fahrzeugparameter, Playback, Kurvendemo und Ortsreferenzen. Der OSM-Flächenimport mit angenommenen Breiten entfällt; die OSM-Hintergrundkarte bleibt erhalten. Das Turf-Gesamtpaket wurde durch die benötigten Einzelmodule ersetzt.

ALKIS-Straßenverkehrsflächen werden als unveränderbare Straßenraumreferenz geführt. Ein erneuter Import erhält manuelle Geometrie und Varianten. Das neue Projektformat v2 liest frühere v1-Dateien und nutzt einen getrennten lokalen Speicherschlüssel. Varianten werden für die Kartendarstellung aufgelöst; ihre Auswahl bleibt auch nach Undo gültig.

Querschnittsgenerator und fachlicher Regelkatalog sind noch nicht implementiert. Die weiteren Meilensteine stehen in [STRASSENENTWURF_PLAN.md](STRASSENENTWURF_PLAN.md).

Prüfung der Bereinigung: Typecheck, Lint, 12 Unit-/Integrationstests, drei Playwright-Browserabläufe und Produktionsbuild. Die Browserabläufe verwenden kontrollierte ALKIS-Antworten; sie testen keine aktuelle Verfügbarkeit des öffentlichen Dienstes. Durch das Entfernen der nicht mehr benötigten Geometrie- und Simulationsabhängigkeiten entfallen 143 Pakete.
