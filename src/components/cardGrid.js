import { esc, isIso3, safeUrl } from "../utils/sanitize.js";
import { formatNumber, regionToEs } from "../utils/formatters.js";

export class CardGridController {
  constructor({ gridEl, countEl, loadMoreBtn, sentinelEl, store, onOpenCountry }) {
    this.gridEl = gridEl;
    this.countEl = countEl;
    this.loadMoreBtn = loadMoreBtn;
    this.sentinelEl = sentinelEl;
    this.store = store;
    this.onOpenCountry = onOpenCountry;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.activeCard = null;
    this.tiltFrame = null;
    this.pendingTilt = null;

    this.bindEvents();
    this.bindInfiniteObserver();
  }

  renderSkeletons() {
    this.countEl.textContent = "Cargando países del mundo…";
    this.loadMoreBtn.hidden = true;
    this.gridEl.innerHTML = Array.from({ length: 12 }, () => `<div class="skeleton-card" aria-hidden="true"></div>`).join("");
  }

  renderError(message, onRetry) {
    this.countEl.textContent = "No se pudieron obtener los países";
    this.loadMoreBtn.hidden = true;
    this.gridEl.innerHTML = `
      <div class="status-box is-error">
        <p style="margin:0 0 12px">${esc(message)}</p>
        <button type="button" class="btn btn-primary" id="retry-load-btn">Reintentar</button>
      </div>
    `;
    document.getElementById("retry-load-btn")?.addEventListener("click", onRetry);
  }

  render() {
    const state = this.store.state;
    if (state.status === "loading") {
      this.renderSkeletons();
      return;
    }
    if (state.status === "error") return;

    const total = state.filtered.length;
    const visible = state.filtered.slice(0, state.renderedCount);

    if (total === 0) {
      this.countEl.textContent = "0 países coinciden con los filtros actuales";
      this.loadMoreBtn.hidden = true;
      this.gridEl.innerHTML = `
        <div class="status-box">
          <p style="margin:0">No se encontraron países con esa combinación de búsqueda o continente.</p>
        </div>
      `;
      return;
    }

    this.countEl.textContent = `Mostrando ${visible.length} de ${total} países`;
    this.loadMoreBtn.hidden = visible.length >= total;

    this.gridEl.innerHTML = visible.map((c) => this.renderCardHtml(c, state)).join("");
  }

  renderCardHtml(c, state) {
    const isVisited = Boolean(state.visited[c.id]);
    const isWishlist = state.wishlist.has(c.id);
    const isCompare = state.compareList.includes(c.id);
    const cardClasses = [
      "country-card",
      isVisited ? "is-visited" : "",
      isWishlist ? "is-wishlist" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const flagUrl = safeUrl(c.flagSvg);
    return `
      <article class="${cardClasses}" data-id="${esc(c.id)}" tabindex="0" role="button" aria-label="Explorar ${esc(c.nameEs)}">
        <div class="card-chassis">
          <div class="card-glare" aria-hidden="true"></div>
          <div class="card-border-glow" aria-hidden="true"></div>
          <div class="card-flag-wrap">
            <img loading="lazy" src="${esc(flagUrl)}" alt="${esc(c.flagAlt)}">
          </div>
          <div class="card-pills">
            <span class="region-pill">${esc(regionToEs(c.region))}</span>
            <div class="card-actions-mini">
              <button type="button" class="mini-action-btn ${isVisited ? "is-active-gold" : ""}" data-act="visit" data-id="${esc(c.id)}" title="${isVisited ? "Quitar de visitados" : "Marcar como visitado"}" aria-label="Marcar ${esc(c.nameEs)} como visitado">${isVisited ? "★" : "☆"}</button>
              <button type="button" class="mini-action-btn ${isWishlist ? "is-active-emerald" : ""}" data-act="wish" data-id="${esc(c.id)}" title="${isWishlist ? "Quitar de por visitar" : "Agregar a por visitar"}" aria-label="Agregar ${esc(c.nameEs)} a por visitar">${isWishlist ? "✓" : "⚑"}</button>
              <button type="button" class="mini-action-btn ${isCompare ? "is-active-compare" : ""}" data-act="compare" data-id="${esc(c.id)}" title="${isCompare ? "Quitar del comparador" : "Agregar al comparador"}" aria-label="Comparar ${esc(c.nameEs)}">${isCompare ? "≡" : "+"}</button>
            </div>
          </div>
          <div class="card-body">
            <h3 class="card-name">${esc(c.nameEs)}</h3>
            <p class="card-meta">
              <span>${esc(c.capital[0] || "Sin capital")}</span>
              <span class="tabular">${esc(formatNumber(c.population))} hab.</span>
            </p>
          </div>
        </div>
      </article>
    `;
  }

  bindEvents() {
    this.loadMoreBtn.addEventListener("click", () => this.store.showAllFiltered());

    // Event Delegation for clicks and keyboard selection
    this.gridEl.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("[data-act]");
      if (actionBtn) {
        e.stopPropagation();
        const id = actionBtn.dataset.id;
        const act = actionBtn.dataset.act;
        if (!isIso3(id)) return;
        if (act === "visit") this.store.toggleVisited(id);
        else if (act === "wish") this.store.toggleWishlist(id);
        else if (act === "compare") this.store.toggleCompare(id);
        return;
      }

      const card = e.target.closest(".country-card");
      if (card && isIso3(card.dataset.id)) {
        this.onOpenCountry(card.dataset.id);
      }
    });

    this.gridEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.target.closest("[data-act]")) return;
      const card = e.target.closest(".country-card");
      if (card && isIso3(card.dataset.id)) {
        e.preventDefault();
        this.onOpenCountry(card.dataset.id);
      }
    });

    // Mouse spotlight & border-glow tracking without moving/tilting the card
    if (!this.reducedMotion) {
      this.gridEl.addEventListener("pointermove", (e) => {
        if (e.pointerType === "touch") return;
        const card = e.target.closest(".country-card");
        if (!card) {
          this.activeCard = null;
          return;
        }
        this.activeCard = card;
        const rect = card.getBoundingClientRect();
        const gx = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)).toFixed(1);
        const gy = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)).toFixed(1);

        this.pendingTilt = { card, gx, gy };

        if (!this.tiltFrame) {
          this.tiltFrame = requestAnimationFrame(() => {
            this.tiltFrame = null;
            const p = this.pendingTilt;
            if (!p) return;
            p.card.style.setProperty("--glare-x", `${p.gx}%`);
            p.card.style.setProperty("--glare-y", `${p.gy}%`);
          });
        }
      });

      this.gridEl.addEventListener("pointerleave", () => {
        this.activeCard = null;
      });
    }
  }

  bindInfiniteObserver() {
    if (!("IntersectionObserver" in window) || !this.sentinelEl) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && this.store.state.status === "ready") {
        this.store.loadMoreBatch();
      }
    }, { rootMargin: "220px" });
    io.observe(this.sentinelEl);
  }
}
