# Plan: Straßenentwurf im ALKIS-Straßenraum

Stand: 06.11.2026. Planung für eine Erweiterung von StreetLab. Nach der anschließenden Bereinigung bestehen Karte, ALKIS-Referenzen, manueller Editor, Varianten und Speicherung; Querschnittsgenerator und Regelprüfung bleiben offen.

## 1. Ziel und Annahmen

Nach Auswahl eines Projektbereichs wird der verfügbare Straßenraum angezeigt. Darin entsteht ein bearbeitbarer Straßenentwurf: Verlauf auf der Karte und abschnittsweise definierter Querschnitt. Änderungen am Querschnitt ändern die Flächen auf der Karte und die Grundlage des Variantenvergleichs. Eine gesonderte Regelprüfung erklärt Konflikte, fehlende Angaben und erforderliche fachliche Entscheidungen.

„Zusammensetzung“ bedeutet zunächst die Aufteilung des Straßenraums in Fahrbahn, Gehwege, Radverkehr, Parken, Sicherheitsräume, Grün und Einbauten. Material kann als Eigenschaft erfasst werden. Ein rechnerischer Oberbau mit Schichtdicken und Entwässerungsbemessung wäre eine eigene Erweiterung.

Erster Geltungsbereich: innerörtliche Straßen in Rheinland-Pfalz, passend zum vorhandenen ALKIS-Import und Beispiel Beindersheim. Andere Bundesländer und Außerortsstraßen benötigen eigene Regelprofile. Bestehendes Limit: höchstens 500 m Projektdurchmesser, Berechnung in lokalen Metern, lokale Speicherung ohne Backend.

## 2. Fachliche Grundlage und bestehender Änderungsbedarf

ALKIS liefert hier Straßenverkehrsflächen und Gebäude. Eine Nutzungsfläche ist weder automatisch eine nachgewiesen öffentlich gewidmete Fläche noch die befahrbare Fahrbahn. Eigentum, Widmung, tatsächliche Nutzung und verfügbare Planungsfläche müssen getrennt erfasst werden. Der Oberbergische Kreis verweist für die Feststellung der Widmung ausdrücklich an die zuständige Kommune: [FAQ Bauen und Kataster](https://www.oberbergkreis.de/obk/themen/planen-und-bauen/bauen-und-wohnen/faq-bauen/index.shtml.de).

Die frühere direkte Übernahme von `AX_Strassenverkehr` als `kind: 'road'` wurde bei der Bereinigung entfernt. `src/map/dataSources.ts` liefert jetzt `street_space`-Referenzen. Ein bestätigter Planungskorridor bleibt als nächster Schritt umzusetzen.

Vorhandene Grundlagen können weiterverwendet werden: Leaflet-Karte, lokale Projektion, Geometrievalidierung, Zustand, Undo/Redo, Bestand/Varianten, JSON/GeoJSON und Tests. Der neue Querschnittsgenerator und die Regelprüfung bleiben von React und Leaflet unabhängig.

## 3. Geplanter Bedienablauf

1. **Projektbereich auswählen.** ALKIS laden, Straßenverkehrsflächen und Gebäude getrennt darstellen; Quelle und Datenstand speichern.
2. **Planungskorridor festlegen.** Zusammenhängende relevante Flächen auswählen und auf den Projektbereich begrenzen. Nachgewiesene Verfügbarkeit und Widmung als eigene Angaben mit Beleg führen; unbekannte Angaben bleiben ausdrücklich unbekannt. Ein Entwurf darf vorläufig bearbeitet werden.
3. **Straßenverlauf vorschlagen.** Eine geeignete vorhandene Mittellinie, beispielsweise aus optionalen OSM-Vektordaten, als gekennzeichneten Vorschlag verwenden. Sie belegt keine Fahrbahnmaße. Fehlt ein eindeutiger Verlauf, setzt der Nutzer Anfang, Ende und nötige Zwischenpunkte. Aus ALKIS allein wird kein vermeintlich sicherer Verlauf erfunden.
4. **Planungskontext angeben.** Straßenfunktion, innerorts/außerorts, Entwurf oder Bestand, angestrebte/angeordnete Geschwindigkeit getrennt, Verkehrsrichtungen, relevante Verkehrsmengen, Bus-/Schwerverkehr, Fuß-/Radverkehr, Zufahrten und Haltestellen. Fehlende Angaben begrenzen die prüfbaren Regeln.
5. **Querschnitt definieren.** Eine Vorlage wählen, Elemente ergänzen/entfernen/umsortieren und Breiten ändern. Links und rechts beziehen sich eindeutig auf die angezeigte Achsrichtung.
6. **Vorschau und Prüfung.** Karte und Querschnitt aktualisieren sich gemeinsam. Eine Station auf der Achse auswählen, dort Breiten und Engstellen sehen, einen Befund anklicken und direkt zur betroffenen Stelle springen.
7. **Varianten vergleichen.** Beispielsweise weniger Parken, Einbahnführung oder anderer Radverkehrsentwurf. Jede Variante besitzt eigene Entwurfsparameter und Prüfergebnisse.
8. **Export.** Entwurf, Annahmen, Quellen, Regelversionen und Befunde gemeinsam exportieren.

## 4. Querschnittseditor

Beispiel für eine Elementfolge, ausdrücklich ohne vorgegebene allgemeingültige Breiten:

`Gehweg | Grün-/Sicherheitsraum | Radverkehr | Fahrstreifen → | Fahrstreifen ← | Parken | Gehweg`

| Element | Einstellbare Eigenschaften |
| --- | --- |
| Fahrstreifen | Breite, Fahrtrichtung, zugelassene Fahrzeugarten |
| Gehweg | Gesamtbreite, nutzbare lichte Breite, Einbauten |
| Radverkehr | Führungsform, Richtung, Breite, bauliche oder markierte Trennung |
| Parken/Liefern | Anordnung, Breite, Nutzung, zeitliche Angaben, erforderliche Sicherheitsräume |
| Trenn-/Sicherheitsraum | Breite, Funktion, Zuordnung, physische Ausgestaltung |
| Grün/Ausstattung | Breite, Bäume und weitere Hindernisse |
| Bord/Insel/Poller | Geometrie, relevante Höhenangaben, explizite Hinderniseigenschaft |

Breiten können abschnittsweise variieren. Übergänge erhalten eigene Längen und Stationen. Die Oberfläche zeigt benötigte Gesamtbreite und lokal verfügbare Breite sowie nicht zugeordnete Restflächen. Lichte Breite ist von Gesamtbreite und Sicherheitsräumen zu unterscheiden; Flächen dürfen nicht doppelt gezählt werden.

Ein Straßenentwurf ist zunächst eine Variante. Eine Übernahme als tatsächlicher Bestand erfordert eine bewusste Kennzeichnung der Datengrundlage; automatisch erzeugte Flächen werden nicht als vermessen ausgegeben.

## 5. Geometrische Erzeugung

- Straßenachse als gerichtete Linie im vorhandenen lokalen Metersystem speichern; Stationierung entlang ihrer Länge berechnen.
- Aus geordneten Querschnittselementen seitliche Versätze und Streifenflächen erzeugen. Kurven, Übergänge und unterschiedliche linke/rechte Breiten berücksichtigen.
- Robuste Polygonoperationen mit vorhandenen freien Bibliotheken verwenden; Löcher, MultiPolygone und getrennte Teilflächen erhalten.
- Entwurfsflächen vollständig gegen Planungskorridor, Gebäude und bekannte Hindernisse prüfen. Engstellen entlang der gesamten Strecke untersuchen; adaptive Verdichtung an Kurven und Breitenwechseln plus flächenhafte Prüfung.
- Überstehende Flächen sichtbar als Konflikt darstellen. Kein stilles Abschneiden oder Verkleinern auf eine vermeintlich passende Breite.
- Bei Selbstüberschneidungen enger Versatzkurven einen konkreten Geometriebefund liefern; keine fehlerhaften Flächen übernehmen.
- Kreuzungen und Einmündungen zunächst als gesondert zu bearbeitende Anschlussbereiche markieren. Dort keine Regelkonformität aus einem einfachen Streifenquerschnitt ableiten.
- Eine Änderung erzeugt genau eine nachvollziehbare Bearbeitung und verwirft veraltete Regelbefunde.

## 6. Regelprüfung und gesetzliche Anforderungen

Die Funktion soll regelgestütztes Planen ermöglichen. Eine einzelne Mindestbreitentabelle reicht dafür nicht: Anwendbarkeit hängt von Ort, Straßenfunktion, Verkehr, Ausgestaltung und eingeführten Vorschriften ab.

Für Stadtstraßen sind insbesondere RASt und ihre ergänzenden Handlungsanleitungen zu berücksichtigen; der FGSV-Verlag verweist ausdrücklich auf diese Ergänzung bis zur Neufassung: [RASt](https://www.fgsv-verlag.de/rast). Ergänzend kommen je nach Entwurf Rad- und Fußverkehr, ruhender Verkehr sowie Klimaempfehlungen hinzu: [ERA](https://www.fgsv-verlag.de/era), [E Klima / FGSV](https://www.fgsv.de/aktuelles/news-details/steckbriefe-zur-e-klima-ab-sofort-verfuegbar). Für die Barrierefreiheit ist unter anderem der Gegenstand der [DIN 18040-3](https://www.dinmedia.de/de/norm/din-18040-3/223713891) relevant. Die Produktseiten belegen den Themenumfang, ersetzen aber keinen geprüften Zugriff auf die konkreten Regeltexte.

Geometrische Gestaltung und behördliche Anordnung werden getrennt bewertet. Über Verkehrszeichen und Verkehrseinrichtungen entscheiden die zuständigen Behörden nach [§ 45 StVO](https://www.gesetze-im-internet.de/stvo_2013/__45.html). Eine passende Geometrie liefert diese Anordnung nicht automatisch.

### Regelkatalog

Jede implementierte Regel erhält:

- stabile ID, Version und fachlichen Prüfstand;
- Quelle mit Ausgabe, Fundstelle und Link;
- Geltungsbereich und benötigte Eingaben;
- Einordnung als Rechtsvorgabe, Verwaltungsvorschrift, technisches Regelwerk oder Empfehlung;
- Beleg ihrer Verbindlichkeit für das gewählte Projektprofil, soweit einschlägig;
- Prüfbedingung, Maßeinheit und mögliche Ausnahmebedingungen;
- verständliche Meldung und mögliche Entwurfsänderungen.

Technische Empfehlungen werden nicht pauschal zu gesetzlichen Verboten. Ausnahmen bleiben dokumentierte Fachentscheidungen; ein Nutzerkommentar beseitigt keinen Befund zu einer zwingenden Vorgabe. Vollständige Normtexte oder Tabellen werden nicht ungeprüft in die freie Anwendung kopiert. Nutzungsrechte für eine maschinenlesbare Umsetzung und Veröffentlichung sind vor Aufnahme zu klären. Der kostenlose Grundbetrieb bleibt erhalten; nicht verfügbare Regelmodule werden als fehlend ausgewiesen.

### Ergebnisdarstellung

Zwei getrennte Angaben pro Prüfung:

- **Ergebnis:** erfüllt, nicht erfüllt, nicht prüfbar oder nicht anwendbar.
- **Bedeutung:** zwingende Vorgabe, technische Anforderung oder Empfehlung, jeweils im Projektkontext belegt.

Die Gesamtansicht zeigt geprüfte Regeln, fehlende Voraussetzungen und offene fachliche Nachweise. „Keine Verstöße in den implementierten Prüfungen“ darf nicht zu „gesetzeskonform“ verkürzt werden. Fehlende Daten werden niemals als bestandene Prüfung gezählt. Bei Geometrie- oder Regeländerungen wird der Bericht ungültig, bis erneut geprüft wurde.

Erste Prüfungen: gültige und konfliktfreie Flächen, Korridoreinhaltung, tatsächlich nutzbare Breiten, notwendige Trenn-/Sicherheitsräume, geeignete Kombinationen und abschnittsweise Kontinuität. Konkrete normative Grenzwerte werden erst nach Quellen- und Anwendungsprüfung eingetragen. Sicht, Höhen/Neigungen, Entwässerung, Tragfähigkeit und weitere nicht modellierte Anforderungen erscheinen als offene Nachweise, soweit für das Projekt erforderlich.

## 7. Datenmodell und Einbindung

Vorgeschlagene neue fachliche Objekte:

| Objekt | Zweck |
| --- | --- |
| `ReferenceDataset` | Unveränderte importierte Geometrie, Quelle, Abruf-/Datenstand, Lizenz, Abdeckungsstatus |
| `PlanningCorridor` | Nutzbare Planungsgrenze; getrennte Nachweise zu Verfügbarkeit und Widmung |
| `RoadDesign` | Achse, Kontext, Abschnitte und zugehörige Variante |
| `CrossSectionElement` | Typ, Reihenfolge, Richtung, Breiten und Eigenschaften je Abschnitt |
| `GeneratedSurface` | Abgeleitete Fläche mit Entwurfs-, Abschnitts- und Elementreferenz |
| `RuleProfile` / `RuleDefinition` | Anwendungsprofil und versionierte Prüfregeln |
| `CheckReport` | Befunde mit Station/Geometrie, Quellen und geprüfter Eingaberevision |

Entwurfsparameter sind die bearbeitbare Quelle; Flächen werden daraus reproduzierbar erzeugt. Direkte Änderungen an erzeugten Polygonen sind nur über explizite Umwandlung in manuelle Geometrie möglich, damit Parameter und Karte nicht auseinanderlaufen.

Geplante Dateien:

- `src/domain/types.ts`: Referenzen, Korridor, Entwurf und Schema v2.
- `src/map/dataSources.ts`: ALKIS als Referenz statt pauschaler Fahrbahn.
- `src/design/`: Achse, Stationierung, Querschnitt und Flächengenerator.
- `src/rules/`: Regelprofile, Quellenkatalog, Prüfer und Berichte.
- `src/app/`: Bearbeitungszustand, Querschnittseditor und Befundliste.
- `src/map/StreetMap.tsx`: Korridor-, Achsen-, Streifen- und Befunddarstellung.
- `src/persistence/projectIO.ts`: Validierung, Migration und Export der neuen Objekte.

Alte v1-Projekte bleiben importierbar. Frühere ALKIS-`road`-Flächen werden anhand ihrer Herkunft als Referenz eingeordnet und als noch nicht bestätigte Fahrbahn gekennzeichnet. Manuelle und synthetische Fahrbahnflächen bleiben erhalten. Ohne eindeutige Herkunft keine automatische fachliche Neubewertung. Vorhandene gespeicherte Projekte werden nicht still überschrieben.


## 8. Umsetzung in Meilensteinen

| Schritt | Ergebnis | Abnahme |
| --- | --- | --- |
| M1: Daten und fachlicher Geltungsbereich | ALKIS-Referenz, Korridor, Kontext, Schema v2 mit Migration; Quellenmatrix für das RLP-Innerortsprofil | ALKIS-Fläche ist nicht automatisch Fahrbahn; alte Projekte bleiben lesbar; Umfang und fehlende Regeln sind sichtbar |
| M2: Achse und einfacher Querschnitt | Bearbeitbare Achse, Vorlage für einen durchgehenden Abschnitt, Fahrbahn/Gehwege und Breitenbilanz | Änderung einer Breite ändert Karte und Querschnitt konsistent; nicht passende Entwürfe werden markiert |
| M3: Abschnitte und komplexere Geometrie | Kurven, variable Breiten, Übergänge, Radverkehr/Parken/Grün, Engstellen | Synthetische Gerade, L-Kurve und Verengung funktionieren; Löcher und Mehrteiligkeit werden erhalten |
| M4: Versionierte Regelprüfung | Fachlich geprüfter erster Regelsatz, Quellenanzeige, differenzierte Ergebnisse | Unbekannte Voraussetzungen verhindern ein positives Ergebnis; Empfehlungen und zwingende Regeln sind unterscheidbar |
| M5: Varianten und Export | Vollständiger Ablauf mit Undo/Redo, getrennten Varianten und Bericht | Browserablauf von Bereichsauswahl bis Reimport; Bestand und ALKIS-Referenzen unverändert |

Der erste nutzbare Ausbau ist M1–M2 mit geometrischer Prüfung. Ein normativ bewerteter Entwurf wird erst mit dem geprüften Regelsatz aus M4 angeboten. Ein realistischer Termin hängt insbesondere vom Zugang zu Regelquellen und deren fachlicher Prüfung ab.

## 9. Entscheidende Prüfbeispiele

1. ALKIS enthält eine breite Verkehrsfläche: Sie wird als Referenz angezeigt und nicht automatisch als Fahrbahn übernommen.
2. Eine synthetisch 12 m breite Fläche erhält Elemente mit zusammen 13 m Breite: Konflikt mit Position und Fehlbetrag; kein automatisches Verkleinern.
3. Ein nur örtlich schmalerer Abschnitt oder ein Gebäudevorsprung wird erkannt, obwohl der Querschnitt an Anfang und Ende hineinpasst.
4. Eine Kurve erzeugt gültige, zusammenhängende Streifen; selbstschneidende Versätze werden abgewiesen.
5. Ein erforderlicher Kontextwert fehlt: betroffene Regel ist „nicht prüfbar“, nicht „erfüllt“.
6. Eine Empfehlung wird unterschritten: Empfehlungskonflikt statt unbelegter Gesetzesverstoß.
7. Änderung eines Gehwegs aktualisiert Entwurfsflächen und verwirft alte Regelbefunde; ALKIS-Herkunftsdaten und Bestand bleiben unverändert.
8. Export/Reimport erhält Achse, Abschnitte, Varianten, Quellen und Regelversionen. Überholte Berichte erscheinen nicht als aktuell.
9. Ein vorläufiger Entwurf ohne geklärte Widmung bleibt bearbeitbar, erhält aber keine Aussage zur bestätigten rechtlichen Flächenverfügbarkeit.
10. Ein geometrisch passender Querschnitt wird nicht als Nachweis für eine behördliche Anordnung oder vollständige Barrierefreiheit ausgegeben.

## 10. Bewusst nachgelagerte Erweiterungen

Automatischer Knotenpunktentwurf, Sichtdreiecke, Höhenmodell und vollständige Barrierefreiheitsprüfung, entwässerungstechnische Bemessung, Oberbau/Tragfähigkeit, eine gegebenenfalls später separat ergänzte Befahrbarkeitsprüfung sowie zusätzliche Länder- und Außerortsprofile. Sobald eine dieser Prüfungen für ein Projekt notwendig ist, muss ihr Fehlen im Bericht sichtbar sein.
