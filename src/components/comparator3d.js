import { esc, isIso3, safeUrl } from "../utils/sanitize.js";
import { formatArea, formatDensity, formatNumber, regionToEs } from "../utils/formatters.js";
import { loadWorldGeo, projectFeatureToKm } from "../api/worldGeo.js";

const PRISM_PALETTES = [
  { color: "#14b8a6", side: "#0f766e", top: "#5eead4", rgba: "rgba(20, 184, 166, 0.28)" },
  { color: "#f59e0b", side: "#b45309", top: "#fde68a", rgba: "rgba(245, 158, 11, 0.28)" },
  { color: "#3b82f6", side: "#1d4ed8", top: "#93c5fd", rgba: "rgba(59, 130, 246, 0.28)" },
];

export class ComparatorController {
  constructor({ dockEl, dialogEl, store, onOpenCountry }) {
    this.dockEl = dockEl;
    this.dialogEl = dialogEl;
    this.store = store;
    this.onOpenCountry = onOpenCountry;

    this.dialogEl.addEventListener("click", (e) => {
      if (e.target === this.dialogEl) this.dialogEl.close();
    });
  }

  renderDock() {
    const state = this.store.state;
    const countries = state.compareList.map((id) => state.countryIndex.get(id)).filter(Boolean);

    if (countries.length === 0) {
      this.dockEl.classList.remove("is-visible");
      this.dockEl.innerHTML = "";
      return;
    }

    const pillsHtml = countries
      .map((c) => {
        const flag = safeUrl(c.flagSvg);
        return `
          <span class="compare-pill">
            ${flag ? `<img src="${esc(flag)}" alt="">` : ""}
            <span>${esc(c.nameEs)}</span>
            <button type="button" data-rm-compare="${esc(c.id)}" aria-label="Quitar ${esc(c.nameEs)}">✕</button>
          </span>
        `;
      })
      .join("");

    this.dockEl.innerHTML = `
      <strong style="font-size:0.84rem">Comparador (${countries.length}/3):</strong>
      <div class="compare-pills">${pillsHtml}</div>
      <button type="button" class="btn btn-primary btn-pill" id="open-compare-modal-btn" ${countries.length < 2 ? "disabled" : ""}>
        Comparar en 3D
      </button>
      <button type="button" class="btn btn-pill" id="clear-compare-btn">Limpiar</button>
    `;
    this.dockEl.classList.add("is-visible");

    this.dockEl.querySelectorAll("[data-rm-compare]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.rmCompare;
        if (isIso3(id)) this.store.toggleCompare(id);
      });
    });

    this.dockEl.querySelector("#clear-compare-btn")?.addEventListener("click", () => {
      this.store.clearCompare();
    });

    this.dockEl.querySelector("#open-compare-modal-btn")?.addEventListener("click", () => {
      this.openModal();
    });
  }

  renderPrismChart(title, countries, getValue, formatValue) {
    const max = Math.max(...countries.map(getValue), 1);
    const colsHtml = countries
      .map((c, idx) => {
        const val = getValue(c);
        const hPct = Math.max(8, Math.round((val / max) * 100));
        const pal = PRISM_PALETTES[idx % PRISM_PALETTES.length];
        return `
          <div class="prism-col">
            <span class="prism-value tabular">${esc(formatValue(c))}</span>
            <div class="prism-bar" style="--h:${hPct}%;--p-color:${pal.color};--p-side:${pal.side};--p-top:${pal.top}">
              <span class="prism-face-front"></span>
              <span class="prism-face-side"></span>
              <span class="prism-face-top"></span>
            </div>
            <span class="prism-label">${esc(c.id)}</span>
          </div>
        `;
      })
      .join("");

    return `
      <div class="prism-card">
        <h3>${esc(title)}</h3>
        <div class="prism-stage">${colsHtml}</div>
      </div>
    `;
  }

  openModal() {
    const countries = this.store.state.compareList
      .map((id) => this.store.state.countryIndex.get(id))
      .filter(Boolean);
    if (countries.length < 2) return;

    const headCols = countries
      .map((c) => {
        const flag = safeUrl(c.flagSvg);
        return `
          <th>
            <button type="button" class="btn btn-pill" data-cmp-open="${esc(c.id)}">
              ${flag ? `<img src="${esc(flag)}" alt="" style="width:20px;height:14px;border-radius:3px;object-fit:cover">` : ""}
              <strong>${esc(c.nameEs)}</strong>
            </button>
          </th>
        `;
      })
      .join("");

    const makeRow = (label, fn) =>
      `<tr><th>${esc(label)}</th>${countries.map((c) => `<td class="tabular">${esc(fn(c))}</td>`).join("")}</tr>`;

    this.dialogEl.innerHTML = `
      <div class="dialog-panel">
        <div class="dialog-head">
          <div>
            <h2>📊 Comparador Volumétrico 3D</h2>
            <p class="dialog-sub">Contraste proporcional con prismas isométricos 3D entre ${countries.map((c) => esc(c.nameEs)).join(" vs. ")}</p>
          </div>
          <button type="button" class="btn" id="compare-close-btn" aria-label="Cerrar">✕</button>
        </div>

        <div class="prism-metrics-grid">
          ${this.renderPrismChart("Población", countries, (c) => c.population, (c) => formatNumber(c.population))}
          ${this.renderPrismChart("Superficie (km²)", countries, (c) => c.area, (c) => formatArea(c.area))}
          ${this.renderPrismChart("Densidad (hab/km²)", countries, (c) => c.density, (c) => formatDensity(c.population, c.area))}
        </div>

        <section class="mercator-section">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
            <h3 style="margin:0;font-size:0.95rem;color:var(--accent-soft)">📏 Escala Real Superpuesta (Anti-distorsión Mercator)</h3>
            <small id="mercator-ratio" style="color:var(--muted)"></small>
          </div>
          <canvas id="mercator-canvas" class="mercator-canvas" width="720" height="280"></canvas>
        </section>

        <table class="compare-table">
          <thead><tr><th>Atributo</th>${headCols}</tr></thead>
          <tbody>
            ${makeRow("Capital", (c) => c.capitalText)}
            ${makeRow("Región", (c) => `${regionToEs(c.region)} · ${c.subregion}`)}
            ${makeRow("Idiomas", (c) => c.languages.join(", ") || "—")}
            ${makeRow("Monedas", (c) => c.currencies.map((m) => `${m.name} (${m.code})`).join(", ") || "—")}
            ${makeRow("Fronteras", (c) => `${c.borders.length} países`)}
            ${makeRow("Husos horarios", (c) => c.timezones[0] || "UTC")}
          </tbody>
        </table>
      </div>
    `;

    this.dialogEl.querySelector("#compare-close-btn").addEventListener("click", () => this.dialogEl.close());
    this.dialogEl.querySelectorAll("[data-cmp-open]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.cmpOpen;
        if (isIso3(id)) {
          this.dialogEl.close();
          this.onOpenCountry(id);
        }
      });
    });

    this.dialogEl.showModal();
    this.renderAntiMercator(countries);
  }

  async renderAntiMercator(countries) {
    const canvas = this.dialogEl.querySelector("#mercator-canvas");
    const ratioEl = this.dialogEl.querySelector("#mercator-ratio");
    if (!canvas || !ratioEl) return;

    const sortedArea = [...countries].filter((c) => c.area > 0).sort((a, b) => b.area - a.area);
    if (sortedArea.length >= 2) {
      const ratio = (sortedArea[0].area / sortedArea[1].area).toFixed(2).replace(".", ",");
      ratioEl.textContent = `${sortedArea[0].nameEs} equivale a ${ratio}× la superficie de ${sortedArea[1].nameEs}`;
    }

    try {
      const geo = await loadWorldGeo();
      const ctx = canvas.getContext("2d");
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const projectedItems = countries
        .map((c, idx) => {
          const feat = c.numericCode ? geo.byNumericCode.get(c.numericCode) : null;
          const proj = feat ? projectFeatureToKm(feat, c.latlng) : null;
          return proj ? { country: c, proj, palette: PRISM_PALETTES[idx % PRISM_PALETTES.length] } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.country.area - a.country.area);

      if (!projectedItems.length) return;

      const maxSpanX = Math.max(...projectedItems.map((i) => i.proj.widthKm), 100);
      const maxSpanY = Math.max(...projectedItems.map((i) => i.proj.heightKm), 100);
      const pxPerKm = Math.min((W - 80) / maxSpanX, (H - 54) / maxSpanY);
      const cx = W / 2;
      const cy = H / 2;

      // Subtle reference grid
      ctx.strokeStyle = "rgba(143, 214, 200, 0.08)";
      ctx.lineWidth = 1;
      for (let gx = 40; gx < W; gx += 60) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 30; gy < H; gy += 60) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }

      for (const item of projectedItems) {
        ctx.beginPath();
        for (const poly of item.proj.polygons) {
          for (const ring of poly) {
            if (!ring.length) continue;
            ctx.moveTo(cx + ring[0][0] * pxPerKm, cy - ring[0][1] * pxPerKm);
            for (let i = 1; i < ring.length; i++) {
              ctx.lineTo(cx + ring[i][0] * pxPerKm, cy - ring[i][1] * pxPerKm);
            }
            ctx.closePath();
          }
        }
        ctx.fillStyle = item.palette.rgba;
        ctx.fill("evenodd");
        ctx.strokeStyle = item.palette.top;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Legend & Scale bar
      let lx = 14;
      ctx.font = "600 12px sans-serif";
      for (const item of projectedItems) {
        ctx.fillStyle = item.palette.top;
        ctx.fillRect(lx, 12, 12, 12);
        ctx.fillStyle = "#f1fff9";
        ctx.fillText(item.country.nameEs, lx + 18, 22);
        lx += ctx.measureText(item.country.nameEs).width + 36;
      }

      const barKm = maxSpanX > 3000 ? 1000 : maxSpanX > 800 ? 500 : 100;
      const barPx = barKm * pxPerKm;
      ctx.strokeStyle = "#9dd4ca";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W - 20 - barPx, H - 18);
      ctx.lineTo(W - 20, H - 18);
      ctx.stroke();
      ctx.fillStyle = "#9dd4ca";
      ctx.fillText(`${barKm} km`, W - 20 - barPx, H - 24);
    } catch {
      ratioEl.textContent = "Siluetas comparativas no disponibles";
    }
  }
}
