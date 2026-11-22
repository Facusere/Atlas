import { esc, isIso3, safeUrl } from "../utils/sanitize.js";
import {
  bearingDeg,
  formatArea,
  formatDensity,
  formatNumber,
  getLocalTimeFromUtc,
  regionToEs,
} from "../utils/formatters.js";
import { fetchCapitalWeather, fetchExchangeRates, fetchWikiSummaryEs } from "../api/countriesClient.js";
import { loadWorldGeo } from "../api/worldGeo.js";
import { WavingFlag3D } from "./flag3d.js";
import { CountrySilhouette3D } from "./silhouette3d.js";
import {
  renderCoatOfArmsPod,
  renderCompassClockPod,
  renderCurrencyPod,
  renderWeatherPodContent,
  renderWeatherPodSkeleton,
} from "./objects3d.js";

const REGION_ACCENT_HEX = {
  Americas: 0x10b981,
  Europe: 0x3b82f6,
  Africa: 0xf59e0b,
  Asia: 0xef4444,
  Oceania: 0x06b6d4,
  Antarctic: 0x818cf8,
};

const POPULAR_FX = ["USD", "EUR", "ARS", "BRL", "MXN", "CLP", "COP", "UYU", "GBP", "JPY"];

export class DetailModalController {
  constructor({ dialogEl, store, globe, onOpenRouteWith }) {
    this.dialogEl = dialogEl;
    this.store = store;
    this.globe = globe;
    this.onOpenRouteWith = onOpenRouteWith;

    this.clockTimer = null;
    this.renderToken = 0;
    this.leafletMap = null;
    this.flag3d = null;
    this.silhouette3d = null;

    this.dialogEl.addEventListener("close", () => {
      this.stopClock();
      this.dispose3D();
      if (this.store.state.activeCountryId) {
        this.store.closeCountry();
      }
    });

    this.dialogEl.addEventListener("click", (e) => {
      if (e.target === this.dialogEl) this.dialogEl.close();
    });
  }

  dispose3D() {
    this.flag3d?.dispose();
    this.flag3d = null;
    this.silhouette3d?.dispose();
    this.silhouette3d = null;
  }

  open(countryId) {
    const state = this.store.state;
    const country = state.countryIndex.get(countryId);
    if (!country) return;

    const alreadyOpen = this.dialogEl.open;
    this.store.openCountry(countryId);
    this.globe.flyTo(country.latlng[0], country.latlng[1], 2.2);
    this.globe.showCountryBorderArcs(country, state.countryIndex);

    const applyRender = () => {
      this.render(country);
      if (!alreadyOpen) this.dialogEl.showModal();
    };

    if (
      !alreadyOpen &&
      typeof document.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      try {
        document.startViewTransition(applyRender);
      } catch {
        applyRender();
      }
    } else {
      applyRender();
    }
  }

  stopClock() {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  render(country) {
    this.stopClock();
    this.dispose3D();
    const token = ++this.renderToken;
    const state = this.store.state;
    const isVisited = Boolean(state.visited[country.id]);
    const isWishlist = state.wishlist.has(country.id);
    const isCompare = state.compareList.includes(country.id);

    const borders = (country.borders || [])
      .map((b) => state.countryIndex.get(b))
      .filter(Boolean);

    const bordersHtml = borders.length
      ? borders
          .map((n) => {
            const nFlag = safeUrl(n.flagSvg);
            return `
              <button type="button" class="border-btn" data-neighbor="${esc(n.id)}">
                ${nFlag ? `<img src="${esc(nFlag)}" alt="" loading="lazy">` : ""}
                <span>${esc(n.nameEs)}</span>
              </button>
            `;
          })
          .join("")
      : `<span style="color:var(--muted);font-size:0.86rem">Sin fronteras terrestres (territorio insular)</span>`;

    const languagesText = country.languages.length ? country.languages.join(", ") : "—";
    const tldText = country.tld.length ? country.tld.join(", ") : "—";

    this.dialogEl.innerHTML = `
      <div class="flip-scene">
        <div class="flip-card" id="detail-flip-card">
          <section class="flip-face flip-face-front" aria-label="Ficha de ${esc(country.nameEs)}">
            <div class="dialog-head">
              <div>
                <h2>${esc(country.nameEs)}</h2>
                <p class="dialog-sub">${esc(country.officialNameEs)} · ${esc(regionToEs(country.region))} (${esc(country.subregion)})</p>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="btn btn-primary" id="flip-to-map-btn">🗺️ Ver mapa 3D</button>
                <button type="button" class="btn" id="detail-close-btn" aria-label="Cerrar detalle">✕</button>
              </div>
            </div>

            <div class="detail-hero">
              <div class="detail-flag-3d" id="detail-flag-3d" title="Bandera 3D ondeando (mové el mouse)"></div>
              <div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
                  <button type="button" class="btn btn-pill ${isVisited ? "btn-primary" : ""}" id="detail-visit-btn">
                    ${isVisited ? "★ Visitado" : "☆ Marcar visitado"}
                  </button>
                  <button type="button" class="btn btn-pill ${isWishlist ? "btn-primary" : ""}" id="detail-wish-btn">
                    ${isWishlist ? "✓ Por visitar" : "⚑ Quiero ir"}
                  </button>
                  <button type="button" class="btn btn-pill" id="detail-compare-btn">
                    ${isCompare ? "≡ En comparador" : "+ Comparar"}
                  </button>
                  <button type="button" class="btn btn-pill" id="detail-route-btn">
                    🧭 Ruta terrestre
                  </button>
                </div>

                <div class="detail-facts" style="margin:0">
                  <div class="fact-box"><small>Capital</small><strong>${esc(country.capitalText)}</strong></div>
                  <div class="fact-box"><small>Población</small><strong class="tabular">${esc(formatNumber(country.population))}</strong></div>
                  <div class="fact-box"><small>Superficie</small><strong class="tabular">${esc(formatArea(country.area))}</strong></div>
                  <div class="fact-box"><small>Densidad</small><strong class="tabular">${esc(formatDensity(country.population, country.area))}</strong></div>
                </div>
              </div>
            </div>

            <!-- Interactive 3D Objects Strip -->
            <div class="detail-objects-strip">
              ${renderCoatOfArmsPod(country)}
              ${renderCurrencyPod(country.currencies)}
              ${renderCompassClockPod(country)}
              ${renderWeatherPodSkeleton(country.capital[0] || country.nameEs)}
            </div>

            <!-- Inline Currency Converter Drawer -->
            <div class="fx-drawer" id="detail-fx-drawer" hidden></div>

            <!-- 3D Extruded Country Silhouette Pedestal + Wikipedia ES -->
            <div class="detail-showcase-row">
              <div class="silhouette-pod">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <span class="object-pod-label">Relieve 3D · ${esc(country.nameEs)}</span>
                  <small style="color:var(--muted);font-size:0.72rem">Arrastrá para girar</small>
                </div>
                <div class="silhouette-stage" id="detail-silhouette-3d"></div>
              </div>

              <div class="wiki-box" id="detail-wiki-box" style="margin:0">
                <strong style="color:var(--accent-soft);display:block;margin-bottom:4px">Contexto enciclopédico (Wikipedia)</strong>
                <span style="color:var(--muted)">Cargando resumen cultural en español…</span>
              </div>
            </div>

            <div class="detail-facts">
              <div class="fact-box"><small>Idiomas</small><span>${esc(languagesText)}</span></div>
              <div class="fact-box"><small>Código ISO / Prefijo / Web</small><span class="tabular">${esc(country.id)} · ${esc(country.callingCode)} · ${esc(tldText)}</span></div>
              <div class="fact-box"><small>Coordenadas</small><span class="tabular">${esc(country.latlng[0].toFixed(2))}°, ${esc(country.latlng[1].toFixed(2))}°</span></div>
              <div class="fact-box"><small>Husos horarios</small><span>${esc(country.timezones.slice(0, 3).join(", "))}${country.timezones.length > 3 ? ` (+${country.timezones.length - 3})` : ""}</span></div>
            </div>

            <div>
              <strong style="font-size:0.86rem;color:var(--muted)">Países limítrofes (${borders.length}) — pasá el mouse para orientar la brújula y el globo:</strong>
              <div class="borders-wrap">${bordersHtml}</div>
            </div>
          </section>

          <section class="flip-face flip-face-back" aria-label="Mapa de ${esc(country.nameEs)}">
            <div class="dialog-head">
              <div>
                <h2>Mapa cartográfico · ${esc(country.nameEs)}</h2>
                <p class="dialog-sub">Capital: ${esc(country.capitalText)} · Tocá cualquier marcador limítrofe para viajar allí</p>
              </div>
              <div style="display:flex;gap:8px">
                <button type="button" class="btn btn-primary" id="flip-to-front-btn">↩ Volver a ficha 3D</button>
                <button type="button" class="btn" id="detail-close-back-btn" aria-label="Cerrar">✕</button>
              </div>
            </div>
            <div id="leaflet-map" class="atlas-dark-map"></div>
          </section>
        </div>
      </div>
    `;

    this.bindModalActions(country, borders);
    this.mount3DObjects(country, token);
    this.startLiveClock();
    this.loadAsyncEnrichments(country, token);
  }

  mount3DObjects(country, token) {
    const flagWrap = this.dialogEl.querySelector("#detail-flag-3d");
    if (flagWrap) {
      this.flag3d = new WavingFlag3D(flagWrap, country.flagPng, country.flagSvg, country.flagAlt);
    }

    const silWrap = this.dialogEl.querySelector("#detail-silhouette-3d");
    if (silWrap) {
      loadWorldGeo()
        .then((geo) => {
          if (token !== this.renderToken || !silWrap.isConnected) return;
          const feature = country.numericCode ? geo.byNumericCode.get(country.numericCode) : null;
          const accentHex = REGION_ACCENT_HEX[country.region] || 0x14b8a6;
          this.silhouette3d = new CountrySilhouette3D(silWrap, feature, country, {
            showPin: true,
            accentHex,
          });
        })
        .catch(() => {
          if (silWrap) silWrap.innerHTML = `<div class="globe-fallback" style="font-size:0.8rem">Sin geometría disponible</div>`;
        });
    }
  }

  bindModalActions(country, borders) {
    const flipCard = this.dialogEl.querySelector("#detail-flip-card");
    const close = () => this.dialogEl.close();

    this.dialogEl.querySelector("#detail-close-btn")?.addEventListener("click", close);
    this.dialogEl.querySelector("#detail-close-back-btn")?.addEventListener("click", close);

    this.dialogEl.querySelector("#flip-to-map-btn")?.addEventListener("click", () => {
      flipCard.classList.add("is-flipped");
      this.store.setModalFace("back");
      this.initOrUpdateLeaflet(country, borders);
    });

    this.dialogEl.querySelector("#flip-to-front-btn")?.addEventListener("click", () => {
      flipCard.classList.remove("is-flipped");
      this.store.setModalFace("front");
    });

    this.dialogEl.querySelector("#detail-visit-btn")?.addEventListener("click", () => {
      this.store.toggleVisited(country.id);
      this.render(country);
    });

    this.dialogEl.querySelector("#detail-wish-btn")?.addEventListener("click", () => {
      this.store.toggleWishlist(country.id);
      this.render(country);
    });

    this.dialogEl.querySelector("#detail-compare-btn")?.addEventListener("click", () => {
      this.store.toggleCompare(country.id);
      this.render(country);
    });

    this.dialogEl.querySelector("#detail-route-btn")?.addEventListener("click", () => {
      this.dialogEl.close();
      this.onOpenRouteWith(country.id);
    });

    // Coat of arms error fallback
    const coatImg = this.dialogEl.querySelector("[data-coat-fallback]");
    if (coatImg) {
      coatImg.addEventListener("error", () => {
        const box = coatImg.parentElement;
        if (box) box.innerHTML = `<span class="crest-fallback">${esc(country.id)}</span>`;
      });
    }

    // Currency 3D coin flip
    this.dialogEl.querySelectorAll(".coin-3d").forEach((coinBtn) => {
      coinBtn.addEventListener("click", () => coinBtn.classList.toggle("is-flipped"));
    });

    // Currency Converter toggle
    const fxBtn = this.dialogEl.querySelector("#detail-fx-toggle");
    const fxDrawer = this.dialogEl.querySelector("#detail-fx-drawer");
    if (fxBtn && fxDrawer) {
      fxBtn.addEventListener("click", () => {
        if (!fxDrawer.hidden) {
          fxDrawer.hidden = true;
          return;
        }
        this.openCurrencyConverter(fxDrawer, fxBtn.dataset.fxCode);
      });
    }

    // Neighbor border interactions
    const compassEl = this.dialogEl.querySelector("#detail-compass");
    const neighborMap = new Map(borders.map((b) => [b.id, b]));
    this.dialogEl.querySelectorAll("[data-neighbor]").forEach((btn) => {
      const nId = btn.dataset.neighbor;
      const neighbor = neighborMap.get(nId);
      if (!neighbor) return;

      btn.addEventListener("mouseenter", () => {
        if (compassEl) {
          const deg = Math.round(bearingDeg(country.latlng, neighbor.latlng));
          compassEl.style.setProperty("--bearing", `${deg}deg`);
        }
        this.globe.showCountryBorderArcs(country, this.store.state.countryIndex, nId);
      });

      btn.addEventListener("click", () => {
        if (isIso3(nId)) this.open(nId);
      });
    });
  }

  async openCurrencyConverter(drawerEl, countryCode) {
    drawerEl.hidden = false;
    drawerEl.innerHTML = `<span style="color:var(--muted);font-size:0.86rem">Consultando cotizaciones en vivo…</span>`;

    try {
      const fx = await fetchExchangeRates();
      const codes = [...new Set([countryCode, ...POPULAR_FX, ...Object.keys(fx.rates)])]
        .filter((c) => fx.rates[c]);

      if (!codes.includes(countryCode)) {
        drawerEl.innerHTML = `<span style="color:var(--muted);font-size:0.86rem">La divisa ${esc(countryCode)} no cuenta con cotización pública disponible.</span>`;
        return;
      }

      const defaultTarget = countryCode === "USD" ? "ARS" : "USD";
      const opts = (selected) =>
        codes.map((c) => `<option value="${esc(c)}" ${c === selected ? "selected" : ""}>${esc(c)}</option>`).join("");

      drawerEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <strong style="font-size:0.86rem;color:var(--accent-soft)">💱 Conversor de Divisa en Vivo</strong>
          <small style="color:var(--muted)">Actualizado: ${esc(fx.updatedAt)}</small>
        </div>
        <div class="fx-grid">
          <input type="number" id="fx-amount" min="0" step="any" value="100" aria-label="Monto a convertir">
          <select id="fx-from" aria-label="Moneda origen">${opts(countryCode)}</select>
          <button type="button" class="btn btn-icon" id="fx-swap" title="Invertir monedas">⇄</button>
          <select id="fx-to" aria-label="Moneda destino">${opts(defaultTarget)}</select>
          <div class="fx-result tabular" id="fx-output">—</div>
        </div>
        <small id="fx-unit-rate" style="color:var(--muted);display:block;margin-top:6px"></small>
      `;

      const amountEl = drawerEl.querySelector("#fx-amount");
      const fromEl = drawerEl.querySelector("#fx-from");
      const toEl = drawerEl.querySelector("#fx-to");
      const outEl = drawerEl.querySelector("#fx-output");
      const unitEl = drawerEl.querySelector("#fx-unit-rate");
      const nf = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
      const nfUnit = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });

      const recalc = () => {
        const amt = parseFloat(amountEl.value) || 0;
        const rFrom = fx.rates[fromEl.value];
        const rTo = fx.rates[toEl.value];
        if (!rFrom || !rTo) return;
        const unit = rTo / rFrom;
        const converted = amt * unit;
        outEl.textContent = `${nf.format(converted)} ${toEl.value}`;
        unitEl.textContent = `Tasa: 1 ${fromEl.value} = ${nfUnit.format(unit)} ${toEl.value}`;
      };

      amountEl.addEventListener("input", recalc);
      fromEl.addEventListener("change", recalc);
      toEl.addEventListener("change", recalc);
      drawerEl.querySelector("#fx-swap").addEventListener("click", () => {
        const tmp = fromEl.value;
        fromEl.value = toEl.value;
        toEl.value = tmp;
        recalc();
      });

      recalc();
    } catch {
      drawerEl.innerHTML = `<span style="color:var(--muted);font-size:0.86rem">No se pudieron obtener las cotizaciones en este momento.</span>`;
    }
  }

  startLiveClock() {
    const clockEl = this.dialogEl.querySelector("#detail-live-clock");
    if (!clockEl) return;
    const tz = clockEl.dataset.tz || "UTC";
    this.clockTimer = setInterval(() => {
      const info = getLocalTimeFromUtc(tz);
      clockEl.textContent = `${info.isDay ? "☀️" : "🌙"} ${info.timeStr}`;
    }, 1000);
  }

  async loadAsyncEnrichments(country, token) {
    const weatherPod = this.dialogEl.querySelector("#detail-weather-pod");
    const wikiBox = this.dialogEl.querySelector("#detail-wiki-box");

    fetchCapitalWeather(country.latlng[0], country.latlng[1])
      .then((wx) => {
        if (token !== this.renderToken || !weatherPod) return;
        weatherPod.innerHTML = renderWeatherPodContent(wx, country.capital[0] || country.nameEs);
      })
      .catch(() => {
        if (token !== this.renderToken || !weatherPod) return;
        weatherPod.innerHTML = renderWeatherPodContent(null, country.capital[0] || country.nameEs);
      });

    fetchWikiSummaryEs(country)
      .then((wiki) => {
        if (token !== this.renderToken || !wikiBox) return;
        if (!wiki) {
          wikiBox.innerHTML = `
            <strong style="color:var(--accent-soft);display:block;margin-bottom:4px">Contexto enciclopédico</strong>
            <span style="color:var(--muted)">Sin resumen disponible en Wikipedia para este territorio.</span>
          `;
          return;
        }
        const safeHref = safeUrl(wiki.pageUrl);
        wikiBox.innerHTML = `
          <strong style="color:var(--accent-soft);display:block;margin-bottom:4px">Contexto enciclopédico · ${esc(wiki.title)}</strong>
          <p style="margin:0 0 6px">${esc(wiki.extract)}</p>
          ${safeHref ? `<a href="${esc(safeHref)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-soft);font-size:0.82rem">Leer artículo completo en Wikipedia ↗</a>` : ""}
        `;
      })
      .catch(() => {
        if (token !== this.renderToken || !wikiBox) return;
        wikiBox.innerHTML = `<span style="color:var(--muted)">No se pudo cargar el resumen enciclopédico.</span>`;
      });
  }

  initOrUpdateLeaflet(country, borders) {
    const mapContainer = this.dialogEl.querySelector("#leaflet-map");
    if (!mapContainer) return;

    if (!window.L) {
      mapContainer.innerHTML = `<div class="globe-fallback">No se pudo cargar la librería cartográfica Leaflet.</div>`;
      return;
    }

    if (this.leafletMap) {
      this.leafletMap.remove();
      this.leafletMap = null;
    }

    const L = window.L;
    const zoom = country.area > 2_000_000 ? 3 : country.area > 250_000 ? 4 : 5;
    this.leafletMap = L.map(mapContainer, { zoomControl: true }).setView(country.latlng, zoom);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(this.leafletMap);

    const mainMarker = L.circleMarker(country.latlng, {
      radius: 9,
      color: "#5eead4",
      fillColor: "#14b8a6",
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(this.leafletMap);
    mainMarker.bindPopup(`<strong>${esc(country.nameEs)}</strong><br>Capital: ${esc(country.capitalText)}`).openPopup();

    for (const n of borders) {
      L.polyline([country.latlng, n.latlng], {
        color: "#fbbf24",
        weight: 2,
        dashArray: "5, 6",
        opacity: 0.75,
      }).addTo(this.leafletMap);

      const nMarker = L.circleMarker(n.latlng, {
        radius: 6,
        color: "#fde68a",
        fillColor: "#f59e0b",
        fillOpacity: 0.85,
        weight: 1.5,
      }).addTo(this.leafletMap);
      nMarker.bindTooltip(n.nameEs);
      nMarker.on("click", () => this.open(n.id));
    }

    setTimeout(() => {
      this.leafletMap?.invalidateSize();
    }, 360);
  }
}
