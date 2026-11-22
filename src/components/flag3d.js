import { esc, safeUrl } from "../utils/sanitize.js";

/**
 * 3D Cloth-Simulated Flag rendered with Three.js & custom GLSL wave/lighting shader.
 */
export class WavingFlag3D {
  constructor(containerEl, flagPngUrl, flagSvgFallbackUrl, flagAlt) {
    this.containerEl = containerEl;
    this.flagPngUrl = safeUrl(flagPngUrl);
    this.flagSvgFallbackUrl = safeUrl(flagSvgFallbackUrl);
    this.flagAlt = flagAlt || "Bandera";
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.mesh = null;
    this.texture = null;
    this.rafId = null;
    this.resizeObs = null;
    this.disposed = false;
    this.windBoost = 1.0;
    this.pointerTilt = 0.0;

    this.init();
  }

  renderFallbackImg() {
    if (this.disposed || !this.containerEl) return;
    const url = this.flagSvgFallbackUrl || this.flagPngUrl;
    this.containerEl.innerHTML = `<img class="flag-3d-fallback" src="${esc(url)}" alt="${esc(this.flagAlt)}">`;
  }

  async init() {
    if (this.reducedMotion || !this.flagPngUrl) {
      this.renderFallbackImg();
      return;
    }

    try {
      const THREE = await import("three");
      if (this.disposed) return;

      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      const tex = await new Promise((resolve, reject) => {
        loader.load(this.flagPngUrl, resolve, undefined, reject);
      });

      if (this.disposed) {
        tex.dispose();
        return;
      }

      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      this.texture = tex;

      const width = Math.max(200, this.containerEl.clientWidth || 240);
      const height = Math.max(140, this.containerEl.clientHeight || 165);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 20);
      this.camera.position.set(0.05, 0.08, 4.35);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height);

      this.containerEl.innerHTML = "";
      this.containerEl.appendChild(this.renderer.domElement);

      // Metallic Flagpole + Finial
      const poleGeo = new THREE.CylinderGeometry(0.04, 0.045, 2.55, 16);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.78, roughness: 0.25 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(-1.46, -0.22, 0);
      this.scene.add(pole);

      const finialGeo = new THREE.SphereGeometry(0.08, 16, 16);
      const finialMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 });
      const finial = new THREE.Mesh(finialGeo, finialMat);
      finial.position.set(-1.46, 1.08, 0);
      this.scene.add(finial);

      const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
      dirLight.position.set(2, 3, 4);
      this.scene.add(dirLight);
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));

      // Subdivided Cloth Mesh anchored on left edge
      const clothGeo = new THREE.PlaneGeometry(2.85, 1.85, 36, 22);
      const clothMat = new THREE.ShaderMaterial({
        uniforms: {
          uTex: { value: tex },
          uTime: { value: 0 },
          uWind: { value: 1.0 },
          uTilt: { value: 0.0 },
        },
        side: THREE.DoubleSide,
        vertexShader: `
          uniform float uTime;
          uniform float uWind;
          uniform float uTilt;
          varying vec2 vUv;
          varying float vSlope;

          void main() {
            vUv = uv;
            vec3 pos = position;
            float pin = smoothstep(0.0, 0.28, uv.x);

            float wave1 = sin(uv.x * 7.2 - uTime * 3.1 * uWind + uv.y * 1.9);
            float wave2 = cos(uv.x * 12.5 - uTime * 4.4 * uWind - uv.y * 2.6) * 0.35;
            float disp = (wave1 + wave2) * 0.16 * pin * uWind;

            // Approximate x-derivative for cloth fold shading
            float dWave = cos(uv.x * 7.2 - uTime * 3.1 * uWind + uv.y * 1.9) * 7.2;
            vSlope = dWave * 0.12 * pin;

            pos.z += disp + uv.x * uTilt * 0.25;
            pos.y += sin(uv.x * 4.5 - uTime * 2.2) * 0.035 * pin;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uTex;
          varying vec2 vUv;
          varying float vSlope;

          void main() {
            vec4 texel = texture2D(uTex, vUv);
            float shade = clamp(0.92 + vSlope * 0.24, 0.68, 1.18);
            float edgeShadow = smoothstep(0.0, 0.06, vUv.x);
            vec3 col = texel.rgb * shade * mix(0.75, 1.0, edgeShadow);
            gl_FragColor = vec4(col, texel.a);
          }
        `,
      });

      this.mesh = new THREE.Mesh(clothGeo, clothMat);
      this.mesh.position.set(0.0, 0.05, 0);
      this.scene.add(this.mesh);

      this.bindEvents();
      this.startLoop();
    } catch {
      this.renderFallbackImg();
    }
  }

  bindEvents() {
    const canvas = this.renderer?.domElement;
    if (!canvas) return;

    canvas.addEventListener("pointermove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      this.windBoost = 1.45;
      this.pointerTilt = nx;
    });

    canvas.addEventListener("pointerleave", () => {
      this.windBoost = 1.0;
      this.pointerTilt = 0.0;
    });

    if ("ResizeObserver" in window) {
      this.resizeObs = new ResizeObserver(() => {
        if (!this.renderer || !this.camera || this.disposed) return;
        const w = this.containerEl.clientWidth;
        const h = this.containerEl.clientHeight;
        if (w > 0 && h > 0) {
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
        }
      });
      this.resizeObs.observe(this.containerEl);
    }
  }

  startLoop() {
    let prev = performance.now();
    const tick = (now) => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (document.hidden || !this.renderer || !this.mesh) return;

      const u = this.mesh.material.uniforms;
      u.uTime.value += dt;
      u.uWind.value += (this.windBoost - u.uWind.value) * 0.08;
      u.uTilt.value += (this.pointerTilt - u.uTilt.value) * 0.08;

      this.renderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  dispose() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObs?.disconnect();

    this.scene?.traverse((obj) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
      else obj.material?.dispose?.();
    });
    this.texture?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
    }
  }
}
