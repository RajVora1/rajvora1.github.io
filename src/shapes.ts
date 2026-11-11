// Every scene is a list of 1x2 brick placements on a stud grid.
// Unit = one stud pitch. A brick is 2 x H x 1 when it runs along x.
export const H = 1.2;
export const BRICKS = 100;

export interface Placement {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

type Axis = 'x' | 'z';

/** Brick whose corner cell is (cx, cz) on level L, running along `axis`. */
function b(cx: number, L: number, cz: number, axis: Axis = 'x'): Placement {
  const along = axis === 'x';
  return {
    x: cx + (along ? 1 : 0.5),
    y: L * H + H / 2,
    z: cz + (along ? 0.5 : 1),
    rx: 0,
    ry: along ? 0 : Math.PI / 2,
    rz: 0,
  };
}

/** Rectangle outline w x d (both even), running bond alternating by level. */
function ring(x0: number, z0: number, w: number, d: number, L: number): Placement[] {
  const out: Placement[] = [];
  if (L % 2 === 0) {
    for (let x = x0; x < x0 + w; x += 2) {
      out.push(b(x, L, z0, 'x'), b(x, L, z0 + d - 1, 'x'));
    }
    for (let z = z0 + 1; z < z0 + d - 1; z += 2) {
      out.push(b(x0, L, z, 'z'), b(x0 + w - 1, L, z, 'z'));
    }
  } else {
    for (let z = z0; z < z0 + d; z += 2) {
      out.push(b(x0, L, z, 'z'), b(x0 + w - 1, L, z, 'z'));
    }
    for (let x = x0 + 1; x < x0 + w - 1; x += 2) {
      out.push(b(x, L, z0, 'x'), b(x, L, z0 + d - 1, 'x'));
    }
  }
  return out;
}

/** Solid rectangle; rows run along x on even levels, along z on odd ones. */
function fill(x0: number, z0: number, w: number, d: number, L: number): Placement[] {
  const out: Placement[] = [];
  const alongX = L % 2 === 0 ? w % 2 === 0 : d % 2 !== 0;
  if (alongX) {
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x += 2) out.push(b(x, L, z, 'x'));
  } else {
    for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z += 2) out.push(b(x, L, z, 'z'));
  }
  return out;
}

/** Straight wall one stud thick along x. */
function wallX(x0: number, cz: number, w: number, L: number): Placement[] {
  const out: Placement[] = [];
  for (let x = x0; x < x0 + w; x += 2) out.push(b(x, L, cz, 'x'));
  return out;
}

function levels(from: number, to: number, f: (L: number) => Placement[]): Placement[] {
  const out: Placement[] = [];
  for (let L = from; L <= to; L++) out.push(...f(L));
  return out;
}

// Seeded random so the pile is identical on every visit.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pile(): Placement[] {
  const r = rng(9);
  const out: Placement[] = [];
  for (let i = 0; i < BRICKS; i++) {
    const a = r() * Math.PI * 2;
    const rad = Math.pow(r(), 0.75) * 5.6;
    const hgt = Math.max(0, 1 - rad / 5.6);
    out.push({
      x: Math.cos(a) * rad * 1.15,
      y: H / 2 + hgt * hgt * 3.6 + r() * 0.5,
      z: Math.sin(a) * rad * 0.8,
      rx: (r() - 0.5) * 0.9 * hgt + (r() < 0.12 ? Math.PI / 2 : 0),
      ry: r() * Math.PI * 2,
      rz: (r() - 0.5) * 0.9 * hgt,
    });
  }
  // Bottom bricks first, so the build order reads naturally.
  return out.sort((p, q) => p.y - q.y);
}

function computer(dx = 0, scale: 'full' | 'small' = 'full'): Placement[] {
  if (scale === 'small') {
    return [
      ...levels(1, 3, (L) => wallX(dx - 3, -2, 6, L)),
      b(dx - 1, 0, -2, 'x'),
      ...wallX(dx - 3, 1, 6, 0),
    ];
  }
  return [
    b(dx - 2, 0, -3, 'x'),
    b(dx, 0, -3, 'x'),
    b(dx - 1, 0, -2, 'x'),
    b(dx - 1, 1, -2, 'x'),
    ...levels(2, 6, (L) => wallX(dx - 5, -2, 10, L)),
    ...wallX(dx - 4, 1, 8, 0),
    ...wallX(dx - 4, 2, 8, 0),
    b(dx + 5, 0, 1, 'z'),
  ];
}

/** Tower: two levels per role, k roles built. */
export function tower(k: number): Placement[] {
  return levels(0, k * 2 - 1, (L) => ring(-3, -3, 6, 6, L));
}

function sorter(): Placement[] {
  // Raised belt on three supports, running left to right.
  const supports = [-8, -2, 4].map((x) => b(x, 0, -1, 'z'));
  const belt = [...wallX(-8, -1, 16, 1), ...wallX(-8, 0, 16, 1)];
  // Hopper: a funnel sitting over the start of the belt.
  const hopper = [...ring(-8, -2, 4, 4, 2), ...ring(-8, -2, 4, 4, 3), ...ring(-9, -3, 6, 6, 4)];
  // Camera gantry arching over the middle of the belt.
  const gantry = [
    ...levels(0, 3, (L) => [b(0, L, -3, 'x'), b(0, L, 2, 'x')]),
    b(0, 4, -3, 'z'),
    b(0, 4, -1, 'z'),
    b(0, 4, 1, 'z'),
  ];
  // Three sorting bins in a row in front.
  const bins = [-1, 4, 9].flatMap((x) => levels(0, 1, (L) => ring(x, 3, 4, 4, L)));
  const parts = [b(-5, 2, -1, 'z'), b(3, 2, -1, 'z')];
  return [...supports, ...belt, ...hopper, ...gantry, ...bins, ...parts];
}

function classroom(): Placement[] {
  const board = [b(-6, 0, -6, 'x'), b(4, 0, -6, 'x'), ...levels(1, 4, (L) => wallX(-6, -6, 12, L))];
  const teacher = [
    b(-1, 0, -3, 'z'),
    b(2, 0, -3, 'z'),
    ...wallX(-1, -3, 4, 1),
    ...wallX(-1, -2, 4, 1),
  ];
  const desk = (cx: number, cz: number) => [
    b(cx, 0, cz, 'z'),
    b(cx + 3, 0, cz, 'z'),
    ...wallX(cx, cz, 4, 1),
    ...wallX(cx, cz + 1, 4, 1),
  ];
  const desks = [-8, -2, 4].flatMap((x) => [...desk(x, 0), ...desk(x, 4)]);
  return [...board, ...teacher, ...desks];
}

function mountain(): Placement[] {
  return [
    ...ring(-6, -4, 12, 8, 0),
    ...ring(-5, -3, 10, 6, 1),
    ...ring(-5, -3, 8, 6, 2),
    ...ring(-4, -2, 6, 4, 3),
    ...ring(-3, -2, 4, 4, 4),
    ...fill(-3, -1, 4, 2, 5),
    ...fill(-2, -1, 2, 2, 6),
    b(-2, 7, -1, 'x'),
  ];
}

function paddle(): Placement[] {
  const widths = [4, 6, 8, 8, 8, 8, 6, 4];
  const face = widths.flatMap((w, i) => wallX(-w / 2, -1, w, i + 2));
  return [b(-1, 0, -1, 'x'), b(-1, 1, -1, 'x'), ...face, b(5, 0, 2, 'x')];
}

function house(): Placement[] {
  const walls = levels(0, 2, (L) => ring(-4, -3, 8, 6, L)).filter(
    (p) => !(p.y < H && Math.abs(p.x - 1) < 0.01 && p.z > 2),
  );
  const roof = [
    ...wallX(-4, -3, 8, 3),
    ...wallX(-4, 2, 8, 3),
    ...wallX(-4, -2, 8, 4),
    ...wallX(-4, 1, 8, 4),
    ...wallX(-4, -1, 8, 5),
    ...wallX(-4, 0, 8, 5),
  ];
  return [...walls, ...roof];
}

function figure(): Placement[] {
  const dx = -4;
  const legs = levels(0, 2, (L) => [b(dx - 2, L, -1, 'z'), b(dx + 1, L, -1, 'z')]);
  const torso = levels(3, 6, (L) => fill(dx - 2, -1, 4, 2, L));
  const leftArm = levels(3, 5, (L) => [b(dx - 3, L, -1, 'z')]);
  const head = levels(7, 8, (L) => fill(dx - 1, -1, 2, 2, L));
  const rightArm = levels(5, 8, (L) => [b(dx + 2, L, -1, 'z')]);
  return [...legs, ...torso, ...leftArm, ...head, ...computer(6, 'small'), ...rightArm];
}

export const SHAPES = {
  pile: pile(),
  computer: computer(),
  sorter: sorter(),
  classroom: classroom(),
  mountain: mountain(),
  paddle: paddle(),
  house: house(),
  figure: figure(),
} satisfies Record<string, Placement[]>;

export type ShapeName = keyof typeof SHAPES | 'tower';

export function shapeFor(name: ShapeName, layer = 5): Placement[] {
  return name === 'tower' ? tower(Math.max(1, Math.min(5, layer))) : SHAPES[name];
}
