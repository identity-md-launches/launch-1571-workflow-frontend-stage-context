/**
 * Single source of deployment configuration.
 *
 * Addresses, chain id, ABIs and public RPC URLs are NOT hard-coded here. They are read at
 * runtime from `imd-deployment.json`, the manifest emitted next to the static export, and the
 * ABI JSON files it references. This module only defines the shape, the loader and the minimal
 * interface ABIs of the chain-wide Uniswap v4 / Permit2 / ERC-20 contracts whose addresses also
 * come from that manifest's `network` block.
 */
import { createConfig, fallback, http, type Config } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain, type Abi, type Address, type Chain, type Hex } from 'viem';

export interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

export interface NetworkBlock {
  chainId: number;
  name: string;
  testnet: boolean;
  rpcUrls: string[];
  explorer: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  faucets?: string[];
  pairToken?: Address;
  otherPairTokens?: unknown;
  uniswapV4: {
    poolManager: Address;
    universalRouter: Address;
    quoter: Address;
    stateView: Address;
    positionManager: Address;
    permit2: Address;
    extendedSwapParams?: boolean;
  };
}

export interface WalletAddChain {
  chainId: Hex;
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls: string[];
}

export interface ManifestContract {
  name: string;
  address: Address;
  abiHash: string;
  abiPath: string;
}

export interface DeploymentManifest {
  version: 1;
  launchId: string;
  chainId: number;
  sourceCommit: string;
  attestationHash: string;
  contracts: ManifestContract[];
  assets: { path: string; sha256: string }[];
  poolKey?: PoolKey;
  network?: NetworkBlock;
  walletAddChain?: WalletAddChain;
}

/** Everything the app needs, resolved from the manifest at startup. */
export interface AppConfig {
  manifest: DeploymentManifest;
  chain: Chain;
  game: { address: Address; abi: Abi };
  token: { address: Address; abi: Abi; symbol: string; decimals: number };
  network: NetworkBlock | null;
  walletAddChain: WalletAddChain | null;
  poolKey: PoolKey | null;
  explorer: string;
  /** Optional public WalletConnect project id (build-time, see README). */
  walletConnectProjectId: string | null;
}

export const MANIFEST_PATH = './imd-deployment.json';

/** Contract names as recorded in the deployment handoff. */
export const GAME_CONTRACT = 'CatWars';
export const TOKEN_CONTRACT = 'LaunchToken';
export const TOKEN_SYMBOL = 'MEOW';
export const TOKEN_DECIMALS = 18;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return (await res.json()) as T;
}

function assertManifest(m: DeploymentManifest): void {
  if (m.version !== 1) throw new Error('Unsupported deployment manifest version');
  if (!Number.isInteger(m.chainId)) throw new Error('Deployment manifest has no chainId');
  if (!Array.isArray(m.contracts) || m.contracts.length === 0) throw new Error('Deployment manifest lists no contracts');
  for (const c of m.contracts) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(c.address)) throw new Error(`Bad address for ${c.name}`);
    if (c.abiPath.startsWith('/') || c.abiPath.includes('..') || /^[a-z]+:/i.test(c.abiPath)) {
      throw new Error(`abiPath for ${c.name} must be relative to the export`);
    }
  }
}

export async function loadConfig(): Promise<AppConfig> {
  const manifest = await fetchJson<DeploymentManifest>(MANIFEST_PATH);
  assertManifest(manifest);
  const gameEntry = manifest.contracts.find((c) => c.name === GAME_CONTRACT);
  const tokenEntry = manifest.contracts.find((c) => c.name === TOKEN_CONTRACT);
  if (!gameEntry) throw new Error(`Deployment manifest has no ${GAME_CONTRACT} contract`);
  if (!tokenEntry) throw new Error(`Deployment manifest has no ${TOKEN_CONTRACT} contract`);
  const [gameAbi, tokenAbi] = await Promise.all([
    fetchJson<Abi>('./' + gameEntry.abiPath),
    fetchJson<Abi>('./' + tokenEntry.abiPath),
  ]);
  const network = manifest.network ?? null;
  const rpcUrls = network?.rpcUrls?.length ? network.rpcUrls : [];
  if (rpcUrls.length === 0) throw new Error('Deployment manifest has no public RPC URLs');
  const explorer = network?.explorer ?? '';
  const chain = defineChain({
    id: manifest.chainId,
    name: network?.name ?? `Chain ${manifest.chainId}`,
    testnet: network?.testnet ?? true,
    nativeCurrency: network?.nativeCurrency ?? { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: rpcUrls } },
    blockExplorers: explorer ? { default: { name: 'Explorer', url: explorer } } : undefined,
  });
  const walletConnectProjectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim() || null;
  return {
    manifest,
    chain,
    game: { address: gameEntry.address, abi: gameAbi },
    token: { address: tokenEntry.address, abi: tokenAbi, symbol: TOKEN_SYMBOL, decimals: TOKEN_DECIMALS },
    network,
    walletAddChain: manifest.walletAddChain ?? null,
    poolKey: manifest.poolKey ?? null,
    explorer,
    walletConnectProjectId,
  };
}

/** wagmi config: injected (EIP-6963 / window.ethereum) wallets, reads through the public RPC list. */
export function buildWagmiConfig(cfg: AppConfig): Config {
  const transports = cfg.chain.rpcUrls.default.http.map((u) => http(u, { batch: true, timeout: 15_000 }));
  return createConfig({
    chains: [cfg.chain],
    connectors: [injected({ shimDisconnect: true })],
    multiInjectedProviderDiscovery: true,
    transports: { [cfg.chain.id]: fallback(transports, { rank: false }) },
    pollingInterval: 4_000,
  });
}

/* ---------- Minimal interface ABIs for chain-wide contracts (addresses come from the manifest's network block) ---------- */

export const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 's', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const;

export const permit2Abi = [
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }, { name: 'token', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }],
  },
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }],
    outputs: [],
  },
] as const;

const poolKeyComponents = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'tickSpacing', type: 'int24' },
  { name: 'hooks', type: 'address' },
] as const;

export const quoterAbi = [
  {
    type: 'function', name: 'quoteExactInputSingle', stateMutability: 'nonpayable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'poolKey', type: 'tuple', components: poolKeyComponents },
        { name: 'zeroForOne', type: 'bool' },
        { name: 'exactAmount', type: 'uint128' },
        { name: 'hookData', type: 'bytes' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }, { name: 'gasEstimate', type: 'uint256' }],
  },
] as const;

export const universalRouterAbi = [
  {
    type: 'function', name: 'execute', stateMutability: 'payable',
    inputs: [{ name: 'commands', type: 'bytes' }, { name: 'inputs', type: 'bytes[]' }, { name: 'deadline', type: 'uint256' }],
    outputs: [],
  },
] as const;

export const stateViewAbi = [
  {
    type: 'function', name: 'getSlot0', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
  },
  {
    type: 'function', name: 'getLiquidity', stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
] as const;
