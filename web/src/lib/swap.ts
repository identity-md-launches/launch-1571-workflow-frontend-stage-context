/**
 * Uniswap v4 Universal Router swap encoding for the launch pool, following the
 * assignment's swap reference: one V4_SWAP command with SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL.
 */
import { encodeAbiParameters, keccak256, type Address, type Hex } from 'viem';
import type { PoolKey } from '../config';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export const V4_SWAP_COMMAND: Hex = '0x10';
export const ACTIONS: Hex = '0x060c0f'; // SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL

const POOL_KEY_TYPE = {
  type: 'tuple',
  components: [
    { name: 'currency0', type: 'address' },
    { name: 'currency1', type: 'address' },
    { name: 'fee', type: 'uint24' },
    { name: 'tickSpacing', type: 'int24' },
    { name: 'hooks', type: 'address' },
  ],
} as const;

export function poolId(key: PoolKey): Hex {
  return keccak256(encodeAbiParameters([POOL_KEY_TYPE], [key]));
}

export interface SwapPlan {
  commands: Hex;
  inputs: Hex[];
  value: bigint;
  inputCurrency: Address;
  outputCurrency: Address;
  zeroForOne: boolean;
}

export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  return (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
}

/** Sorted (currency0 < currency1) check so a pool key is never assumed. */
export function sideOf(key: PoolKey, currency: Address): 0 | 1 {
  if (key.currency0.toLowerCase() === currency.toLowerCase()) return 0;
  if (key.currency1.toLowerCase() === currency.toLowerCase()) return 1;
  throw new Error('currency is not in the pool');
}

export function buildSwap(opts: {
  poolKey: PoolKey;
  inputCurrency: Address;
  amountIn: bigint;
  amountOutMinimum: bigint;
  extendedSwapParams?: boolean;
}): SwapPlan {
  const { poolKey, inputCurrency, amountIn, amountOutMinimum } = opts;
  const inSide = sideOf(poolKey, inputCurrency);
  const zeroForOne = inSide === 0;
  const outputCurrency = zeroForOne ? poolKey.currency1 : poolKey.currency0;
  const base = [
    { name: 'poolKey', ...POOL_KEY_TYPE },
    { name: 'zeroForOne', type: 'bool' },
    { name: 'amountIn', type: 'uint128' },
    { name: 'amountOutMinimum', type: 'uint128' },
  ] as const;
  const params0 = opts.extendedSwapParams
    ? encodeAbiParameters(
        [{ type: 'tuple', components: [...base, { name: 'sqrtPriceLimitX96', type: 'uint256' }, { name: 'hookData', type: 'bytes' }] }],
        [{ poolKey, zeroForOne, amountIn, amountOutMinimum, sqrtPriceLimitX96: 0n, hookData: '0x' }],
      )
    : encodeAbiParameters(
        [{ type: 'tuple', components: [...base, { name: 'hookData', type: 'bytes' }] }],
        [{ poolKey, zeroForOne, amountIn, amountOutMinimum, hookData: '0x' }],
      );
  const params1 = encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [inputCurrency, amountIn]);
  const params2 = encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [outputCurrency, amountOutMinimum]);
  const input0 = encodeAbiParameters([{ type: 'bytes' }, { type: 'bytes[]' }], [ACTIONS, [params0, params1, params2]]);
  const isNativeIn = inputCurrency.toLowerCase() === ZERO_ADDRESS;
  return {
    commands: V4_SWAP_COMMAND,
    inputs: [input0],
    value: isNativeIn ? amountIn : 0n,
    inputCurrency,
    outputCurrency,
    zeroForOne,
  };
}

/** Price of currency1 in units of currency0 from sqrtPriceX96 (both 18-decimal). */
export function priceFromSqrtX96(sqrtPriceX96: bigint): number {
  const q96 = 2 ** 96;
  const s = Number(sqrtPriceX96) / q96;
  return s * s; // currency1 per currency0
}
