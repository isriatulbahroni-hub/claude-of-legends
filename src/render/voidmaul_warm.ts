// The Voidmaul's art for the fights' warm-up (warm_samples.ts): its slam
// and its crush, each with its scar, its shockwave, its dust and sparks and
// its stones, and its rift with the rift's burst, built the way
// voidmaul_impacts.ts and voidmaul_rifts.ts build the live ones. The
// creature's body and its rigged model are a body sample of their own
// (WARM_BODIES). Built off screen and compiled against the planet's scene,
// their programs link before the first Voidmaul Rising rather than at its
// rise and its first strike, mid-fight.

import { VOIDMAUL_SLAM, type VoidmaulAttackKind } from '../sim/content/voidmaul_slam';
import { VoidmaulAttackFx } from './vfx/voidmaul_attack_fx';
import { VoidmaulRiftFx } from './vfx/voidmaul_rift_fx';
import type { WarmArt } from './warm_samples';

function strike(kind: VoidmaulAttackKind): WarmArt {
  const fx = new VoidmaulAttackFx(VOIDMAUL_SLAM.radius, undefined, kind);
  return { root: fx.root, age: (s) => void fx.update(s), dispose: () => fx.dispose() };
}

function rift(): WarmArt {
  const fx = new VoidmaulRiftFx();
  return { root: fx.root, age: (s) => fx.update(s), dispose: () => fx.dispose() };
}

export const VOIDMAUL_WARM_ART: Readonly<Record<string, () => WarmArt>> = {
  voidmaul_slam: () => strike('slam'),
  voidmaul_crush: () => strike('crush'),
  voidmaul_rift: rift,
};
