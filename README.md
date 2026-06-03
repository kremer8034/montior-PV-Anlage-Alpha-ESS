# PV-Monitor (Alpha ESS) – Infomonitor fürs Foyer

Live-Dashboard für eure Photovoltaik-Anlagen, das auf einem Infomonitor (z. B. via
**Yodeck**) angezeigt wird. Es zeigt für **alle Dächer zusammengefasst**:

- ☀️ **Aktuelle PV-Leistung** (kW)
- 🔌 **Aktueller Verbrauch** (kW)
- ⚡ **Gesamt erzeugte Energie** (kWh)
- **Heute erzeugt** + **eingespartes CO₂**

Die Daten kommen aus der **Alpha-ESS-Cloud** (Open API). Ein kleiner serverseitiger
Dienst fragt die API signiert ab, summiert alle Anlagen und liefert sie an die
Webseite – die Zugangsdaten bleiben dabei sicher auf dem Server.

```
Alpha ESS Cloud ──(signiert, alle ~30s)──▶ /api/data (Vercel) ──▶ Dashboard ──▶ Yodeck ──▶ Monitor
```

---

## Aufbau

| Datei | Zweck |
|-------|-------|
| `lib/alphaess.js` | Alpha-ESS-API-Client (Signatur, Endpunkte, Aggregation) |
| `lib/demo.js` | Beispieldaten für den Demo-Modus |
| `api/data.js` | Serverless-Endpunkt – liefert aggregierte Live-Daten als JSON |
| `public/index.html` · `styles.css` · `app.js` | Das Dashboard (Anzeige) |
| `public/config.js` | **Branding** (Logo, Farben, Texte) – hier anpassen |
| `public/logo.svg` | Logo-Platzhalter – durch euer Logo ersetzen |
| `.env.example` | Vorlage für die Zugangsdaten |

---

## 1) Alpha-ESS-Open-API-Zugang einrichten (einmalig)

1. Auf **https://open.alphaess.com** ein **Developer-Konto** registrieren.
2. Im Entwicklerbereich eine App anlegen → ihr erhaltet **AppID** und **AppSecret**.
3. Jede PV-Anlage mit dem Konto verknüpfen. Dazu braucht ihr pro Anlage die
   **Seriennummer (SN)** und den **CheckCode** (stehen in der AlphaCloud-App
   bzw. auf dem Wechselrichter / Typenschild).
4. SN aller Dächer notieren – die tragen wir als `ALPHAESS_SN_LIST` ein
   (oder leer lassen, dann werden automatisch alle verknüpften Anlagen geladen).

> Hinweis: Die API hat Aufruf-Limits. Der Dienst cached die Antworten
> (`CACHE_TTL_SECONDS`, Standard 30 s), daher ist das bei einem Monitor unkritisch.

## 2) Deployment auf Vercel

1. Repo mit Vercel verbinden (Import) – kein Build-Schritt nötig, kein Framework.
2. Unter **Settings → Environment Variables** eintragen (siehe `.env.example`):
   - `ALPHAESS_APP_ID`
   - `ALPHAESS_APP_SECRET`
   - `ALPHAESS_SN_LIST` (optional)
3. Deployen. Ergebnis ist eine öffentliche URL, z. B. `https://pv-monitor.vercel.app`.

**Ohne Zugangsdaten startet automatisch der Demo-Modus** – ihr seht sofort, wie der
Monitor aussieht (mit realistischen Beispielwerten und einer Tageskurve).

## 3) In Yodeck einbinden

1. In Yodeck **Add Media → Web Page** anlegen.
2. Die Vercel-URL eintragen.
3. Anzeige-/Refresh-Optionen: Vollbild, kein Scrollen. Das Dashboard aktualisiert
   sich selbst (Intervall in `config.js`, Standard 20 s) – Yodeck muss die Seite
   **nicht** neu laden.
4. Die Web-Page einem **Playlist/Layout** zuweisen und auf den Monitor schalten.

## 4) Branding anpassen

In `public/config.js`:
- `companyName`, `headline`, `subline`
- `colors` (euer Corporate Design)
- `logoUrl` → euer Logo nach `public/logo.svg` oder `public/logo.png` legen

---

## Lokal testen

```bash
npm install -g vercel
vercel dev
# Öffnen: http://localhost:3000  (läuft ohne Zugangsdaten im Demo-Modus)
```

## Datenfelder der Alpha-ESS-API

Der Client nutzt diese Endpunkte (Basis `https://openapi.alphaess.com/api`):

- `getLastPowerData` → `ppv` (PV-Leistung, W), `pload` (Verbrauch, W)
- `getSumDataForCustomer` → `epvtoday`, `epvtotal` (kWh)
- `getEssList` → Liste der Anlagen (für automatische SN-Ermittlung)

Signatur: `sign = SHA512(appId + appSecret + timeStamp)`, gesendet als Header
`appId`, `timeStamp`, `sign`. Falls Alpha ESS Feldnamen ändert, müssen nur
`extractLast()` / `extractSummary()` in `lib/alphaess.js` angepasst werden.
