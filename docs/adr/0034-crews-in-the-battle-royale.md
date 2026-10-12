# Crews in the battle royale

> Amends ADR 0031 (a match is played Solo or in Crews) and ADR 0030 (a team may hold more than
> one champion on the planet).

The battle royale was fifty champions each for themself (ADR 0031): every champion its own team
(ADR 0030). On 2026-10-12 the maintainer asked for it to be playable in teams of three and of
five as well, and settled three choices: a person's crewmates are house bots, and the people
who enter the same crew size are put in the same crew while it has a bot's seat (no party, no
invitation); in One life a fallen champion is out for good and watches its crew, with no
knocked-down state to be lifted from; the crew size is chosen on the battle royale's quick pick
card, Solo, Trios or Fives, and Play now stays Respawn in Solo. This records the decisions the
code rests on (CONTEXT.md: Crew).

## Decision

- **Three crew sizes, either variant.** Solo is the mode as it was: fifty seats, each its own
  team. Fives: ten crews of five, fifty seats. Trios: sixteen crews of three, forty-eight seats
  (fifty does not divide by three; seventeen crews would crowd the planet's ground per
  champion). Seat i sits in crew floor(i / size), the people first (`src/sim/royale/crews.ts`
  crewOfSeat, crewSeats).
- **A crew is a team (ADR 0030).** It shares its sight, its champions never hurt one another,
  and the sim's own team rules (an attack's target, a spell's, an ally's spell and dash, an
  assist, the Wrath's and a favor's team) read it as they read the 5v5's teams. The
  free-for-all's isolation rule (`combat/effects.ts` targetIsolated) holds in Solo only.
- **The landing.** Each crew lands around its leader's pick (its first person who picked, else
  its first seat that picked, else a quiet spot), its other champions 3 to 6 m from it. Solo's
  escorts become a whole crew of house bots coming down 18 to 24 m from each crew with a person
  in it, the softest crew first for a crew with a newcomer. The others' picks show on the globe
  as before, the crewmates' apart in the ally's blue.
- **Coming back and arriving beside the crew.** A Respawn return with no pick of its own, and an
  Arrival, come down 3 to 6 m from a crewmate standing deep in the light with no enemy within
  12 m of it (`crews.ts` besideCrew); with none, the edge of the light, the fair first fight or
  the quiet spot as in Solo. In every crew size the clearance of a return and of an Arrival, the
  edge's distance, an Arrival's fair foe and its crowding read the other crews only (in Solo:
  every other champion, as before).
- **The score and the end.** Respawn: a crew scores every takedown its champions land, the Last
  light and the marks included (`RoyaleState.crewScores`, kept when a drop-in's own tally starts
  from zero), and the crew with the most wins, fewer deaths then the lower crew on a tie. One
  life: a fallen champion is out for good; a crew is out once its last champion fell, the crews
  falling on one tick placed by the most health one of their fallen had before it, and the last
  crew standing wins (`RoyaleState.crewsOut`, `winnerTeam`). The winner (`winnerId`) is the
  winning crew's best champion. Every champion of a crew out is told its crew's place then
  (`royale_out`), not at its own fall.
- **The bots.** The observation's royale block names the crew's anchor (`ObsRoyale.anchor`: a
  person playing in the crew, else its first champion standing; the bot mark is public). A bot
  farther than 14 m from its anchor walks back to 5 m of it, unless the anchor stands in the
  dark; within the leash it loots, takes camps and answers calls as alone. Its crewmates within
  the odds' reach weigh beside it in a fight's odds, and a crewmate's mark is nobody's hunt.
- **Entering.** The 'royale' message carries the crew size (`c`: 3 or 5, Solo when absent). A
  person joins the liveliest match of the variant and size asked, in a bot's seat of the crew
  with the most people first, then the champion picked as before (`server/royale_join.ts`). The
  match kept running for visitors is Solo Respawn's alone; a match of Crews starts with the
  person who asks. A Respawn drop-in in Crews is ranked with its crew from the drop: no window
  since landing.
- **Points (ADR 0027).** A person on the same crew is no opponent: the weight doubles only for a
  person on another crew. One life's places are the crews', out of the crews: the last crew
  standing 50, the top tenth of the crews 25, the top fifth 15 (fifty seats in Solo give five and
  ten, as before). Respawn's 50 for the best score and One life's 50 go to every seat of the
  winning crew still playing, a fallen one too.
- **The screens.** The quick pick card has a Crew row (Solo, Trios, Fives) remembered with the
  pick. In Crews the top line counts crews ("Crew #3 of 16 · 12 takedowns · 2 behind #2", "5
  crews left · 7 takedowns"), the win line and the win card say what wins a crew, crewmates are
  drawn as allies (the health bar, the ring, the minimap) and named in the ally's blue in the
  kill feed, a One life champion out for good watches a crewmate standing
  (`src/game/crew_watch.ts`), and the end screen says the crew's place, what the seat and its
  crew scored, which crew won, and the top crews.
- **Rules 13.** The planet's rules version moves from 12 to 13; a replay records the crew size
  (`RoyaleRecord.crew`, absent for Solo) and rebuilds the crews from it.

## Measured

`node scripts/royale_crews.mjs --seeds 6`: seeds 1 to 6 of each variant and crew size, every
seat a house bot, no person (so no escort crew), rules 13.

- **One life** ends at 7:43 on average in Solo, 7:10 in Trios and 7:05 in Fives, with 49, 46
  and 48 takedowns. The winning crew ends with 2.2 of its three champions standing in Trios on
  average, 2.3 of its five in Fives. Crews still in by minute, Trios seed 1: 16 16 16 15 12 9 7
  3 2; Fives seed 1: 10 10 10 8 6 5 3 3 2.
- **Respawn** runs its ten minutes with 962 takedowns in Solo, 982 in Trios, 1029 in Fives. The
  best crew scores 198 against the second's 149 in Trios on average, 346 against 221 in Fives
  (the best champion in Solo: 143 against 82).
- **Together.** Of every standing champion's seconds, the share with a crewmate standing within
  the 14 m leash: 69 percent in Respawn Trios, 85 in Respawn Fives, 81 in One life Trios, 90 in
  One life Fives; the median distance to the nearest crewmate 6.4, 3.3, 5.3 and 2.5 m.
- **Left open.** A Respawn crew of five that pulls ahead stays ahead (a 57 percent lead over the
  second on average, 495 against 200 on seed 6); nothing slows a leading crew yet but the
  Lodestar's mark on its best champion. No person played in these matches: a person's crew, its
  escort crew and a drop-in beside its crew are pinned by tests (`tests/royale_crews.test.ts`,
  `tests/royale_crew_bot.test.ts`) and one browser run, not measured.

## Consequences

- Solo is unchanged, match for match: every recorded and pinned royale test plays to the same
  state, and every rule that now reads "the other crews" reads every other champion there.
- The Wrath on the planet is its holder's team buff (ADR 0022's), so in Crews it strengthens the
  holder's whole crew while the holder carries it, and leaves with the holder. A ring creature's
  aspect, where one is in play, is the slayer's crew's favor.
- No crew chat, no pings and no knocked-down state; a crew of friends cannot enter together.
  Each would be its own decision.
