# PV-Infomonitor (Alpha ESS)

## Technische Dokumentation & Code-Beschreibung

*BRK Kreisverband Miltenberg-Obernburg · Standort Obernburg*  
*Stand: 09.06.2026*  

## 1. Überblick

Der PV-Infomonitor ist ein Live-Dashboard, das die Daten von fünf Photovoltaik-/Speicheranlagen (Alpha ESS) zusammenfasst und auf einem Info-Monitor (über Yodeck) im Querformat anzeigt. Angezeigt werden die aktuelle PV-Leistung, der aktuelle Verbrauch, die heute erzeugte Energie, der durchschnittliche Batterie-Ladestand sowie – als Gesamtwerte – die insgesamt erzeugte Energie und das eingesparte CO₂.

Die Messwerte stammen aus der Alpha-ESS-Cloud (Open API). Ein kleiner serverseitiger Dienst auf Vercel ruft die API signiert ab, summiert alle Anlagen und stellt das Ergebnis als JSON bereit. Die Zugangsdaten bleiben dabei ausschließlich auf dem Server – der Browser bzw. der Yodeck-Player sieht nur die fertig aufbereiteten Zahlen.


### 1.1 Datenfluss (vereinfacht)

```
Alpha-ESS-Cloud
      │  (signierte Abfrage, alle ~30 s, serverseitig)
      ▼
/api/data  (Vercel Serverless Function)
      │  aggregiert + cached -> JSON
      ▼
Dashboard (index.html + app.js)  ── ruft /api/data alle 20 s ab
      ▼
Yodeck-Player  ──▶  Info-Monitor
```


### 1.2 Wichtige Adressen


| Element | Beschreibung |
|---|---|
| **Live-URL (Yodeck)** | https://montior-pv-anlage-alpha-ess.vercel.app |
| **Datenendpunkt** | https://montior-pv-anlage-alpha-ess.vercel.app/api/data |
| **Hosting** | Vercel (Team „kremer8034's projects“) |
| **Quellcode** | GitHub: kremer8034/montior-PV-Anlage-Alpha-ESS (Branch main) |


## 2. Technologie & Architektur

Das Projekt kommt bewusst ohne Framework und ohne Build-Schritt aus. Das Frontend besteht aus statischem HTML/CSS/JavaScript, das Backend aus einer einzigen Serverless-Funktion (Node.js). Dadurch ist es extrem wartungsarm und läuft auf Vercel ohne weitere Konfiguration.

- Frontend: statisches HTML, CSS und „Vanilla“-JavaScript (kein Framework).
- Backend: eine Node.js-Serverless-Funktion (/api/data) auf Vercel.
- Sprache/Module: JavaScript als ES-Module ("type": "module").
- Externe Abhängigkeiten: keine (nur das in Node enthaltene crypto-Modul).
- Laufzeit: Node.js 18+ (auf Vercel aktuell Node 24).

### 2.1 Projektstruktur


| Element | Beschreibung |
|---|---|
| **api/data.js** | Serverless-Endpunkt; liefert die aggregierten Live-Daten als JSON. |
| **lib/alphaess.js** | Alpha-ESS-API-Client: Signatur, API-Aufrufe, Aggregation aller Anlagen. |
| **lib/demo.js** | Erzeugt realistische Beispielwerte für den Demo-Modus. |
| **public/index.html** | Aufbau (Struktur) des Dashboards. |
| **public/styles.css** | Layout & Design (DRK-Farbwelt, für Großdisplay optimiert). |
| **public/app.js** | Anzeige-Logik: holt /api/data, animiert und aktualisiert die Werte. |
| **public/config.js** | Branding (Texte, Farben, Logo, Aktualisierungsintervall). |
| **public/logo.svg** | Logo (BRK Kreisverband Miltenberg-Obernburg). |
| **.env.example** | Vorlage für die Zugangsdaten (Environment Variables). |
| **vercel.json** | Vercel-Konfiguration (Routing). |
| **package.json** | Projekt-Metadaten und Node-Version. |


## 3. Backend im Detail


### 3.1 lib/alphaess.js – Alpha-ESS-API-Client

Diese Datei kapselt die komplette Kommunikation mit der Alpha-ESS-Cloud.


#### Authentifizierung / Signatur

Jede Anfrage wird signiert. Die Signatur wird nach dem offiziellen Alpha-ESS-Schema gebildet:

```
sign = SHA512( appId + appSecret + timeStamp )
```

Gesendet werden die HTTP-Header appId, timeStamp (Unix-Sekunden), sign und Content-Type: application/json. AppID und AppSecret werden aus den Umgebungsvariablen gelesen und sind nie im Code enthalten.


#### Verwendete API-Endpunkte (Basis: https://openapi.alphaess.com/api)


| Element | Beschreibung |
|---|---|
| **getLastPowerData** | Echtzeitwerte je Anlage: ppv (PV-Leistung, W), pload (Verbrauch, W), soc (Batterie %). |
| **getSumDataForCustomer** | Energiesummen je Anlage: epvtoday (heute, kWh), epvtotal (gesamt, kWh). |
| **getEssList** | Liste aller mit dem Konto verknüpften Anlagen (für automatische SN-Ermittlung). |


#### Aggregation – fetchAggregated()

Für jede Seriennummer werden parallel Echtzeit- und Summenwerte geladen. Eine ausgefallene Anlage bricht das Gesamtergebnis nicht ab (sie wird als online:false markiert). Anschließend werden die Werte der erreichbaren Anlagen zusammengeführt:

- PV-Leistung, Verbrauch, Ertrag heute und Ertrag gesamt werden summiert.
- Der Batterie-Ladestand (socAvg) wird als Mittelwert über alle erreichbaren Anlagen berechnet.
- Das eingesparte CO₂ wird aus dem Gesamtertrag × CO₂-Faktor (Standard 0,4 kg/kWh) berechnet.
Leistungswerte kommen von der API in Watt und werden in Kilowatt (kW) umgerechnet; Energiewerte sind in kWh. Das zurückgegebene Objekt enthält zusätzlich updatedAt (Zeitstempel), systemsTotal/systemsOnline (Status) und ein systems-Array mit den Einzelwerten jeder Anlage.


### 3.2 api/data.js – Serverless-Endpunkt /api/data

Dies ist die Schnittstelle, die das Dashboard im Browser aufruft. Sie übernimmt drei Aufgaben:

- Zugangsdaten serverseitig halten – sie verlassen den Server nie.
- Caching: Antworten werden kurz zwischengespeichert (CACHE_TTL_SECONDS, Standard 30 s), um die API-Aufruflimits zu schonen.
- Fehlertoleranz: Bei einem API-Fehler wird – falls vorhanden – der letzte gültige Stand zurückgegeben (mit Markierung stale), damit der Monitor nicht „leer“ läuft.
Demo-Modus: Sind keine Zugangsdaten gesetzt (oder ist DEMO_MODE=true), liefert der Endpunkt automatisch realistische Beispielwerte. So ist der Monitor auch ohne API sofort sichtbar.

CORS: Der Endpunkt erlaubt Zugriffe von überall (Access-Control-Allow-Origin: *), damit der Yodeck-Player die Daten lesen kann.


### 3.3 lib/demo.js – Demo-Daten

Erzeugt plausible Beispielwerte mit einer Tageskurve (PV-Leistung folgt einer Glockenkurve um die Mittagszeit, Batterie lädt tagsüber auf). Nur aktiv, wenn keine echten Zugangsdaten vorhanden sind.


## 4. Frontend im Detail


### 4.1 public/index.html – Aufbau

Definiert die Struktur des Dashboards: Kopfzeile (Logo + Titel), die obere Kachelreihe mit vier großen Kacheln, die untere Reihe mit zwei kleinen Kacheln und eine Statuszeile.

Obere Reihe (große Kacheln – aktuelle/Tageswerte):

- ☀️ Aktuelle PV-Leistung (kW)
- 🔌 Aktueller Verbrauch (kW)
- 📅 Heute erzeugt (kWh)
- 🔋 Batterie-Ladestand (%)
Untere Reihe (kleine Kacheln – Gesamtwerte):

- Gesamt erzeugt (kWh/MWh)
- Eingespartes CO₂ gesamt (t)

### 4.2 public/app.js – Anzeige-Logik

Holt regelmäßig (Standard alle 20 s) die Daten von /api/data und aktualisiert die Anzeige. Wesentliche Funktionen:

- Branding anwenden: liest Farben/Texte/Logo aus config.js und setzt sie.
- Zähler-Animation: Werte zählen weich vom alten auf den neuen Wert hoch.
- scaleEnergy(): skaliert große Energiemengen automatisch (kWh → MWh → GWh), damit nichts aus der Kachel läuft.
- fitValue(): verkleinert zur Sicherheit die Schrift, falls ein Wert doch zu breit würde – so wird nie etwas abgeschnitten.
- Statusanzeige: zeigt „Aktualisiert HH:MM“ (verbunden), eine Warnung (z. B. wenn nicht alle Anlagen erreichbar sind) oder einen Fehler.

### 4.3 public/config.js – Branding (hier anpassen)

Diese Datei darf gefahrlos bearbeitet werden – sie enthält keine sensiblen Daten. Einstellbar sind:


| Element | Beschreibung |
|---|---|
| **companyName** | Name in der Statuszeile / im Seitentitel. |
| **headline** | Große Überschrift (aktuell „Unsere Photovoltaik-Anlagen am Standort Obernburg – live“). |
| **subline** | Unterzeile unter der Überschrift. |
| **logoUrl** | Pfad zum Logo (Standard logo.svg). |
| **colors** | Farbwelt nach DRK-Styleguide (Hintergrund, Rot, Blau, Batterie-Grün, …). |
| **refreshSeconds** | Aktualisierungsintervall des Monitors in Sekunden (Standard 20). |


### 4.4 public/styles.css – Design

Layout für Querformat-Monitore (z. B. 1920×1080), mit responsiven Schriftgrößen (clamp/vw) für gute Lesbarkeit aus mehreren Metern. Die Farben folgen dem DRK-Styleguide (helles Theme: Weiß/Rot/Blau, plus Grün für die Batterie). Die obere Kachelreihe ist als 4-Spalten-Raster angelegt.


## 5. Konfiguration (Environment Variables)

Die Zugangsdaten werden ausschließlich in Vercel unter Settings → Environment Variables hinterlegt (Scope: Production):


| Element | Beschreibung |
|---|---|
| **ALPHAESS_APP_ID** | Entwickler-ID (AppID) aus dem Alpha-ESS-Entwicklerkonto. Pflicht. |
| **ALPHAESS_APP_SECRET** | Entwicklerschlüssel (AppSecret). Pflicht. Wie ein Passwort behandeln. |
| **ALPHAESS_SN_LIST** | Seriennummern aller Anlagen, kommagetrennt. Leer = alle Anlagen des Kontos. |
| **CACHE_TTL_SECONDS** | Cache-Dauer in Sekunden (Standard 30). |
| **CO2_FACTOR_KG_PER_KWH** | CO₂-Faktor (Standard 0,4 kg/kWh, dt. Strommix). |
| **DEMO_MODE** | „true“ erzwingt Demo, „false“ schaltet ihn ab. Ohne AppID automatisch Demo. |

Wichtig: Änderungen an Environment Variables greifen erst nach einem neuen Deployment (Redeploy).


## 6. Betrieb & Deployment

Das Projekt ist mit GitHub verbunden. Jeder Push auf den Branch main löst automatisch ein neues Production-Deployment auf Vercel aus, das anschließend unter der gleichbleibenden Live-URL erreichbar ist. Die Yodeck-URL muss daher nie geändert werden.

- Code ändern → auf main pushen → Vercel baut automatisch → live.
- Nur Zugangsdaten geändert → in Vercel Redeploy auslösen.
- Der Yodeck-Player zeigt Änderungen beim nächsten Seiten-Refresh.

### 6.1 Einbindung in Yodeck

- In Yodeck: Add Media → Web Page, die Live-URL eintragen.
- Vollbild, kein Scrollen. Das Dashboard aktualisiert sich selbst.
- Web-Page einem Layout/Playlist zuweisen und auf den Monitor schalten.

## 7. Sicherheit

- Das AppSecret liegt nur als verschlüsselte Environment Variable in Vercel, nie im Code oder im (öffentlichen) GitHub-Repository.
- Die Signatur wird serverseitig berechnet; der Browser erhält keine Zugangsdaten.
- Der Datenendpunkt /api/data ist öffentlich lesbar (nötig für Yodeck) und liefert ausschließlich PV-Ertragszahlen – keine personenbezogenen Daten.
- Empfehlung: Das AppSecret regelmäßig bzw. bei Verdacht in der AlphaCloud zurücksetzen und in Vercel aktualisieren.

## 8. Wartung & typische Anpassungen


| Element | Beschreibung |
|---|---|
| **Texte/Logo/Farben ändern** | public/config.js anpassen. |
| **Aktualisierungsintervall** | refreshSeconds in config.js. |
| **Anlage hinzufügen/entfernen** | ALPHAESS_SN_LIST in Vercel anpassen, dann Redeploy. |
| **API-Feldnamen ändern sich** | Nur extractLast()/extractSummary() in lib/alphaess.js anpassen. |
| **CO₂-Faktor** | CO2_FACTOR_KG_PER_KWH in Vercel setzen. |


## 9. Glossar


| Element | Beschreibung |
|---|---|
| **SOC** | State of Charge – Batterie-Ladestand in Prozent. |
| **PV** | Photovoltaik. |
| **Serverless Function** | Server-Code, der nur bei Bedarf ausgeführt wird (hier auf Vercel). |
| **Environment Variable** | Konfigurationswert, der außerhalb des Codes (in Vercel) gespeichert ist. |
| **Aggregation** | Zusammenfassen mehrerer Anlagen zu Gesamtwerten. |
| **Demo-Modus** | Anzeige mit Beispielwerten, falls keine Zugangsdaten vorhanden sind. |
| **CO₂-Faktor** | Umrechnungsfaktor von erzeugter Energie zu vermiedenem CO₂. |

