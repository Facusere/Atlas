const WORLD_50M_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
const WORLD_110M_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

let geoPromise = null;

/**
 * Loads TopoJSON world geometry once and indexes features by zero-padded ISO numeric code.
 */
export function loadWorldGeo() {
  if (geoPromise) return geoPromise;

  geoPromise = (async () => {
    const topojson = await import("topojson-client");
    let atlas;
    try {
      const res = await fetch(WORLD_50M_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      atlas = await res.json();
    } catch {
      const res = await fetch(WORLD_110M_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      atlas = await res.json();
    }

    const geo = topojson.feature(atlas, atlas.objects.countries);
    const features = geo.features || [];
    const byNumericCode = new Map();
    const toPolys = (g) =>
      g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : [];

    for (const feat of features) {
      if (feat.id === undefined || feat.id === null) continue;
      const code = String(feat.id).padStart(3, "0");
      if (byNumericCode.has(code)) {
        const prev = byNumericCode.get(code);
        byNumericCode.set(code, {
          ...prev,
          geometry: {
            type: "MultiPolygon",
            coordinates: [...toPolys(prev.geometry), ...toPolys(feat.geometry)],
          },
        });
      } else {
        byNumericCode.set(code, feat);
      }
    }
    return { features, byNumericCode };
  })().catch((err) => {
    geoPromise = null;
    throw err;
  });

  return geoPromise;
}

function ringShoelaceArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(sum) * 0.5;
}

function ringCentroid(ring) {
  let sx = 0;
  let sy = 0;
  const n = ring.length || 1;
  for (const pt of ring) {
    sx += pt[0];
    sy += pt[1];
  }
  return [sx / n, sy / n];
}

function unwrapLng(lng, refLng) {
  let d = lng - refLng;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return refLng + d;
}

/**
 * Extracts and projects polygons of a GeoJSON feature into true kilometer offsets
 * around its primary landmass center (compensating cos(latitude) to avoid Mercator distortion).
 */
export function projectFeatureToKm(feature, fallbackLatLng = [0, 0]) {
  if (!feature?.geometry) return null;
  const rawPolys =
    feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.type === "MultiPolygon"
        ? feature.geometry.coordinates
        : [];
  if (!rawPolys.length) return null;

  // Score each polygon by outer ring area to locate the main landmass
  const scored = rawPolys
    .map((poly) => {
      const outer = poly[0] || [];
      const area = ringShoelaceArea(outer);
      const center = ringCentroid(outer);
      return { poly, area, center };
    })
    .filter((p) => p.poly[0]?.length >= 3 && p.area > 0)
    .sort((a, b) => b.area - a.area);

  if (!scored.length) return null;

  const mainArea = scored[0].area;
  const refLng = scored[0].center[0] ?? fallbackLatLng[1] ?? 0;
  const refLat = scored[0].center[1] ?? fallbackLatLng[0] ?? 0;

  // Keep primary landmass, nearby islands (<32 deg), or major detached regions (>=10% area, e.g. Alaska)
  const selected = scored.filter((p) => {
    const dLng = Math.abs(unwrapLng(p.center[0], refLng) - refLng);
    const dLat = Math.abs(p.center[1] - refLat);
    return (dLng < 32 && dLat < 28) || p.area >= mainArea * 0.1;
  });

  // Recompute weighted center across selected polygons
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const toKm = (lng, lat) => {
    const uLng = unwrapLng(lng, refLng);
    const x = (uLng - refLng) * 111.32 * Math.cos((lat * Math.PI) / 180);
    const y = (lat - refLat) * 111.32;
    return [x, y];
  };

  const polygonsKm = selected.map(({ poly }) =>
    poly.map((ring) =>
      ring.map(([lng, lat]) => {
        const [x, y] = toKm(lng, lat);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        return [x, y];
      })
    )
  );

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const centeredPolys = polygonsKm.map((poly) =>
    poly.map((ring) => ring.map(([x, y]) => [x - cx, y - cy]))
  );

  const capitalKm = fallbackLatLng
    ? (() => {
        const [kx, ky] = toKm(fallbackLatLng[1], fallbackLatLng[0]);
        return [kx - cx, ky - cy];
      })()
    : [0, 0];

  return {
    polygons: centeredPolys,
    widthKm: Math.max(1, maxX - minX),
    heightKm: Math.max(1, maxY - minY),
    capitalKm,
  };
}
