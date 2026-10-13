import { describe, expect, it } from 'vitest';
import { decodeRound, estimatedRake, multiplier, poolShares, projectedPayout, claimable, publicCancelAllowed, Status } from '../src/lib/game';
import { seedHexFromRandomWord, replayRound, engine, CATS } from '../src/lib/engine';
import { buildSwap, applySlippage, poolId, ZERO_ADDRESS } from '../src/lib/swap';
import { fmtUnits, fmtCountdown, fmtMultiplier } from '../src/lib/format';
import { decodeAbiParameters, keccak256, encodeAbiParameters } from 'viem';

const base = { total0: 3_000_000_000_000_000n, total1: 1_000_000_000_000_000n, rakeBps: 500 };

describe('payout math (docs/ABI.md)', () => {
  it('rake uses the round snapshot, floor(pool * rakeBps / 10000)', () => {
    expect(estimatedRake(base)).toBe(200_000_000_000_000n);
  });
  it('multiplier is (pool - rake) / sideTotal and null for an empty side', () => {
    expect(multiplier(base, 0)).toBeCloseTo(1.2667, 3);
    expect(multiplier(base, 1)).toBeCloseTo(3.8, 3);
    expect(multiplier({ total0: 0n, total1: 5n, rakeBps: 500 }, 0)).toBeNull();
  });
  it('pool shares sum to 100 and default to 50/50', () => {
    expect(poolShares(base)).toEqual([75, 25]);
    expect(poolShares({ total0: 0n, total1: 0n })).toEqual([50, 50]);
  });
  it('projected payout includes the new stake in the pool', () => {
    const stake = 1_000_000_000_000_000n;
    // after staking on side 1: pool 5e15, rake 2.5e14, side1 2e15 -> stake * 4.75e15 / 2e15
    expect(projectedPayout(base, 1, stake)).toBe(2_375_000_000_000_000n);
  });
});

describe('round decoding and eligibility', () => {
  const tuple = [2, 5, 3, 500, 1, 17, 1000n, 1100n, 7n, 3n, 1n, 2n, 1n, 42n, 0n];
  const r = decodeRound(9n, tuple);
  it('decodes getRound in declaration order', () => {
    expect(r).toMatchObject({ id: 9n, catA: 2, catB: 5, status: 3, rakeBps: 500, winner: 1, turns: 17, lockAt: 1000n, total0: 3n, total1: 1n, bettors1: 1n, randomWord: 42n });
  });
  it('claimable only for unclaimed winning or cancelled bets', () => {
    expect(claimable(r, { side: 1, amount: 1n, claimed: false })).toBe(true);
    expect(claimable(r, { side: 0, amount: 1n, claimed: false })).toBe(false);
    expect(claimable(r, { side: 1, amount: 1n, claimed: true })).toBe(false);
    expect(claimable({ ...r, status: Status.Cancelled }, { side: 0, amount: 1n, claimed: false })).toBe(true);
    expect(claimable({ ...r, status: Status.Open }, { side: 1, amount: 1n, claimed: false })).toBe(false);
  });
  it('public cancellation is strictly after the timeouts', () => {
    const open = { ...r, status: Status.Open, lockAt: 1000n };
    expect(publicCancelAllowed(open, 4600n)).toBe(false);
    expect(publicCancelAllowed(open, 4601n)).toBe(true);
    const req = { ...r, status: Status.Requested, requestedAt: 1100n };
    expect(publicCancelAllowed(req, 1100n + 86400n)).toBe(false);
    expect(publicCancelAllowed(req, 1101n + 86400n)).toBe(true);
    expect(publicCancelAllowed({ ...r, status: Status.Fulfilled }, 10n ** 12n)).toBe(false);
  });
});

describe('seed and replay', () => {
  it('encodes the random word as bytes32 big-endian', () => {
    expect(seedHexFromRandomWord(0n)).toBe('0x' + '0'.repeat(64));
    expect(seedHexFromRandomWord(255n)).toBe('0x' + '0'.repeat(62) + 'ff');
    expect(seedHexFromRandomWord((1n << 256n) - 1n)).toBe('0x' + 'f'.repeat(64));
  });
  it('replay verifies against the engine result and flags a mismatch', () => {
    const word = 123456789012345678901234567890n;
    const sim = engine.simulate(0, 1, engine.hexToSeed(seedHexFromRandomWord(word)));
    const ok = replayRound(0, 1, word, sim.winner, sim.turns);
    expect(ok.verified).toBe(true);
    const bad = replayRound(0, 1, word, 1 - sim.winner, sim.turns);
    expect(bad.verified).toBe(false);
  });
  it('roster has eight cats with names matching the art table', () => {
    expect(CATS).toHaveLength(8);
  });
});

describe('Uniswap v4 swap encoding', () => {
  const key = { currency0: ZERO_ADDRESS, currency1: '0x779767c9115182c9eb793f11a1aa7c53c7270a9e', fee: 12500, tickSpacing: 60, hooks: '0xa0602cb30558d5dd17415b6268a4feea3a0ca000' } as const;
  it('buys with native ETH as value, zeroForOne, actions 0x060c0f', () => {
    const plan = buildSwap({ poolKey: key, inputCurrency: ZERO_ADDRESS, amountIn: 10n ** 16n, amountOutMinimum: 5n });
    expect(plan.commands).toBe('0x10');
    expect(plan.value).toBe(10n ** 16n);
    expect(plan.zeroForOne).toBe(true);
    const [actions, params] = decodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], plan.inputs[0]);
    expect(actions).toBe('0x060c0f');
    expect(params).toHaveLength(3);
    const [settle] = decodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], params[1]);
    expect(settle.toLowerCase()).toBe(ZERO_ADDRESS);
    const [take, min] = decodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], params[2]);
    expect(take.toLowerCase()).toBe(key.currency1);
    expect(min).toBe(5n);
  });
  it('sells the token with no value and the extended six-field tuple when requested', () => {
    const plan = buildSwap({ poolKey: key, inputCurrency: key.currency1, amountIn: 7n, amountOutMinimum: 1n, extendedSwapParams: true });
    expect(plan.value).toBe(0n);
    expect(plan.zeroForOne).toBe(false);
    const [, params] = decodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], plan.inputs[0]);
    const five = buildSwap({ poolKey: key, inputCurrency: key.currency1, amountIn: 7n, amountOutMinimum: 1n });
    const [, p5] = decodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], five.inputs[0]);
    expect(params[0].length).toBe(p5[0].length + 64); // one extra uint256 word
  });
  it('slippage and pool id', () => {
    expect(applySlippage(10_000n, 100)).toBe(9_900n);
    const expected = keccak256(encodeAbiParameters([{ type: 'tuple', components: [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }, { type: 'int24' }, { type: 'address' }] }], [[key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]]));
    expect(poolId(key)).toBe(expected);
  });
});

describe('formatting', () => {
  it('formats units without raw wei', () => {
    expect(fmtUnits(1_500_000_000_000_000_000n)).toBe('1.5');
    expect(fmtUnits(1_000_000_000_000_000n, 18, 4)).toBe('0.001');
    expect(fmtUnits(1n, 18, 4)).toBe('<0.0001');
    expect(fmtUnits(1234567n * 10n ** 18n, 18, 2)).toBe('1,234,567');
  });
  it('countdowns and multipliers stay short for long values', () => {
    expect(fmtCountdown(59)).toBe('0:59');
    expect(fmtCountdown(86000)).toBe('23h 53m');
    expect(fmtCountdown(0)).toBe('0:00');
    expect(fmtMultiplier(1.2667)).toBe('1.27×');
    expect(fmtMultiplier(1e11)).toBe('>9999×');
    expect(fmtMultiplier(null)).toBe('—');
  });
});
