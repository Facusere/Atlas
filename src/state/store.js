import { loadPassport, savePassport } from "../api/cacheStore.js";
import { normalizeText } from "../utils/formatters.js";
import { isIso3 } from "../utils/sanitize.js";

const BATCH_SIZE = 24;

class AtlasStore {
  constructor() {
    const savedPassport = loadPassport();
    this.state = {
      countries: [],
      countryIndex: new Map(),
      numericIndex: new Map(),
      filtered: [],
      renderedCount: BATCH_SIZE,
      filters: {
        query: "",
        region: "",
        subregion: "",
        passportMode: "all", // "all" | "visited" | "wishlist"
        sortBy: "name",      // "name" | "population" | "area" | "density"
        sortDir: "asc",
      },
      visited: savedPassport.visited,
      wishlist: new Set(savedPassport.wishlist),
      compareList: [],
      activeCountryId: null,
      modalFace: "front",
      activeRoute: null,
      globe: {
        solarTerminator: true,
        autoRotate: true,
        showClouds: true,
        showPins: true,
        collapsed: false,
      },
      status: "loading", // "loading" | "ready" | "error"
      dataSource: "",
      errorMessage: "",
    };

    this.listeners = new Map();
    this.collator = new Intl.Collator("es", { sensitivity: "base" });
  }

  subscribe(topic, fn) {
    if (!this.listeners.has(topic)) this.listeners.set(topic, new Set());
    this.listeners.get(topic).add(fn);
    return () => this.listeners.get(topic)?.delete(fn);
  }

  emit(topic) {
    const set = this.listeners.get(topic);
    if (set) set.forEach((fn) => fn(this.state));
  }

  setLoading() {
    this.state.status = "loading";
    this.state.errorMessage = "";
    this.emit("status");
  }

  setError(msg) {
    this.state.status = "error";
    this.state.errorMessage = msg || "No se pudo cargar la información de los países.";
    this.emit("status");
  }

  setCountries(countries, source) {
    this.state.countries = countries;
    this.state.countryIndex = new Map(countries.map((c) => [c.id, c]));
    this.state.numericIndex = new Map(
      countries.filter((c) => c.numericCode).map((c) => [c.numericCode, c])
    );
    this.state.status = "ready";
    this.state.dataSource = source;
    this.applyFilters(false);
    this.emit("status");
    this.emit("countries");
  }

  setFilter(patch) {
    const prevRegion = this.state.filters.region;
    Object.assign(this.state.filters, patch);
    if (patch.region !== undefined && patch.region !== prevRegion && patch.subregion === undefined) {
      this.state.filters.subregion = "";
    }
    this.applyFilters(true);
  }

  applyFilters(resetBatch = true) {
    const { query, region, subregion, passportMode, sortBy, sortDir } = this.state.filters;
    const q = normalizeText(query);

    const list = this.state.countries.filter((c) => {
      if (q && !c.searchKey.includes(q)) return false;
      if (region && c.region !== region) return false;
      if (subregion && c.subregion !== subregion) return false;
      if (passportMode === "visited" && !this.state.visited[c.id]) return false;
      if (passportMode === "wishlist" && !this.state.wishlist.has(c.id)) return false;
      return true;
    });

    const dir = sortDir === "desc" ? -1 : 1;
    list.sort((a, b) => {
      if (sortBy === "population") return (a.population - b.population) * dir;
      if (sortBy === "area") return (a.area - b.area) * dir;
      if (sortBy === "density") return (a.density - b.density) * dir;
      return this.collator.compare(a.nameEs, b.nameEs) * dir;
    });

    this.state.filtered = list;
    if (resetBatch) this.state.renderedCount = BATCH_SIZE;
    this.emit("filters");
  }

  loadMoreBatch() {
    if (this.state.renderedCount >= this.state.filtered.length) return;
    this.state.renderedCount = Math.min(
      this.state.filtered.length,
      this.state.renderedCount + BATCH_SIZE
    );
    this.emit("batch");
  }

  showAllFiltered() {
    this.state.renderedCount = this.state.filtered.length;
    this.emit("batch");
  }

  persistPassport() {
    savePassport({
      visited: this.state.visited,
      wishlist: [...this.state.wishlist],
    });
  }

  toggleVisited(id) {
    if (this.state.visited[id]) {
      delete this.state.visited[id];
    } else {
      this.state.visited[id] = new Date().toISOString().slice(0, 10);
      this.state.wishlist.delete(id);
    }
    this.persistPassport();
    if (this.state.filters.passportMode !== "all") this.applyFilters(false);
    this.emit("passport");
  }

  toggleWishlist(id) {
    if (this.state.wishlist.has(id)) {
      this.state.wishlist.delete(id);
    } else {
      this.state.wishlist.add(id);
      if (this.state.visited[id]) delete this.state.visited[id];
    }
    this.persistPassport();
    if (this.state.filters.passportMode !== "all") this.applyFilters(false);
    this.emit("passport");
  }

  resetPassport() {
    this.state.visited = {};
    this.state.wishlist = new Set();
    this.persistPassport();
    if (this.state.filters.passportMode !== "all") this.applyFilters(false);
    this.emit("passport");
  }

  importPassport(payload) {
    const nextVisited = {};
    if (payload?.visited && typeof payload.visited === "object") {
      for (const [id, dateVal] of Object.entries(payload.visited)) {
        const cleanId = String(id).toUpperCase();
        if (isIso3(cleanId) && this.state.countryIndex.has(cleanId)) {
          nextVisited[cleanId] = typeof dateVal === "string" ? dateVal.slice(0, 10) : new Date().toISOString().slice(0, 10);
        }
      }
    }
    const nextWishlist = new Set();
    if (Array.isArray(payload?.wishlist)) {
      for (const rawId of payload.wishlist) {
        const cleanId = String(rawId).toUpperCase();
        if (isIso3(cleanId) && this.state.countryIndex.has(cleanId) && !nextVisited[cleanId]) {
          nextWishlist.add(cleanId);
        }
      }
    }
    this.state.visited = nextVisited;
    this.state.wishlist = nextWishlist;
    this.persistPassport();
    if (this.state.filters.passportMode !== "all") this.applyFilters(false);
    this.emit("passport");
  }

  toggleCompare(id) {
    const idx = this.state.compareList.indexOf(id);
    if (idx >= 0) {
      this.state.compareList.splice(idx, 1);
    } else {
      if (this.state.compareList.length >= 3) {
        this.state.compareList.shift();
      }
      this.state.compareList.push(id);
    }
    this.emit("compare");
  }

  clearCompare() {
    this.state.compareList = [];
    this.emit("compare");
  }

  openCountry(id) {
    if (!this.state.countryIndex.has(id)) return;
    this.state.activeCountryId = id;
    this.state.modalFace = "front";
    this.emit("activeCountry");
  }

  closeCountry() {
    this.state.activeCountryId = null;
    this.emit("activeCountry");
  }

  setModalFace(face) {
    this.state.modalFace = face === "back" ? "back" : "front";
    this.emit("modalFace");
  }

  setActiveRoute(route) {
    this.state.activeRoute = route;
    this.emit("route");
  }

  clearActiveRoute() {
    this.state.activeRoute = null;
    this.emit("route");
  }

  toggleGlobeOption(key) {
    this.state.globe[key] = !this.state.globe[key];
    this.emit("globe");
  }

  getSubregionsFor(region) {
    const set = new Set();
    for (const c of this.state.countries) {
      if ((!region || c.region === region) && c.subregion) {
        set.add(c.subregion);
      }
    }
    return [...set].sort((a, b) => this.collator.compare(a, b));
  }
}

export const store = new AtlasStore();
