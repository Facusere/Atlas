import { esc, safeUrl } from "../utils/sanitize.js";
import { normalizeText, regionToEs } from "../utils/formatters.js";

export class CommandPaletteController {
  constructor({ dialogEl, store, actions }) {
    this.dialogEl = dialogEl;
    this.store = store;
    this.actions = actions;
    this.items = [];
    this.selectedIdx = 0;

    this.bindGlobalShortcut();
    this.dialogEl.addEventListener("click", (e) => {
      if (e.target === this.dialogEl) this.dialogEl.close();
    });
  }

  bindGlobalShortcut() {
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (this.dialogEl.open) this.dialogEl.close();
        else this.open();
      }
    });
  }

  open() {
    this.dialogEl.innerHTML = `
      <div class="dialog-panel" style="padding:16px">
        <input class="cmd-input" id="cmd-search-input" placeholder="Buscá un país, capital, código ISO o acción (Ej: Japón, Ruta, Pasaporte)…" autocomplete="off">
        <ul class="cmd-list" id="cmd-results-list" role="listbox"></ul>
      </div>
    `;

    const input = this.dialogEl.querySelector("#cmd-search-input");
    const listEl = this.dialogEl.querySelector("#cmd-results-list");

    const update = () => {
      this.buildItems(input.value);
      this.selectedIdx = 0;
      this.renderList(listEl);
    };

    input.addEventListener("input", update);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (this.items.length) {
          this.selectedIdx = (this.selectedIdx + 1) % this.items.length;
          this.renderList(listEl);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this.items.length) {
          this.selectedIdx = (this.selectedIdx - 1 + this.items.length) % this.items.length;
          this.renderList(listEl);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        const chosen = this.items[this.selectedIdx];
        if (chosen) {
          this.dialogEl.close();
          chosen.run();
        }
      }
    });

    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cmd-idx]");
      if (!btn) return;
      const item = this.items[Number(btn.dataset.cmdIdx)];
      if (item) {
        this.dialogEl.close();
        item.run();
      }
    });

    this.dialogEl.showModal();
    update();
    input.focus();
  }

  buildItems(rawQuery) {
    const q = normalizeText(rawQuery);
    const quickCommands = [
      {
        type: "action",
        title: "🧭 Abrir Calculador de Rutas Terrestres",
        sub: "Trazar camino entre fronteras en el Globo",
        run: () => this.actions.openRoutes(),
      },
      {
        type: "action",
        title: "🎮 Jugar Quiz Geográfico",
        sub: "Banderas, capitales, siluetas y desafíos de fronteras",
        run: () => this.actions.openQuiz(),
      },
      {
        type: "action",
        title: "🛂 Abrir Pasaporte de Viajero",
        sub: "Ver sellos visitados y por visitar",
        run: () => this.actions.openPassport(),
      },
      {
        type: "action",
        title: "🎲 Sorpréndeme (País aleatorio)",
        sub: "Volar en el Globo a una nación al azar",
        run: () => this.actions.openRandomCountry(),
      },
      {
        type: "action",
        title: "🌗 Alternar Terminador Solar Día/Noche",
        sub: "Cambiar iluminación real UTC del Globo",
        run: () => this.actions.toggleSolar(),
      },
      {
        type: "action",
        title: "🔄 Limpiar todos los filtros",
        sub: "Mostrar todos los continentes y países",
        run: () => this.actions.resetFilters(),
      },
    ];

    const matchedActions = q
      ? quickCommands.filter((a) => normalizeText(`${a.title} ${a.sub}`).includes(q))
      : quickCommands;

    const countryMatches = this.store.state.countries
      .filter((c) => !q || c.searchKey.includes(q))
      .slice(0, q ? 12 : 6)
      .map((c) => ({
        type: "country",
        title: c.nameEs,
        sub: `${c.capitalText} · ${regionToEs(c.region)} (${c.id})`,
        flag: safeUrl(c.flagSvg),
        run: () => this.actions.openCountry(c.id),
      }));

    this.items = [...matchedActions, ...countryMatches];
  }

  renderList(listEl) {
    if (!this.items.length) {
      listEl.innerHTML = `<li style="padding:12px;color:var(--muted);text-align:center">No hay comandos ni países que coincidan.</li>`;
      return;
    }

    listEl.innerHTML = this.items
      .map((item, idx) => `
        <li>
          <button type="button" class="cmd-item ${idx === this.selectedIdx ? "is-selected" : ""}" data-cmd-idx="${idx}" role="option" aria-selected="${idx === this.selectedIdx}">
            <span class="cmd-item-left">
              ${item.flag ? `<img src="${esc(item.flag)}" alt="">` : ""}
              <span>
                <strong style="display:block;font-size:0.92rem">${esc(item.title)}</strong>
                <small style="color:var(--muted)">${esc(item.sub)}</small>
              </span>
            </span>
            <span class="kbd">${item.type === "country" ? "Explorar" : "Acción"}</span>
          </button>
        </li>
      `)
      .join("");
  }
}
