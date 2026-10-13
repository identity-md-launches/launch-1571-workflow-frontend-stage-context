import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount, useConnectorClient, usePublicClient, useReadContract, useReadContracts, useConfig as useWagmiConfig } from 'wagmi';
import { getConnectorClient } from 'wagmi/actions';
import { writeContract } from 'viem/actions';
import { encodeFunctionData, decodeFunctionResult, type Abi, type Address, type Hex, type Log } from 'viem';
import type { AppConfig } from './config';
import { decodeBet, decodeRound, type Bet, type Round } from './lib/game';
import { describeError } from './lib/errors';
import { switchOrAddChain } from './lib/chain';

export const ConfigContext = createContext<AppConfig | null>(null);
export function useConfig(): AppConfig {
  const c = useContext(ConfigContext);
  if (!c) throw new Error('ConfigContext missing');
  return c;
}

export const POLL_MS = 4000;

/** Chain time in seconds, driven by the latest block and advanced locally between polls. */
export function useChainNow(): number {
  const client = usePublicClient();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const offset = useRef(0);
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      try {
        const b = await client!.getBlock({ blockTag: 'latest' });
        if (alive) offset.current = Number(b.timestamp) - Math.floor(Date.now() / 1000);
      } catch { /* keep local clock */ }
    };
    void sync();
    const s = setInterval(sync, 12_000);
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000) + offset.current), 1000);
    return () => { alive = false; clearInterval(s); clearInterval(t); };
  }, [client]);
  return now;
}

export interface GameSettings {
  roundCount: bigint;
  minBet: bigint;
  rakeBps: number;
  bettingDuration: bigint;
  paused: boolean;
  owner: Address;
  keeper: Address;
  treasury: Address;
}

export function useGameSettings() {
  const cfg = useConfig();
  const base = { address: cfg.game.address, abi: cfg.game.abi } as const;
  const q = useReadContracts({
    contracts: [
      { ...base, functionName: 'roundCount' },
      { ...base, functionName: 'minBet' },
      { ...base, functionName: 'rakeBps' },
      { ...base, functionName: 'bettingDuration' },
      { ...base, functionName: 'paused' },
      { ...base, functionName: 'owner' },
      { ...base, functionName: 'keeper' },
      { ...base, functionName: 'treasury' },
    ],
    query: { refetchInterval: POLL_MS },
  });
  const d = q.data;
  const ok = d && d.every((r) => r.status === 'success');
  const settings: GameSettings | null = ok
    ? {
        roundCount: d[0].result as bigint,
        minBet: d[1].result as bigint,
        rakeBps: Number(d[2].result),
        bettingDuration: d[3].result as bigint,
        paused: d[4].result as boolean,
        owner: d[5].result as Address,
        keeper: d[6].result as Address,
        treasury: d[7].result as Address,
      }
    : null;
  return { settings, isLoading: q.isLoading, error: q.error ?? (d && !ok ? new Error('Could not read game settings') : null), refetch: q.refetch };
}

export function useRound(id: bigint | null) {
  const cfg = useConfig();
  const q = useReadContract({
    address: cfg.game.address,
    abi: cfg.game.abi,
    functionName: 'getRound',
    args: id === null ? undefined : [id],
    query: { enabled: id !== null, refetchInterval: POLL_MS },
  });
  const round: Round | null = q.data !== undefined && id !== null ? decodeRound(id, q.data) : null;
  return { round, isLoading: q.isLoading, error: q.error, refetch: q.refetch };
}

export function useBet(id: bigint | null, player: Address | undefined) {
  const cfg = useConfig();
  const q = useReadContract({
    address: cfg.game.address,
    abi: cfg.game.abi,
    functionName: 'getBet',
    args: id !== null && player ? [id, player] : undefined,
    query: { enabled: id !== null && !!player, refetchInterval: POLL_MS },
  });
  const bet: Bet | null = q.data !== undefined ? decodeBet(q.data) : null;
  return { bet, refetch: q.refetch };
}

export function useOwed(player: Address | undefined) {
  const cfg = useConfig();
  const q = useReadContract({
    address: cfg.game.address,
    abi: cfg.game.abi,
    functionName: 'owed',
    args: player ? [player] : undefined,
    query: { enabled: !!player, refetchInterval: POLL_MS },
  });
  return { owed: (q.data as bigint | undefined) ?? null, refetch: q.refetch };
}

/** Reads a span of rounds [from, to] (inclusive) with per-call reads; small spans only. */
export function useRounds(ids: bigint[]) {
  const cfg = useConfig();
  const q = useReadContracts({
    contracts: ids.map((id) => ({ address: cfg.game.address, abi: cfg.game.abi, functionName: 'getRound', args: [id] })),
    query: { enabled: ids.length > 0, refetchInterval: POLL_MS * 3 },
  });
  const rounds: Round[] = (q.data ?? [])
    .map((r, i) => (r.status === 'success' ? decodeRound(ids[i], r.result) : null))
    .filter((r): r is Round => r !== null);
  return { rounds, isLoading: q.isLoading, error: q.error };
}

/** The connected player's bets across a list of rounds (for the claims panel). */
export function useBets(ids: bigint[], player: Address | undefined) {
  const cfg = useConfig();
  const q = useReadContracts({
    contracts: ids.map((id) => ({ address: cfg.game.address, abi: cfg.game.abi, functionName: 'getBet', args: [id, player!] })),
    query: { enabled: ids.length > 0 && !!player, refetchInterval: POLL_MS * 3 },
  });
  const bets = new Map<bigint, Bet>();
  (q.data ?? []).forEach((r, i) => { if (r.status === 'success') bets.set(ids[i], decodeBet(r.result)); });
  return bets;
}

export interface Backer { player: Address; side: number; amount: bigint }

/** Unique backers of a round from BetPlaced logs, summed per address (top-ups add). */
export function useBackers(roundId: bigint | null) {
  const cfg = useConfig();
  const client = usePublicClient();
  return useQuery({
    queryKey: ['backers', cfg.game.address, roundId?.toString()],
    enabled: roundId !== null,
    refetchInterval: POLL_MS * 2,
    queryFn: async (): Promise<{ backers: Backer[]; partial: boolean }> => {
      const event = (cfg.game.abi as Abi).find((e) => e.type === 'event' && e.name === 'BetPlaced');
      if (!event || event.type !== 'event') throw new Error('BetPlaced event missing from ABI');
      const latest = await client!.getBlockNumber();
      const attempt = async (fromBlock: bigint) =>
        client!.getLogs({ address: cfg.game.address, event, args: { roundId: roundId! }, fromBlock, toBlock: latest });
      let logs: Log[] = [];
      let partial = false;
      try {
        logs = await attempt(0n);
      } catch {
        try {
          logs = await attempt(latest > 50_000n ? latest - 50_000n : 0n);
          partial = true;
        } catch {
          return { backers: [], partial: true };
        }
      }
      const byPlayer = new Map<string, Backer>();
      for (const l of logs) {
        const a = (l as unknown as { args: { player: Address; side: number; amount: bigint } }).args;
        const key = a.player.toLowerCase();
        const prev = byPlayer.get(key);
        byPlayer.set(key, { player: a.player, side: Number(a.side), amount: (prev?.amount ?? 0n) + a.amount });
      }
      return { backers: [...byPlayer.values()], partial };
    },
  });
}

/** RoundSettled / RoundCancelled transaction hashes for history explorer links. */
export function useRoundTxHashes(ids: bigint[]) {
  const cfg = useConfig();
  const client = usePublicClient();
  return useQuery({
    queryKey: ['roundTx', cfg.game.address, ids.map(String).join(',')],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, Hex>> => {
      const abi = cfg.game.abi as Abi;
      const names = ['RoundSettled', 'RoundCancelled'];
      const out: Record<string, Hex> = {};
      const latest = await client!.getBlockNumber();
      for (const name of names) {
        const event = abi.find((e) => e.type === 'event' && e.name === name);
        if (!event || event.type !== 'event') continue;
        try {
          const logs = await client!.getLogs({ address: cfg.game.address, event, fromBlock: 0n, toBlock: latest });
          for (const l of logs) {
            const id = (l as unknown as { args: { roundId: bigint } }).args.roundId;
            if (l.transactionHash) out[id.toString()] = l.transactionHash;
          }
        } catch { /* history links fall back to the contract page */ }
      }
      return out;
    },
  });
}

/** vrfPrice() evaluated at a gas price with headroom, as the contract prices by tx.gasprice. */
export function useVrfQuote(enabled: boolean) {
  const cfg = useConfig();
  const client = usePublicClient();
  return useQuery({
    queryKey: ['vrfPrice', cfg.game.address],
    enabled,
    refetchInterval: POLL_MS * 3,
    queryFn: async () => {
      const gasPrice = await client!.getGasPrice();
      const priced = (gasPrice * 15n) / 10n; // 50% headroom for the gas price the wallet may choose
      const data = encodeFunctionData({ abi: cfg.game.abi, functionName: 'vrfPrice' });
      const res = await client!.call({ to: cfg.game.address, data, gasPrice: priced });
      const price = decodeFunctionResult({ abi: cfg.game.abi, functionName: 'vrfPrice', data: res.data ?? '0x' }) as bigint;
      return { price, gasPrice: priced, suggested: (price * 12n) / 10n }; // 20% margin; excess is refunded
    },
  });
}

export type TxPhase = 'idle' | 'simulating' | 'signing' | 'pending' | 'confirmed' | 'error';
export interface TxState { phase: TxPhase; hash?: Hex; error?: string }

/**
 * One transaction runner per button (Rule 1): simulate, ask the wallet, wait for the receipt,
 * and refresh reads. The button stays disabled until the receipt arrives.
 */
export function useTx() {
  const wagmiConfig = useWagmiConfig();
  const client = usePublicClient();
  const qc = useQueryClient();
  const [state, setState] = useState<TxState>({ phase: 'idle' });

  const run = useCallback(
    async (args: {
      address: Address; abi: Abi; functionName: string; args?: readonly unknown[]; value?: bigint;
    }): Promise<boolean> => {
      setState({ phase: 'simulating' });
      try {
        // Resolve the connected wallet at click time so a fresh connection or chain switch is honoured.
        const walletClient = await getConnectorClient(wagmiConfig).catch(() => null);
        if (!walletClient) { setState({ phase: 'error', error: 'Connect a wallet first.' }); return false; }
        const pc = client!;
        const { request } = await pc.simulateContract({
          ...args,
          account: walletClient.account,
        } as Parameters<typeof pc.simulateContract>[0]);
        setState({ phase: 'signing' });
        const hash = await writeContract(walletClient, request as Parameters<typeof writeContract>[1]);
        setState({ phase: 'pending', hash });
        const receipt = await client!.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
          setState({ phase: 'error', hash, error: 'The transaction reverted on chain.' });
          await qc.invalidateQueries();
          return false;
        }
        setState({ phase: 'confirmed', hash });
        await qc.invalidateQueries();
        return true;
      } catch (e) {
        setState({ phase: 'error', error: describeError(e) });
        return false;
      }
    },
    [wagmiConfig, client, qc],
  );
  const reset = useCallback(() => setState({ phase: 'idle' }), []);
  const busy = state.phase === 'simulating' || state.phase === 'signing' || state.phase === 'pending';
  return { state, run, reset, busy };
}

/** Wrong-network handling with wallet_addEthereumChain fallback. */
export function useNetworkSwitch() {
  const cfg = useConfig();
  const { data: connectorClient } = useConnectorClient();
  const { connector } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const switchChain = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const provider = (await connector?.getProvider()) as Parameters<typeof switchOrAddChain>[0] | undefined;
      if (!provider) throw new Error('No wallet provider available.');
      const hex = cfg.walletAddChain?.chainId ?? (`0x${cfg.chain.id.toString(16)}` as `0x${string}`);
      await switchOrAddChain(provider, hex, cfg.walletAddChain);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }, [connector, cfg, connectorClient]);
  return { switchChain, error, busy };
}
