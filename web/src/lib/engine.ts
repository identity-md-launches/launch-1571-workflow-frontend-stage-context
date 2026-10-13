/**
 * Typed access to the canonical CAT WARS engine and portrait art, both copied VERBATIM from
 * specification commit 62a025e1bfd655205aa1cdb54ce9943999691c85 (engine/engine.js, art/catart.js).
 * The files are served unchanged from the export and register themselves on window; this wrapper only reads those globals.
 */

export interface Skill {
  name: string; icon: string; desc: string; cd: number;
  dmg?: number; hits?: number; crit?: number; pierce?: number; stun?: number; lifesteal?: number;
  heal?: number; shield?: number; buff?: number; weaken?: number; curse?: number; dodge?: number; turns?: number;
}
export interface Cat { name: string; title: string; hp: number; atk: number; def: number; spd: number; skills: Skill[] }
export interface FightSnap { hp: number; max: number; status: string[] }
export interface FightEvent {
  turn: number; actor: 0 | 1; kind: 'skill' | 'stunned' | 'end'; text: string; snap: FightSnap[];
  skill?: Skill; dmg?: number; heal?: number; crit?: boolean; miss?: boolean; stunned?: boolean;
}
export interface FightResult { winner: 0 | 1; reason: 'ko' | 'decision'; turns: number; events: FightEvent[] }

interface EngineApi {
  CATS: Cat[];
  MAX_TURNS: number;
  simulate(catA: number, catB: number, seed: Uint8Array): FightResult;
  hexToSeed(hex: string): Uint8Array;
  seedToHex(seed: Uint8Array): string;
}
interface ArtApi {
  CAT_ART: Record<string, { token: string; rarity: string }>;
  RARITY_COLOR: Record<string, string>;
  catSVG(cat: { name: string }, uid: string): string;
}

// The verbatim files are loaded as classic scripts by index.html (vendor/engine.js, vendor/catart.js)
// and register themselves on window; the test setup loads them the same way under Node.
const g = globalThis as unknown as { CatWarsEngine?: EngineApi } & Partial<ArtApi>;
if (!g.CatWarsEngine || !g.catSVG) throw new Error('CAT WARS engine or art script did not load');

export const engine: EngineApi = g.CatWarsEngine;
export const CATS: Cat[] = engine.CATS;
const art: ArtApi = g as ArtApi;
export const CAT_ART = art.CAT_ART;
export const RARITY_COLOR = art.RARITY_COLOR;
export const catSVG = (name: string, uid: string): string => art.catSVG({ name }, uid);

/** Exactly bytes32(randomWord), big-endian, as the contract and keeper encode the seed. */
export function seedHexFromRandomWord(randomWord: bigint): `0x${string}` {
  if (randomWord < 0n || randomWord >= 1n << 256n) throw new Error('random word out of range');
  return ('0x' + randomWord.toString(16).padStart(64, '0')) as `0x${string}`;
}

/** Replays a settled round and checks it against the on-chain outcome. */
export function replayRound(catA: number, catB: number, randomWord: bigint, onchainWinner: number, onchainTurns: number) {
  const seedHex = seedHexFromRandomWord(randomWord);
  const result = engine.simulate(catA, catB, engine.hexToSeed(seedHex));
  const verified = result.winner === onchainWinner && result.turns === onchainTurns;
  return { seedHex, result, verified };
}

/** Display form of an all-caps roster name ("TIGRIS" -> "Tigris"). */
export function displayName(name: string): string {
  return name.charAt(0) + name.slice(1).toLowerCase();
}
