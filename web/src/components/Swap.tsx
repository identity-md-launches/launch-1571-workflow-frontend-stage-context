import { useEffect, useMemo, useState } from 'react';
import { useAccount, useBalance, usePublicClient, useReadContract } from 'wagmi';
import { parseEther } from 'viem';
import { erc20Abi, permit2Abi, quoterAbi, stateViewAbi, universalRouterAbi } from '../config';
import { POLL_MS, useConfig, useTx } from '../hooks';
import { applySlippage, buildSwap, poolId, priceFromSqrtX96, ZERO_ADDRESS } from '../lib/swap';
import { describeError } from '../lib/errors';
import { fmtEth, fmtUnits } from '../lib/format';
import { AddressLink, Panel } from './common';

const MAX_UINT160 = (1n << 160n) - 1n;
const MAX_UINT256 = (1n << 256n) - 1n;

/** ETH <-> MEOW through the launch's Uniswap v4 pool, using only addresses from the manifest's network block. */
export function Swap() {
  const cfg = useConfig();
  const client = usePublicClient();
  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === cfg.chain.id;
  const [dir, setDir] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('0.01');
  const [slippage, setSlippage] = useState('1');
  const [quote, setQuote] = useState<{ out: bigint; forAmount: bigint } | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const approve1 = useTx();
  const approve2 = useTx();
  const swap = useTx();

  const uni = cfg.network?.uniswapV4;
  const key = cfg.poolKey;
  const enabled = !!uni && !!key;
  const id = useMemo(() => (key ? poolId(key) : null), [key]);

  const slot0 = useReadContract({
    address: uni?.stateView, abi: stateViewAbi, functionName: 'getSlot0', args: id ? [id] : undefined,
    query: { enabled: enabled && !!id, refetchInterval: POLL_MS * 3 },
  });
  const sqrtPrice = slot0.data ? (slot0.data as readonly [bigint, number, number, number])[0] : null;
  const initialized = sqrtPrice !== null && sqrtPrice !== 0n;
  const tokenIsCurrency1 = key ? key.currency1.toLowerCase() === cfg.token.address.toLowerCase() : true;
  // price of MEOW in ETH: currency1 per currency0 when token is currency1 means ETH per... compute MEOW per ETH explicitly
  const meowPerEth = sqrtPrice && initialized ? (tokenIsCurrency1 ? priceFromSqrtX96(sqrtPrice) : 1 / priceFromSqrtX96(sqrtPrice)) : null;

  const ethBal = useBalance({ address, chainId: cfg.chain.id, query: { enabled: !!address, refetchInterval: 8000 } });
  const meowBal = useReadContract({ address: cfg.token.address, abi: erc20Abi, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address, refetchInterval: 8000 } });
  const tokenAllowance = useReadContract({ address: cfg.token.address, abi: erc20Abi, functionName: 'allowance', args: address && uni ? [address, uni.permit2] : undefined, query: { enabled: !!address && enabled && dir === 'sell', refetchInterval: POLL_MS } });
  const p2Allowance = useReadContract({ address: uni?.permit2, abi: permit2Abi, functionName: 'allowance', args: address && uni ? [address, cfg.token.address, uni.universalRouter] : undefined, query: { enabled: !!address && enabled && dir === 'sell', refetchInterval: POLL_MS } });

  const amountIn = useMemo(() => { try { const v = parseEther(amount as `${number}`); return v > 0n ? v : null; } catch { return null; } }, [amount]);
  const slipBps = Math.min(5000, Math.max(0, Math.round(Number(slippage || '0') * 100)));
  const inputCurrency = dir === 'buy' ? ZERO_ADDRESS : cfg.token.address;

  useEffect(() => {
    if (!enabled || !initialized || !amountIn || !key || !uni || !client) { setQuote(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        setQuoteErr(null);
        const zeroForOne = key.currency0.toLowerCase() === inputCurrency.toLowerCase();
        const { result } = await client.simulateContract({
          address: uni.quoter, abi: quoterAbi, functionName: 'quoteExactInputSingle',
          args: [{ poolKey: key, zeroForOne, exactAmount: amountIn, hookData: '0x' }],
        });
        if (alive) setQuote({ out: result[0], forAmount: amountIn });
      } catch (e) {
        if (alive) { setQuote(null); setQuoteErr(describeError(e)); }
      }
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [enabled, initialized, amountIn, key, uni, client, inputCurrency]);

  if (!enabled) {
    return (
      <Panel title={`Trade ${cfg.token.symbol}`} id="swap">
        <p className="hint">Trading is disabled: this build has no vetted network table with Uniswap addresses{key ? '' : ' or no pool key'}. The token is {cfg.token.symbol} at <AddressLink address={cfg.token.address} />.</p>
      </Panel>
    );
  }

  const minOut = quote ? applySlippage(quote.out, slipBps) : null;
  const plan = key && amountIn && minOut !== null ? buildSwap({ poolKey: key, inputCurrency, amountIn, amountOutMinimum: minOut, extendedSwapParams: uni!.extendedSwapParams }) : null;
  const needTokenApproval = dir === 'sell' && amountIn !== null && (tokenAllowance.data as bigint | undefined) !== undefined && (tokenAllowance.data as bigint) < amountIn;
  const p2 = p2Allowance.data as readonly [bigint, number, number] | undefined;
  const nowSec = Math.floor(Date.now() / 1000);
  const needPermit2 = dir === 'sell' && amountIn !== null && p2 !== undefined && (p2[0] < amountIn || Number(p2[1]) <= nowSec);
  const balance = dir === 'buy' ? ethBal.data?.value : (meowBal.data as bigint | undefined);
  const insufficient = amountIn !== null && balance !== undefined && balance < amountIn;
  const busy = approve1.busy || approve2.busy || swap.busy;

  const step: 'connect' | 'network' | 'approve-token' | 'approve-permit2' | 'swap' =
    !isConnected ? 'connect' : !onChain ? 'network' : needTokenApproval ? 'approve-token' : needPermit2 ? 'approve-permit2' : 'swap';

  const doApproveToken = () => approve1.run({ address: cfg.token.address, abi: erc20Abi, functionName: 'approve', args: [uni!.permit2, MAX_UINT256] });
  const doApprovePermit2 = () => approve2.run({ address: uni!.permit2, abi: permit2Abi, functionName: 'approve', args: [cfg.token.address, uni!.universalRouter, MAX_UINT160, nowSec + 30 * 24 * 3600] });
  const doSwap = () => swap.run({
    address: uni!.universalRouter, abi: universalRouterAbi, functionName: 'execute',
    args: [plan!.commands, plan!.inputs, BigInt(nowSec + 20 * 60)], value: plan!.value,
  });

  return (
    <Panel title={`Trade ${cfg.token.symbol}`} id="swap" aside={<span className="hint">Uniswap v4, {(key!.fee / 10000).toFixed(2)}% fee</span>}>
      <div className="swap-dir" role="group" aria-label="Direction">
        <button type="button" className={`chip ${dir === 'buy' ? 'chip-on' : ''}`} onClick={() => setDir('buy')} aria-pressed={dir === 'buy'}>Buy {cfg.token.symbol} with ETH</button>
        <button type="button" className={`chip ${dir === 'sell' ? 'chip-on' : ''}`} onClick={() => setDir('sell')} aria-pressed={dir === 'sell'}>Sell {cfg.token.symbol} for ETH</button>
      </div>
      <div className="bet-row">
        <label className="field">
          <span>You pay ({dir === 'buy' ? 'ETH' : cfg.token.symbol})</span>
          <input type="text" inputMode="decimal" className="num" value={amount} onChange={(e) => setAmount(e.target.value.trim())} />
        </label>
        <label className="field field-sm">
          <span>Slippage %</span>
          <input type="text" inputMode="decimal" className="num" value={slippage} onChange={(e) => setSlippage(e.target.value.trim())} />
        </label>
      </div>
      <dl className="swap-info">
        <div><dt>Balance</dt><dd className="num">{balance === undefined ? '—' : dir === 'buy' ? fmtEth(balance, 5) : `${fmtUnits(balance, cfg.token.decimals, 2)} ${cfg.token.symbol}`}</dd></div>
        <div><dt>Pool price</dt><dd className="num">{meowPerEth === null ? (slot0.isLoading ? '…' : 'pool not initialized') : `${meowPerEth.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${cfg.token.symbol} per ETH`}</dd></div>
        <div><dt>You receive</dt><dd className="num">{quote ? (dir === 'buy' ? `${fmtUnits(quote.out, cfg.token.decimals, 2)} ${cfg.token.symbol}` : fmtEth(quote.out, 6)) : '—'}</dd></div>
        <div><dt>Minimum after slippage</dt><dd className="num">{minOut !== null ? (dir === 'buy' ? `${fmtUnits(minOut, cfg.token.decimals, 2)} ${cfg.token.symbol}` : fmtEth(minOut, 6)) : '—'}</dd></div>
      </dl>
      {quoteErr && <p className="tx tx-error" role="alert">Quote failed: {quoteErr}</p>}
      {insufficient && <p className="tx tx-error" role="alert">Your balance is lower than this amount.</p>}
      {!initialized && !slot0.isLoading && <p className="hint">The pool has no price yet, so swaps are disabled until liquidity is added.</p>}
      <div className="swap-action">
        {step === 'connect' && <p className="hint">Connect a wallet to trade.</p>}
        {step === 'network' && <p className="hint">Switch to {cfg.chain.name} to trade.</p>}
        {step === 'approve-token' && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={doApproveToken}>{approve1.busy ? 'Approving…' : `Step 1 of 3: approve ${cfg.token.symbol} for Permit2`}</button>
        )}
        {step === 'approve-permit2' && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={doApprovePermit2}>{approve2.busy ? 'Approving…' : 'Step 2 of 3: allow the router on Permit2'}</button>
        )}
        {step === 'swap' && (
          <button type="button" className="btn btn-primary" disabled={busy || !plan || !initialized || insufficient} onClick={doSwap}>
            {swap.busy ? 'Swapping…' : dir === 'sell' ? 'Step 3 of 3: swap' : 'Swap'}
          </button>
        )}
        {dir === 'sell' && step !== 'connect' && step !== 'network' && <p className="hint">Selling needs two approvals once (token to Permit2, then Permit2 to the router), then the swap.</p>}
        <p className="hint">The swap is simulated before your wallet asks you to sign. MEOW does not pay game stakes or VRF fees. USD values are not shown; no price source is configured. {cfg.token.symbol} <AddressLink address={cfg.token.address} /></p>
      </div>
      {approve1.state.phase !== 'idle' && <p className={`tx ${approve1.state.phase === 'error' ? 'tx-error' : 'tx-pending'}`}>{approve1.state.phase === 'confirmed' ? 'Token approval confirmed.' : approve1.state.error ?? 'Approving token…'}</p>}
      {approve2.state.phase !== 'idle' && <p className={`tx ${approve2.state.phase === 'error' ? 'tx-error' : 'tx-pending'}`}>{approve2.state.phase === 'confirmed' ? 'Permit2 allowance confirmed.' : approve2.state.error ?? 'Approving on Permit2…'}</p>}
      {swap.state.phase !== 'idle' && <p className={`tx ${swap.state.phase === 'error' ? 'tx-error' : swap.state.phase === 'confirmed' ? 'tx-ok' : 'tx-pending'}`}>{swap.state.phase === 'confirmed' ? 'Swap confirmed.' : swap.state.error ?? 'Swap in progress…'}</p>}
    </Panel>
  );
}
