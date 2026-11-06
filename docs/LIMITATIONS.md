# Grenzen des aktuellen Ausbaus

- Der aktuelle Stand dient zur Erfassung und Bearbeitung von Flächengrundlagen. Straßenachsen, parametrisierte Querschnitte und normative Regelprüfung sind noch nicht implementiert.
- ALKIS-Import ist auf die eingebundenen Dienste für Rheinland-Pfalz beschränkt. Nutzungsflächen sind keine automatisch bestätigten Fahrbahnkanten und kein Nachweis öffentlicher Widmung oder rechtlicher Flächenverfügbarkeit.
- Das Modell ist eben und auf 500 m Projektdurchmesser begrenzt. Höhen, Gefälle, Entwässerung, Baugrund und Oberbau werden nicht berechnet.
- Manuelle Flächen können ungenau sein. Kartenbilder bestimmen keine vermessene Geometrie. Der Editor prüft Polygongeometrie, derzeit noch keine vollständige Entwurfskonformität oder Korridoreinhaltung.
- ALKIS-Referenzen sind im Editor gegen Veränderung geschützt. Der Abruf kann bei großen Einzelobjekten, Datenlimits, Dienstfehlern oder fehlender Internetverbindung scheitern.
- Fahrzeuge, Fahrbewegungen, Schleppflächen und Kollisionen werden nicht simuliert.
- Projekte liegen lokal im Browser und können als JSON exportiert werden. Browserdaten können verloren gehen; Projektdateien regelmäßig sichern.
- Alte v1-Projekte werden in v2 übernommen. Die Geometrie und Varianten bleiben erhalten; Fahrzeug- und Manöverdaten gehören nicht zum neuen Format. Erkennbare ALKIS-Referenzen erhalten ihren unveränderten Ausgangsstand, frühere Variantenänderungen an diesen Referenzen entfallen bei der Migration.
- Die Anwendung erteilt keine Genehmigung und liefert aktuell keine Aussage zur Gesetzeskonformität.
