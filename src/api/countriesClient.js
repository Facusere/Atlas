import { getCache, getStaleCache, setCache } from "./cacheStore.js";
import { normalizeText } from "../utils/formatters.js";
import { isIso3, safeUrl } from "../utils/sanitize.js";

const WORLD_COUNTRIES_URL = "https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json";
const POPULATION_URL = "https://cdn.jsdelivr.net/gh/samayo/country-json@master/src/country-by-population.json";
const TIMEZONES_ESM_URL = "https://cdn.jsdelivr.net/npm/countries-and-timezones@latest/+esm";
const FX_PRIMARY_URL = "https://open.er-api.com/v6/latest/USD";
const FX_FALLBACK_URL = "https://api.frankfurter.app/latest?from=USD";

const COUNTRIES_CACHE_KEY = "atlas:countries:v5";
const FX_CACHE_KEY = "atlas:fx:v1";
const COUNTRIES_TTL_MS = 24 * 60 * 60 * 1000;
const FX_TTL_MS = 6 * 60 * 60 * 1000;
const WEATHER_TTL_MS = 15 * 60 * 1000;
const WIKI_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function fetchJson(url, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRegion(region) {
  if (!region) return "Other";
  if (/polar|antarctic/i.test(region)) return "Antarctic";
  return region;
}

function parseCurrencies(rawCurrencies) {
  if (Array.isArray(rawCurrencies)) {
    return rawCurrencies
      .filter((c) => c && (c.name || c.code))
      .map((c) => ({
        code: String(c.code || "—").toUpperCase(),
        name: String(c.name || c.code || "Divisa"),
        symbol: String(c.symbol || c.code || "$"),
      }));
  }
  if (rawCurrencies && typeof rawCurrencies === "object") {
    return Object.entries(rawCurrencies).map(([code, c]) => ({
      code: code.toUpperCase(),
      name: String(c?.name || code),
      symbol: String(c?.symbol || code),
    }));
  }
  return [];
}

function parseLanguages(rawLanguages) {
  if (Array.isArray(rawLanguages)) {
    return rawLanguages.map((l) => l?.nativeName || l?.name).filter(Boolean);
  }
  if (rawLanguages && typeof rawLanguages === "object") {
    return Object.values(rawLanguages).filter(Boolean);
  }
  return [];
}

function parseCallingCode(raw) {
  if (Array.isArray(raw.callingCodes) && raw.callingCodes[0]) {
    return `+${String(raw.callingCodes[0]).replace(/^\+/, "")}`;
  }
  if (raw.idd?.root) {
    const suffix = Array.isArray(raw.idd.suffixes) && raw.idd.suffixes[0] ? raw.idd.suffixes[0] : "";
    return `${raw.idd.root}${suffix}`;
  }
  return "—";
}

/**
 * Normalizes records from either apicountries.com or world-countries fallback into a uniform model.
 */
export function normalizeCountry(raw, fallbackPopMap = null, tzResolver = null) {
  const id = String(raw.alpha3Code || raw.cca3 || "").toUpperCase();
  if (!isIso3(id)) return null;

  const alpha2 = String(raw.alpha2Code || raw.cca2 || "").toLowerCase();
  const numericRaw = String(raw.numericCode || raw.ccn3 || "").trim();
  const numericCode = numericRaw ? numericRaw.padStart(3, "0") : "";

  const nameEn = typeof raw.name === "string" ? raw.name : (raw.name?.common || id);
  const officialEn = typeof raw.name === "string" ? raw.name : (raw.name?.official || nameEn);
  const nameEs =
    (typeof raw.translations?.es === "string" && raw.translations.es) ||
    raw.translations?.spa?.common ||
    nameEn;
  const officialNameEs =
    raw.translations?.spa?.official ||
    nameEs;

  const capital = Array.isArray(raw.capital)
    ? raw.capital.filter(Boolean)
    : raw.capital
      ? [String(raw.capital)]
      : [];
  const capitalText = capital.join(", ") || "—";

  const latlngRaw = Array.isArray(raw.latlng) && raw.latlng.length >= 2
    ? raw.latlng
    : [0, 0];
  const lat = Number.isFinite(Number(latlngRaw[0])) ? Number(latlngRaw[0]) : 0;
  const lng = Number.isFinite(Number(latlngRaw[1])) ? Number(latlngRaw[1]) : 0;

  let population = Number(raw.population);
  if (!Number.isFinite(population) && fallbackPopMap) {
    population = Number(fallbackPopMap.get(normalizeText(nameEn)) ?? 0);
  }
  if (!Number.isFinite(population) || population < 0) population = 0;

  const area = Number.isFinite(Number(raw.area)) && Number(raw.area) > 0 ? Number(raw.area) : 0;
  const density = area > 0 ? population / area : 0;

  const flagSvg =
    safeUrl(raw.flags?.svg) ||
    safeUrl(raw.flags?.png) ||
    (alpha2 ? `https://flagcdn.com/${alpha2}.svg` : "");
  const flagPng =
    safeUrl(raw.flags?.png) ||
    (alpha2 ? `https://flagcdn.com/w640/${alpha2}.png` : "");
  const coatOfArmsUrl =
    safeUrl(raw.coatOfArms?.svg) ||
    (alpha2 ? `https://mainfacts.com/media/images/coats_of_arms/${alpha2}.svg` : "");

  const region = normalizeRegion(raw.region);
  const subregion = raw.subregion || region;
  const borders = Array.isArray(raw.borders)
    ? raw.borders.map((b) => String(b).toUpperCase()).filter(isIso3)
    : [];

  let timezones = Array.isArray(raw.timezones) && raw.timezones.length ? raw.timezones : [];
  if (!timezones.length && tzResolver && alpha2) {
    const tzObjs = tzResolver(alpha2.toUpperCase()) || [];
    const seen = new Set();
    for (const tz of tzObjs) {
      if (tz?.deprecated && tzObjs.some((t) => !t.deprecated)) continue;
      const offset = tz?.utcOffsetStr ? `UTC${tz.utcOffsetStr}` : "UTC";
      if (!seen.has(offset)) {
        seen.add(offset);
        timezones.push(offset);
      }
    }
  }
  if (!timezones.length) timezones = ["UTC"];

  const tld = Array.isArray(raw.topLevelDomain)
    ? raw.topLevelDomain
    : Array.isArray(raw.tld)
      ? raw.tld
      : [];

  return {
    id,
    alpha2: alpha2.toUpperCase(),
    numericCode,
    nameEs,
    officialNameEs,
    nameEn,
    officialEn,
    nativeName: raw.nativeName || nameEn,
    capital,
    capitalText,
    region,
    subregion,
    population,
    area,
    density,
    latlng: [lat, lng],
    borders,
    timezones,
    currencies: parseCurrencies(raw.currencies),
    languages: parseLanguages(raw.languages),
    flagSvg,
    flagPng,
    flagAlt: `Bandera de ${nameEs}`,
    coatOfArmsUrl,
    tld,
    callingCode: parseCallingCode(raw),
    independent: Boolean(raw.independent),
    searchKey: normalizeText([nameEs, officialNameEs, nameEn, raw.nativeName, capitalText, id, alpha2].join(" ")),
  };
}

/**
 * Loads all countries using CORS-safe jsDelivr datasets + Cache -> Stale Cache.
 */
export async function loadCountries() {
  const cached = getCache(COUNTRIES_CACHE_KEY);
  if (Array.isArray(cached) && cached.length > 0) {
    return { countries: cached, source: "cache" };
  }

  try {
    const [worldRaw, popRaw, tzModule] = await Promise.all([
      fetchJson(WORLD_COUNTRIES_URL, 10_000),
      fetchJson(POPULATION_URL, 8_000).catch(() => []),
      import(TIMEZONES_ESM_URL).catch(() => null),
    ]);

    const popMap = new Map(
      (Array.isArray(popRaw) ? popRaw : []).map((p) => [normalizeText(p.country), p.population])
    );
    const tzResolver = tzModule?.getTimezonesForCountry || null;

    const normalized = (Array.isArray(worldRaw) ? worldRaw : [])
      .map((item) => normalizeCountry(item, popMap, tzResolver))
      .filter(Boolean);

    if (normalized.length === 0) throw new Error("Empty countries dataset");
    setCache(COUNTRIES_CACHE_KEY, normalized, COUNTRIES_TTL_MS);
    return { countries: normalized, source: "jsdelivr-cdn" };
  } catch (err) {
    const stale = getStaleCache(COUNTRIES_CACHE_KEY);
    if (Array.isArray(stale) && stale.length > 0) {
      return { countries: stale, source: "stale-cache" };
    }
    throw err;
  }
}

/**
 * Fetches live weather at country/capital coordinates via Open-Meteo (free, no key).
 */
export async function fetchCapitalWeather(lat, lng) {
  const key = `atlas:wx:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = getCache(key);
  if (cached) return cached;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lng)}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,is_day`;
  const data = await fetchJson(url, 7_000);
  if (!data?.current) throw new Error("No weather data");

  const result = {
    temp: Math.round(data.current.temperature_2m),
    wind: Math.round(data.current.wind_speed_10m),
    code: data.current.weather_code,
    isDay: data.current.is_day,
  };
  setCache(key, result, WEATHER_TTL_MS);
  return result;
}

/**
 * Fetches concise Spanish cultural summary from Wikipedia REST API.
 */
export async function fetchWikiSummaryEs(country) {
  const key = `atlas:wiki:es:${country.id}`;
  const cached = getCache(key);
  if (cached) return cached;

  const candidates = [
    country.nameEs,
    `${country.nameEs} (país)`,
    country.officialNameEs,
    country.nameEn,
  ].filter(Boolean);

  for (const title of candidates) {
    try {
      const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const data = await fetchJson(url, 6_000);
      if (data?.type === "disambiguation" || !data?.extract) continue;

      const summary = {
        title: data.title || country.nameEs,
        extract: data.extract,
        pageUrl: safeUrl(data.content_urls?.desktop?.page) || "",
      };
      setCache(key, summary, WIKI_TTL_MS);
      return summary;
    } catch {
      // Try next title candidate
    }
  }
  return null;
}

/**
 * Fetches USD-based exchange rates (160+ currencies via open.er-api with Frankfurter fallback).
 */
export async function fetchExchangeRates() {
  const cached = getCache(FX_CACHE_KEY);
  if (cached?.rates) return cached;

  try {
    const data = await fetchJson(FX_PRIMARY_URL, 7_000);
    if (!data?.rates || typeof data.rates !== "object") throw new Error("Invalid FX payload");
    const result = {
      base: "USD",
      rates: { USD: 1, ...data.rates },
      updatedAt: data.time_last_update_utc ? data.time_last_update_utc.slice(0, 16) : "Hoy",
    };
    setCache(FX_CACHE_KEY, result, FX_TTL_MS);
    return result;
  } catch {
    const fb = await fetchJson(FX_FALLBACK_URL, 7_000);
    if (!fb?.rates) throw new Error("FX unavailable");
    const result = {
      base: "USD",
      rates: { USD: 1, ...fb.rates },
      updatedAt: fb.date || "Hoy",
    };
    setCache(FX_CACHE_KEY, result, FX_TTL_MS);
    return result;
  }
}
