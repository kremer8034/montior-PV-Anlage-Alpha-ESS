// -------------------------------------------------------------------------
// BRANDING / ANPASSUNGEN  —  diese Datei darfst du gefahrlos bearbeiten.
// Corporate Design: Deutsches/Bayerisches Rotes Kreuz (DRK-Styleguide).
// Keine sensiblen Daten hier! API-Zugang läuft serverseitig über Env-Variablen.
// -------------------------------------------------------------------------
window.DASHBOARD_CONFIG = {
  // Kopfzeile
  companyName: "BRK Kreisverband Miltenberg-Obernburg",
  headline: "Unsere Photovoltaik-Anlagen – live",
  subline: "Wir produzieren sauberen Strom – ein Beitrag zur Nachhaltigkeit.",

  // Logo: liegt unter /public/logo.svg (durch offizielle Datei ersetzbar)
  logoUrl: "logo.svg",

  // Farben nach DRK-Styleguide (https://styleguide.drk.de)
  colors: {
    bg: "#f2f2f2", // Seitenhintergrund (hell)
    bgAccent: "#ffffff", // Kachel-Hintergrund (weiß)
    primary: "#e60005", // DRK-Rot (Akzent/CO2)
    sun: "#e60005", // PV-Erzeugung -> DRK-Rot
    load: "#008ccd", // Verbrauch -> DRK-Mittelblau
    total: "#002d55", // Gesamterzeugung -> DRK-Dunkelblau
    text: "#1a1a1a",
    textMuted: "#6f6f6e",
  },

  // Aktualisierungsintervall des Monitors in Sekunden
  refreshSeconds: 20,
};
