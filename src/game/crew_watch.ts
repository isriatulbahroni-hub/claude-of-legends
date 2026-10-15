// One life in Crews (ADR 0034): a champion fallen for good while its crew
// stands watches the crew. The camera follows a crewmate still standing,
// the one it already follows while it stands, else the first by unit id,
// and moves on when that one falls; with nobody of the crew standing, or
// in Solo (no crewmate in the mirror), it stays on the fallen champion.
// The crew shares its sight (ADR 0030), so every crewmate is in the
// mirror. Pure decision (crewWatchTarget) and a thin camera over it, which
// game/boot.ts hands the renderer (Renderer.watchUnit, recenterCamera).

import type { IWorld } from '../world_api';
import type { BeatLens } from './death_beat';

export interface CrewmateSight {
  id: number;
  dead: boolean;
}

// Whom the camera follows: null for the champion itself.
export function crewWatchTarget(
  selfDead: boolean,
  mates: readonly CrewmateSight[],
  current: number | null,
): number | null {
  if (!selfDead) return null;
  if (current !== null && mates.some((m) => m.id === current && !m.dead)) return current;
  let best: number | null = null;
  for (const m of mates) if (!m.dead && (best === null || m.id < best)) best = m.id;
  return best;
}

export class CrewCamera {
  private watching: number | null = null;

  constructor(
    private readonly world: Pick<IWorld, 'units'>,
    private readonly lens: Pick<BeatLens, 'watchUnit' | 'recenterCamera'>,
    private readonly selfId: number,
    private readonly selfTeam: number,
  ) {}

  // Once per world tick.
  tick(): void {
    const mates: CrewmateSight[] = [];
    for (const u of this.world.units.values()) {
      if (u.kind !== 'champion' || u.id === this.selfId || u.team !== this.selfTeam) continue;
      mates.push({ id: u.id, dead: u.dead });
    }
    const selfDead = this.world.units.get(this.selfId)?.dead === true;
    const next = crewWatchTarget(selfDead, mates, this.watching);
    if (next === this.watching) return;
    this.watching = next;
    this.lens.watchUnit(next);
    this.lens.recenterCamera();
  }
}
