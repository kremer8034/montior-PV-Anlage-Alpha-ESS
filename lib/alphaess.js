// Alpha ESS Open API Client
// ---------------------------------------------------------------------------
// Kapselt die Authentifizierung (Signatur) und die Abfrage der Alpha-ESS-Cloud.
//
// Auth-Schema der Open API (https://github.com/alphaess-developer/alphacloud_open_api):
//   sign = SHA512( appId + appSecret + timeStamp )
//   Header: appId, timeStamp (Unix-Sekunden), sign, Content-Type: application/json
//
// Sollte Alpha ESS einzelne Feldnamen ändern, müssen nur die Stellen mit
// `data.<feld>` in extractLast() / extractSummary() angepasst werden.
// ---------------------------------------------------------------------------

import crypto from "node:crypto";

const BASE_URL = process.env.ALPHAESS_BASE_URL || "https://openapi.alphaess.com/api";

function buildHeaders() {
  const appId = process.env.ALPHAESS_APP_ID;
  const appSecret = process.env.ALPHAESS_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "ALPHAESS_APP_ID / ALPHAESS_APP_SECRET sind nicht gesetzt. Bitte als Umgebungsvariablen hinterlegen."
    );
  }
  const timeStamp = Math.floor(Date.now() / 1000).toString();
  const sign = crypto
    .createHash("sha512")
    .update(`${appId}${appSecret}${timeStamp}`)
    .digest("hex");

  return {
    appId,
    timeStamp,
    sign,
    "Content-Type": "application/json",
  };
}

async function apiGet(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }

  const res = await fetch(url, { method: "GET", headers: buildHeaders() });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} bei ${path}`);
  }
  const body = await res.json();
  // Open-API-Antwort: { code: 200, msg: "Success", data: {...} }
  if (body.code !== undefined && body.code !== 200) {
    throw new Error(`Alpha-ESS-Fehler ${body.code}: ${body.msg || "unbekannt"} (${path})`);
  }
  return body.data;
}

/** Liste aller mit dem Konto verknüpften Anlagen (liefert u.a. sysSn). */
export async function getEssList() {
  const data = await apiGet("/getEssList");
  return Array.isArray(data) ? data : [];
}

/** Echtzeit-Leistungsdaten einer Anlage. */
export async function getLastPowerData(sysSn) {
  return apiGet("/getLastPowerData", { sysSn });
}

/** Summen-/Energiedaten einer Anlage (heute, gesamt, CO2, ...). */
export async function getSumData(sysSn) {
  return apiGet("/getSumDataForCustomer", { sysSn });
}

const num = (v) => (typeof v === "number" && isFinite(v) ? v : Number(v) || 0);

// Felder aus getLastPowerData (Werte in Watt) -> kW
function extractLast(data = {}) {
  return {
    pvPowerKw: num(data.ppv) / 1000, // aktuelle PV-Erzeugung
    loadPowerKw: num(data.pload) / 1000, // aktueller Verbrauch (Last)
    soc: num(data.soc), // Batterie-Ladestand %
  };
}

// Felder aus getSumDataForCustomer (Energie in kWh)
function extractSummary(data = {}) {
  return {
    energyTodayKwh: num(data.epvtoday), // heute erzeugt
    energyTotalKwh: num(data.epvtotal), // gesamt erzeugt
  };
}

/**
 * Fragt alle übergebenen Anlagen ab und summiert die Werte.
 * Eine ausgefallene Anlage bricht das Gesamtergebnis nicht ab.
 */
export async function fetchAggregated(snList) {
  const systems = await Promise.all(
    snList.map(async (sysSn) => {
      try {
        const [last, sum] = await Promise.all([
          getLastPowerData(sysSn),
          getSumData(sysSn),
        ]);
        return { sysSn, online: true, ...extractLast(last), ...extractSummary(sum) };
      } catch (err) {
        return { sysSn, online: false, error: String(err.message || err) };
      }
    })
  );

  const online = systems.filter((s) => s.online);
  const agg = online.reduce(
    (a, s) => ({
      pvPowerKw: a.pvPowerKw + s.pvPowerKw,
      loadPowerKw: a.loadPowerKw + s.loadPowerKw,
      energyTodayKwh: a.energyTodayKwh + s.energyTodayKwh,
      energyTotalKwh: a.energyTotalKwh + s.energyTotalKwh,
    }),
    { pvPowerKw: 0, loadPowerKw: 0, energyTodayKwh: 0, energyTotalKwh: 0 }
  );

  const co2Factor = num(process.env.CO2_FACTOR_KG_PER_KWH) || 0.4; // kg CO2 / kWh (dt. Strommix ~0,4)

  return {
    updatedAt: new Date().toISOString(),
    pvPowerKw: round(agg.pvPowerKw, 2),
    loadPowerKw: round(agg.loadPowerKw, 2),
    energyTodayKwh: round(agg.energyTodayKwh, 1),
    energyTotalKwh: round(agg.energyTotalKwh, 0),
    co2SavedKg: round(agg.energyTotalKwh * co2Factor, 0),
    co2SavedTons: round((agg.energyTotalKwh * co2Factor) / 1000, 1),
    systemsTotal: systems.length,
    systemsOnline: online.length,
    systems,
  };
}

function round(n, d) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
