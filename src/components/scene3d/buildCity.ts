// OSM surroundings → merged low-poly geometry in 3 km chunks (so off-screen chunks are culled, for
// shadows too) + tree instance matrices. Pure; explicit .ts imports for Node's test runner.
import * as THREE from "three";
import { PALETTE } from "../../constants/scene.ts";

type LngLat = [number, number];
type XZ = [number, number];
interface CityInput {
  buildings: { features: { geometry: { coordinates: LngLat[][] }; properties: { height: number } }[] };
  roads: { features: { geometry: { coordinates: LngLat[] }; properties: { width: number } }[] };
  green: { features: { geometry: { coordinates: LngLat[][] } }[] };
  trees: { features: { geometry: { coordinates: LngLat }; properties: { variant: number } }[] };
}

const CHUNK_M = 3000;
const ROAD_Y = 0.3; // above the ground, under nothing else
const GREEN_Y = 0.15;
const TREE_HEIGHT_SCALE = 4.8; // Kenney trees are ~1.7 units tall → ≈ 8 m

type Acc = { pos: number[]; col: number[] };
const newAcc = (): Acc => ({ pos: [], col: [] });
const rgb = (hex: string) => new THREE.Color(hex);
// Cheap deterministic 0..1 from a number, for per-building shade and per-tree size/rotation.
const hash = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

function pushTri(acc: Acc, a: number[], b: number[], c: number[], color: THREE.Color) {
  acc.pos.push(...a, ...b, ...c);
  for (let i = 0; i < 3; i++) acc.col.push(color.r, color.g, color.b);
}

function polygon(acc: Acc, pts: XZ[], y: number, color: THREE.Color) {
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(pts.map(([x, z]) => new THREE.Vector2(x, z)), []))
    pushTri(acc, [pts[i][0], y, pts[i][1]], [pts[j][0], y, pts[j][1]], [pts[k][0], y, pts[k][1]], color);
}

function toGeometry(acc: Acc) {
  if (!acc.pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(acc.col, 3));
  g.computeVertexNormals(); // non-indexed: one normal per face → flat low-poly shading
  g.computeBoundingSphere();
  return g;
}

export function buildCity(city: CityInput, project: (p: LngLat) => XZ) {
  const chunks = new Map<string, { buildings: Acc; roads: Acc; green: Acc }>();
  const chunk = ([x, z]: XZ) => {
    const key = `${Math.floor(x / CHUNK_M)},${Math.floor(z / CHUNK_M)}`;
    if (!chunks.has(key)) chunks.set(key, { buildings: newAcc(), roads: newAcc(), green: newAcc() });
    return chunks.get(key)!;
  };
  const [wall, roof, road, greenColor] = [rgb(PALETTE.wall), rgb(PALETTE.roof), rgb(PALETTE.road), rgb(PALETTE.green)];
  let buildingTris = 0;

  city.buildings.features.forEach((f, n) => {
    const pts = f.geometry.coordinates[0].slice(0, -1).map(project);
    if (pts.length < 3) return;
    const h = f.properties.height;
    const acc = chunk(pts[0]).buildings;
    const shade = 0.94 + hash(n) * 0.06; // slight per-building variation, like the reference
    const w = wall.clone().multiplyScalar(shade);
    const before = acc.pos.length;
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length];
      pushTri(acc, [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], w);
      pushTri(acc, [a[0], 0, a[1]], [b[0], h, b[1]], [a[0], h, a[1]], w);
    });
    polygon(acc, pts, h, roof.clone().multiplyScalar(shade));
    buildingTris += (acc.pos.length - before) / 9;
  });

  for (const f of city.roads.features) {
    const pts = f.geometry.coordinates.map(project);
    const half = f.properties.width / 2;
    const acc = chunk(pts[0]).roads;
    // Left-hand normals from the neighbour direction (same approach as extrudeRect).
    const edge = pts.map((p, i) => {
      const [a, b] = [pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const [nx, nz] = [(b[1] - a[1]) / len, -(b[0] - a[0]) / len];
      return [[p[0] + nx * half, ROAD_Y, p[1] + nz * half], [p[0] - nx * half, ROAD_Y, p[1] - nz * half]];
    });
    for (let i = 0; i < pts.length - 1; i++) {
      pushTri(acc, edge[i][0], edge[i + 1][0], edge[i][1], road);
      pushTri(acc, edge[i][1], edge[i + 1][0], edge[i + 1][1], road);
    }
  }

  for (const f of city.green.features) {
    const pts = f.geometry.coordinates[0].slice(0, -1).map(project);
    if (pts.length >= 3) polygon(chunk(pts[0]).green, pts, GREEN_Y, greenColor);
  }

  const trees: THREE.Matrix4[][] = [[], [], [], []];
  city.trees.features.forEach((f, n) => {
    const [x, z] = project(f.geometry.coordinates);
    const s = TREE_HEIGHT_SCALE * (0.8 + hash(n + 0.5) * 0.4);
    trees[f.properties.variant % 4].push(
      new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(n) * Math.PI * 2), new THREE.Vector3(s, s, s)),
    );
  });

  return {
    chunks: [...chunks].map(([key, c]) => ({ key, buildings: toGeometry(c.buildings), roads: toGeometry(c.roads), green: toGeometry(c.green) })),
    trees,
    stats: { chunks: chunks.size, buildingTris, trees: city.trees.features.length },
  };
}
