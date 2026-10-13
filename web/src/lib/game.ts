/** Pure helpers over the CatWars round model (see docs/ABI.md). */

export const Status = { Open: 0, Requested: 1, Fulfilled: 2, Settled: 3, Cancelled: 4 } as const;
export type StatusValue = (typeof Status)[keyof typeof Status];
export const STATUS_LABEL: Record<number, string> = {
  0: 'Betting open',
  1: 'Waiting for randomness',
  2: 'Ready to settle',
  3: 'Settled',
  4: 'Cancelled',
};

export interface Round {
  id: bigint;
  catA: number;
  catB: number;
  status: number;
  rakeBps: number;
  winner: number;
  turns: number;
  lockAt: bigint;
  requestedAt: bigint;
  requestId: bigint;
  total0: bigint;
  total1: bigint;
  bettors0: bigint;
  bettors1: bigint;
  randomWord: bigint;
  rake: bigint;
}

/** Decodes the `getRound` tuple in declaration order. */
export function decodeRound(id: bigint, t: unknown): Round {
  const r = (Array.isArray(t) ? t : Object.values(t as object)) as unknown[];
  const n = (i: number) => Number(r[i]);
  const b = (i: number) => BigInt(r[i] as bigint | number | string);
  return {
    id,
    catA: n(0), catB: n(1), status: n(2), rakeBps: n(3), winner: n(4), turns: n(5),
    lockAt: b(6), requestedAt: b(7), requestId: b(8),
    total0: b(9), total1: b(10), bettors0: b(11), bettors1: b(12),
    randomWord: b(13), rake: b(14),
  };
}

export interface Bet { side: number; amount: bigint; claimed: boolean }
export function decodeBet(t: unknown): Bet {
  const r = (Array.isArray(t) ? t : Object.values(t as object)) as unknown[];
  return { side: Number(r[0]), amount: BigInt(r[1] as bigint), claimed: Boolean(r[2]) };
}

export const pool = (r: Pick<Round, 'total0' | 'total1'>) => r.total0 + r.total1;

/** Pre-settlement rake estimate: floor(pool * round.rakeBps / 10000) using the round's snapshot. */
export function estimatedRake(r: Pick<Round, 'total0' | 'total1' | 'rakeBps'>): bigint {
  return (pool(r) * BigInt(r.rakeBps)) / 10000n;
}

/** Expected return per 1 wei staked on `side`, or null when that side has no stake. */
export function multiplier(r: Pick<Round, 'total0' | 'total1' | 'rakeBps'>, side: 0 | 1): number | null {
  const sideTotal = side === 0 ? r.total0 : r.total1;
  if (sideTotal === 0n) return null;
  const net = pool(r) - estimatedRake(r);
  // scale to keep precision in Number conversion
  return Number((net * 10_000n) / sideTotal) / 10_000;
}

/** Share of the pool on each side in percent (integers that sum to 100 when the pool is nonzero). */
export function poolShares(r: Pick<Round, 'total0' | 'total1'>): [number, number] {
  const p = pool(r);
  if (p === 0n) return [50, 50];
  const s0 = Number((r.total0 * 1000n) / p) / 10;
  return [s0, Math.round((100 - s0) * 10) / 10];
}

/** What a winning stake would receive if the round settled now with these totals. */
export function projectedPayout(r: Pick<Round, 'total0' | 'total1' | 'rakeBps'>, side: 0 | 1, stake: bigint): bigint {
  const total0 = r.total0 + (side === 0 ? stake : 0n);
  const total1 = r.total1 + (side === 1 ? stake : 0n);
  const next = { total0, total1, rakeBps: r.rakeBps };
  const sideTotal = side === 0 ? total0 : total1;
  if (sideTotal === 0n) return 0n;
  return (stake * (pool(next) - estimatedRake(next))) / sideTotal;
}

export function isTerminal(status: number): boolean {
  return status === Status.Settled || status === Status.Cancelled;
}

/** Whether an eligible claim exists for this bet in a terminal round (per docs/ABI.md). */
export function claimable(r: Round, bet: Bet): boolean {
  if (bet.amount === 0n || bet.claimed) return false;
  if (r.status === Status.Cancelled) return true;
  if (r.status === Status.Settled) return bet.side === r.winner;
  return false;
}

export const OPEN_TIMEOUT = 3600n;
export const REQUEST_TIMEOUT = 86400n;

/** Public (anyone) cancellation windows; owner/keeper may also cancel while Open at any time. */
export function publicCancelAllowed(r: Round, now: bigint): boolean {
  if (r.status === Status.Open) return now > r.lockAt + OPEN_TIMEOUT;
  if (r.status === Status.Requested) return now > r.requestedAt + REQUEST_TIMEOUT;
  return false;
}
