import { projectFeatureToKm } from "../api/worldGeo.js";

/**
 * 3D Extruded Country Silhouette on a Rotating Cartographic Pedestal.
 */
export class CountrySilhouette3D {
  constructor(containerEl, feature, country, options = {}) {
    this.containerEl = containerEl;
    this.feature = feature;
    this.country = country;
    this.showPin = options.showPin !== false;
    this.accentHex = options.accentHex ?? 0x14b8a6;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.pivot = null;
    this.rafId = null;
    this.resizeObs = null;
    this.disposed = false;

    this.isDragging = false;
    this.lastX = 0;
    this.targetRotY = 0.25;

    this.init();
  }

  async init() {
    try {
      const THREE = await import("three");
      if (this.disposed) return;

      const width = Math.max(200, this.containerEl.clientWidth || 260);
      const height = Math.max(170, this.containerEl.clientHeight || 200);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 40);
      this.camera.position.set(0, 2.55, 3.45);
      this.camera.lookAt(0, 0.12, 0);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height);

      this.containerEl.innerHTML = "";
      this.containerEl.appendChild(this.renderer.domElement);

      // Lighting
      const key = new THREE.DirectionalLight(0xffffff, 2.1);
      key.position.set(3, 5, 4);
      this.scene.add(key);

      const rim = new THREE.DirectionalLight(0x5eead4, 1.15);
      rim.position.set(-4, 2, -3);
      this.scene.add(rim);
      this.scene.add(new THREE.AmbientLight(0x9dd4ca, 0.7));

      this.pivot = new THREE.Group();
      this.scene.add(this.pivot);

      // Holographic Circular Pedestal Base
      const baseGeo = new THREE.CylinderGeometry(1.42, 1.52, 0.12, 48);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x0b222e,
        metalness: 0.65,
        roughness: 0.35,
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = -0.06;
      this.pivot.add(baseMesh);

      const ringGeo = new THREE.RingGeometry(1.32, 1.38, 64);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: this.accentHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.72,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.y = 0.004;
      this.pivot.add(ringMesh);

      const innerRingGeo = new THREE.RingGeometry(0.84, 0.87, 48);
      innerRingGeo.rotateX(-Math.PI / 2);
      const innerRingMat = new THREE.MeshBasicMaterial({
        color: 0x5eead4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25,
      });
      const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
      innerRing.position.y = 0.004;
      this.pivot.add(innerRing);

      // Extrude GeoJSON Landmass
      const projected = this.feature ? projectFeatureToKm(this.feature, this.country?.latlng) : null;
      const topMat = new THREE.MeshStandardMaterial({
        color: this.accentHex,
        metalness: 0.28,
        roughness: 0.36,
      });
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x09303b,
        metalness: 0.45,
        roughness: 0.5,
      });

      let pinPos = [0, 0];
      if (projected) {
        const span = Math.max(projected.widthKm, projected.heightKm, 1);
        const scale = 2.15 / span;

        const shapes = [];
        for (const poly of projected.polygons.slice(0, 14)) {
          const outerRing = poly[0];
          if (!outerRing || outerRing.length < 3) continue;
          const shape = new THREE.Shape();
          outerRing.forEach(([x, y], idx) => {
            const sx = x * scale;
            const sy = y * scale;
            if (idx === 0) shape.moveTo(sx, sy);
            else shape.lineTo(sx, sy);
          });

          for (let h = 1; h < poly.length; h++) {
            const holeRing = poly[h];
            if (!holeRing || holeRing.length < 3) continue;
            const holePath = new THREE.Path();
            holeRing.forEach(([x, y], idx) => {
              const sx = x * scale;
              const sy = y * scale;
              if (idx === 0) holePath.moveTo(sx, sy);
              else holePath.lineTo(sx, sy);
            });
            shape.holes.push(holePath);
          }
          shapes.push(shape);
        }

        if (shapes.length) {
          const extrudeGeo = new THREE.ExtrudeGeometry(shapes, {
            depth: 0.22,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.022,
            bevelSegments: 2,
          });
          // Rotate shape XY plane onto XZ horizontal pedestal (+Y up)
          extrudeGeo.rotateX(-Math.PI / 2);
          const landMesh = new THREE.Mesh(extrudeGeo, [topMat, wallMat]);
          landMesh.position.y = 0.03;
          this.pivot.add(landMesh);

          pinPos = [
            Math.max(-1.05, Math.min(1.05, projected.capitalKm[0] * scale)),
            Math.max(-1.05, Math.min(1.05, -projected.capitalKm[1] * scale)),
          ];
        } else {
          this.addMicrostateRelief(THREE, topMat, wallMat);
        }
      } else {
        this.addMicrostateRelief(THREE, topMat, wallMat);
      }

      // Luminous Capital Beacon Pin
      if (this.showPin) {
        const stemGeo = new THREE.CylinderGeometry(0.018, 0.01, 0.34, 10);
        const stemMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set(pinPos[0], 0.42, pinPos[1]);
        this.pivot.add(stem);

        const headGeo = new THREE.SphereGeometry(0.06, 16, 16);
        const headMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(pinPos[0], 0.61, pinPos[1]);
        this.pivot.add(head);
      }

      this.bindEvents();
      this.startLoop();
    } catch {
      this.containerEl.innerHTML = `<div class="globe-fallback" style="font-size:0.82rem">Silueta 3D no disponible</div>`;
    }
  }

  addMicrostateRelief(THREE, topMat, wallMat) {
    const discGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.22, 32);
    const disc = new THREE.Mesh(discGeo, [wallMat, topMat, wallMat]);
    disc.position.y = 0.14;
    this.pivot.add(disc);
  }

  bindEvents() {
    const canvas = this.renderer?.domElement;
    if (!canvas) return;
    canvas.style.cursor = "grab";

    canvas.addEventListener("pointerdown", (e) => {
      this.isDragging = true;
      this.lastX = e.clientX;
      canvas.style.cursor = "grabbing";
    });

    this._onWinMove = (e) => {
      if (!this.isDragging || this.disposed) return;
      const dx = e.clientX - this.lastX;
      this.lastX = e.clientX;
      this.targetRotY += dx * 0.014;
    };

    this._onWinUp = () => {
      this.isDragging = false;
      if (canvas) canvas.style.cursor = "grab";
    };

    window.addEventListener("pointermove", this._onWinMove);
    window.addEventListener("pointerup", this._onWinUp);

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
      if (document.hidden || !this.renderer || !this.pivot) return;

      if (!this.isDragging && !this.reducedMotion) {
        this.targetRotY += dt * 0.45;
      }
      this.pivot.rotation.y += (this.targetRotY - this.pivot.rotation.y) * 0.12;
      this.renderer.render(this.scene, this.camera);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  dispose() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObs?.disconnect();
    if (this._onWinMove) window.removeEventListener("pointermove", this._onWinMove);
    if (this._onWinUp) window.removeEventListener("pointerup", this._onWinUp);

    this.scene?.traverse((obj) => {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
      else obj.material?.dispose?.();
    });
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
    }
  }
}
