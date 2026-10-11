// The hand-written shaders' half of what program_keeper.ts keeps. Three
// keys a ShaderMaterial's program by the ids of its two source stages, and
// forgets a stage the moment the last material drawing with it is disposed
// (WebGLShaderCache.remove): an effect that builds its ShaderMaterials for
// each strike and disposes them after (the Voidmaul's slam and crush, its
// rift and the rift's burst, render/vfx/voidmaul_*.ts) gets a new id for
// the same sources on its next strike, so a new key, and links its programs
// again, kept or not.
//
// The hold keeps one stand-in for every distinct setup of a hand-written
// shader it is shown: a clone of the material, with the same sources, on an
// object of the same kind and geometry. The caller dresses the stand-ins as
// the originals are dressed (the planet's bend) and compiles them once
// against its scene; they are never drawn and never disposed, so the stages
// keep their ids and the programs their keys and their use for the
// renderer's life, and every later strike finds its programs linked. Shown
// to the hold before the bend: a bent material's clone would not carry the
// bend it was keyed by, so a bent one is passed over.

import * as THREE from 'three';
import { isBent } from './planet_bend';

// More setups than any match draws: a bound, should a material ever carry
// defines of its own per strike.
const MAX_HELD = 64;

function handWritten(material: THREE.Material): material is THREE.ShaderMaterial {
  return (material as THREE.ShaderMaterial).isShaderMaterial === true;
}

type Flagged = THREE.Object3D & {
  isPoints?: boolean;
  isLineSegments?: boolean;
  isLine?: boolean;
  isMesh?: boolean;
  isInstancedMesh?: boolean;
  isSkinnedMesh?: boolean;
  isBatchedMesh?: boolean;
  geometry?: THREE.BufferGeometry;
};

// The kind of a drawn object, as three's key tells it apart: a mesh, a
// line or a cloud of points.
function kindOf(object: Flagged): string {
  if (object.isPoints === true) return 'points';
  if (object.isLineSegments === true) return 'line segments';
  if (object.isLine === true) return 'line';
  return 'mesh';
}

// A stand-in for `object` drawing with `material`: the same kind on the
// same geometry (its attributes key the program too). An instanced, skinned
// or batched mesh and a sprite are passed over: their stand-in would need
// the state they draw with.
function standInFor(
  object: Flagged,
  material: THREE.Material | THREE.Material[],
): THREE.Object3D | null {
  if (object.isInstancedMesh || object.isSkinnedMesh || object.isBatchedMesh) return null;
  const geometry = object.geometry;
  if (!geometry) return null;
  if (object.isPoints === true) return new THREE.Points(geometry, material);
  if (object.isLineSegments === true) return new THREE.LineSegments(geometry, material);
  if (object.isLine === true) return new THREE.Line(geometry, material);
  if (object.isMesh === true) return new THREE.Mesh(geometry, material);
  return null;
}

// What sets a hand-written material's program apart from another of the
// same sources, more finely than three's key rather than less: a setup
// told apart for nothing only holds one stand-in more.
export function shaderSetup(object: THREE.Object3D, material: THREE.ShaderMaterial): string {
  const defines = Object.entries(material.defines ?? {})
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(',');
  return [
    kindOf(object),
    material.type,
    material.side,
    material.transparent ? 'transparent' : 'opaque',
    material.blending,
    material.vertexColors ? 'vertex colors' : '',
    material.alphaTest > 0 ? 'alpha test' : '',
    material.fog ? 'fog' : '',
    material.lights ? 'lights' : '',
    material.toneMapped ? '' : 'not tone mapped',
    material.premultipliedAlpha ? 'premultiplied' : '',
    defines,
    material.vertexShader,
    material.fragmentShader,
  ].join('|');
}

export class ShaderHold {
  private readonly held = new Map<string, THREE.Object3D>();

  constructor(private readonly max = MAX_HELD) {}

  // The stand-ins for the hand-written materials under `root` whose setup
  // is not held yet, each setup once. The caller dresses and compiles them
  // now, while the originals still stand, and leaves them be.
  take(root: THREE.Object3D): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    root.traverse((object) => {
      const drawn = object as Flagged & { material?: THREE.Material | THREE.Material[] };
      if (!drawn.material || this.held.size >= this.max) return;
      const materials = Array.isArray(drawn.material) ? drawn.material : [drawn.material];
      const fresh = new Set<THREE.Material>();
      for (const m of materials) {
        if (handWritten(m) && !isBent(m) && !this.held.has(shaderSetup(object, m))) fresh.add(m);
      }
      if (fresh.size === 0) return;
      const copies = materials.map((m) => (fresh.has(m) ? m.clone() : m));
      const standIn = standInFor(drawn, Array.isArray(drawn.material) ? copies : copies[0]!);
      if (!standIn) return;
      standIn.visible = false;
      standIn.name = `held ${object.name}`;
      for (const m of fresh) this.held.set(shaderSetup(object, m as THREE.ShaderMaterial), standIn);
      out.push(standIn);
    });
    return out;
  }

  // How many setups are held.
  get size(): number {
    return this.held.size;
  }

  // The context came back: three built its caches anew, and the stand-ins
  // hold nothing in them. The next strike's setups are held again.
  forget(): void {
    this.held.clear();
  }
}
