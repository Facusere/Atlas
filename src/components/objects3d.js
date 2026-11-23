import { esc, safeUrl } from "../utils/sanitize.js";
import { getLocalTimeFromUtc, weatherCodeToInfo } from "../utils/formatters.js";

/**
 * Coat of Arms Logo without background circle (safe fallback to embossed ISO3 monogram).
 */
export function renderCoatOfArmsPod(country) {
  const safeCoat = safeUrl(country.coatOfArmsUrl);
  const inner = safeCoat
    ? `<img src="${esc(safeCoat)}" alt="Escudo de ${esc(country.nameEs)}" loading="lazy" data-coat-fallback="${esc(country.id)}">`
    : `<span class="crest-fallback">${esc(country.id)}</span>`;

  return `
    <div class="object-pod">
      <span class="object-pod-label">Escudo</span>
      <div class="crest-logo-wrap">${inner}</div>
      <div class="object-pod-foot">
        <small style="color:var(--muted)">Emblema nacional</small>
      </div>
    </div>
  `;
}

/**
 * Spinning Currency Coins + Clickable Card Trigger for Live FX Converter & Current Banknotes.
 */
export function renderCurrencyPod(currencies) {
  const list = (currencies && currencies.length ? currencies : [{ code: "—", name: "Sin divisa", symbol: "¤" }]).slice(0, 2);
  const coinsHtml = list
    .map(
      (cur) => `
      <button type="button" class="coin-3d" title="Clic para girar moneda" aria-label="Moneda ${esc(cur.name)} (${esc(cur.code)})">
        <span class="coin-face-rim"></span>
        <span class="coin-face coin-face-front">
          <span class="coin-symbol">${esc(cur.symbol || cur.code)}</span>
          <span class="coin-code">${esc(cur.code)}</span>
        </span>
        <span class="coin-face coin-face-back">${esc(cur.name)}</span>
      </button>
    `
    )
    .join("");

  const primaryCode = list[0]?.code && list[0].code !== "—" ? list[0].code : "";

  return `
    <div class="object-pod ${primaryCode ? "object-pod--currency" : ""}" ${primaryCode ? `id="detail-currency-pod" data-fx-code="${esc(primaryCode)}" role="button" tabindex="0"` : ""}>
      <span class="object-pod-label">Moneda</span>
      <div class="coin-stage" style="margin:auto 0">${coinsHtml}</div>
      <div class="object-pod-foot">
        <small style="color:var(--muted)">${esc(list.map((c) => `${c.name} (${c.code})`).join(" · "))}</small>
        ${primaryCode ? `<button type="button" class="btn btn-pill fx-toggle-btn" id="detail-fx-toggle" data-fx-code="${esc(primaryCode)}">💱 Conversor y billetes</button>` : ""}
      </div>
    </div>
  `;
}

/**
 * Cartographic Compass + Live Local Clock Pod.
 */
export function renderCompassClockPod(country) {
  const primaryTz = country.timezones?.[0] || "UTC";
  const initialClock = getLocalTimeFromUtc(primaryTz);
  const initialBearing = Math.round(((country.latlng[1] + 180) / 360) * 360);

  return `
    <div class="object-pod">
      <span class="object-pod-label">Brújula &amp; Reloj</span>
      <div class="compass-3d" id="detail-compass" style="--bearing:${initialBearing}deg" title="Apuntá a un país limítrofe para orientar la aguja">
        <span class="compass-cardinal n">N</span>
        <span class="compass-cardinal e">E</span>
        <span class="compass-cardinal s">S</span>
        <span class="compass-cardinal o">O</span>
        <span class="compass-needle"></span>
      </div>
      <div class="object-pod-foot">
        <span class="live-clock-pill tabular" id="detail-live-clock" data-tz="${esc(primaryTz)}">
          ${initialClock.isDay ? "☀️" : "🌙"} ${esc(initialClock.timeStr)}
        </span>
        <small style="color:var(--muted)">${esc(primaryTz)}</small>
      </div>
    </div>
  `;
}

/**
 * Mini Weather Object Container (updated asynchronously by Open-Meteo).
 */
export function renderWeatherPodSkeleton(capitalName) {
  return `
    <div class="object-pod" id="detail-weather-pod">
      <span class="object-pod-label">Clima en vivo</span>
      <div class="weather-obj-3d"><div class="wx-cloud" style="opacity:0.45"></div></div>
      <div class="object-pod-foot">
        <span class="tabular" style="font-weight:700">Consultando…</span>
        <small style="color:var(--muted)">${esc(capitalName)}</small>
      </div>
    </div>
  `;
}

export function renderWeatherPodContent(weather, capitalName) {
  if (!weather) {
    return `
      <span class="object-pod-label">Clima en vivo</span>
      <div class="weather-obj-3d"><div class="wx-cloud" style="opacity:0.4"></div></div>
      <div class="object-pod-foot">
        <span>No disponible</span>
        <small style="color:var(--muted)">${esc(capitalName)}</small>
      </div>
    `;
  }

  const info = weatherCodeToInfo(weather.code, weather.isDay);
  let modelHtml = `<div class="wx-sun"></div>`;
  if (info.kind === "moon") modelHtml = `<div class="wx-moon"></div>`;
  else if (info.kind === "cloud" || info.kind === "fog") modelHtml = `<div class="wx-cloud"></div>`;
  else if (info.kind === "partly") modelHtml = `<div class="wx-sun" style="transform:translate(10px,-8px) scale(0.76)"></div><div class="wx-cloud" style="position:absolute"></div>`;
  else if (info.kind === "rain" || info.kind === "storm") {
    modelHtml = `<div class="wx-cloud"></div><div class="wx-drops"><span></span><span></span><span></span></div>`;
  } else if (info.kind === "snow") {
    modelHtml = `<div class="wx-cloud"></div><div class="wx-drops"><span style="background:#e2e8f0"></span><span style="background:#e2e8f0"></span><span style="background:#e2e8f0"></span></div>`;
  }

  return `
    <span class="object-pod-label">Clima en vivo</span>
    <div class="weather-obj-3d">${modelHtml}</div>
    <div class="object-pod-foot">
      <span class="tabular" style="font-size:1.38rem;font-weight:800">${esc(weather.temp)} °C</span>
      <small style="color:var(--muted)">${esc(info.label)} · Viento ${esc(weather.wind)} km/h</small>
    </div>
  `;
}
