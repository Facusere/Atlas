import { esc, isIso3, safeUrl } from "../utils/sanitize.js";
import { regionToEs } from "../utils/formatters.js";

const CONTINENTS = ["Americas", "Europe", "Africa", "Asia", "Oceania", "Antarctic"];

export class PassportModalController {
  constructor({ dialogEl, store, onOpenCountry }) {
    this.dialogEl = dialogEl;
    this.store = store;
    this.onOpenCountry = onOpenCountry;
    this.activeTab = "visited";

    this.dialogEl.addEventListener("click", (e) => {
      if (e.target === this.dialogEl) this.dialogEl.close();
    });
  }

  open() {
    this.render();
    this.dialogEl.showModal();
  }

  render() {
    const state = this.store.state;
    const total = state.countries.length || 1;
    const visitedIds = Object.keys(state.visited).filter((id) => state.countryIndex.has(id));
    const wishlistIds = [...state.wishlist].filter((id) => state.countryIndex.has(id));
    const pct = ((visitedIds.length / total) * 100).toFixed(1);

    const continentCards = CONTINENTS.map((reg) => {
      const inReg = state.countries.filter((c) => c.region === reg);
      const visInReg = inReg.filter((c) => Boolean(state.visited[c.id])).length;
      const rPct = inReg.length ? Math.round((visInReg / inReg.length) * 100) : 0;
      return `
        <div class="continent-stat">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <strong>${esc(regionToEs(reg))}</strong>
            <span class="tabular" style="color:var(--muted)">${visInReg}/${inReg.length}</span>
          </div>
          <div class="progress-track" style="height:7px">
            <div class="progress-fill" style="width:${rPct}%"></div>
          </div>
        </div>
      `;
    }).join("");

    const stampIds = this.activeTab === "visited" ? visitedIds : wishlistIds;
    const stampsHtml = stampIds.length
      ? stampIds
          .map((id, idx) => {
            const c = state.countryIndex.get(id);
            const flag = safeUrl(c.flagSvg);
            const tilt = ((idx % 5) - 2) * 1.4;
            const dateLabel = this.activeTab === "visited" ? state.visited[id] : "Por visitar";
            return `
              <button type="button" class="stamp-3d ${this.activeTab === "wishlist" ? "is-wishlist" : ""}" style="--tilt:${tilt}deg" data-stamp-id="${esc(c.id)}">
                ${flag ? `<img src="${esc(flag)}" alt="">` : ""}
                <div style="font-weight:700;font-size:0.88rem">${esc(c.nameEs)}</div>
                <small style="color:var(--muted)">${esc(dateLabel)}</small>
              </button>
            `;
          })
          .join("")
      : `<div class="status-box" style="grid-column:1/-1">
           <p style="margin:0;color:var(--muted)">
             ${this.activeTab === "visited"
               ? "Todavía no sellaste ningún país como visitado. Usá ★ en cualquier tarjeta para pintarlo de dorado en el Globo."
               : "Tu lista de destinos por visitar está vacía. Usá ⚑ en cualquier tarjeta para agregarla aquí y pintarla de esmeralda en el Globo."}
           </p>
         </div>`;

    this.dialogEl.innerHTML = `
      <div class="dialog-panel">
        <div class="dialog-head">
          <div>
            <h2>🛂 Pasaporte de Viajero</h2>
            <p class="dialog-sub">Tus países visitados brillan en dorado y tus deseos en esmeralda sobre el Globo Terráqueo</p>
          </div>
          <button type="button" class="btn" id="passport-close-btn" aria-label="Cerrar">✕</button>
        </div>

        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.9rem">
            <span>Progreso mundial explorado</span>
            <strong class="tabular">${visitedIds.length} / ${state.countries.length} países (${pct}%)</strong>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>

        <div class="continent-bars">${continentCards}</div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="btn btn-pill ${this.activeTab === "visited" ? "btn-primary" : ""}" data-ptab="visited">
              ★ Sellos Visitados (${visitedIds.length})
            </button>
            <button type="button" class="btn btn-pill ${this.activeTab === "wishlist" ? "btn-primary" : ""}" data-ptab="wishlist">
              ⚑ Por Visitar (${wishlistIds.length})
            </button>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center" id="passport-data-tools">
            <button type="button" class="btn btn-pill" id="passport-export-btn">⬇ Exportar JSON</button>
            <label class="btn btn-pill" style="cursor:pointer">
              ⬆ Importar JSON
              <input type="file" id="passport-import-input" accept="application/json" hidden>
            </label>
            <button type="button" class="btn btn-pill" id="passport-reset-btn" style="border-color:rgba(248,113,113,0.45);color:#fca5a5">🗑 Reiniciar</button>
          </div>
        </div>
        <div id="passport-feedback" style="font-size:0.82rem;color:var(--accent-soft);margin-bottom:10px" hidden></div>

        <div class="stamps-grid">${stampsHtml}</div>
      </div>
    `;

    this.dialogEl.querySelector("#passport-close-btn").addEventListener("click", () => this.dialogEl.close());
    this.dialogEl.querySelectorAll("[data-ptab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.activeTab = btn.dataset.ptab;
        this.render();
      });
    });

    const fbEl = this.dialogEl.querySelector("#passport-feedback");
    const showFeedback = (msg) => {
      if (!fbEl) return;
      fbEl.textContent = msg;
      fbEl.hidden = false;
    };

    this.dialogEl.querySelector("#passport-export-btn")?.addEventListener("click", () => {
      const payload = {
        app: "Atlas 3D",
        exportedAt: new Date().toISOString(),
        visited: state.visited,
        wishlist: [...state.wishlist],
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atlas-pasaporte-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showFeedback("Pasaporte exportado en formato JSON.");
    });

    this.dialogEl.querySelector("#passport-import-input")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        this.store.importPassport(parsed);
        this.render();
        const freshFb = this.dialogEl.querySelector("#passport-feedback");
        if (freshFb) {
          freshFb.textContent = "Pasaporte importado correctamente.";
          freshFb.hidden = false;
        }
      } catch {
        showFeedback("El archivo JSON no tiene un formato válido de Pasaporte.");
      }
    });

    const resetBtn = this.dialogEl.querySelector("#passport-reset-btn");
    const toolsWrap = this.dialogEl.querySelector("#passport-data-tools");
    resetBtn?.addEventListener("click", () => {
      if (!toolsWrap) return;
      toolsWrap.innerHTML = `
        <span style="font-size:0.8rem;color:#fca5a5">¿Borrar todos los sellos?</span>
        <button type="button" class="btn btn-pill" id="passport-reset-confirm" style="background:rgba(220,38,38,0.35);border-color:#f87171;color:#fee2e2">Confirmar</button>
        <button type="button" class="btn btn-pill" id="passport-reset-cancel">Cancelar</button>
      `;
      toolsWrap.querySelector("#passport-reset-confirm")?.addEventListener("click", () => {
        this.store.resetPassport();
        this.render();
      });
      toolsWrap.querySelector("#passport-reset-cancel")?.addEventListener("click", () => {
        this.render();
      });
    });

    this.dialogEl.querySelectorAll("[data-stamp-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.stampId;
        if (isIso3(id)) {
          this.dialogEl.close();
          this.onOpenCountry(id);
        }
      });
    });
  }
}
