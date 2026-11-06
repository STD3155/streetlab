# StreetLab – Anforderungen für den Straßenentwurf

Stand: 06.11.2026. Dieses Dokument ersetzt die frühere Spezifikation des Fahrzeugsimulators. Maßgeblich ist der aktuelle Benutzerauftrag: eine schlanke Grundlage für Straßenzeichnung und konfigurierbare, nachvollziehbar geprüfte Straßenquerschnitte.

## Ziel

Ein Nutzer wählt einen Projektbereich, lädt ALKIS als Flächengrundlage und entwirft innerhalb eines bestätigten Planungskorridors eine Straße mit definierbarem Querschnitt. Die Anwendung soll anwendbare Anforderungen anhand versionierter, fachlich geprüfter Regeln bewerten. Der detaillierte Ablauf und die Abnahme der nächsten Ausbauschritte stehen in [docs/STRASSENENTWURF_PLAN.md](docs/STRASSENENTWURF_PLAN.md).

## Erforderliche Grundlage

- React, TypeScript strict, Vite, Leaflet, Zustand und ein lokales metrisches Projektionssystem.
- Frei wählbarer Kartenausschnitt, WGS84-Koordinateneingabe, sichtbarer Maßstab und Projektgrenze; maximal 500 m Projektdurchmesser.
- ALKIS-Straßenverkehrsflächen und Gebäude als getrennte, unveränderte Referenz. Nutzungsfläche, Fahrbahn, Verfügbarkeit und Widmung nicht gleichsetzen.
- Manueller Flächeneditor für Fahrbahn, Gehweg, Gebäude, Hindernis und Bordfläche; gültige Polygone, Selektion, Verschieben, Stützpunktbearbeitung und Abstandsmessung.
- Bestand und getrennte Varianten, Layersteuerung und mindestens 20 Undo-Schritte.
- Lokale Speicherung, versionierter JSON-Import/-Export, WGS84-GeoJSON mit Herkunftsangaben. Bestehende Dateien nach nachvollziehbarer Migration weiter nutzbar halten.
- Deutsche Oberfläche, eindeutige Bearbeitungsmodi, zugängliche Formulare und verständliche Fehlermeldungen.
- Keine Bezahl-API, Konten, Datenbank, Cloud oder Geometriegewinnung aus Google-Kartenbildern.

## Nächste Ausbauschritte

1. Bestätigter Planungskorridor und Projektkontext mit getrennten Angaben zur rechtlichen Flächenverfügbarkeit.
2. Bearbeitbarer Straßenverlauf und Querschnittseditor mit beidseitig geordneten Elementen.
3. Reproduzierbar erzeugte Flächen, variable Breiten, Übergänge und Engstellenprüfung.
4. Regelprofile zunächst für innerörtliche Straßen in Rheinland-Pfalz; jede Regel mit Quelle, Ausgabe, Anwendungsbedingungen und fachlichem Prüfstand.
5. Variantenvergleich und exportierbarer Prüfbericht mit nachvollziehbaren Eingaben und Quellen.

Prüfergebnisse unterscheiden „erfüllt“, „nicht erfüllt“, „nicht prüfbar“ und „nicht anwendbar“. Rechtsvorgaben, technische Anforderungen und Empfehlungen getrennt einordnen. Fehlende Nachweise bleiben sichtbar; keine pauschale Zusicherung der Gesetzeskonformität.

## Entfernt und nicht Bestandteil des aktuellen Umfangs

Fahrzeugmodell, Fahrlinienplaner, Schleppflächen, Kollisionssimulation, Manöver und Playback sowie die synthetische Kurvendemo und deren Ortsreferenzen. Ebenfalls entfallen der OSM-Geometrieimport mit geschätzten Breiten und spezielle Insel-/Poller-Simulationswerkzeuge. Allgemeine Hindernisse können weiterhin als Flächen erfasst werden.

## Entwicklungsqualität

Nach Änderungen passende Unit- und Browserabläufe prüfen sowie Typecheck, Lint und Produktionsbuild ausführen. Geometriemodule unabhängig von UI halten. Fachliche Regelwerte erst nach Quellenprüfung implementieren; Nutzungsrechte prüfen. Geplante Funktionen nicht als bereits vorhanden darstellen.
