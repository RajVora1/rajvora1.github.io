import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Brick height in stud units (a 1x1 brick is 1 wide, 1 deep, H tall). */
const H = 1.2;
const ROWS = 7;
const LINE_GAP = 2.2;
/** On wide screens every title uses the same brick size (px per stud). */
const STUD_PX = 12.5;
const MAX_LEN = 4;

/** Bright brick colors that all read against the green ground. */
const PALETTE = ['#f5c518', '#8fd3ff', '#ffa3c2', '#f7f7f4', '#ffad4d', '#cdb0ff'];

// A 5x7 brick font. '#' is a stud-wide brick, '.' is empty.
const GLYPHS: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.###.',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '###|.#.|.#.|.#.|.#.|.#.|###',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  "'": '#|#|.|.|.|.|.',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  '.': '.|.|.|.|.|.|#',
  ',': '.|.|.|.|.|#|#',
  '!': '#|#|#|#|#|.|#',
  '-': '....|....|....|####|....|....|....',
};
const SPACE = 2;

const glyphWidth = (ch: string) => (ch === ' ' ? SPACE : GLYPHS[ch]?.split('|')[0].length ?? 0);
const wordCols = (w: string) => [...w].reduce((n, ch, i) => n + glyphWidth(ch) + (i ? 1 : 0), 0);

function normalize(s: string) {
  return s.replace(/[’‘]/g, "'").toUpperCase().replace(/[^A-Z'?.,!\- ]/g, '').replace(/\s+/g, ' ').trim();
}

/** Greedy wrap: forced breaks first, then words, within maxCols. */
function wrap(segments: string[], maxCols: number) {
  const lines: string[] = [];
  for (const seg of segments) {
    let line = '';
    for (const word of seg.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && wordCols(next) > maxCols) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function brickGeometry(n: number) {
  const body = new RoundedBoxGeometry(n - 0.04, H - 0.04, 0.96, 2, 0.06);
  const parts: THREE.BufferGeometry[] = [body];
  for (let i = 0; i < n; i++) {
    const s = new THREE.CylinderGeometry(0.3, 0.3, 0.18, 18);
    s.translate(i - (n - 1) / 2, H / 2 + 0.08, 0);
    parts.push(s);
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}

interface Brick {
  len: number;
  index: number; // instance index within its length's mesh
  x: number;
  y: number;
  letter: number;
  delay: number;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A page title spelled in bricks. Each letter is a different color; the
 * bricks drop in left to right, and a letter hops when the pointer passes it.
 */
export class BrickTitle {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(13, 1, 0.1, 900);
  private meshes: THREE.InstancedMesh[] = [];
  private bricks: Brick[] = [];
  private letters: { x0: number; x1: number; y0: number; y1: number; hop: number }[] = [];
  private dummy = new THREE.Object3D();
  private clock = new THREE.Clock();
  private t0 = 0;
  private center = new THREE.Vector3();
  private dist = 50;
  private visible = true;
  private running = true;
  private lines: string[] = [];
  private hovered = -1;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private shadowPlane: THREE.Mesh;
  private key: THREE.DirectionalLight;

  constructor(
    private canvas: HTMLCanvasElement,
    private segments: string[],
    private reduced: boolean,
  ) {
    this.segments = segments.map(normalize).filter(Boolean);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.75;
    const key = new THREE.DirectionalLight('#ffffff', 1.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 1024);
    key.shadow.bias = -0.0008;
    key.shadow.radius = 5;
    this.scene.add(key, key.target, new THREE.HemisphereLight('#ffffff', '#2d5a3c', 0.55));
    this.key = key;

    // The letters cast a soft shadow onto an invisible wall just behind them.
    this.shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.16 }));
    this.shadowPlane.receiveShadow = true;
    this.scene.add(this.shadowPlane);

    const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.18 });
    for (let n = 1; n <= MAX_LEN; n++) {
      const mesh = new THREE.InstancedMesh(brickGeometry(n), mat, 256);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes.push(mesh);
      this.scene.add(mesh);
    }

    canvas.addEventListener('pointermove', (e) => this.pointer(e));
    canvas.addEventListener('pointerleave', () => (this.hovered = -1));
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!);
    new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
      if (this.visible) this.loop();
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => {
      this.running = !document.hidden;
      if (this.running) this.loop();
    });
    this.resize(true);
    this.loop();
  }

  /** Columns that fit the space at a readable brick size. */
  private maxCols() {
    const w = this.canvas.parentElement!.clientWidth;
    return Math.max(30, Math.floor(w / (w >= 720 ? STUD_PX : 6)));
  }

  private build(animate: boolean) {
    this.bricks = [];
    this.letters = [];
    const counts = new Array(MAX_LEN + 1).fill(0);
    const lineH = ROWS * H + LINE_GAP;
    let letter = 0;
    let maxW = 0;

    this.lines.forEach((line, li) => {
      let cx = 0;
      const top = -li * lineH;
      for (const ch of line) {
        if (ch === ' ') {
          cx += SPACE + 1;
          continue;
        }
        const rows = GLYPHS[ch].split('|');
        const w = rows[0].length;
        rows.forEach((row, r) => {
          const y = top - r * H;
          // Merge each run of studs into the fewest bricks (up to MAX_LEN long).
          let c = 0;
          while (c < w) {
            if (row[c] !== '#') {
              c++;
              continue;
            }
            let run = 0;
            while (c + run < w && row[c + run] === '#') run++;
            while (run > 0) {
              const len = Math.min(MAX_LEN, run);
              this.bricks.push({ len, index: counts[len]++, x: cx + c + len / 2, y, letter, delay: 0 });
              c += len;
              run -= len;
            }
          }
        });
        this.letters.push({ x0: cx, x1: cx + w, y0: top - (ROWS - 0.5) * H, y1: top + H / 2, hop: -10 });
        cx += w + 1;
        letter++;
      }
      maxW = Math.max(maxW, cx - 1);
    });

    // Build order: letter by letter, bottom row first.
    const total = Math.max(1, letter);
    for (const b of this.bricks) {
      const letterT = (b.letter / total) * Math.min(1.2, total * 0.08);
      const rowT = ((this.letters[b.letter].y1 - b.y) / (ROWS * H)) * -0.12 + 0.12;
      b.delay = letterT + rowT;
    }
    this.meshes.forEach((m, i) => {
      m.count = counts[i + 1];
    });
    for (const b of this.bricks) {
      const color = new THREE.Color(PALETTE[b.letter % PALETTE.length]);
      this.meshes[b.len - 1].setColorAt(b.index, color);
    }
    for (const m of this.meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;

    // Frame the title: the canvas takes the title's shape.
    const height = this.lines.length * lineH - LINE_GAP;
    const padX = 1.2;
    const padTop = 1.0;
    const padBottom = 1.4;
    const W = maxW + padX * 2;
    const Ht = height + padTop + padBottom;
    this.center.set(maxW / 2, H / 2 + padTop - Ht / 2, 0);
    this.canvas.style.aspectRatio = `${W} / ${Ht}`;
    this.canvas.style.maxWidth = `${Math.round(W * STUD_PX)}px`;
    this.camera.aspect = W / Ht;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    this.dist = Ht / 2 / Math.tan(vfov / 2) + 0.5;

    this.shadowPlane.scale.set(W * 2, Ht * 3, 1);
    this.shadowPlane.position.set(this.center.x, this.center.y, -0.9);
    this.key.position.set(this.center.x - 14, this.center.y + 16, 30);
    this.key.target.position.copy(this.center);
    Object.assign(this.key.shadow.camera, { left: -W, right: W, top: Ht * 1.5, bottom: -Ht * 1.5, near: 1, far: 120 });
    this.key.shadow.camera.updateProjectionMatrix();

    this.t0 = animate && !this.reduced ? this.clock.getElapsedTime() : -100;
  }

  private resize(first = false) {
    const lines = wrap(this.segments, this.maxCols());
    if (first || lines.join('|') !== this.lines.join('|')) {
      this.lines = lines;
      this.build(first);
    }
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private pointer(e: PointerEvent) {
    if (this.reduced) return;
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return;
    const i = this.letters.findIndex((l) => hit.x >= l.x0 - 0.5 && hit.x <= l.x1 + 0.5 && hit.y >= l.y0 && hit.y <= l.y1);
    if (i !== this.hovered) {
      this.hovered = i;
      const now = this.clock.getElapsedTime();
      if (i >= 0 && now - this.letters[i].hop > 0.45) this.letters[i].hop = now;
    }
  }

  private loop = () => {
    if (!this.running || !this.visible) return;
    requestAnimationFrame(this.loop);
    this.frame();
  };

  private frame() {
    const now = this.clock.getElapsedTime();
    const t = now - this.t0;

    const yaw = this.reduced ? -0.04 : -0.04 + Math.sin(now * 0.25) * 0.035;
    const pitch = 0.13;
    this.camera.position.set(
      this.center.x + Math.sin(yaw) * Math.cos(pitch) * this.dist,
      this.center.y + Math.sin(pitch) * this.dist,
      Math.cos(yaw) * Math.cos(pitch) * this.dist,
    );
    this.camera.lookAt(this.center);

    for (const b of this.bricks) {
      const k = THREE.MathUtils.clamp((t - b.delay) / 0.42, 0, 1);
      const e = easeOut(k);
      const hopT = (now - this.letters[b.letter].hop) / 0.42;
      const hop = hopT >= 0 && hopT <= 1 ? Math.sin(hopT * Math.PI) * 0.9 : 0;
      this.dummy.position.set(b.x, b.y + 7 * (1 - e) + hop, 0);
      this.dummy.rotation.set(0, 0, hop * 0.06);
      this.dummy.scale.setScalar(k <= 0 ? 0.0001 : 1);
      this.dummy.updateMatrix();
      this.meshes[b.len - 1].setMatrixAt(b.index, this.dummy.matrix);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}
