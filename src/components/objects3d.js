import { esc, safeUrl } from "../utils/sanitize.js";
import { getLocalTimeFromUtc, weatherCodeToInfo } from "../utils/formatters.js";

/**
 * 3D Coat of Arms Medallion with safe image fallback to embossed ISO3 monogram.
 */
export function renderCoatOfArmsPod(country) {
  const safeCoat = safeUrl(country.coatOfArmsUrl);
  const inner = safeCoat
    ? `<img src="${esc(safeCoat)}" alt="Escudo de ${esc(country.nameEs)}" loading="lazy" data-coat-fallback="${esc(country.id)}">`
    : `<span class="crest-fallback">${esc(country.id)}</span>`;

  return `
    <div class="object-pod">
      <span class="object-pod-label">Escudo 3D</span>
      <div class="crest-medallion">
        <div class="crest-inner">${inner}</div>
      </div>
      <small style="color:var(--muted)">Emblema nacional</small>
    </div>
  `;
}

/**
 * 3D Spinning Currency Coins (click any coin to flip between front symbol & back name).
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
    <div class="object-pod">
      <span class="object-pod-label">Moneda 3D (clic)</span>
      <div class="coin-stage">${coinsHtml}</div>
      <small style="color:var(--muted)">${esc(list.map((c) => `${c.name} (${c.code})`).join(" · "))}</small>
      ${primaryCode ? `<button type="button" class="btn btn-pill" id="detail-fx-toggle" data-fx-code="${esc(primaryCode)}">💱 Convertir ${esc(primaryCode)}</button>` : ""}
    </div>
  `;
}

/**
 * 3D Cartographic Compass + Live Local Clock Pod.
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
      <span class="live-clock-pill tabular" id="detail-live-clock" data-tz="${esc(primaryTz)}">
        ${initialClock.isDay ? "☀️" : "🌙"} ${esc(initialClock.timeStr)}
      </span>
      <small style="color:var(--muted)">${esc(primaryTz)}</small>
    </div>
  `;
}

/**
 * 3D Mini Weather Object Container (updated asynchronously by Open-Meteo).
 */
export function renderWeatherPodSkeleton(capitalName) {
  return `
    <div class="object-pod" id="detail-weather-pod">
      <span class="object-pod-label">Clima en vivo</span>
      <div class="weather-obj-3d"><div class="wx-cloud" style="opacity:0.45"></div></div>
      <span class="tabular" style="font-weight:700">Consultando…</span>
      <small style="color:var(--muted)">${esc(capitalName)}</small>
    </div>
  `;
}

export function renderWeatherPodContent(weather, capitalName) {
  if (!weather) {
    return `
      <span class="object-pod-label">Clima en vivo</span>
      <div class="weather-obj-3d"><div class="wx-cloud" style="opacity:0.4"></div></div>
      <span>No disponible</span>
      <small style="color:var(--muted)">${esc(capitalName)}</small>
    `;
  }

  const info = weatherCodeToInfo(weather.code, weather.isDay);
  let modelHtml = `<div class="wx-sun"></div>`;
  if (info.kind === "moon") modelHtml = `<div class="wx-moon"></div>`;
  else if (info.kind === "cloud" || info.kind === "fog") modelHtml = `<div class="wx-cloud"></div>`;
  else if (info.kind === "partly") modelHtml = `<div class="wx-sun" style="transform:translate(8px,-6px) scale(0.75)"></div><div class="wx-cloud" style="position:absolute"></div>`;
  else if (info.kind === "rain" || info.kind === "storm") {
    modelHtml = `<div class="wx-cloud"></div><div class="wx-drops"><span></span><span></span><span></span></div>`;
  } else if (info.kind === "snow") {
    modelHtml = `<div class="wx-cloud"></div><div class="wx-drops"><span style="background:#e2e8f0"></span><span style="background:#e2e8f0"></span><span style="background:#e2e8f0"></span></div>`;
  }

  return `
    <span class="object-pod-label">Clima en vivo</span>
    <div class="weather-obj-3d">${modelHtml}</div>
    <span class="tabular" style="font-size:1.15rem;font-weight:800">${esc(weather.temp)} °C</span>
    <small style="color:var(--muted)">${esc(info.label)} · Viento ${esc(weather.wind)} km/h</small>
  `;
}
