// Erzeugt realistische Beispielwerte für den Demo-Modus (ohne echte API).
// Die PV-Leistung folgt einer Tageskurve, damit der Monitor "lebendig" wirkt.
export function demoPayload() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;

  // Glockenkurve um die Mittagszeit (Maximum ~ 12:30), nachts 0.
  const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const peakKw = 48; // angenommene Gesamt-Spitzenleistung aller Dächer
  const jitter = 0.9 + Math.random() * 0.2;
  const pv = +(peakKw * daylight * jitter).toFixed(1);
  const load = +(8 + Math.random() * 14).toFixed(1);

  const energyTotal = 412_350; // kWh kumuliert (Beispiel)
  const energyToday = +(peakKw * 5.2 * daylight + 30 * daylight).toFixed(1);
  const co2Factor = Number(process.env.CO2_FACTOR_KG_PER_KWH) || 0.4;

  return {
    updatedAt: now.toISOString(),
    demo: true,
    pvPowerKw: pv,
    loadPowerKw: load,
    energyTodayKwh: energyToday,
    energyTotalKwh: energyTotal,
    socAvg: Math.round(55 + 35 * daylight), // Demo: lädt tagsüber auf
    co2SavedKg: Math.round(energyTotal * co2Factor),
    co2SavedTons: +((energyTotal * co2Factor) / 1000).toFixed(1),
    systemsTotal: 3,
    systemsOnline: 3,
    systems: [],
  };
}
