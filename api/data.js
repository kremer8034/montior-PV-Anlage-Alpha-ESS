// Serverless-Endpunkt (Vercel): /api/data
// Liefert die aggregierten Live-Daten aller Anlagen als JSON an das Dashboard.
//
// - Hält die Alpha-ESS-Zugangsdaten serverseitig (niemals im Browser!).
// - Cached die Antwort kurz (CACHE_TTL_SECONDS), um die API-Aufruflimits zu schonen.
//   Bei einem Monitor mit ~20s-Polling reicht das locker aus.

import { fetchAggregated, getEssList } from "../lib/alphaess.js";
import { demoPayload } from "../lib/demo.js";

const TTL_MS = (Number(process.env.CACHE_TTL_SECONDS) || 30) * 1000;

// Demo-Modus: aktiv, wenn keine Zugangsdaten gesetzt sind (oder DEMO_MODE=true).
// Liefert realistische Beispielwerte, damit das Dashboard sofort sichtbar ist.
const DEMO_MODE =
  process.env.DEMO_MODE === "true" ||
  (!process.env.ALPHAESS_APP_ID && process.env.DEMO_MODE !== "false");

let cache = { at: 0, payload: null };
let snCache = null; // SN-Liste wird selten gebraucht -> einmal ermitteln

async function resolveSnList() {
  const fromEnv = (process.env.ALPHAESS_SN_LIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;

  // Fallback: alle am Konto hängenden Anlagen automatisch laden
  if (!snCache) {
    const list = await getEssList();
    snCache = list.map((e) => e.sysSn).filter(Boolean);
  }
  return snCache;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");

  if (DEMO_MODE) {
    res.setHeader("X-Demo", "1");
    return res.status(200).json(demoPayload());
  }

  try {
    const now = Date.now();
    if (cache.payload && now - cache.at < TTL_MS) {
      res.setHeader("X-Cache", "HIT");
      return res.status(200).json(cache.payload);
    }

    const snList = await resolveSnList();
    if (!snList.length) {
      return res.status(500).json({
        error:
          "Keine Anlagen gefunden. Bitte ALPHAESS_SN_LIST setzen oder Anlagen mit dem API-Konto verknüpfen.",
      });
    }

    const payload = await fetchAggregated(snList);
    cache = { at: now, payload };
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(payload);
  } catch (err) {
    // Letzten guten Stand zurückgeben, falls vorhanden (Monitor zeigt dann nicht "leer")
    if (cache.payload) {
      res.setHeader("X-Cache", "STALE");
      return res.status(200).json({ ...cache.payload, stale: true, error: String(err.message || err) });
    }
    return res.status(500).json({ error: String(err.message || err) });
  }
}
