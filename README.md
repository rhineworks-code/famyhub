# FamyHub 3.0

Selbst gehosteter Familienplaner: Kalender, Einkaufslisten, Essensplan, Rezepte, Chat, Galerie, Dokumente mit Texterkennung, Passwort-Tresor, Verträge, Taschengeld, Aufgaben mit Punkten, Projekte, Urlaubsplanung, Wunschlisten, Timeline und Push-Benachrichtigungen.

Version 3.0 bringt eine komplett neu gebaute Oberfläche im iOS-Stil (Hell, Dunkel oder automatisch) für Handy, Tablet und PC. Die bestehende Datenbank wird beim ersten Start automatisch übernommen. Alle Daten bleiben erhalten.

---

## Installation mit Git (empfohlen)

```bash
git clone https://github.com/rhineworks-code/famyhub.git ~/famyhub
cd ~/famyhub
cp .env.example .env            # anpassen, z. B. FAMYHUB_PORT=3264
mkdir -p data uploads
sudo chown -R 1000:1000 data uploads
docker compose up -d --build
```

Danach `http://<server>:<FAMYHUB_PORT>` öffnen. Der Einrichtungs-Assistent legt die Familie und den ersten Admin an.

## Updates

Neue Versionen kommen über GitHub: Änderungen werden auf einem Branch entwickelt, per Pull Request nach `main` gemergt und auf dem Server mit einem Befehl eingespielt:

```bash
cd ~/famyhub
./update.sh            # Update holen, Backup, neu bauen, starten
./update.sh --check    # nur nachsehen, ob es etwas Neues gibt
```

`update.sh` macht Folgendes:
1. Prüft, ob es neue Commits auf `main` gibt (sonst passiert nichts).
2. Stoppt den Container kurz und sichert `data/` und `uploads/` nach `backups/`. Die letzten 7 Backups bleiben erhalten (`KEEP_BACKUPS=…`).
3. Holt den neuen Stand (`git pull`, nur Fast-Forward).
4. Baut das Image und startet den Container.
5. Wartet, bis der Healthcheck grün ist. Startet die neue Version nicht, wird automatisch der vorherige Stand wiederhergestellt.

**Eigene Anpassungen** nie in versionierte Dateien schreiben, sonst blockiert `git pull`:
- Port, Schlüssel und Optionen gehören in die `.env`.
- Docker-Anpassungen (z. B. `user:`, weitere Volumes) kommen in eine `docker-compose.override.yml`. Beide Dateien ignoriert Git.

## Umstieg von einer entpackten ZIP-Version

```bash
cd ~/famyhub-2.0 && docker compose down          # alte Installation stoppen
git clone https://github.com/rhineworks-code/famyhub.git ~/famyhub
cd ~/famyhub
cp -a ~/famyhub-2.0/.env ~/famyhub-2.0/data ~/famyhub-2.0/uploads .
grep -q FAMYHUB_PORT .env || echo "FAMYHUB_PORT=3264" >> .env   # Port übernehmen
sudo chown -R 1000:1000 data uploads
docker compose up -d --build
```

## Umstieg von der ursprünglichen Version (vor 2.0)

1. Alten Container stoppen (`docker compose down` im alten Ordner) und `data/`, `uploads/` sowie `backend/.env` sichern.
2. Wie oben unter „Installation mit Git“ klonen.
3. `data/` und `uploads/` hineinkopieren und die VAPID-Schlüssel aus der alten `backend/.env` in die neue `.env` übernehmen.
4. Starten. Fehlende Tabellen und Spalten werden beim ersten Start automatisch ergänzt, es wird nichts gelöscht. **Alle müssen sich einmal neu anmelden**, weil der alte Anmeldeschlüssel ein öffentlich bekannter Standardwert war.

## Konfiguration (`.env`)

| Variable | Bedeutung |
|---|---|
| `FAMYHUB_PORT` | Port auf dem Server (Standard 3265). |
| `JWT_SECRET` | Anmeldeschlüssel (≥ 32 Zeichen). Leer lassen: Er wird automatisch erzeugt und in `data/.jwt_secret` gespeichert. |
| `PUBLIC_VAPID_KEY` / `PRIVATE_VAPID_KEY` | Schlüssel für Push-Benachrichtigungen. Ohne sie ist Push deaktiviert. |
| `ALLOW_REGISTRATION` | `false` (Standard): Neue Mitglieder legt der Admin an oder sie treten mit dem Einladungscode bei. |
| `TRUST_PROXY` | Hinter einem Reverse Proxy auf `true` setzen. |
| `TZ` | Zeitzone für Erinnerungen, Aufgaben-Intervalle und den Kalender-Export. |
| `SMTP_*` | Optionaler Mailserver für „Passwort vergessen“, falls die Familie in den Einstellungen keinen eigenen hinterlegt hat. |
| `WEATHER_LAT` / `WEATHER_LON` | Optionaler Standard-Standort für das Wetter. |
| `DOCS_ALLOWED_ROOTS` | Zusätzliche erlaubte Pfade für den Dokumentenspeicher, z. B. ein gemountetes NAS. |

## Backups

- In der App unter **Einstellungen → Admin → Backup erstellen**. Die ZIP-Datei enthält die Datenbank und alle Uploads. Die Datenbank wird dabei im laufenden Betrieb konsistent gesichert.
- Oder auf dem Server die Ordner `data/` und `uploads/` sichern.

## Entwicklung

```bash
cd backend && npm install && npm run dev          # API auf :3265
cd frontend && npm install && npm run dev         # UI auf :5173 (leitet /api und /uploads weiter)
cd backend && npm test                            # 17 API-Tests (inkl. Sicherheits-Checks)
```

## Projektstruktur

```
backend/
  src/
    server.js            Express-App, Routen, Fehlerbehandlung
    config.js            Konfiguration aus .env
    db/                  SQLite-Zugriff (Promise-basiert) + automatische Migrationen
    middleware/          Anmeldung, Rollen, Modul-Berechtigungen, Rate-Limit
    routes/              eine Datei pro Modul
    services/            Push, Mail, SMB, Texterkennung, Uploads, Zeitplaner
  test/api.test.js       End-to-End-Tests der API
frontend/
  src/                   React-App (Vite + Tailwind), Module werden bei Bedarf nachgeladen
update.sh                Update aus GitHub mit Backup und automatischem Rollback
Dockerfile               Mehrstufiger Build (Frontend → Backend → schlankes Laufzeit-Image)
docker-compose.yml
.env.example
CHANGELOG.md             Was gegenüber der alten Version behoben wurde
```
