import { esc, isIso3, safeUrl } from "../utils/sanitize.js";
import { loadQuizStats, saveQuizStats } from "../api/cacheStore.js";
import { loadWorldGeo } from "../api/worldGeo.js";
import { findBorderRoute } from "../utils/routing.js";
import { CountrySilhouette3D } from "./silhouette3d.js";

const MODES = [
  { id: "flag", label: "🏴 Banderas" },
  { id: "capital", label: "🏛️ Capitales" },
  { id: "silhouette", label: "🗺️ Silueta" },
  { id: "borders", label: "🧭 Fronteras" },
];

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export class QuizModalController {
  constructor({ dialogEl, store, globe }) {
    this.dialogEl = dialogEl;
    this.store = store;
    this.globe = globe;

    this.mode = "flag";
    this.streak = 0;
    this.score = 0;
    this.stats = loadQuizStats();
    this.silhouette3d = null;
    this.question = null;
    this.answered = false;

    this.dialogEl.addEventListener("close", () => {
      this.dispose3D();
    });

    this.dialogEl.addEventListener("click", (e) => {
      if (e.target === this.dialogEl) this.dialogEl.close();
    });
  }

  dispose3D() {
    this.silhouette3d?.dispose();
    this.silhouette3d = null;
  }

  open() {
    this.stats = loadQuizStats();
    this.dialogEl.showModal();
    this.startRound();
  }

  async startRound() {
    this.dispose3D();
    this.answered = false;
    const countries = this.store.state.countries;
    if (countries.length < 4) return;

    if (this.mode === "flag") {
      const pool = countries.filter((c) => c.flagSvg && c.population > 50_000);
      const target = pool[Math.floor(Math.random() * pool.length)];
      const distractors = shuffle(pool.filter((c) => c.id !== target.id)).slice(0, 3);
      this.question = {
        type: "flag",
        target,
        options: shuffle([target, ...distractors]),
      };
    } else if (this.mode === "capital") {
      const pool = countries.filter((c) => c.capital.length > 0 && c.population > 100_000);
      const target = pool[Math.floor(Math.random() * pool.length)];
      const seenCap = new Set([target.capital[0]]);
      const distractors = [];
      for (const c of shuffle(pool)) {
        if (distractors.length >= 3) break;
        const cap = c.capital[0];
        if (cap && !seenCap.has(cap)) {
          seenCap.add(cap);
          distractors.push(c);
        }
      }
      this.question = {
        type: "capital",
        target,
        options: shuffle([target, ...distractors]),
      };
    } else if (this.mode === "silhouette") {
      const geo = await loadWorldGeo().catch(() => null);
      const pool = countries.filter(
        (c) => c.area > 25_000 && c.numericCode && geo?.byNumericCode.has(c.numericCode)
      );
      if (pool.length < 4) {
        this.mode = "flag";
        return this.startRound();
      }
      const target = pool[Math.floor(Math.random() * pool.length)];
      const distractors = shuffle(pool.filter((c) => c.id !== target.id)).slice(0, 3);
      this.question = {
        type: "silhouette",
        target,
        feature: geo.byNumericCode.get(target.numericCode),
        options: shuffle([target, ...distractors]),
      };
    } else if (this.mode === "borders") {
      this.question = this.generateBordersChallenge();
    }

    this.render();
  }

  generateBordersChallenge() {
    const state = this.store.state;
    const candidates = state.countries.filter((c) => (c.borders || []).length >= 2);
    for (let tries = 0; tries < 40; tries++) {
      const start = candidates[Math.floor(Math.random() * candidates.length)];
      const end = candidates[Math.floor(Math.random() * candidates.length)];
      if (!start || !end || start.id === end.id) continue;
      const route = findBorderRoute(start.id, end.id, state.countryIndex);
      if (route.found && route.hops >= 2 && route.hops <= 4) {
        return {
          type: "borders",
          start,
          target: end,
          current: start,
          optimalHops: route.hops,
          optimalPath: route.path,
          steps: [start],
          won: false,
        };
      }
    }
    const arg = state.countryIndex.get("ARG");
    const col = state.countryIndex.get("COL");
    const fallbackRoute = findBorderRoute("ARG", "COL", state.countryIndex);
    return {
      type: "borders",
      start: arg,
      target: col,
      current: arg,
      optimalHops: fallbackRoute.hops || 2,
      optimalPath: fallbackRoute.path || [],
      steps: [arg],
      won: false,
    };
  }

  recordAnswer(isCorrect) {
    this.stats.totalPlayed += 1;
    if (isCorrect) {
      this.stats.totalCorrect += 1;
      this.streak += 1;
      this.score += 10 + this.streak * 2;
      const prevBest = this.stats.bestStreaks[this.mode] || 0;
      if (this.streak > prevBest) {
        this.stats.bestStreaks[this.mode] = this.streak;
      }
    } else {
      this.streak = 0;
    }
    saveQuizStats(this.stats);
  }

  render() {
    this.dispose3D();
    const best = this.stats.bestStreaks[this.mode] || 0;
    const tabsHtml = MODES.map(
      (m) => `<button type="button" class="btn btn-pill ${this.mode === m.id ? "btn-primary" : ""}" data-qmode="${esc(m.id)}">${esc(m.label)}</button>`
    ).join("");

    let bodyHtml = "";
    if (this.question?.type === "flag") {
      const flag = safeUrl(this.question.target.flagSvg);
      bodyHtml = `
        <div class="quiz-prompt">
          <p class="quiz-question">¿A qué país pertenece esta bandera?</p>
          <img class="quiz-flag-img" src="${esc(flag)}" alt="Bandera incógnita">
        </div>
        <div class="quiz-options">
          ${this.question.options
            .map((o) => `<button type="button" class="quiz-opt-btn" data-qopt="${esc(o.id)}">${esc(o.nameEs)}</button>`)
            .join("")}
        </div>
      `;
    } else if (this.question?.type === "capital") {
      bodyHtml = `
        <div class="quiz-prompt">
          <p class="quiz-question">¿Cuál es la capital de <strong>${esc(this.question.target.nameEs)}</strong>?</p>
          <small style="color:var(--muted)">Región: ${esc(this.question.target.subregion)}</small>
        </div>
        <div class="quiz-options">
          ${this.question.options
            .map((o) => `<button type="button" class="quiz-opt-btn" data-qopt="${esc(o.id)}">${esc(o.capital[0])}</button>`)
            .join("")}
        </div>
      `;
    } else if (this.question?.type === "silhouette") {
      bodyHtml = `
        <div class="quiz-prompt">
          <p class="quiz-question">¿Qué país corresponde a esta silueta?</p>
          <div class="silhouette-stage" id="quiz-silhouette-stage" style="height:210px;width:100%;max-width:340px;margin:0 auto"></div>
        </div>
        <div class="quiz-options">
          ${this.question.options
            .map((o) => `<button type="button" class="quiz-opt-btn" data-qopt="${esc(o.id)}">${esc(o.nameEs)}</button>`)
            .join("")}
        </div>
      `;
    } else if (this.question?.type === "borders") {
      bodyHtml = this.renderBordersChallengeHtml();
    }

    this.dialogEl.innerHTML = `
      <div class="dialog-panel">
        <div class="dialog-head">
          <div>
            <h2>🎮 Quiz Geográfico</h2>
            <p class="dialog-sub">Poné a prueba tu geografía · El Globo viaja a cada destino al responder</p>
          </div>
          <button type="button" class="btn" id="quiz-close-btn" aria-label="Cerrar">✕</button>
        </div>

        <div class="quiz-hud">
          <div style="display:flex;gap:6px;flex-wrap:wrap">${tabsHtml}</div>
          <div class="quiz-stats-pills">
            <span class="chip is-active tabular">Puntos: ${esc(this.score)}</span>
            <span class="chip tabular">Racha: 🔥 ${esc(this.streak)}</span>
            <span class="chip tabular">Récord: 🏆 ${esc(best)}</span>
          </div>
        </div>

        ${bodyHtml}

        <div class="quiz-feedback" id="quiz-feedback"></div>
      </div>
    `;

    this.bindEvents();
  }

  renderBordersChallengeHtml() {
    const q = this.question;
    const state = this.store.state;
    const current = q.current;
    const neighbors = (current.borders || [])
      .map((id) => state.countryIndex.get(id))
      .filter(Boolean);

    const stepsHtml = q.steps
      .map((s, idx) => {
        const flag = safeUrl(s.flagSvg);
        return `
          <span class="route-node" style="padding:5px 9px;font-size:0.8rem">
            ${flag ? `<img src="${esc(flag)}" alt="">` : ""}
            <span>${esc(s.nameEs)}</span>
          </span>
          ${idx < q.steps.length - 1 ? `<span class="route-arrow">→</span>` : ""}
        `;
      })
      .join("");

    const neighborBtns = q.won
      ? ""
      : neighbors
          .map((n) => {
            const flag = safeUrl(n.flagSvg);
            return `
              <button type="button" class="border-btn" data-qhop="${esc(n.id)}">
                ${flag ? `<img src="${esc(flag)}" alt="">` : ""}
                <span>${esc(n.nameEs)}</span>
              </button>
            `;
          })
          .join("");

    return `
      <div class="quiz-prompt" style="text-align:left">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <span>Objetivo: llegar desde <strong>${esc(q.start.nameEs)}</strong> hasta <strong>${esc(q.target.nameEs)}</strong></span>
          <span class="tabular" style="color:var(--gold-soft)">Saltos: ${q.steps.length - 1} (Óptimo: ${q.optimalHops})</span>
        </div>
        <div class="route-chain" style="margin:8px 0">${stepsHtml}</div>
        ${q.won
          ? `<div class="status-box" style="margin-top:10px;border-color:var(--emerald)">
               <strong>🎉 ¡Llegaste a ${esc(q.target.nameEs)} en ${q.steps.length - 1} saltos!</strong>
               <p style="margin:6px 0 0;color:var(--muted)">
                 ${q.steps.length - 1 <= q.optimalHops ? "¡Ruta óptima perfecta!" : `Ruta óptima era de ${q.optimalHops} saltos (${q.optimalPath.map((p) => esc(p.nameEs)).join(" → ")}).`}
               </p>
             </div>`
          : `<div style="margin-top:12px">
               <small style="color:var(--muted);display:block;margin-bottom:6px">Estás en <strong>${esc(current.nameEs)}</strong>. Elegí una frontera:</small>
               <div class="borders-wrap">${neighborBtns}</div>
             </div>`}
      </div>
      ${q.won ? `<div style="margin-top:12px"><button type="button" class="btn btn-primary" id="quiz-next-btn">Siguiente desafío →</button></div>` : ""}
    `;
  }

  bindEvents() {
    this.dialogEl.querySelector("#quiz-close-btn").addEventListener("click", () => this.dialogEl.close());

    this.dialogEl.querySelectorAll("[data-qmode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextMode = btn.dataset.qmode;
        if (nextMode === this.mode) return;
        this.mode = nextMode;
        this.streak = 0;
        this.startRound();
      });
    });

    if (this.question?.type === "silhouette") {
      const stage = this.dialogEl.querySelector("#quiz-silhouette-stage");
      if (stage) {
        this.silhouette3d = new CountrySilhouette3D(stage, this.question.feature, this.question.target, {
          showPin: false,
          accentHex: 0x14b8a6,
        });
      }
    }

    this.dialogEl.querySelectorAll("[data-qopt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (this.answered) return;
        this.answered = true;
        const chosenId = btn.dataset.qopt;
        const target = this.question.target;
        const isCorrect = chosenId === target.id;
        this.recordAnswer(isCorrect);

        this.dialogEl.querySelectorAll("[data-qopt]").forEach((b) => {
          b.disabled = true;
          if (b.dataset.qopt === target.id) b.classList.add("is-correct");
          else if (b.dataset.qopt === chosenId && !isCorrect) b.classList.add("is-wrong");
        });

        this.globe.flyTo(target.latlng[0], target.latlng[1], 2.25);
        this.globe.showCountryBorderArcs(target, this.store.state.countryIndex);

        const fbEl = this.dialogEl.querySelector("#quiz-feedback");
        fbEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:14px">
            <span>${isCorrect ? `✅ ¡Correcto! Era <strong>${esc(target.nameEs)}</strong> (${esc(target.capitalText)}).` : `❌ Era <strong>${esc(target.nameEs)}</strong> (${esc(target.capitalText)}).`}</span>
            <button type="button" class="btn btn-primary" id="quiz-next-btn">Siguiente pregunta →</button>
          </div>
        `;
        fbEl.querySelector("#quiz-next-btn").addEventListener("click", () => this.startRound());
      });
    });

    this.dialogEl.querySelectorAll("[data-qhop]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextId = btn.dataset.qhop;
        if (!isIso3(nextId)) return;
        const nextCountry = this.store.state.countryIndex.get(nextId);
        if (!nextCountry) return;

        this.question.current = nextCountry;
        this.question.steps.push(nextCountry);
        this.globe.flyTo(nextCountry.latlng[0], nextCountry.latlng[1], 2.35);
        this.globe.showCountryBorderArcs(nextCountry, this.store.state.countryIndex);

        if (nextCountry.id === this.question.target.id) {
          this.question.won = true;
          this.recordAnswer(true);
        }
        this.render();
      });
    });

    this.dialogEl.querySelector("#quiz-next-btn")?.addEventListener("click", () => this.startRound());
  }
}
