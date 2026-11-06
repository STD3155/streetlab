# Akzeptanztest-Status

Stand der Implementierung; alle automatisierten Tests laufen lokal ohne Backend. Ein bestandenes synthetisches Modell ist keine Bestätigung realer Geometrie.

| ID | Ergebnis | Automatisierte Abdeckung |
|---|---|---|
| T01 | bestanden | Gerade 10-m-Fahrt, Endpose/Heading und Integrationsschritt |
| T02 | bestanden | Bicycle-Krümmung und positives Drehvorzeichen |
| T03 | bestanden | Footprint-Lage, Länge, Breite und Überhänge |
| T04 | bestanden | Gerade Schleppfläche und Flächen-Toleranztest |
| T05 | bestanden | Hindernis im Frontüberhang bei freier Hinterachse |
| T06 | bestanden | Kurvenpose mit Hindernis am Fahrzeugumriss |
| T07 | bestanden | Automatisch berechnete Route in synthetischer L-Kurve |
| T08 | bestanden | Neu berechnete, abweichende und footprint-geprüfte Inselvariante |
| T09 | bestanden | Querblockade liefert keinen falschen Erfolg |
| T10 | bestanden | Positive diagnostische Gehwegüberdeckung in Geometrie-/Metriktest |
| T11 | bestanden | Gehweg-Start wird im Modus `road_only` zurückgewiesen; Diagnose separat |
| T12 | bestanden | JSON Import/Export erhält Projektion, Geometrie, Szenarien und Fahrzeug |
| T13 | bestanden | Variantverschiebung/-löschung ändert Bestand nicht; Undo stellt wieder her |
| T14 | bestanden | Zielpose außerhalb zulässiger Fläche ist `invalid_input` |
| T15 | bestanden | Playwright bricht Worker ab; Oberfläche bleibt bedienbar |
| T16 | bestanden | AEQD→WGS84→AEQD an zwei weit auseinanderliegenden deutschen Zentren |
| T17 | bestanden | Playwright: Insel zeichnen → Bestand/Variante rechnen → Export/Import |

Zusatztests decken ungültige/Selbstüberschneidungs-Polygone, NaN, Projektgrößenlimit, beschädigtes JSON, falsche Schema-Version, MultiPolygon-Erhalt, Szenarioisolation und vollständige Hindernisprüfung ab.

## Nicht abgenommen

- Kein Rathauskurven-Vermessungsdatensatz oder Vor-Ort-Vergleich liegt vor.
- Keine Orthofoto-/WMS-Quelle wird integriert oder validiert.
- Es gibt keine Abnahme für reale Fahrzeugspezifikationen, Sichtverhältnisse, Höhe, Geschwindigkeit, Fußgänger oder verkehrsrechtliche Zulässigkeit.
