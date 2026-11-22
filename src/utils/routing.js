import { haversineKm } from "./formatters.js";
import { isIso3 } from "./sanitize.js";

/**
 * Finds the shortest land border path between two countries using BFS.
 * Normalizes border adjacency symmetrically so minor API asymmetries never break routes.
 */
export function findBorderRoute(originId, targetId, countryIndex) {
  if (!countryIndex.has(originId) || !countryIndex.has(targetId)) {
    return { found: false, reason: "invalid" };
  }

  if (originId === targetId) {
    const c = countryIndex.get(originId);
    return { found: true, path: [c], hops: 0, distanceKm: 0, directDistanceKm: 0 };
  }

  const adj = new Map();
  for (const [id, country] of countryIndex.entries()) {
    if (!adj.has(id)) adj.set(id, new Set());
    for (const neighbor of country.borders || []) {
      if (!countryIndex.has(neighbor)) continue;
      adj.get(id).add(neighbor);
      if (!adj.has(neighbor)) adj.set(neighbor, new Set());
      adj.get(neighbor).add(id);
    }
  }

  const queue = [originId];
  const visited = new Set([originId]);
  const parent = new Map();
  let reached = false;

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === targetId) {
      reached = true;
      break;
    }
    const neighbors = adj.get(current);
    if (!neighbors) continue;
    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        parent.set(next, current);
        queue.push(next);
      }
    }
  }

  const originCountry = countryIndex.get(originId);
  const targetCountry = countryIndex.get(targetId);
  const directDistanceKm = Math.round(haversineKm(originCountry.latlng, targetCountry.latlng));

  if (!reached) {
    return { found: false, reason: "no_land_route", directDistanceKm };
  }

  const path = [];
  let cursor = targetId;
  while (cursor) {
    path.unshift(countryIndex.get(cursor));
    cursor = parent.get(cursor);
  }

  let distanceKm = 0;
  for (let i = 0; i < path.length - 1; i++) {
    distanceKm += haversineKm(path[i].latlng, path[i + 1].latlng);
  }

  return {
    found: true,
    path,
    hops: path.length - 1,
    distanceKm: Math.round(distanceKm),
    directDistanceKm,
  };
}

/**
 * Reads Deep Link parameters from URL query string.
 */
export function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const country = (params.get("country") || "").toUpperCase();
  return {
    q: params.get("q") || "",
    region: params.get("region") || "",
    country: isIso3(country) ? country : null,
  };
}

/**
 * Synchronizes current query, region, and active country modal into the URL without reloading.
 */
export function syncUrlParams({ q, region, country }) {
  try {
    const url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");

    if (region) url.searchParams.set("region", region);
    else url.searchParams.delete("region");

    if (country && isIso3(country)) url.searchParams.set("country", country);
    else url.searchParams.delete("country");

    window.history.replaceState(null, "", url.toString());
  } catch {
    // Ignore history restrictions on unsupported origins
  }
}
