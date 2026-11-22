const nfInt = new Intl.NumberFormat("es-AR");
const nfDec = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

const REGION_ES = {
  Americas: "Américas",
  Europe: "Europa",
  Africa: "África",
  Asia: "Asia",
  Oceania: "Oceanía",
  Antarctic: "Antártida",
};

export function regionToEs(region) {
  return REGION_ES[region] || region || "Otras";
}

/**
 * Normalizes strings for accent-insensitive and case-insensitive search.
 */
export function normalizeText(str) {
  return String(str ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return "—";
  return nfInt.format(Math.round(num));
}

export function formatArea(area) {
  const num = Number(area);
  if (!Number.isFinite(num) || num <= 0) return "—";
  return `${nfInt.format(Math.round(num))} km²`;
}

export function formatDensity(population, area) {
  const pop = Number(population);
  const ar = Number(area);
  if (!Number.isFinite(pop) || !Number.isFinite(ar) || ar <= 0) return "—";
  return `${nfDec.format(pop / ar)} hab/km²`;
}

/**
 * Computes local time string and day/night state from an offset string like "UTC-03:00".
 */
export function getLocalTimeFromUtc(tzString) {
  const clean = String(tzString || "UTC").replace(/\u2212/g, "-").trim();
  let offsetMinutes = 0;

  if (clean !== "UTC") {
    const match = clean.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/i);
    if (match) {
      const sign = match[1] === "-" ? -1 : 1;
      const hours = parseInt(match[2], 10);
      const mins = parseInt(match[3] || "0", 10);
      offsetMinutes = sign * (hours * 60 + mins);
    }
  }

  const shifted = new Date(Date.now() + offsetMinutes * 60_000);
  const hh = shifted.getUTCHours();
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  const hhStr = String(hh).padStart(2, "0");

  return {
    timeStr: `${hhStr}:${mm}:${ss}`,
    isDay: hh >= 6 && hh < 19,
    offsetLabel: clean,
  };
}

/**
 * Haversine great-circle distance in kilometers between two [lat, lng] coordinates.
 */
export function haversineKm(coordA, coordB) {
  const [lat1, lon1] = coordA || [0, 0];
  const [lat2, lon2] = coordB || [0, 0];
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Initial compass bearing in degrees (0..360) from coordA to coordB.
 */
export function bearingDeg(coordA, coordB) {
  const [lat1, lon1] = coordA || [0, 0];
  const [lat2, lon2] = coordB || [0, 0];
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Maps Open-Meteo WMO weather codes to Spanish descriptions and 3D icon kinds.
 */
export function weatherCodeToInfo(code, isDay = 1) {
  const c = Number(code);
  if (c === 0) return { label: isDay ? "Despejado" : "Noche despejada", kind: isDay ? "sun" : "moon" };
  if (c >= 1 && c <= 2) return { label: "Algo nublado", kind: "partly" };
  if (c === 3) return { label: "Nublado", kind: "cloud" };
  if (c === 45 || c === 48) return { label: "Niebla", kind: "fog" };
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82)) return { label: "Lluvia / Llovizna", kind: "rain" };
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return { label: "Nieve", kind: "snow" };
  if (c >= 95) return { label: "Tormenta eléctrica", kind: "storm" };
  return { label: "Condición variable", kind: isDay ? "partly" : "cloud" };
}
