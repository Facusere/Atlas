import { store } from "./state/store.js";
import { loadCountries } from "./api/countriesClient.js";
import { GlobeController } from "./components/globe3d.js";
import { CardGridController } from "./components/cardGrid.js";
import { DetailModalController } from "./components/detailModal.js";
import { RouteModalController } from "./components/routeModal.js";
import { PassportModalController } from "./components/passportModal.js";
import { ComparatorController } from "./components/comparator3d.js";
import { QuizModalController } from "./components/quizModal.js";
import { CommandPaletteController } from "./components/commandPalette.js";
import { readUrlParams, syncUrlParams } from "./utils/routing.js";
import { formatNumber } from "./utils/formatters.js";
import { esc } from "./utils/sanitize.js";

const $ = (id) => document.getElementById(id);

const globe = new GlobeController({
  wrapEl: $("globe-canvas-wrap"),
  tooltipEl: $("globe-tooltip"),
  onSelectCountry: (id) => detailModal.open(id),
});

const comparator = new ComparatorController({
  dockEl: $("compare-dock"),
  dialogEl: $("compare-modal"),
  store,
  onOpenCountry: (id) => detailModal.open(id),
});

const passportModal = new PassportModalController({
  dialogEl: $("passport-modal"),
  store,
  onOpenCountry: (id) => detailModal.open(id),
});

const quizModal = new QuizModalController({
  dialogEl: $("quiz-modal"),
  store,
  globe,
});

const routeModal = new RouteModalController({
  dialogEl: $("route-modal"),
  store,
  globe,
  onOpenCountry: (id) => detailModal.open(id),
  onProjectGlobe: (route) => {
    if (store.state.globe.collapsed) {
      store.toggleGlobeOption("collapsed");
    }
    globe.showLandRoute(route);
    $("globe-section").scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
});

const detailModal = new DetailModalController({
  dialogEl: $("country-modal"),
  store,
  globe,
  onOpenRouteWith: (originId) => routeModal.open(originId),
});

const cardGrid = new CardGridController({
  gridEl: $("grid"),
  countEl: $("results-count"),
  loadMoreBtn: $("load-all-btn"),
  sentinelEl: $("sentinel"),
  store,
  onOpenCountry: (id) => detailModal.open(id),
});

const commandPalette = new CommandPaletteController({
  dialogEl: $("cmd-modal"),
  store,
  actions: {
    openCountry: (id) => detailModal.open(id),
    openRoutes: () => routeModal.open(store.state.activeCountryId || "ARG"),
    openQuiz: () => quizModal.open(),
    openPassport: () => passportModal.open(),
    openRandomCountry: () => openRandomCountry(),
    toggleSolar: () => store.toggleGlobeOption("solarTerminator"),
    resetFilters: () => resetAllFilters(),
  },
});

function openRandomCountry() {
  const pool = store.state.filtered.length ? store.state.filtered : store.state.countries;
  if (!pool.length) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  detailModal.open(pick.id);
}

function resetAllFilters() {
  $("q").value = "";
  $("reg").value = "";
  $("subreg").value = "";
  $("ord").value = "name";
  store.setFilter({
    query: "",
    region: "",
    subregion: "",
    passportMode: "all",
    sortBy: "name",
    sortDir: "asc",
  });
}

function updateTopbarPassportBadge() {
  const visitedCount = Object.keys(store.state.visited).filter((id) => store.state.countryIndex.has(id)).length;
  const badge = $("passport-count-badge");
  if (badge) badge.textContent = String(visitedCount);
}

function updateSubregionSelect() {
  const sel = $("subreg");
  const current = store.state.filters.subregion;
  const list = store.getSubregionsFor(store.state.filters.region);
  sel.innerHTML = `<option value="">Todas las subregiones</option>` +
    list.map((sr) => `<option value="${esc(sr)}">${esc(sr)}</option>`).join("");
  sel.value = list.includes(current) ? current : "";
}

function updateGlobeHud() {
  const g = store.state.globe;
  $("globe-section").classList.toggle("is-collapsed", g.collapsed);
  $("toggle-globe-btn").textContent = g.collapsed ? "Mostrar Globo 3D" : "Ocultar Globo";
  $("toggle-solar-btn").textContent = g.solarTerminator ? "🌗 Día/Noche Real" : "☀️ Luz Completa";
  $("toggle-rotate-btn").textContent = g.autoRotate ? "⏸ Pausar giro" : "▶ Girar";
  globe.updateGlobeOptions(g);
}

function updateRouteBanner() {
  const banner = $("globe-route-banner");
  const route = store.state.activeRoute;
  if (!route?.found) {
    banner.classList.remove("is-visible");
    banner.innerHTML = "";
    return;
  }
  const names = route.path.map((c) => esc(c.nameEs)).join(" → ");
  banner.innerHTML = `
    <span>🧭 <strong>${esc(route.hops)} fronteras</strong> (${esc(formatNumber(route.distanceKm))} km): ${names}</span>
    <button type="button" class="btn btn-pill" id="banner-clear-route">✕</button>
  `;
  banner.classList.add("is-visible");
  $("banner-clear-route")?.addEventListener("click", () => {
    store.clearActiveRoute();
    globe.clearArcs();
  });
}

function syncToolbarControls() {
  const { query, region, passportMode, sortDir } = store.state.filters;
  $("q-clear").classList.toggle("is-visible", Boolean(query));
  document.documentElement.dataset.region = region || "";
  $("ord-dir").textContent = sortDir === "asc" ? "↑ Asc" : "↓ Desc";

  document.querySelectorAll("[data-passport-filter]").forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.passportFilter === passportMode);
  });
}

function bindToolbarEvents() {
  let debounceTimer = null;
  $("q").addEventListener("input", (e) => {
    const val = e.target.value;
    $("q-clear").classList.toggle("is-visible", Boolean(val));
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      store.setFilter({ query: val });
    }, 140);
  });

  $("q-clear").addEventListener("click", () => {
    $("q").value = "";
    store.setFilter({ query: "" });
    $("q").focus();
  });

  $("reg").addEventListener("change", (e) => {
    store.setFilter({ region: e.target.value });
    updateSubregionSelect();
  });

  $("subreg").addEventListener("change", (e) => {
    store.setFilter({ subregion: e.target.value });
  });

  $("ord").addEventListener("change", (e) => {
    const sortBy = e.target.value;
    const defaultDir = sortBy === "name" ? "asc" : "desc";
    store.setFilter({ sortBy, sortDir: defaultDir });
  });

  $("ord-dir").addEventListener("click", () => {
    const nextDir = store.state.filters.sortDir === "asc" ? "desc" : "asc";
    store.setFilter({ sortDir: nextDir });
  });

  document.querySelectorAll("[data-passport-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      store.setFilter({ passportMode: btn.dataset.passportFilter });
    });
  });

  $("open-passport-btn").addEventListener("click", () => passportModal.open());
  $("open-routes-btn").addEventListener("click", () => routeModal.open(store.state.activeCountryId || "ARG"));
  $("open-quiz-btn").addEventListener("click", () => quizModal.open());
  $("random-country-btn").addEventListener("click", () => openRandomCountry());
  $("open-cmd-btn").addEventListener("click", () => commandPalette.open());

  $("toggle-solar-btn").addEventListener("click", () => store.toggleGlobeOption("solarTerminator"));
  $("toggle-rotate-btn").addEventListener("click", () => store.toggleGlobeOption("autoRotate"));
  $("toggle-globe-btn").addEventListener("click", () => store.toggleGlobeOption("collapsed"));
}

function subscribeStore() {
  store.subscribe("filters", () => {
    syncToolbarControls();
    cardGrid.render();
    globe.updatePins(store.state);
    globe.refreshTextures(store.state);
    syncUrlParams({
      q: store.state.filters.query,
      region: store.state.filters.region,
      country: store.state.activeCountryId,
    });
  });

  store.subscribe("batch", () => cardGrid.render());

  store.subscribe("passport", () => {
    updateTopbarPassportBadge();
    cardGrid.render();
    globe.updatePins(store.state);
    globe.refreshTextures(store.state);
  });

  store.subscribe("compare", () => {
    cardGrid.render();
    comparator.renderDock();
  });

  store.subscribe("activeCountry", () => {
    globe.updatePins(store.state);
    globe.refreshTextures(store.state);
    if (!store.state.activeCountryId && !store.state.activeRoute) {
      globe.clearArcs();
    }
    syncUrlParams({
      q: store.state.filters.query,
      region: store.state.filters.region,
      country: store.state.activeCountryId,
    });
  });

  store.subscribe("route", () => updateRouteBanner());
  store.subscribe("globe", () => updateGlobeHud());
}

async function bootstrap() {
  bindToolbarEvents();
  subscribeStore();
  updateGlobeHud();
  cardGrid.renderSkeletons();
  store.setLoading();

  try {
    const { countries, source } = await loadCountries();
    store.setCountries(countries, source);

    const urlState = readUrlParams();
    if (urlState.q) $("q").value = urlState.q;
    if (urlState.region) $("reg").value = urlState.region;
    store.setFilter({ query: urlState.q, region: urlState.region });

    updateSubregionSelect();
    updateTopbarPassportBadge();
    syncToolbarControls();
    cardGrid.render();

    await globe.init(store.state);

    if (urlState.country && store.state.countryIndex.has(urlState.country)) {
      detailModal.open(urlState.country);
    }
  } catch (err) {
    store.setError("No se pudieron obtener los datos geográficos. Verificá tu conexión e intentá nuevamente.");
    cardGrid.renderError(store.state.errorMessage, bootstrap);
  }
}

bootstrap();
