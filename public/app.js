// Dashboard-Logik: holt regelmäßig /api/data und aktualisiert die Anzeige.
(function () {
  const cfg = window.DASHBOARD_CONFIG || {};

  // --- Branding anwenden ---------------------------------------------------
  const c = cfg.colors || {};
  const root = document.documentElement.style;
  const map = {
    "--bg": c.bg,
    "--bg-accent": c.bgAccent,
    "--primary": c.primary,
    "--sun": c.sun,
    "--load": c.load,
    "--total": c.total,
    "--text": c.text,
    "--text-muted": c.textMuted,
  };
  for (const [k, v] of Object.entries(map)) if (v) root.setProperty(k, v);

  setText("headline", cfg.headline || "Photovoltaik – live");
  setText("subline", cfg.subline || "");
  setText("company", cfg.companyName || "");
  document.title = cfg.companyName ? `PV-Monitor · ${cfg.companyName}` : "PV-Monitor";
  if (cfg.logoUrl) document.getElementById("logo").setAttribute("src", cfg.logoUrl);

  const refreshMs = (Number(cfg.refreshSeconds) || 20) * 1000;

  // --- Hilfsfunktionen -----------------------------------------------------
  function setText(id, t) {
    const el = document.getElementById(id);
    if (el) el.textContent = t;
  }
  const nf = (d) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d });

  // Skaliert kWh automatisch auf kWh/MWh/GWh, damit große Summen nicht
  // aus der Kachel laufen.
  function scaleEnergy(kwh) {
    const v = Number(kwh) || 0;
    if (v >= 1_000_000) return { value: v / 1_000_000, unit: "GWh", decimals: 2 };
    if (v >= 1_000) return { value: v / 1_000, unit: "MWh", decimals: 1 };
    return { value: v, unit: "kWh", decimals: 0 };
  }

  // Sicherheitsnetz: verkleinert den Wert automatisch, falls er (mit Einheit)
  // breiter als die Kachel würde – so wird nie etwas abgeschnitten.
  function fitValue(el) {
    if (!el) return;
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize);
    let guard = 0;
    while (el.scrollWidth > el.clientWidth && size > 24 && guard++ < 40) {
      size *= 0.95;
      el.style.fontSize = size + "px";
    }
  }
  function fitAll() {
    document.querySelectorAll(".tile__value").forEach(fitValue);
  }

  function setStatus(kind, text) {
    const dot = document.getElementById("dot");
    dot.className = "dot " + (kind ? "dot--" + kind : "");
    setText("status", text);
  }

  // Sanfte Zähler-Animation von altem auf neuen Wert
  const lastVals = {};
  function animate(id, target, decimals) {
    const el = document.getElementById(id);
    if (!el) return;
    const from = lastVals[id] ?? target;
    lastVals[id] = target;
    const start = performance.now();
    const dur = 800;
    function step(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = nf(decimals).format(from + (target - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // --- Datenabruf ----------------------------------------------------------
  async function update() {
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Serverfehler");

      animate("pvPower", data.pvPowerKw, 1);
      animate("loadPower", data.loadPowerKw, 1);

      const total = scaleEnergy(data.energyTotalKwh);
      setText("energyTotalUnit", total.unit);
      animate("energyTotal", total.value, total.decimals);

      animate("energyToday", data.energyTodayKwh, 1);
      animate("co2", data.co2SavedTons, 1);

      // nach Ende der Zähler-Animation prüfen, ob alles in die Kacheln passt
      setTimeout(fitAll, 850);

      const t = new Date(data.updatedAt).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      if (data.stale) {
        setStatus("warn", `Letzter Stand ${t} (Verbindung gestört)`);
      } else if (data.systemsOnline < data.systemsTotal) {
        setStatus("warn", `${data.systemsOnline}/${data.systemsTotal} Anlagen · Stand ${t}`);
      } else {
        setStatus("ok", `Aktualisiert ${t}`);
      }
    } catch (err) {
      setStatus("err", "Keine Verbindung – nächster Versuch …");
      console.error(err);
    }
  }

  update();
  setInterval(update, refreshMs);
  window.addEventListener("resize", fitAll);
})();
