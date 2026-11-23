import { esc, isIso3, safeUrl } from "../utils/sanitize.js";
import { formatNumber } from "../utils/formatters.js";
import { findBorderRoute } from "../utils/routing.js";

export class RouteModalController {
  constructor({ dialogEl, store, globe, onOpenCountry, onProjectGlobe }) {
    this.dialogEl = dialogEl;
    this.store = store;
    this.globe = globe;
    this.onOpenCountry = onOpenCountry;
    this.onProjectGlobe = onProjectGlobe;
    this.lastResult = null;

    this.dialogEl.addEventListener("click", (e) => {
      if (e.target === this.dialogEl) this.dialogEl.close();
    });
  }

  open(preselectedOriginId = "ARG") {
    const state = this.store.state;
    const collator = new Intl.Collator("es", { sensitivity: "base" });
    const sorted = [...state.countries].sort((a, b) => collator.compare(a.nameEs, b.nameEs));

    const defaultOrigin = state.countryIndex.has(preselectedOriginId) ? preselectedOriginId : sorted[0]?.id;
    const defaultDest = defaultOrigin === "COL" ? "ARG" : "COL";

    const optionsHtml = sorted
      .map((c) => `<option value="${esc(c.id)}">${esc(c.nameEs)} (${esc(c.id)})</option>`)
      .join("");

    this.dialogEl.innerHTML = `
      <div class="dialog-panel">
        <div class="dialog-head">
          <div>
            <h2>🧭 Calculador de Rutas Terrestres</h2>
            <p class="dialog-sub">Encontrá el camino más corto cruzando fronteras y proyectalo sobre el Globo</p>
          </div>
          <button type="button" class="btn" id="route-close-btn" aria-label="Cerrar">✕</button>
        </div>

        <div class="route-form">
          <div class="route-field">
            <label for="route-origin">País de origen</label>
            <select id="route-origin">${optionsHtml}</select>
          </div>
          <button type="button" class="btn" id="route-swap-btn" title="Invertir origen y destino">⇄</button>
          <div class="route-field">
            <label for="route-dest">País de destino</label>
            <select id="route-dest">${optionsHtml}</select>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
          <button type="button" class="btn btn-primary" id="route-calc-btn">Calcular ruta fronteriza</button>
          <button type="button" class="btn btn-pill" data-preset="ARG:COL">🇦🇷 Argentina → 🇨🇴 Colombia</button>
          <button type="button" class="btn btn-pill" data-preset="ESP:CHN">🇪🇸 España → 🇨🇳 China</button>
          <button type="button" class="btn btn-pill" data-preset="ZAF:EGY">🇿🇦 Sudáfrica → 🇪🇬 Egipto</button>
        </div>

        <div id="route-output"></div>
      </div>
    `;

    const originSel = this.dialogEl.querySelector("#route-origin");
    const destSel = this.dialogEl.querySelector("#route-dest");
    if (defaultOrigin) originSel.value = defaultOrigin;
    if (state.countryIndex.has(defaultDest)) destSel.value = defaultDest;

    this.dialogEl.querySelector("#route-close-btn").addEventListener("click", () => this.dialogEl.close());
    this.dialogEl.querySelector("#route-swap-btn").addEventListener("click", () => {
      const tmp = originSel.value;
      originSel.value = destSel.value;
      destSel.value = tmp;
      this.calculate(originSel.value, destSel.value);
    });
    this.dialogEl.querySelector("#route-calc-btn").addEventListener("click", () => {
      this.calculate(originSel.value, destSel.value);
    });

    this.dialogEl.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const [a, b] = btn.dataset.preset.split(":");
        if (state.countryIndex.has(a) && state.countryIndex.has(b)) {
          originSel.value = a;
          destSel.value = b;
          this.calculate(a, b);
        }
      });
    });

    this.dialogEl.showModal();
    this.calculate(originSel.value, destSel.value);
  }

  calculate(originId, destId) {
    const outEl = this.dialogEl.querySelector("#route-output");
    const result = findBorderRoute(originId, destId, this.store.state.countryIndex);
    this.lastResult = result;

    if (!result.found) {
      outEl.innerHTML = `
        <div class="status-box" style="text-align:left">
          <strong>No existe una ruta exclusivamente terrestre</strong>
          <p style="margin:6px 0 0;color:var(--muted)">
            Estos territorios están separados por océanos o islas sin conexión fronteriza continua.
            Distancia aérea directa aproximada: <strong class="tabular">${esc(formatNumber(result.directDistanceKm))} km</strong>.
          </p>
        </div>
      `;
      return;
    }

    const chainHtml = result.path
      .map((c, idx) => {
        const flag = safeUrl(c.flagSvg);
        const node = `
          <button type="button" class="route-node" data-route-country="${esc(c.id)}">
            ${flag ? `<img src="${esc(flag)}" alt="">` : ""}
            <span>${esc(c.nameEs)}</span>
          </button>
        `;
        return idx < result.path.length - 1 ? `${node}<span class="route-arrow">→</span>` : node;
      })
      .join("");

    outEl.innerHTML = `
      <div class="detail-facts">
        <div class="fact-box"><small>Cruces fronterizos</small><strong class="tabular">${esc(result.hops)} fronteras (${esc(result.path.length)} países)</strong></div>
        <div class="fact-box"><small>Distancia por ruta</small><strong class="tabular">${esc(formatNumber(result.distanceKm))} km</strong></div>
        <div class="fact-box"><small>Vuelo directo</small><strong class="tabular">${esc(formatNumber(result.directDistanceKm))} km</strong></div>
      </div>

      <div class="route-chain">${chainHtml}</div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
        <button type="button" class="btn btn-primary" id="route-project-btn">🌍 Proyectar ruta en el Globo</button>
        <button type="button" class="btn" id="route-clear-btn">Limpiar ruta del globo</button>
      </div>
    `;

    outEl.querySelectorAll("[data-route-country]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.routeCountry;
        if (isIso3(id)) {
          this.dialogEl.close();
          this.onOpenCountry(id);
        }
      });
    });

    outEl.querySelector("#route-project-btn")?.addEventListener("click", () => {
      this.store.setActiveRoute(result);
      this.dialogEl.close();
      this.onProjectGlobe(result);
    });

    outEl.querySelector("#route-clear-btn")?.addEventListener("click", () => {
      this.store.clearActiveRoute();
      this.globe.clearArcs();
    });
  }
}
