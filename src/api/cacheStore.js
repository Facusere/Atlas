const memoryCache = new Map();

export const PASSPORT_KEY = "atlas:passport:v1";
export const QUIZ_KEY = "atlas:quiz:v1";

export function getCache(key) {
  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key);
    if (!entry.expiresAt || entry.expiresAt > Date.now()) {
      return entry.value;
    }
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt && parsed.expiresAt <= Date.now()) {
      return null;
    }
    memoryCache.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

export function getStaleCache(key) {
  if (memoryCache.has(key)) return memoryCache.get(key).value;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw).value ?? null;
  } catch {
    return null;
  }
}

export function setCache(key, value, ttlMs = 0) {
  const payload = {
    value,
    expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
  };
  memoryCache.set(key, payload);
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPassport() {
  try {
    const raw = window.localStorage.getItem(PASSPORT_KEY);
    if (!raw) return { visited: {}, wishlist: [] };
    const parsed = JSON.parse(raw);
    return {
      visited: parsed && typeof parsed.visited === "object" && parsed.visited ? parsed.visited : {},
      wishlist: Array.isArray(parsed?.wishlist) ? parsed.wishlist : [],
    };
  } catch {
    return { visited: {}, wishlist: [] };
  }
}

export function savePassport(passport) {
  try {
    window.localStorage.setItem(PASSPORT_KEY, JSON.stringify(passport));
  } catch {
    // Ignore storage errors
  }
}

export function loadQuizStats() {
  try {
    const raw = window.localStorage.getItem(QUIZ_KEY);
    if (!raw) return { bestStreaks: {}, totalCorrect: 0, totalPlayed: 0 };
    const parsed = JSON.parse(raw);
    return {
      bestStreaks: parsed?.bestStreaks && typeof parsed.bestStreaks === "object" ? parsed.bestStreaks : {},
      totalCorrect: Number(parsed?.totalCorrect) || 0,
      totalPlayed: Number(parsed?.totalPlayed) || 0,
    };
  } catch {
    return { bestStreaks: {}, totalCorrect: 0, totalPlayed: 0 };
  }
}

export function saveQuizStats(stats) {
  try {
    window.localStorage.setItem(QUIZ_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage errors
  }
}
