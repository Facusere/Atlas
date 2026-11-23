import { esc } from "../utils/sanitize.js";
import { formatNumber, regionToEs } from "../utils/formatters.js";
import { loadWorldGeo } from "../api/worldGeo.js";

const EARTH_RADIUS = 1.0;
const NASA_DAY_URL = "https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg";
const NASA_NIGHT_URL = "https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-night.jpg";
const NASA_TOPO_URL = "https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-topology.png";

const REGION_ATMOSPHERE = {
  "": 0x14b8a6,
  Americas: 0x10b981,
  Europe: 0x3b82f6,
  Africa: 0xf59e0b,
  Asia: 0xef4444,
  Oceania: 0x06b6d4,
  Antarctic: 0x818cf8,
};

function latLngToVec3(lat, lng, radius, THREE) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function getSunDirection(THREE) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 0));
  const dayOfYear = Math.floor((now - start) / 86_400_000);
  const declDeg = -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  let sunLng = (12 - utcHours) * 15;
  if (sunLng > 180) sunLng -= 360;
  if (sunLng < -180) sunLng += 360;
  return latLngToVec3(declDeg, sunLng, 1, THREE).normalize();
}

function drawPolygonRings(ctx, rings, W, H) {
  for (const ring of rings) {
    if (!ring.length) continue;
    ctx.moveTo(((ring[0][0] + 180) / 360) * W, ((90 - ring[0][1]) / 180) * H);
    for (let i = 1; i < ring.length; i++) {
      const prevLng = ring[i - 1][0];
      const currLng = ring[i][0];
      const x = ((currLng + 180) / 360) * W;
      const y = ((90 - ring[i][1]) / 180) * H;
      if (Math.abs(currLng - prevLng) > 180) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
  }
}

function createBaseCanvases(countries, geoFeatures) {
  const W = 2048;
  const H = 1024;

  const dayCanvas = document.createElement("canvas");
  dayCanvas.width = W; dayCanvas.height = H;
  const dCtx = dayCanvas.getContext("2d");

  const nightCanvas = document.createElement("canvas");
  nightCanvas.width = W; nightCanvas.height = H;
  const nCtx = nightCanvas.getContext("2d");

  const waterCanvas = document.createElement("canvas");
  waterCanvas.width = W; waterCanvas.height = H;
  const wCtx = waterCanvas.getContext("2d");

  const oceanGrad = dCtx.createLinearGradient(0, 0, 0, H);
  oceanGrad.addColorStop(0, "#0b2e3d");
  oceanGrad.addColorStop(0.5, "#071f2c");
  oceanGrad.addColorStop(1, "#0a2736");
  dCtx.fillStyle = oceanGrad;
  dCtx.fillRect(0, 0, W, H);

  nCtx.fillStyle = "#030912";
  nCtx.fillRect(0, 0, W, H);

  wCtx.fillStyle = "#ffffff";
  wCtx.fillRect(0, 0, W, H);

  for (const feat of geoFeatures) {
    const polys = feat.geometry?.type === "Polygon"
      ? [feat.geometry.coordinates]
      : feat.geometry?.type === "MultiPolygon"
        ? feat.geometry.coordinates
        : [];
    dCtx.beginPath();
    nCtx.beginPath();
    wCtx.beginPath();
    for (const poly of polys) {
      drawPolygonRings(dCtx, poly, W, H);
      drawPolygonRings(nCtx, poly, W, H);
      drawPolygonRings(wCtx, poly, W, H);
    }
    dCtx.fillStyle = "#174b52";
    dCtx.fill();
    dCtx.strokeStyle = "rgba(94, 234, 212, 0.22)";
    dCtx.lineWidth = 0.7;
    dCtx.stroke();

    nCtx.fillStyle = "#091824";
    nCtx.fill();

    wCtx.fillStyle = "#000000";
    wCtx.fill();
  }

  for (const c of countries) {
    const [lat, lng] = c.latlng;
    const x = ((lng + 180) / 360) * W;
    const y = ((90 - lat) / 180) * H;
    const r = Math.min(16, Math.max(4, Math.log10((c.population || 10_000) + 10) * 2));
    const grad = nCtx.createRadialGradient(x, y, 0.4, x, y, r);
    grad.addColorStop(0, "rgba(253, 224, 71, 0.85)");
    grad.addColorStop(0.5, "rgba(245, 158, 11, 0.28)");
    grad.addColorStop(1, "rgba(245, 158, 11, 0)");
    nCtx.fillStyle = grad;
    nCtx.beginPath();
    nCtx.arc(x, y, r, 0, Math.PI * 2);
    nCtx.fill();
  }

  return { dayCanvas, nightCanvas, waterCanvas };
}

function createOverlayCanvas(geoFeatures, state) {
  const W = 2048;
  const H = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Subtle cartographic graticule lines
  ctx.strokeStyle = "rgba(148, 234, 212, 0.08)";
  ctx.lineWidth = 0.9;
  for (let lng = -150; lng <= 150; lng += 30) {
    const x = ((lng + 180) / 360) * W;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * H;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  for (const feat of geoFeatures) {
    const numId = String(feat.id || "").padStart(3, "0");
    const matched = state.numericIndex.get(numId);
    const isActive = matched && matched.id === state.activeCountryId;
    const isVisited = matched && Boolean(state.visited[matched.id]);
    const isWishlist = matched && state.wishlist.has(matched.id);

    const polys = feat.geometry?.type === "Polygon"
      ? [feat.geometry.coordinates]
      : feat.geometry?.type === "MultiPolygon"
        ? feat.geometry.coordinates
        : [];
    if (!polys.length) continue;

    ctx.beginPath();
    for (const poly of polys) {
      drawPolygonRings(ctx, poly, W, H);
    }

    if (isActive) {
      ctx.fillStyle = "rgba(45, 212, 191, 0.52)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 2.0;
      ctx.stroke();
    } else if (isVisited) {
      ctx.fillStyle = "rgba(245, 158, 11, 0.45)";
      ctx.fill();
      ctx.strokeStyle = "rgba(253, 230, 138, 0.85)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else if (isWishlist) {
      ctx.fillStyle = "rgba(16, 185, 129, 0.42)";
      ctx.fill();
      ctx.strokeStyle = "rgba(110, 231, 183, 0.8)";
      ctx.lineWidth = 1.1;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(203, 245, 238, 0.16)";
      ctx.lineWidth = 0.65;
      ctx.stroke();
    }
  }

  return canvas;
}

function createCloudsCanvas() {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  let seed = 4217;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 680; i++) {
    const x = rand() * W;
    // Concentrate bands gently around tropics & mid-latitude storm tracks
    const bandBias = i % 3 === 0 ? 0.5 + (rand() - 0.5) * 0.16 : 0.08 + rand() * 0.84;
    const y = bandBias * H;
    const rx = 18 + rand() * 78;
    const ry = 3 + rand() * 11;
    const alpha = 0.025 + rand() * 0.065;
    const grad = ctx.createRadialGradient(x, y, 1, x, y, rx);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.55, `rgba(240, 249, 255, ${alpha * 0.45})`);
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rand() - 0.5) * 0.28);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return canvas;
}

function createSunGlowTexture(THREE) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, "rgba(255, 250, 232, 1.0)");
  grad.addColorStop(0.18, "rgba(253, 224, 138, 0.85)");
  grad.addColorStop(0.45, "rgba(251, 146, 60, 0.25)");
  grad.addColorStop(1, "rgba(251, 146, 60, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function createStarSprite(THREE) {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.65)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export class GlobeController {
  constructor({ wrapEl, tooltipEl, onSelectCountry }) {
    this.wrapEl = wrapEl;
    this.tooltipEl = tooltipEl;
    this.onSelectCountry = onSelectCountry;

    this.THREE = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.earthMesh = null;
    this.cloudsMesh = null;
    this.atmosphereMesh = null;
    this.orbitalRing = null;
    this.sunSprite = null;
    this.pinsMesh = null;
    this.activeRing = null;
    this.hoverRing = null;
    this.arcsGroup = null;

    this.geoFeatures = [];
    this.dayTex = null;
    this.nightTex = null;
    this.waterTex = null;
    this.overlayTex = null;
    this.pinCountries = [];
    this.arcPulses = [];
    this.showPins = true;

    this.flyTargetPos = null;
    this.isInView = true;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.rafId = null;
    this.ready = false;
  }

  async init(state) {
    try {
      const [THREE, { OrbitControls }, worldGeo] = await Promise.all([
        import("three"),
        import("three/addons/controls/OrbitControls.js"),
        loadWorldGeo(),
      ]);

      this.THREE = THREE;
      this.geoFeatures = worldGeo.features || [];

      const width = this.wrapEl.clientWidth || 900;
      const height = this.wrapEl.clientHeight || 400;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      this.camera.position.set(0.35, 0.45, 2.75);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height);
      this.wrapEl.innerHTML = "";
      this.wrapEl.appendChild(this.renderer.domElement);

      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.enablePan = false;
      this.controls.minDistance = 1.42;
      this.controls.maxDistance = 4.4;
      this.controls.autoRotate = state.globe.autoRotate && !this.reducedMotion;
      this.controls.autoRotateSpeed = 0.52;
      this.controls.addEventListener("start", () => {
        this.flyTargetPos = null;
      });

      this.showPins = state.globe.showPins !== false;
      this.buildStarfield();
      this.buildSunSprite(state.globe);
      this.buildEarth(state);
      this.buildClouds(state.globe);
      this.buildAtmosphere(state.filters.region, state.globe);
      this.buildOrbitalRing(state.filters.region);
      this.buildActiveRing();
      this.buildHoverRing();

      this.arcsGroup = new THREE.Group();
      this.scene.add(this.arcsGroup);

      this.updatePins(state);
      this.bindPointerEvents();
      this.bindResizeAndVisibility();

      this.ready = true;
      this.startLoop();
      this.upgradeNasaTextures();
    } catch {
      this.wrapEl.innerHTML = `<div class="globe-fallback">
        <div>
          <strong>Vista 3D del globo no disponible en este entorno</strong>
          <p style="margin:6px 0 0;font-size:0.86rem">Podés seguir explorando toda la grilla, rutas, pasaporte, quiz y comparador debajo.</p>
        </div>
      </div>`;
    }
  }

  buildStarfield() {
    const THREE = this.THREE;
    const count = 1600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xc7f9f1),
      new THREE.Color(0xbae6fd),
      new THREE.Color(0xfef3c7),
    ];

    for (let i = 0; i < count; i++) {
      const r = 14 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const c = palette[i % palette.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.14,
      map: createStarSprite(THREE),
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.scene.add(new THREE.Points(geo, mat));
  }

  buildEarth(state) {
    const THREE = this.THREE;
    const { dayCanvas, nightCanvas, waterCanvas } = createBaseCanvases(state.countries, this.geoFeatures);
    const overlayCanvas = createOverlayCanvas(this.geoFeatures, state);

    this.dayTex = new THREE.CanvasTexture(dayCanvas);
    this.dayTex.colorSpace = THREE.SRGBColorSpace;
    this.dayTex.anisotropy = 4;

    this.nightTex = new THREE.CanvasTexture(nightCanvas);
    this.nightTex.colorSpace = THREE.SRGBColorSpace;
    this.nightTex.anisotropy = 4;

    this.waterTex = new THREE.CanvasTexture(waterCanvas);

    this.overlayTex = new THREE.CanvasTexture(overlayCanvas);
    this.overlayTex.colorSpace = THREE.SRGBColorSpace;
    this.overlayTex.anisotropy = 4;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uDayTex: { value: this.dayTex },
        uNightTex: { value: this.nightTex },
        uWaterTex: { value: this.waterTex },
        uTopoTex: { value: this.waterTex },
        uHasTopo: { value: 0.0 },
        uOverlayTex: { value: this.overlayTex },
        uSunDir: { value: getSunDirection(THREE) },
        uUseSolar: { value: state.globe.solarTerminator ? 1.0 : 0.0 },
        uAccent: { value: new THREE.Color(REGION_ATMOSPHERE[state.filters.region] || 0x14b8a6) },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormalObj;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying vec3 vViewDirObj;
        void main() {
          vUv = uv;
          vNormalObj = normalize(normal);
          vNormalView = normalize(normalMatrix * normal);
          vViewDirObj = normalize(cameraPosition - position);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uDayTex;
        uniform sampler2D uNightTex;
        uniform sampler2D uWaterTex;
        uniform sampler2D uTopoTex;
        uniform float uHasTopo;
        uniform sampler2D uOverlayTex;
        uniform vec3 uSunDir;
        uniform float uUseSolar;
        uniform vec3 uAccent;
        varying vec2 vUv;
        varying vec3 vNormalObj;
        varying vec3 vNormalView;
        varying vec3 vViewDir;
        varying vec3 vViewDirObj;

        void main() {
          vec3 N = normalize(vNormalObj);
          vec3 L = normalize(uSunDir);
          vec3 V = normalize(vViewDirObj);
          float waterMask = texture2D(uWaterTex, vUv).r;

          vec3 dayCol = texture2D(uDayTex, vUv).rgb;
          vec3 nightCol = texture2D(uNightTex, vUv).rgb;

          // Subtle topographic hillshading on land
          if (uHasTopo > 0.5 && waterMask < 0.5) {
            float e0 = texture2D(uTopoTex, vUv).r;
            float ex = texture2D(uTopoTex, vUv + vec2(0.0012, 0.0)).r;
            float ey = texture2D(uTopoTex, vUv + vec2(0.0, 0.0024)).r;
            float slope = clamp((e0 - ex) * 3.5 + (e0 - ey) * 3.5, -0.22, 0.25);
            dayCol *= (1.0 + slope);
          }

          // Blinn-Phong specular ocean sun glint
          vec3 H = normalize(L + V);
          float specAngle = max(dot(N, H), 0.0);
          float oceanGlint = pow(specAngle, 64.0) * waterMask * 0.55;

          vec3 col = dayCol;
          if (uUseSolar > 0.5) {
            float ndotl = dot(N, L);
            float dayFactor = smoothstep(-0.14, 0.16, ndotl);
            float twilight = exp(-pow(ndotl * 11.5, 2.0));
            float sunShade = 0.45 + 0.65 * clamp(ndotl, 0.0, 1.0);
            vec3 litDay = dayCol * sunShade + vec3(0.92, 0.97, 1.0) * oceanGlint * dayFactor;
            vec3 litNight = pow(nightCol, vec3(0.88)) * 1.95 + vec3(0.015, 0.04, 0.075);
            col = mix(litNight, litDay, dayFactor);
            col += vec3(1.0, 0.48, 0.14) * twilight * 0.32;
          } else {
            col = dayCol * 1.1 + vec3(0.88, 0.96, 1.0) * (oceanGlint * 0.5);
          }

          // Passport & border overlay composition
          vec4 ov = texture2D(uOverlayTex, vUv);
          col = mix(col, ov.rgb, clamp(ov.a * 0.88, 0.0, 0.85));

          // Subtle Fresnel rim glow
          vec3 nView = normalize(vNormalView);
          float fresnel = pow(1.0 - max(dot(nView, normalize(vViewDir)), 0.0), 3.4);
          col += uAccent * fresnel * 0.26;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const geom = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    this.earthMesh = new THREE.Mesh(geom, material);
    this.scene.add(this.earthMesh);
  }

  upgradeNasaTextures() {
    if (!this.THREE || !this.earthMesh) return;
    const loader = new this.THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    const loadTex = (url, isColor, onDone) => {
      loader.load(
        url,
        (tex) => {
          if (isColor) tex.colorSpace = this.THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          onDone(tex);
        },
        undefined,
        () => {
          // Keep procedural texture cleanly on failure
        }
      );
    };

    loadTex(NASA_DAY_URL, true, (tex) => {
      this.dayTex?.dispose();
      this.dayTex = tex;
      this.earthMesh.material.uniforms.uDayTex.value = tex;
    });

    loadTex(NASA_NIGHT_URL, true, (tex) => {
      this.nightTex?.dispose();
      this.nightTex = tex;
      this.earthMesh.material.uniforms.uNightTex.value = tex;
    });

    loadTex(NASA_TOPO_URL, false, (tex) => {
      this.earthMesh.material.uniforms.uTopoTex.value = tex;
      this.earthMesh.material.uniforms.uHasTopo.value = 1.0;
    });
  }

  buildSunSprite(globeState) {
    const THREE = this.THREE;
    const mat = new THREE.SpriteMaterial({
      map: createSunGlowTexture(THREE),
      color: 0xfff5d6,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sunSprite = new THREE.Sprite(mat);
    this.sunSprite.scale.set(3.6, 3.6, 1);
    this.sunSprite.position.copy(getSunDirection(THREE).multiplyScalar(14));
    this.sunSprite.visible = globeState.solarTerminator !== false;
    this.scene.add(this.sunSprite);
  }

  buildClouds(globeState) {
    const THREE = this.THREE;
    const cloudTex = new THREE.CanvasTexture(createCloudsCanvas());
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uCloudTex: { value: cloudTex },
        uSunDir: { value: getSunDirection(THREE) },
        uUseSolar: { value: globeState.solarTerminator ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vUv = uv;
          vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uCloudTex;
        uniform vec3 uSunDir;
        uniform float uUseSolar;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        void main() {
          vec4 c = texture2D(uCloudTex, vUv);
          float ndotl = dot(normalize(vWorldNormal), normalize(uSunDir));
          float dayLight = uUseSolar > 0.5 ? mix(0.14, 1.0, smoothstep(-0.18, 0.25, ndotl)) : 0.95;
          gl_FragColor = vec4(vec3(0.95, 0.98, 1.0) * dayLight, c.a * 0.78 * mix(0.32, 1.0, dayLight));
        }
      `,
      transparent: true,
      depthWrite: false,
    });
    const geom = new THREE.SphereGeometry(EARTH_RADIUS * 1.015, 48, 48);
    this.cloudsMesh = new THREE.Mesh(geom, mat);
    this.cloudsMesh.visible = globeState.showClouds !== false;
    this.scene.add(this.cloudsMesh);
  }

  buildAtmosphere(region, globeState) {
    const THREE = this.THREE;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(REGION_ATMOSPHERE[region] || 0x14b8a6) },
        uSunDir: { value: getSunDirection(THREE) },
        uUseSolar: { value: globeState.solarTerminator ? 1.0 : 0.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vNormalObj;
        void main() {
          vNormalObj = normalize(normal);
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uSunDir;
        uniform float uUseSolar;
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vNormalObj;
        void main() {
          // Smooth Rayleigh falloff: 0.0 at outer edge (1.11*R), peaks at Earth's limb (dot=-0.434)
          float rim = clamp((-dot(vNormal, vView)) / 0.434, 0.0, 1.0);
          float glow = pow(rim, 3.2);
          float sunSide = uUseSolar > 0.5
            ? mix(0.28, 1.0, smoothstep(-0.3, 0.4, dot(normalize(vNormalObj), normalize(uSunDir))))
            : 0.85;
          gl_FragColor = vec4(uColor, clamp(glow * sunSide * 0.75, 0.0, 0.78));
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });

    const geom = new THREE.SphereGeometry(EARTH_RADIUS * 1.11, 64, 64);
    this.atmosphereMesh = new THREE.Mesh(geom, mat);
    this.scene.add(this.atmosphereMesh);
  }

  buildOrbitalRing(region) {
    const THREE = this.THREE;
    const geo = new THREE.TorusGeometry(EARTH_RADIUS * 1.18, 0.0022, 8, 160);
    const mat = new THREE.MeshBasicMaterial({
      color: REGION_ATMOSPHERE[region] || 0x14b8a6,
      transparent: true,
      opacity: 0.28,
    });
    this.orbitalRing = new THREE.Mesh(geo, mat);
    this.orbitalRing.rotation.x = Math.PI * 0.42;
    this.orbitalRing.rotation.y = 0.26;
    this.scene.add(this.orbitalRing);
  }

  buildActiveRing() {
    const THREE = this.THREE;
    const ringGeo = new THREE.RingGeometry(0.018, 0.031, 28);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x5eead4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    this.activeRing = new THREE.Mesh(ringGeo, ringMat);
    this.activeRing.visible = false;
    this.scene.add(this.activeRing);
  }

  buildHoverRing() {
    const THREE = this.THREE;
    const ringGeo = new THREE.RingGeometry(0.012, 0.021, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfde68a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
    });
    this.hoverRing = new THREE.Mesh(ringGeo, ringMat);
    this.hoverRing.visible = false;
    this.scene.add(this.hoverRing);
  }

  refreshTextures(state) {
    if (!this.ready || !this.earthMesh) return;
    const overlayCanvas = createOverlayCanvas(this.geoFeatures, state);
    this.overlayTex.image = overlayCanvas;
    this.overlayTex.needsUpdate = true;

    const accentHex = REGION_ATMOSPHERE[state.filters.region] || 0x14b8a6;
    const accentColor = new this.THREE.Color(accentHex);
    this.earthMesh.material.uniforms.uAccent.value.copy(accentColor);
    this.atmosphereMesh.material.uniforms.uColor.value.copy(accentColor);
    this.orbitalRing?.material.color.setHex(accentHex);
  }

  updateGlobeOptions(globeState) {
    this.showPins = globeState.showPins !== false;
    if (!this.ready) return;
    const sunDir = getSunDirection(this.THREE);
    const useSolar = globeState.solarTerminator ? 1.0 : 0.0;

    this.earthMesh.material.uniforms.uUseSolar.value = useSolar;
    this.earthMesh.material.uniforms.uSunDir.value.copy(sunDir);

    if (this.cloudsMesh) {
      this.cloudsMesh.visible = globeState.showClouds !== false;
      this.cloudsMesh.material.uniforms.uUseSolar.value = useSolar;
      this.cloudsMesh.material.uniforms.uSunDir.value.copy(sunDir);
    }

    if (this.atmosphereMesh) {
      this.atmosphereMesh.material.uniforms.uUseSolar.value = useSolar;
      this.atmosphereMesh.material.uniforms.uSunDir.value.copy(sunDir);
    }

    if (this.sunSprite) {
      this.sunSprite.position.copy(sunDir.clone().multiplyScalar(14));
      this.sunSprite.visible = globeState.solarTerminator !== false;
    }

    if (this.pinsMesh) {
      this.pinsMesh.visible = this.showPins;
    }
    if (!this.showPins && this.hoverRing) {
      this.hoverRing.visible = false;
    }

    this.controls.autoRotate = globeState.autoRotate && !this.reducedMotion;
  }

  updatePins(state) {
    if (!this.scene || !this.THREE) return;
    const THREE = this.THREE;

    if (this.pinsMesh) {
      this.scene.remove(this.pinsMesh);
      this.pinsMesh.geometry.dispose();
      this.pinsMesh.material.dispose();
    }

    const list = state.filtered;
    this.pinCountries = list;
    if (!list.length) {
      this.pinsMesh = null;
      return;
    }

    const pinGeo = new THREE.CylinderGeometry(0.0042, 0.0018, 0.026, 8);
    pinGeo.translate(0, 0.013, 0);
    const pinMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(pinGeo, pinMat, list.length);

    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    const color = new THREE.Color();

    list.forEach((c, idx) => {
      const pos = latLngToVec3(c.latlng[0], c.latlng[1], EARTH_RADIUS, THREE);
      dummy.position.copy(pos);
      dummy.quaternion.setFromUnitVectors(up, pos.clone().normalize());
      const isSelected = c.id === state.activeCountryId;
      const scale = isSelected ? 1.85 : 1.0;
      dummy.scale.set(scale, isSelected ? 2.15 : 1.0, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);

      if (isSelected) color.setHex(0xffffff);
      else if (state.visited[c.id]) color.setHex(0xfbbf24);
      else if (state.wishlist.has(c.id)) color.setHex(0x34d399);
      else color.setHex(0x5eead4);

      mesh.setColorAt(idx, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.visible = state.globe.showPins !== false;
    this.pinsMesh = mesh;
    this.scene.add(mesh);

    if (this.activeRing) {
      const active = state.countryIndex.get(state.activeCountryId);
      if (active) {
        const pos = latLngToVec3(active.latlng[0], active.latlng[1], EARTH_RADIUS * 1.006, THREE);
        this.activeRing.position.copy(pos);
        this.activeRing.lookAt(pos.clone().multiplyScalar(2));
        this.activeRing.visible = true;
      } else {
        this.activeRing.visible = false;
      }
    }
  }

  clearArcs() {
    if (!this.arcsGroup) return;
    while (this.arcsGroup.children.length > 0) {
      const child = this.arcsGroup.children[0];
      this.arcsGroup.remove(child);
      child.geometry?.dispose();
      child.material?.dispose();
    }
    this.arcPulses = [];
  }

  showCountryBorderArcs(country, countryIndex, highlightNeighborId = null) {
    if (!this.ready) return;
    this.clearArcs();
    if (!country) return;

    for (const borderId of country.borders || []) {
      const neighbor = countryIndex.get(borderId);
      if (!neighbor) continue;
      const isHi = borderId === highlightNeighborId;
      this.addGeodesicArc(
        country.latlng,
        neighbor.latlng,
        isHi ? 0xfbbf24 : 0x5eead4,
        isHi ? 0.0085 : 0.0045
      );
    }
  }

  showLandRoute(route) {
    if (!this.ready) return;
    this.clearArcs();
    if (!route?.found || !route.path || route.path.length < 2) return;

    for (let i = 0; i < route.path.length - 1; i++) {
      this.addGeodesicArc(route.path[i].latlng, route.path[i + 1].latlng, 0xfbbf24, 0.0095, true);
    }
    const mid = route.path[Math.floor(route.path.length / 2)];
    if (mid) this.flyTo(mid.latlng[0], mid.latlng[1], 2.75);
  }

  addGeodesicArc(coordA, coordB, hexColor, tubeRadius = 0.006, withPulse = true) {
    const THREE = this.THREE;
    const start = latLngToVec3(coordA[0], coordA[1], EARTH_RADIUS * 1.005, THREE);
    const end = latLngToVec3(coordB[0], coordB[1], EARTH_RADIUS * 1.005, THREE);
    const dist = start.distanceTo(end);
    const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(
      EARTH_RADIUS + Math.min(0.45, Math.max(0.08, dist * 0.36))
    );

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    const tubeGeo = new THREE.TubeGeometry(curve, 36, tubeRadius, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.85,
    });
    this.arcsGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

    if (withPulse && !this.reducedMotion) {
      const pulseGeo = new THREE.SphereGeometry(tubeRadius * 2.2, 8, 8);
      const pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pulseMesh = new THREE.Mesh(pulseGeo, pulseMat);
      this.arcsGroup.add(pulseMesh);
      this.arcPulses.push({ mesh: pulseMesh, curve, t: Math.random() });
    }
  }

  flyTo(lat, lng, distance = 2.35) {
    if (!this.ready) return;
    this.flyTargetPos = latLngToVec3(lat, lng, distance, this.THREE);
  }

  bindPointerEvents() {
    const THREE = this.THREE;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const canvas = this.renderer.domElement;

    canvas.addEventListener("pointerdown", (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener("pointermove", (e) => {
      if (!this.showPins || !this.pinsMesh || !this.pinCountries.length) {
        if (this.hoverRing) this.hoverRing.visible = false;
        this.tooltipEl.style.display = "none";
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, this.camera);
      const hits = raycaster.intersectObject(this.pinsMesh, false);

      if (hits.length > 0 && hits[0].instanceId !== undefined) {
        const c = this.pinCountries[hits[0].instanceId];
        if (c) {
          canvas.style.cursor = "pointer";
          this.tooltipEl.style.display = "block";
          this.tooltipEl.style.left = `${e.clientX - rect.left}px`;
          this.tooltipEl.style.top = `${e.clientY - rect.top}px`;
          this.tooltipEl.innerHTML =
            `<strong>${esc(c.nameEs)}</strong> · ${esc(regionToEs(c.region))} · ${esc(formatNumber(c.population))} hab.`;
          if (this.hoverRing) {
            const pos = latLngToVec3(c.latlng[0], c.latlng[1], EARTH_RADIUS * 1.007, THREE);
            this.hoverRing.position.copy(pos);
            this.hoverRing.lookAt(pos.clone().multiplyScalar(2));
            this.hoverRing.visible = true;
          }
          return;
        }
      }
      canvas.style.cursor = "grab";
      this.tooltipEl.style.display = "none";
      if (this.hoverRing) this.hoverRing.visible = false;
    });

    canvas.addEventListener("pointerleave", () => {
      this.tooltipEl.style.display = "none";
      if (this.hoverRing) this.hoverRing.visible = false;
    });

    canvas.addEventListener("click", (e) => {
      const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (moved > 6 || !this.showPins || !this.pinsMesh) return;
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, this.camera);
      const hits = raycaster.intersectObject(this.pinsMesh, false);
      if (hits.length > 0 && hits[0].instanceId !== undefined) {
        const c = this.pinCountries[hits[0].instanceId];
        if (c && this.onSelectCountry) this.onSelectCountry(c.id);
      }
    });
  }

  bindResizeAndVisibility() {
    const resize = () => {
      if (!this.renderer || !this.camera) return;
      const w = this.wrapEl.clientWidth;
      const h = this.wrapEl.clientHeight;
      if (w <= 0 || h <= 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    if ("ResizeObserver" in window) {
      new ResizeObserver(resize).observe(this.wrapEl);
    } else {
      window.addEventListener("resize", resize);
    }

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        this.isInView = entries[0]?.isIntersecting ?? true;
      }, { threshold: 0.05 });
      io.observe(this.wrapEl);
    }
  }

  startLoop() {
    let lastTime = performance.now();
    const tick = (now) => {
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (document.hidden || !this.isInView || !this.renderer) return;

      if (this.flyTargetPos) {
        const curLen = this.camera.position.length();
        const targetLen = this.flyTargetPos.length();
        const nextLen = curLen + (targetLen - curLen) * 0.08;
        const nextDir = this.camera.position
          .clone()
          .normalize()
          .lerp(this.flyTargetPos.clone().normalize(), 0.08)
          .normalize();
        this.camera.position.copy(nextDir.multiplyScalar(nextLen));
        if (this.camera.position.distanceTo(this.flyTargetPos) < 0.03) {
          this.flyTargetPos = null;
        }
      }

      if (this.cloudsMesh && !this.reducedMotion) {
        this.cloudsMesh.rotation.y += dt * 0.014;
      }

      if (this.activeRing && this.activeRing.visible && !this.reducedMotion) {
        const s = 1 + 0.35 * Math.sin(now * 0.005);
        this.activeRing.scale.set(s, s, 1);
      }

      for (const pulse of this.arcPulses) {
        pulse.t = (pulse.t + dt * 0.45) % 1;
        pulse.mesh.position.copy(pulse.curve.getPoint(pulse.t));
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(tick);
  }
}
