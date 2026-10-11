// The quality ladder on the Voidmaul (src/render/quality_dial.ts): a rung
// changes the canvas's pixel ratio and whether the ground receives the
// sun's shadows. The dust, sparks and rift burst of the Voidmaul size their
// points by the drawing buffer as each frame draws them, so they keep their
// size on the screen at any ratio; and the dial's sweep takes every
// receiver of its body, its scar and its rift off the shadows, and gives
// them back.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  VOIDMAUL_CLIPS,
  type VoidmaulTemplate,
  VoidmaulVisual,
} from '../src/render/creatures/voidmaul_visual';
import { receiveShadows } from '../src/render/quality_dial';
import { VoidmaulAttackFx } from '../src/render/vfx/voidmaul_attack_fx';
import { VoidmaulRiftFx } from '../src/render/vfx/voidmaul_rift_fx';

function template(): VoidmaulTemplate {
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial()));
  const clips = new Map(
    VOIDMAUL_CLIPS.map((name) => [
      name,
      new THREE.AnimationClip(name, 1, [
        new THREE.NumberKeyframeTrack('.position[x]', [0, 1], [0, 0]),
      ]),
    ]),
  );
  return { scene, clips };
}

function clouds(root: THREE.Object3D): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[] {
  const out: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];
  root.traverse((o) => {
    if ((o as THREE.Points).isPoints) {
      out.push(o as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>);
    }
  });
  return out;
}

describe('the quality ladder on the Voidmaul', () => {
  it('sizes its points by the drawing buffer each frame, at any ratio', () => {
    const slam = new VoidmaulAttackFx(5.5, undefined, 'crush');
    const rift = new VoidmaulRiftFx();
    const points = [...clouds(slam.root), ...clouds(rift.root)];
    // Dust and sparks, and the burst's.
    expect(points.length).toBeGreaterThanOrEqual(3);
    let height = 1170;
    const gl = {
      getDrawingBufferSize: (target: THREE.Vector2) => target.set(2532, height),
    } as unknown as THREE.WebGLRenderer;
    const draw = (): void => {
      for (const p of points) {
        p.onBeforeRender(
          gl,
          new THREE.Scene(),
          new THREE.PerspectiveCamera(),
          p.geometry,
          p.material,
          new THREE.Group(),
        );
      }
    };
    draw();
    for (const p of points) expect(p.material.uniforms.uHeight!.value).toBe(1170);
    // A rung down: fewer pixels drawn, the points follow.
    height = 780;
    draw();
    for (const p of points) expect(p.material.uniforms.uHeight!.value).toBe(780);
    slam.dispose();
    rift.dispose();
  });

  it("takes its body's, scar's and rift's receivers off the shadows, and gives them back", () => {
    const scene = new THREE.Scene();
    const body = new VoidmaulVisual(template(), 0.5, 1.1);
    const slam = new VoidmaulAttackFx(5.5);
    const rift = new VoidmaulRiftFx();
    scene.add(body.root, slam.root, rift.root);
    const receivers = (): number => {
      let n = 0;
      scene.traverse((o) => {
        if (o.receiveShadow) n++;
      });
      return n;
    };
    const before = receivers();
    expect(before).toBeGreaterThan(0);
    expect(receiveShadows(scene, false)).toBe(before);
    expect(receivers()).toBe(0);
    expect(receiveShadows(scene, true)).toBe(before);
    expect(receivers()).toBe(before);
    body.dispose();
    slam.dispose();
    rift.dispose();
  });
});
