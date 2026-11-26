# Changelog

## 3.0.1 – NAS-Speicher, PDF-Anzeige, Feinschliff

- **Dokumente auf dem NAS (SMB):** Unter Dokumente → Speicherort (Server-Symbol) oder Einstellungen → System lässt sich eine Netzwerkfreigabe einbinden, z. B. `dokumente/famyhub` auf der Synology. Fehlende Ordner werden angelegt. „Speichern“ prüft vorher mit einem echten Schreibtest. Bereits vorhandene Dokumente lassen sich per Knopfdruck auf das NAS verschieben und auch wieder zurückholen.
- **Behoben:** Die bisherige SMB-Anbindung konnte nie funktionieren. Die verwendete Bibliothek nutzte das veraltete NTLMv1 mit DES, das Node 22 nicht mehr kann, und jeder Verbindungsversuch brachte den Server zum Absturz. Jetzt wird `smbclient` (Samba, SMB 2/3, NTLMv2) verwendet. Es ist im Docker-Image enthalten.
- **PDFs werden angezeigt:** Handy-Browser können PDFs nicht in einem eingebetteten Rahmen darstellen. Die Vorschau zeichnet die Seiten jetzt mit PDF.js selbst, dazu gibt es eine Vollbild-Ansicht.
- **Übersicht:** Neuer Kopfbereich mit Begrüßung, Datum, Wetter, eigenem Status und Kurzinfos: nächster Termin, Essen, offene Aufgaben, Einkauf.
- **Behoben:** Lange Projektnamen, Links oder Aufgaben machten die Seite breiter als den Bildschirm, wodurch auch die untere Leiste verrutschte. Außerdem zoomte das iPhone beim Antippen kleiner Eingabefelder hinein.

## 3.0.0 – Komplett neue Oberfläche

Die App-Oberfläche wurde von Grund auf neu geschrieben. Backend, Datenbank und alle Daten bleiben unverändert.

- **Ein einheitliches Bedienkonzept** in allen 17 Modulen: große Titel, gruppierte Listen, Bearbeiten immer im selben Blatt (unten auf dem Handy, als Fenster auf Tablet/PC), „Sichern“ oben rechts, Löschen immer unten in Rot mit Rückfrage.
- **Eigener Komponentenbaukasten** statt hunderter Einzel-Styles: Listenzeilen, Schalter, Segment-Umschalter, Aktionsblätter, Hinweise und Bestätigungen sehen überall gleich aus und reagieren gleich.
- **Übersicht:** Wetter, Familie mit Status, Termine, Essen heute, Aufgaben (direkt abhakbar), Einkauf und Chat. Unter „Anpassen“ ein- und ausblendbar.
- **Kalender:** Monatsansicht mit Tagesliste und eine Listenansicht für 90 Tage. Termine, Geburtstage, Serien, Person und Farbe. Abonnierte iCal-Kalender und der Abo-Link für das Handy sind direkt im Kalender einstellbar.
- **Einkauf:** Mehrere Artikel auf einmal (mit Komma getrennt), Kategorien, Erledigtes eingeklappt.
- **Essensplan:** Wochenraster, mehrere Vorschläge pro Mahlzeit mit Abstimmung, Rezept-Vorschläge beim Tippen, Zutaten mit einem Tipp auf die Einkaufsliste.
- **Rezepte** mit Portionsrechner, **Projekte** mit Fortschrittsring, **Urlaub** mit Countdown und Packliste, **Verträge** mit Kündigungsfristen und Kosten pro Person.
- **Tresor:** Sperrt sich nach 5 Minuten ohne Bedienung automatisch. Passwort-Generator und Stärkeanzeige. Import und Export im Bitwarden-Format. Die Verschlüsselung ist unverändert, alle bisherigen Einträge bleiben lesbar.
- **Einstellungen** wie auf dem iPhone: Profil, Sicherheit (Passwort, 2FA), Darstellung (Hell/Dunkel/Automatisch, Module sortieren und ausblenden), Mitteilungen, Familie (Mitglieder, Rechte pro Modul, Mitteilungen pro Person, Einladungscode teilen) und System.
- **Einladungslink:** `https://…/?invite=CODE` öffnet direkt die Registrierung mit eingetragenem Code.
- **Behoben (Server):** Konnte die Texterkennung (OCR) ihre Sprachdaten nicht laden, stürzte der ganze Server beim Hochladen eines Fotos ab. Jetzt gibt es einen gemeinsamen OCR-Worker mit Zeitlimit. Die Sprachdaten werden in `data/tessdata` zwischengespeichert.
- Entfernt: die ungenutzte „App-PIN“ im Profil. Sie wurde nirgends abgefragt.

## 2.1.0 – Neues Design im iOS-Stil

- **Neue Optik in allen Modulen:** iOS-Graustufen, weiße Karten ohne dicke Rahmen, ruhigere Schrift (Systemschrift bzw. Inter, im Container mitgeliefert, keine Google-Fonts-Anfrage), weichere Schatten und keine bunten Verläufe mehr.
- **Farben:** Dunkelblau `#2B3E6A` als Hauptfarbe, Hellblau `#1AA7EC` als Akzent.
- **Navigation:**
  - Handy: Tab-Leiste unten (Übersicht, drei Module, „Mehr“). „Mehr“ öffnet ein Blatt mit allen Bereichen, den Einstellungen und Abmelden. Reihenfolge und Sichtbarkeit lassen sich dort bearbeiten.
  - Tablet und PC: Seitenleiste mit farbigen Symbolen wie in den iPad-Einstellungen.
- **Dark Mode:** echtes Schwarz und dunkelgraue Karten. Neue Option **„Automatisch“** (Standard), die der Geräte-Einstellung folgt.
- **Dashboard:** Essens- und Wetter-Widget neu gestaltet.
- **Behoben:** Das Dashboard sprang beim Laden nach unten, weil das Chat-Widget automatisch fokussiert wurde. Auf dem Handy öffnete sich dadurch außerdem die Tastatur.
- **Behoben:** Die Kalender- und Dokument-Leisten verdeckten auf dem Handy die neue Tab-Leiste.
- **Login-Sperre:** Erfolgreiche Anmeldungen zählen nicht mehr gegen das Limit.

## 2.0.0 – Aufgeräumte und abgesicherte Version

### Sicherheit (kritisch)
- **Anmeldeschlüssel:** Der JWT-Schlüssel stand als bekannter Standardwert in `docker-compose.yml`. Damit konnte sich jeder ein Admin-Token selbst ausstellen. Jetzt gilt der Wert aus `.env`, sonst wird ein zufälliger Schlüssel erzeugt und gespeichert. Bekannte Standardwerte werden abgelehnt.
- **Offene Registrierung:** Jeder konnte sich registrieren, wurde dabei Admin und bekam System-Rechte: Export aller Familien, Backup-Import, Code-Update. Die Registrierung ist jetzt standardmäßig aus. System-Funktionen sind dem Admin der ersten Familie vorbehalten.
- **Uploads waren öffentlich:** `/uploads` war ohne Anmeldung abrufbar, auch eingescannte Dokumente unter `/uploads/documents`. Jetzt braucht jeder Abruf eine Anmeldung, die Datei muss zur eigenen Familie gehören, und Dokumente gibt es nur noch über die Dokumenten-API.
- **Zugriff auf fremde Daten:** Termine, Einkaufsartikel, Timeline-Beiträge, Wunschlisten-Reservierungen, Dokument-Tags und Galerie-Fotos ließen sich über die ID auch in **anderen Familien** ändern oder löschen. Alle Endpunkte prüfen jetzt die Familienzugehörigkeit.
- **„Private“ Dokumente und Tresor-Einträge** waren für die ganze Familie sichtbar. Jetzt sieht sie nur noch der Besitzer.
- **SMTP-Passwort:** Es wurde an alle Familienmitglieder ausgeliefert. Jetzt wird es nie mehr an den Browser gesendet.
- **2FA-Umgehung:** Das Zwischen-Token aus dem 2FA-Schritt wurde als vollwertige Anmeldung akzeptiert.
- **Backup-Import:** Er entpackte beliebige Pfade ins Programmverzeichnis, womit sich der Server-Code überschreiben ließ. Jetzt werden nur noch `data/family.db` und `uploads/**` übernommen, nach Prüfung.
- **Code-Update per ZIP** wurde entfernt. Updates laufen über das Docker-Image.
- **Datei-Uploads:** Nur noch Bilder und PDFs (bei Dokumenten zusätzlich TXT/TIFF), mit Größenlimit und zufälligen Dateinamen. Vorher war z. B. HTML möglich, also gespeichertes XSS.
- **Anmeldung:** Schutz gegen Passwort-Raten (Rate-Limit) für Login, 2FA und Passwort-Reset. Nach einer Passwortänderung werden alle anderen Geräte abgemeldet. Rollen und Rechte werden bei jeder Anfrage frisch aus der Datenbank gelesen statt aus einem bis zu 365 Tage alten Token.
- **Modul-Berechtigungen:** Abgeschaltete Module wurden weder im Backend noch in der Oberfläche durchgesetzt, und der Berechtigungs-Dialog zeigte immer „alles an“. Beides behoben.
- Das Token steht nicht mehr in Dokument-Links (`?token=`). Dateien werden über ein httpOnly-Cookie geladen, das nur für Lesezugriffe gilt.
- Sicherheits-Header (helmet), CORS nur bei Bedarf, Container läuft nicht als root.

### Fehler behoben
- **Chat:** Es wurden die *ältesten* 100 Nachrichten geladen. Ab 100 Nachrichten erschienen neue nicht mehr.
- **Kalender:** „Termin bearbeiten“ speicherte nach `/calendar/undefined`, Änderungen gingen verloren. Beim Bearbeiten einer Serie wurde außerdem der Serienstart verschoben.
- **Neuinstallation:** Mehrere Module stürzten ab, weil Tabellen oder Spalten fehlten (`vacation_items` war als „vacuum_items“ angelegt, `dream_destinations`, `events.location`/`image_url`) oder Abfragen die nicht vorhandene Spalte `users.name` nutzten (Verträge, Rezepte, Wunschlisten, Galerie, Traumziele).
- **Bestehende Datenbank:** Neue Mitglieder anlegen schlug fehl („NOT NULL constraint failed: users.name“). Die Spalte `last_active` wurde wegen eines SQL-Fehlers nie angelegt, deshalb funktionierte „Gerade online“ nicht.
- **Passwort vergessen:** Die Oberfläche rief Endpunkte auf, die es nicht gab. Sie sind jetzt umgesetzt, mit Code per E-Mail.
- **PDF-Texterkennung:** Sie funktionierte nie, weil sich die API von `pdf-parse` 2.x geändert hatte. Der Fehler wurde verschluckt, die Volltextsuche fand in PDFs nichts.
- **Dokument-Upload:** Die Antwort kam, bevor die Datei verschoben war, und das Öffnen direkt danach ergab 404. Liegengebliebene Temp-Dateien werden aufgeräumt; noch benötigte werden gerettet. Bei der Browser-Texterkennung wurde der Status nie aktualisiert (unerreichbarer Code).
- **Taschengeld:** Beträge kamen als Text an („5“ + 10 = „105“), ein ungültiger Betrag ließ den Server mit „alert is not defined“ abstürzen.
- **Rezepte:** „Zutaten auf die Einkaufsliste“ stürzte ab (`toggleSyncItem` fehlte).
- **Dashboard:** Das Timeline-Widget stürzte ab (`t` war nicht definiert).
- **Projekte:** Monatliche Wiederholung lief über das Monatsende hinaus (31. Jan. + 1 Monat = 3. März).
- **Aufgaben:** „Heute erledigt“ wurde in UTC statt in deutscher Zeit berechnet. Hakt ein Elternteil die Aufgabe eines Kindes ab, bekommt jetzt das Kind die Punkte.
- **Push:** Das Frontend enthielt einen Demo-Schlüssel, der nicht zum Server passte. Der Schlüssel wird jetzt zur Laufzeit vom Server geholt.
- **Erinnerungen:** Sie gelten jetzt auch für Serientermine und laufen in der eingestellten Zeitzone. Doppelte Benachrichtigungen werden verhindert.
- **iCal-Export:** Falsche Uhrzeiten (UTC), Serien und Geburtstage fehlten. Der Abo-Link ist jetzt im Kalender sichtbar.
- **Externe Kalender:** Sie wurden bei jedem Seitenaufruf neu heruntergeladen. Jetzt gibt es 10 Minuten Cache.
- **Mitglieder:** Der Schutz „sich selbst löschen“ griff nie, und das Löschen scheiterte an Fremdschlüsseln. Mindestens ein Admin bleibt jetzt erhalten.
- **Wunschlisten:** Zwei Personen konnten gleichzeitig dasselbe Geschenk reservieren.
- **Übersetzungen:** 39 fehlende Texte wurden als Schlüssel angezeigt (z. B. „upload_doc“, „no_category“), 114 Einträge waren doppelt.
- **Zeitstempel** aus der Datenbank werden als UTC ausgeliefert. Die Timeline zeigte bisher um 1–2 Stunden falsche Zeiten.

### Aufgeräumt / modernisiert
- Backend komplett neu strukturiert: async/await statt verschachtelter Callbacks, eine zentrale Fehlerbehandlung, Transaktionen, Indizes, WAL-Modus.
- Automatische, idempotente Datenbank-Migration für alte und neue Datenbanken.
- Frontend lädt Module bei Bedarf: Der Start lädt etwa 290 kB statt 1,3 MB JavaScript. Eine Fehlergrenze pro Seite verhindert weiße Seiten.
- PWA-Manifest, saubere Icons, Service Worker aktualisiert sich sofort.
- Docker: mehrstufiger Build, Healthcheck, `tini`, Zeitzone, Volumes für `data/` und `uploads/`.
- Ungenutzter Code entfernt: zweites Push-Modul, `translations.js`, `Wishlists.jsx`, `KioskDashboard.jsx`, Budget-Route ohne Oberfläche, FullCalendar- und Tesseract-Pakete.
- 17 automatisierte API-Tests, darunter Familien-Isolation, Upload-Schutz und gefälschte Tokens.
