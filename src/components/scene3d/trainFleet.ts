// Visual profiles only: service timing still comes from trainSim. Regional models are generic CC0 assets.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TRAIN } from "../../constants/scene.ts";

export interface Fleet {
  id: string;
  models: string[];
  formation: number[]; // model index per car, front to rear; final cab is rotated 180 degrees
  carLength: number;
  carWidth: number;
  bodyHeight: number;
  livery?: Record<string, string>;
}
const dir = "/models/regional/";
export const FLEETS: Record<string, Fleet> = {
  dmrc: {
    id: "dmrc", models: ["a", "b", "c"].map(c => `/models/kenney/train/train-electric-subway-${c}.glb`),
    formation: [0, 1, 2, 1, 2, 0], carLength: TRAIN.carLength, carWidth: TRAIN.carWidth, bodyHeight: TRAIN.carHeight,
  },
  rrts: {
    id: "rrts", models: [dir + "rrts-cab.glb", dir + "rrts-middle.glb"], formation: [0, 1, 1, 1, 1, 0],
    carLength: 22, carWidth: 3.2, bodyHeight: 3.9,
    livery: { shell: "#cbd2d7", accent: "#ce3830", warn: "#ce3830" },
  },
  aqua: {
    id: "aqua", models: [dir + "aqua-cab.glb", dir + "metro-middle.glb"], formation: [0, 1, 1, 0],
    carLength: 21.6, carWidth: 3.2, bodyHeight: 3.9,
    livery: { shell: "#e0e6e8", accent: "#14b9bf", warn: "#14b9bf" },
  },
  meerut_metro: {
    id: "meerut_metro", models: [dir + "meerut-cab.glb", dir + "metro-middle.glb"], formation: [0, 1, 0],
    carLength: 22, carWidth: 3.2, bodyHeight: 3.9,
    livery: { shell: "#e3e7e9", accent: "#89cb38", warn: "#f1762c", steel: "#527fbd" },
  },
};

export const fleetForLine = (lineId: string): Fleet => FLEETS[lineId] ?? FLEETS.dmrc;
export const FLEET_MODEL_URLS = [...new Set(Object.values(FLEETS).flatMap(f => f.models))];
export const carCapacity = (fleet: Fleet, type: number, trains: number) => fleet.formation.filter(t => t === type).length * trains;
export const carOffset = (fleet: Fleet, car: number) => ((fleet.formation.length - 1) / 2 - car) * fleet.carLength;

/** Bake the source's material colours into geometry so each car needs one instanced draw call. */
export function regionalCarGeometry(scene: THREE.Object3D, fleet: Fleet) {
  scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  const body = new THREE.Box3();
  scene.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const original = mesh.geometry;
    const source = original.index ? original.toNonIndexed() : original.clone();
    // glTF mesh quantization can use different typed/normalized attributes per primitive. Unpack them.
    const geometry = new THREE.BufferGeometry();
    for (const name of ["position", "normal"]) {
      const attr = source.getAttribute(name);
      if (!attr) continue;
      const array = new Float32Array(attr.count * 3);
      for (let i = 0; i < attr.count; i++) array.set([attr.getX(i), attr.getY(i), attr.getZ(i)], i * 3);
      geometry.setAttribute(name, new THREE.BufferAttribute(array, 3));
    }
    if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
    geometry.applyMatrix4(mesh.matrixWorld);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[];
    const groups = source.groups.length ? source.groups : [{ start: 0, count, materialIndex: 0 }];
    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0];
      const color = fleet.livery?.[material.name] ? new THREE.Color(fleet.livery[material.name]) : material.color;
      for (let i = group.start; i < Math.min(count, group.start + group.count); i++) {
        color.toArray(colors, i * 3);
        if (material.name === "shell") body.expandByPoint(new THREE.Vector3().fromBufferAttribute(geometry.getAttribute("position"), i));
      }
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    parts.push(geometry);
    source.dispose();
  });
  const geometry = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  if (!geometry) throw new Error(`Could not merge ${fleet.id} train car`);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  // Height is measured to the shell, preserving pantographs above it instead of squashing the body.
  const bodyTop = body.isEmpty() ? bounds.max.y : body.max.y;
  const scale = new THREE.Vector3(fleet.carWidth / size.x, fleet.bodyHeight / (bodyTop - bounds.min.y), (fleet.carLength - 0.4) / size.z);
  geometry.translate(-centre.x, -bounds.min.y, -centre.z);
  geometry.scale(scale.x, scale.y, scale.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
