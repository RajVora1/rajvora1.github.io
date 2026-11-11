import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** A brick of w x h x d with studs on top, centered on its own origin. */
function brick(w: number, h: number, d: number, studs = true): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new RoundedBoxGeometry(w - 0.04, h - 0.02, d - 0.04, 2, 0.06)];
  if (studs) {
    const nx = Math.max(1, Math.round(w));
    const nz = Math.max(1, Math.round(d));
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        const s = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 16);
        s.translate(-w / 2 + (w / nx) * (i + 0.5), h / 2 + 0.08, -d / 2 + (d / nz) * (k + 0.5));
        parts.push(s);
      }
    }
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

const tmpColor = new THREE.Color();
function mix(hex: string, toward: string, t: number) {
  return new THREE.Color(hex).lerp(tmpColor.set(toward), t);
}

export class Chameleon {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 300);
  private root = new THREE.Group();
  private head = new THREE.Group();
  private eyes: THREE.Group[] = [];
  private tongue = new THREE.Group();
  private tongueShaft: THREE.Mesh;
  private tongueTip: THREE.Mesh;
  private tail: THREE.Mesh[] = [];
  private body = new THREE.Group();

  private skin = new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  private skinDark = new THREE.MeshPhysicalMaterial({ roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  private bark = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  private skinTarget = new THREE.Color();
  private darkTarget = new THREE.Color();
  private barkTarget = new THREE.Color();

  private mouthLocal = new THREE.Vector3(-4.75, -0.35, 0);
  private target: THREE.Vector3 | null = null;
  private lookPoint = new THREE.Vector3(-20, 4, 6);
  /** Where the tongue is actually pointed; lags `target` while switching words. */
  private aimPoint = new THREE.Vector3();
  private engaged = false;
  private switching = false;
  private ext = 0;
  private vel = 0;
  private extGoal = 0;
  private clock = new THREE.Clock();
  private last = 0;
  private gulp = 0;
  private fireAt = Infinity;
  private running = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private reducedMotion: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.75;
    const key = new THREE.DirectionalLight('#ffffff', 2.0);
    key.position.set(-8, 18, 16);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
    key.shadow.bias = -0.0005;
    this.scene.add(key, new THREE.HemisphereLight('#ffffff', '#666666', 0.5));

    this.buildBody();

    const tongueMat = new THREE.MeshPhysicalMaterial({ color: '#ff7aa6', roughness: 0.3, clearcoat: 0.8 });
    const shaftGeo = new THREE.CylinderGeometry(0.17, 0.17, 1, 12);
    shaftGeo.rotateZ(Math.PI / 2);
    shaftGeo.translate(0.5, 0, 0);
    this.tongueShaft = new THREE.Mesh(shaftGeo, tongueMat);
    this.tongueTip = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 16), tongueMat);
    this.tongue.add(this.tongueShaft, this.tongueTip);
    this.tongue.visible = false;
    this.scene.add(this.root, this.tongue);

    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      if (this.running) this.loop();
    });
    this.resize();
    this.loop();
  }

  private part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, parent: THREE.Object3D = this.body) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /** Brick chameleon in profile, facing -x, standing on a branch whose top is y = 0. */
  private buildBody() {
    // Branch, running off the right edge.
    // Branch: tapered segments, thicker toward the right edge, slightly crooked.
    for (let i = 0; i < 9; i++) {
      const h = 0.9 + i * 0.16;
      const d = 1.5 + i * 0.1;
      const seg = this.part(brick(3.4, h, d, i > 0), this.bark, -2.4 + i * 3.1, -h / 2 - i * 0.16, (i % 2 ? 0.08 : -0.08), this.root);
      seg.rotation.z = -0.05 + (i % 3 === 1 ? 0.03 : 0);
      seg.rotation.y = i % 2 ? 0.04 : -0.04;
    }
    // A twig rising off the branch, with two leaf plates.
    const twig = this.part(brick(4, 0.6, 0.6, false), this.bark, 12.2, 1.3, -0.4, this.root);
    twig.rotation.z = 0.75;
    this.part(brick(1.6, 0.25, 1.0), this.skinDark, 13.6, 2.8, -0.4, this.root).rotation.z = 0.3;

    // Feet gripping both sides of the branch, and legs.
    for (const x of [0.6, 5.4]) {
      for (const z of [-1.25, 1.25]) {
        this.part(brick(1.6, 0.7, 0.8, false), this.skinDark, x, 0.05, z * 0.75);
        this.part(brick(1.4, 0.9, 0.35, false), this.skinDark, x, -0.45, z * 0.72);
        this.part(brick(1, 1.6, 1, false), this.skin, x + (x < 3 ? 0.3 : -0.3), 1.0, z * 0.9);
      }
    }

    // Body: stacked bricks, widest in the middle.
    this.part(brick(5, 0.8, 2), this.skin, 3, 1.6);
    this.part(brick(7, 1.2, 2.4), this.skin, 3, 2.6);
    this.part(brick(8, 1.2, 2.6), this.skin, 3, 3.8);
    this.part(brick(7, 1.2, 2.2), this.skin, 3.3, 5.0);
    // Crest: a row of small bricks of alternating height along the spine.
    for (let i = 0; i < 6; i++) {
      const h = i % 2 ? 0.6 : 0.9;
      this.part(brick(0.9, h, 0.9), this.skinDark, 0.8 + i * 1.0, 5.6 + h / 2);
    }
    this.root.add(this.body);

    // Curled tail: shrinking bricks along a spiral.
    const c = new THREE.Vector2(8.7, 2.4);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const a = Math.PI * 0.82 - t * Math.PI * 1.95;
      const r = 2.3 * (1 - 0.72 * t);
      const s = 1.35 - 0.65 * t;
      const m = this.part(brick(s, s, 1.6 - 0.6 * t, i < 6), this.skin, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r);
      m.rotation.z = a + Math.PI / 2;
      this.tail.push(m);
    }

    // Head, pivoting at the neck.
    this.head.position.set(-0.6, 3.7, 0);
    this.root.add(this.head);
    this.part(brick(3.4, 2.4, 2.6), this.skin, -1.5, 0.2, 0, this.head);
    this.part(brick(1.7, 1.6, 2.0), this.skin, -3.9, -0.15, 0, this.head);
    this.part(brick(2.4, 0.8, 1.6), this.skinDark, -1.0, 1.75, 0, this.head);
    this.part(brick(1.2, 0.8, 1.1), this.skinDark, -0.4, 2.5, 0, this.head);
    const ink = new THREE.MeshStandardMaterial({ color: '#17130a', roughness: 0.4 });
    this.part(new THREE.BoxGeometry(3.1, 0.1, 2.12), ink, -3.15, -0.55, 0, this.head);

    // Turret eyes on both sides; each swivels on its own.
    for (const side of [1, -1]) {
      const eye = new THREE.Group();
      eye.position.set(-2.1, 0.75, side * 1.3);
      const turret = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 18), this.skin);
      turret.scale.set(1, 1, 0.7);
      const white = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }));
      white.rotation.x = Math.PI / 2;
      white.position.z = side * 0.58;
      const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 16), ink);
      pupil.rotation.x = Math.PI / 2;
      pupil.position.z = side * 0.64;
      eye.add(turret, white, pupil);
      eye.userData.side = side;
      this.head.add(eye);
      this.eyes.push(eye);
    }
  }

  /** Recolor to a page color; the chameleon is that color, lightened. */
  setColor(bg: string, instant = false) {
    this.skinTarget.copy(mix(bg, '#ffffff', 0.2));
    this.darkTarget.copy(mix(bg, '#000000', 0.18));
    this.barkTarget.copy(mix(bg, '#000000', 0.42));
    if (instant || this.reducedMotion) {
      this.skin.color.copy(this.skinTarget);
      this.skinDark.color.copy(this.darkTarget);
      this.bark.color.copy(this.barkTarget);
    }
  }

  /** Point the tongue at a screen position (client px), or retract it with null. */
  aim(screen: { x: number; y: number } | null) {
    if (!screen) {
      this.engaged = false;
      this.switching = false;
      this.extGoal = 0;
      this.fireAt = Infinity;
      return;
    }
    const next = this.screenToWorld(screen.x, screen.y);
    this.target = next;
    this.engaged = true;
    if (this.reducedMotion) return;
    if (this.ext < 0.05) {
      // Tongue is in: aim, and fire once the head has started to turn.
      this.aimPoint.copy(next);
      this.switching = false;
      if (this.extGoal === 0 && this.fireAt === Infinity) this.fireAt = this.clock.getElapsedTime() + 0.09;
    } else if (this.aimPoint.distanceTo(next) < 0.6) {
      // Same word (a resize nudged it): just follow.
      this.aimPoint.copy(next);
    } else {
      // Out at another word: reel in first, then fire at the new one.
      this.switching = true;
      this.extGoal = 0;
      this.fireAt = Infinity;
    }
  }

  /** Resolves once the tongue is stuck to the current word (or soon, as a fallback). */
  attached(): Promise<void> {
    if (this.reducedMotion) return Promise.resolve();
    const start = performance.now();
    return new Promise((resolve) => {
      const check = () => {
        const on = this.engaged && !this.switching && this.extGoal === 1 && Math.abs(this.ext - 1) < 0.04 && Math.abs(this.vel) < 1.5;
        if (on || performance.now() - start > 700) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });
  }

  /** Grab: the tongue retracts and the chameleon gulps. Resolves when done. */
  grab(): Promise<void> {
    if (this.reducedMotion) return Promise.resolve();
    this.fireAt = Infinity;
    this.switching = false;
    this.extGoal = 0;
    this.gulp = 1;
    return new Promise((r) => setTimeout(r, 260));
  }

  /** Current mouth position in client px, for moving the grabbed word. */
  mouthScreen() {
    const p = this.head.localToWorld(this.mouthLocal.clone()).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** Current tongue tip in client px. */
  tipScreen() {
    const p = this.tongueTip.getWorldPosition(new THREE.Vector3()).project(this.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  private screenToWorld(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit);
    return hit;
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const wide = w >= 900;
    // Chameleon sits on the right; the branch runs off the right edge.
    this.root.position.set(wide ? 0 : 0, wide ? -2 : -1, 0);
    // Frame the whole animal (head at x = -5, tail curl to x = 11).
    const dist = wide ? 50 : 23 / (0.4986 * this.camera.aspect);
    this.camera.position.set(1.5, 9, dist);
    this.camera.lookAt(3.5, 3, 0);
    if (wide) this.camera.setViewOffset(w, h, -w * 0.24, 0, w, h);
    else this.camera.setViewOffset(w, h, -w * 0.4, -h * 0.24, w, h);
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const now = this.clock.getElapsedTime();
    const dt = Math.min(0.05, now - this.last);
    this.last = now;
    this.frame(now, dt);
  };

  private frame(now: number, dt: number) {
    const k = this.reducedMotion ? 1 : 1 - Math.pow(0.002, dt);
    this.skin.color.lerp(this.skinTarget, k);
    this.skinDark.color.lerp(this.darkTarget, k);
    this.bark.color.lerp(this.barkTarget, k);

    // Breathing, tail sway, gulp.
    if (!this.reducedMotion) {
      this.body.scale.y = 1 + Math.sin(now * 1.6) * 0.012;
      this.tail.forEach((m, i) => (m.rotation.y = Math.sin(now * 1.2 + i * 0.4) * 0.04));
    }
    this.gulp = Math.max(0, this.gulp - dt * 2.6);

    // Head and eyes follow the target, or idly look around.
    const idle = new THREE.Vector3(-20 + Math.sin(now * 0.4) * 4, 4 + Math.sin(now * 0.7) * 3, 6);
    const goal = this.target && this.engaged ? this.target : idle;
    this.lookPoint.lerp(goal, this.reducedMotion ? 1 : 1 - Math.pow(0.0005, dt));
    const neck = this.head.getWorldPosition(new THREE.Vector3());
    const dx = this.lookPoint.x - neck.x;
    const dy = this.lookPoint.y - neck.y;
    const pitch = THREE.MathUtils.clamp(Math.atan2(dy, -dx), -0.55, 0.45);
    this.head.rotation.z = -pitch - Math.sin(this.gulp * Math.PI) * 0.12;
    this.head.updateMatrixWorld(true);
    for (const eye of this.eyes) {
      const local = eye.parent!.worldToLocal(this.lookPoint.clone()).sub(eye.position);
      eye.rotation.y = THREE.MathUtils.clamp(Math.atan2(local.z * eye.userData.side, -local.x) * 0.6, -0.6, 0.6) * eye.userData.side;
      eye.rotation.z = THREE.MathUtils.clamp(Math.atan2(local.y, -local.x), -0.7, 0.7) * -1;
    }

    if (now >= this.fireAt) {
      this.extGoal = 1;
      this.fireAt = Infinity;
    }
    if (this.switching && this.ext < 0.05) {
      // Reeled in from the old word: swing to the new one and fire.
      this.switching = false;
      this.aimPoint.copy(this.target!);
      this.extGoal = 1;
    }

    // Tongue length rides a spring: a quick shot with a small overshoot that
    // settles on the word, and a firm, overshoot-free reel back in.
    const out = this.extGoal > 0;
    const w = out ? 26 : 34; // natural frequency (rad/s)
    const zeta = out ? 0.62 : 1.0;
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const acc = -w * w * (this.ext - this.extGoal) - 2 * zeta * w * this.vel;
      this.vel += acc * h;
      this.ext += this.vel * h;
    }
    if (!out && this.ext < 0.01) {
      this.ext = 0;
      this.vel = 0;
    }
    if (this.ext < 0) {
      this.ext = 0;
      this.vel = Math.max(0, this.vel);
    }

    if (this.ext > 0.001) {
      const mouth = this.head.localToWorld(this.mouthLocal.clone());
      const dir = this.aimPoint.clone().sub(mouth);
      const len = dir.length();
      this.tongue.visible = true;
      this.tongue.position.copy(mouth);
      this.tongue.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
      const L = Math.max(0.01, len * this.ext);
      this.tongueShaft.scale.set(L, 1, 1);
      this.tongueTip.position.set(L, 0, 0);
    } else {
      this.tongue.visible = false;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
