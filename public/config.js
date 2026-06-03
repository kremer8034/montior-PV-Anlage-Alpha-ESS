// -------------------------------------------------------------------------
// BRANDING / ANPASSUNGEN  —  diese Datei darfst du gefahrlos bearbeiten.
// Hier trägst du euer Corporate Design ein (Logo, Farben, Texte).
// Keine sensiblen Daten hier! API-Zugang läuft serverseitig über Env-Variablen.
// -------------------------------------------------------------------------
window.DASHBOARD_CONFIG = {
  // Kopfzeile
  companyName: "Musterfirma GmbH",
  headline: "Unsere Photovoltaik-Anlagen – live",
  subline: "Wir produzieren sauberen Strom für unsere Region.",

  // Logo: Datei nach /public/logo.svg (oder .png) legen und Pfad hier anpassen
  logoUrl: "logo.svg",

  // Farben (Corporate Design). Werden als CSS-Variablen gesetzt.
  colors: {
    bg: "#0d2818", // Hintergrund
    bgAccent: "#13351f", // Kachel-Hintergrund
    primary: "#34d399", // Akzent / PV-Grün
    sun: "#fbbf24", // PV-Erzeugung
    load: "#60a5fa", // Verbrauch
    total: "#a78bfa", // Gesamtsumme
    text: "#ffffff",
    textMuted: "#9fb8a8",
  },

  // Aktualisierungsintervall des Monitors in Sekunden
  refreshSeconds: 20,
};
