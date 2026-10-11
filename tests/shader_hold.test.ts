// The hand-written shaders held for the renderer's life
// (src/render/shader_hold.ts): one stand-in per setup, a clone of the
// material with the same sources on an object of the same kind and
// geometry, never the same setup twice, none for a built-in material, a
// bent one or a body that draws with state of its own; a restored context
// holds again. The Voidmaul's slam, crush and rift as the warm-up builds
// them leave every setup of a later strike held, and the renderer holds
// each live one as it is built. The last test pins three's rule the hold
// answers: a stage's id is handed out per source while a material uses it,
// and goes with its last material.

import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bendMaterial } from '../src/render/planet_bend';
import { ShaderHold, shaderSetup } from '../src/render/shader_hold';
import { VoidmaulAttackFx } from '../src/render/vfx/voidmaul_attack_fx';
import { VoidmaulRiftFx } from '../src/render/vfx/voidmaul_rift_fx';
import { VOIDMAUL_WARM_ART } from '../src/render/voidmaul_warm';
import { WARM_ART_AGES_S } from '../src/render/warm_samples';

const VERT = 'void main() { gl_Position = vec4(0.0); }';

function shader(frag: string, extra: THREE.ShaderMaterialParameters = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: `void main() { gl_FragColor = vec4(${frag}); }`,
    ...extra,
  });
}

function handWritten(root: THREE.Object3D): THREE.ShaderMaterial[] {
  const out: THREE.ShaderMaterial[] = [];
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const material of Array.isArray(m) ? m : [m]) {
      if ((material as THREE.ShaderMaterial).isShaderMaterial) {
        out.push(material as THREE.ShaderMaterial);
      }
    }
  });
  return out;
}

describe('the shader hold', () => {
  it('stands in once for each setup, and for no built-in material', () => {
    const hold = new ShaderHold();
    const root = new THREE.Group();
    const geometry = new THREE.BufferGeometry();
    const red = new THREE.Mesh(geometry, shader('1.0, 0.0, 0.0, 1.0'));
    // The same sources and setup on a second strike's mesh.
    const again = new THREE.Mesh(new THREE.BufferGeometry(), shader('1.0, 0.0, 0.0, 1.0'));
    const sparks = new THREE.Points(new THREE.BufferGeometry(), shader('1.0'));
    const plain = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    root.add(red, again, sparks, plain);
    const standIns = hold.take(root);
    expect(standIns).toHaveLength(2);
    expect(hold.size).toBe(2);
    const [mesh, points] = standIns as [THREE.Mesh, THREE.Points];
    expect(mesh.isMesh && !(mesh as unknown as THREE.Points).isPoints).toBe(true);
    expect(points.isPoints).toBe(true);
    expect(mesh.geometry).toBe(geometry);
    const held = mesh.material as THREE.ShaderMaterial;
    expect(held).not.toBe(red.material);
    expect(held.vertexShader).toBe(red.material.vertexShader);
    expect(held.fragmentShader).toBe(red.material.fragmentShader);
    expect(mesh.visible).toBe(false);
    // Shown again, nothing new to hold.
    expect(hold.take(root)).toHaveLength(0);
  });

  it('tells apart a setup that keys its program apart', () => {
    const hold = new ShaderHold();
    const root = new THREE.Group();
    const geometry = new THREE.BufferGeometry();
    const normal = shader('1.0');
    const added = shader('1.0', { blending: THREE.AdditiveBlending });
    const defined = shader('1.0', { defines: { SOFT: 1 } });
    root.add(
      new THREE.Mesh(geometry, normal),
      new THREE.Mesh(geometry, added),
      new THREE.Mesh(geometry, defined),
      new THREE.Points(geometry, normal.clone()),
    );
    expect(hold.take(root)).toHaveLength(4);
    expect(new Set([normal, added, defined].map((m) => shaderSetup(root, m))).size).toBe(3);
  });

  it('passes over a bent material and a body drawn with state of its own', () => {
    const hold = new ShaderHold();
    const bent = shader('0.5');
    bendMaterial(bent);
    const root = new THREE.Group();
    root.add(
      new THREE.Mesh(new THREE.BufferGeometry(), bent),
      new THREE.InstancedMesh(new THREE.BufferGeometry(), shader('0.25'), 4),
    );
    expect(hold.take(root)).toHaveLength(0);
    expect(hold.size).toBe(0);
  });

  it('holds again after a restored context', () => {
    const hold = new ShaderHold();
    const root = new THREE.Mesh(new THREE.BufferGeometry(), shader('1.0'));
    expect(hold.take(root)).toHaveLength(1);
    expect(hold.take(root)).toHaveLength(0);
    hold.forget();
    expect(hold.take(root)).toHaveLength(1);
  });

  it('stops at its bound', () => {
    const hold = new ShaderHold(2);
    const root = new THREE.Group();
    for (const frag of ['0.1', '0.2', '0.3']) {
      root.add(new THREE.Mesh(new THREE.BufferGeometry(), shader(frag)));
    }
    expect(hold.take(root)).toHaveLength(2);
    expect(hold.size).toBe(2);
  });
});

describe("the Voidmaul's art held", () => {
  it('leaves every setup of a later slam, crush and rift held after the warm-up', () => {
    const hold = new ShaderHold();
    for (const make of Object.values(VOIDMAUL_WARM_ART)) {
      const art = make();
      expect(handWritten(art.root).length).toBeGreaterThan(0);
      hold.take(art.root);
      for (const age of WARM_ART_AGES_S) art.age(age);
      art.dispose();
    }
    expect(hold.size).toBeGreaterThan(0);
    // The live ones, as the impacts and the rifts build them: an
    // Ascendant's larger slam draws with the same setups.
    for (const live of [
      new VoidmaulAttackFx(7.25, { centerX: 1, centerZ: 2, radius: 20 }, 'slam'),
      new VoidmaulAttackFx(5.5, undefined, 'crush'),
      new VoidmaulRiftFx(),
    ]) {
      expect(hold.take(live.root)).toHaveLength(0);
      live.dispose();
    }
  });

  it('is held by the renderer as each live one is built, and forgotten with a lost context', () => {
    const source = readFileSync('src/render/renderer.ts', 'utf8');
    const rifts = source.slice(source.indexOf('this.voidmaulRifts = new VoidmaulRifts('));
    expect(rifts.slice(0, rifts.indexOf(');\n'))).toContain('(root) => this.holdShaders(root)');
    const impacts = source.slice(source.indexOf('this.voidmaulImpacts = new VoidmaulImpacts('));
    expect(impacts.slice(0, impacts.indexOf('    );\n'))).toContain(
      '(root) => this.holdShaders(root)',
    );
    expect(source).toMatch(/restore: async \(\) => \{[\s\S]*?this\.shaderHold\.forget\(\);/);
    // The warm-up waits for the Voidmaul's model and samples its art.
    expect(source).toContain('voidmaul: preloadVoidmaul,');
    expect(source).toContain('art: VOIDMAUL_WARM_ART,');
    expect(source).toContain('hold: (root) => this.shaderHold.take(root),');
  });
});

describe("three's rule the hold answers", () => {
  it('keys a hand-written program by its stages, each gone with its last material', () => {
    const cache = readFileSync(
      'node_modules/three/src/renderers/webgl/WebGLShaderCache.js',
      'utf8',
    );
    expect(cache).toContain('this.id = _id ++;');
    expect(cache).toMatch(
      /if \( shaderStage\.usedTimes === 0 \) this\.shaderCache\.delete\( shaderStage\.code \);/,
    );
    const programs = readFileSync(
      'node_modules/three/src/renderers/webgl/WebGLPrograms.js',
      'utf8',
    );
    expect(programs).toContain('array.push( parameters.customVertexShaderID );');
    expect(programs).toContain('_customShaders.remove( material );');
    // Copying a material keeps its sources: the clone finds the same stage.
    const material = readFileSync('node_modules/three/src/materials/ShaderMaterial.js', 'utf8');
    expect(material).toContain('this.fragmentShader = source.fragmentShader;');
    expect(material).toContain('this.vertexShader = source.vertexShader;');
  });
});
