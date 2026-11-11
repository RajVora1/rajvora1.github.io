import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BRICKS, H, type Placement } from './shapes';

const WHITE = new THREE.Color('#f7f7f4');
const DROP = 4.5;
const OUT = 0.28;
const DUR = 0.55;

function brickGeometry() {
  const body = new RoundedBoxGeometry(1.96, H - 0.02, 0.96, 2, 0.07);
  const studs = [-0.5, 0.5].map((x) => {
    const g = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 20);
    g.translate(x, H / 2 + 0.09, 0);
    return g;
  });
  return mergeGeometries([body, ...studs].map((g) => (g.index ? g.toNonIndexed() : g)));
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);

/**
 * One brick model per page. Showing a new model shrinks the old bricks away,
 * then drops the new ones in from just above, bottom row first.
 */
export class HeroModel {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(26, 1, 0.1, 300);
  private mesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private clock = new THREE.Clock();
  private euler = new THREE.Euler();

  private old: { p: THREE.Vector3; q: THREE.Quaternion; on: boolean }[] = [];
  private next: { p: THREE.Vector3; q: THREE.Quaternion; on: boolean; delay: number }[] = [];
  private t0 = -10;
  private hadOld = false;
  private accentIndex = -1;
  private target = new THREE.Vector3();
  private dist = 40;
  private running = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private reduced: boolean,
    private accent: THREE.Color,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;
    const key = new THREE.DirectionalLight('#ffffff', 2.0);
    key.position.set(-10, 22, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
    key.shadow.bias = -0.0005;
    key.shadow.radius = 6;
    this.scene.add(key, new THREE.HemisphereLight('#ffffff', '#3b5b45', 0.6));

    // A soft contact shadow on an invisible floor; no pedestal.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.2 });
    this.mesh = new THREE.InstancedMesh(brickGeometry(), mat, BRICKS);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < BRICKS; i++) {
      this.old.push({ p: new THREE.Vector3(), q: new THREE.Quaternion(), on: false });
      this.next.push({ p: new THREE.Vector3(), q: new THREE.Quaternion(), on: false, delay: 0 });
      this.mesh.setColorAt(i, WHITE);
    }
    this.scene.add(this.mesh);

    new ResizeObserver(() => this.resize()).observe(canvas);
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      if (this.running) this.loop();
    });
    this.resize();
    this.loop();
  }

  show(placements: Placement[]) {
    // What is on screen now becomes the "old" set that shrinks away.
    this.hadOld = this.next.some((b) => b.on);
    for (let i = 0; i < BRICKS; i++) {
      this.old[i].p.copy(this.next[i].p);
      this.old[i].q.copy(this.next[i].q);
      this.old[i].on = this.next[i].on;
    }

    const order = placements.map((p, i) => i).sort((a, b) => placements[a].y - placements[b].y || a - b);
    const spread = Math.min(1.0, placements.length * 0.016);
    for (let i = 0; i < BRICKS; i++) this.next[i].on = false;
    order.forEach((i, rank) => {
      const pl = placements[i];
      const b = this.next[i];
      b.on = true;
      b.p.set(pl.x, pl.y, pl.z);
      b.q.setFromEuler(this.euler.set(pl.rx, pl.ry, pl.rz, 'YXZ'));
      b.delay = (this.hadOld ? OUT : 0) + (rank / Math.max(1, placements.length)) * spread;
    });
    this.accentIndex = placements.length - 1;

    const box = new THREE.Box3();
    for (const pl of placements) box.expandByPoint(new THREE.Vector3(pl.x, pl.y, pl.z));
    box.expandByScalar(1.2);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.target.copy(sphere.center);
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    this.dist = (sphere.radius * 1.12) / Math.sin(Math.min(vfov, hfov) / 2);
    this.t0 = this.reduced ? -100 : this.clock.getElapsedTime();
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    this.frame();
  };

  private frame() {
    const now = this.clock.getElapsedTime();
    const t = now - this.t0;

    const yaw = -0.6 + (this.reduced ? 0 : Math.sin(now * 0.22) * 0.32);
    const pitch = 0.42;
    this.camera.position.set(
      this.target.x + Math.sin(yaw) * Math.cos(pitch) * this.dist,
      this.target.y + Math.sin(pitch) * this.dist,
      this.target.z + Math.cos(yaw) * Math.cos(pitch) * this.dist,
    );
    this.camera.lookAt(this.target);

    for (let i = 0; i < BRICKS; i++) {
      const o = this.old[i];
      const n = this.next[i];
      let s = 0;
      if (this.hadOld && t < OUT && o.on) {
        // Phase one: the old model shrinks in place.
        s = 1 - easeOut(t / OUT);
        this.dummy.position.copy(o.p);
        this.dummy.quaternion.copy(o.q);
      } else if (n.on) {
        const k = THREE.MathUtils.clamp((t - n.delay) / DUR, 0, 1);
        s = k <= 0 ? 0 : Math.min(1, easeOutBack(k));
        this.dummy.position.copy(n.p);
        this.dummy.position.y += DROP * (1 - easeOut(k));
        this.dummy.quaternion.copy(n.q);
      }
      this.dummy.scale.setScalar(Math.max(0.0001, s));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, i === this.accentIndex && n.on ? this.accent : WHITE);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}
