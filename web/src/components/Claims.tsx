import { useAccount } from 'wagmi';
import { useBets, useConfig, useOwed, useRounds, useTx } from '../hooks';
import { CATS, displayName } from '../lib/engine';
import { claimable, isTerminal, pool, Status, type Round } from '../lib/game';
import { fmtEth } from '../lib/format';
import { Panel, TxStatus } from './common';

const SIDE_NAME = ['Red', 'Blue'] as const;

function ClaimRow({ round, amount }: { round: Round; amount: bigint }) {
  const cfg = useConfig();
  const tx = useTx();
  const { chainId, isConnected } = useAccount();
  const onChain = isConnected && chainId === cfg.chain.id;
  return (
    <li className="claim-row">
      <span>Round {String(round.id)}: {round.status === Status.Cancelled ? 'refund' : `${SIDE_NAME[round.winner]} ${displayName(CATS[round.winner === 0 ? round.catA : round.catB].name)} won`}</span>
      <button type="button" className="btn btn-primary" disabled={!onChain || tx.busy} onClick={() => tx.run({ address: cfg.game.address, abi: cfg.game.abi, functionName: 'claim', args: [round.id] })}>
        {tx.busy ? 'Claiming…' : `Claim ${fmtEth(amount, 6)}`}
      </button>
      <TxStatus state={tx.state} label="claim" />
    </li>
  );
}

/** Unclaimed winnings and refunds across past rounds plus the `owed` credit. */
export function Claims({ ids }: { ids: bigint[] }) {
  const cfg = useConfig();
  const { address, chainId, isConnected } = useAccount();
  const onChain = isConnected && chainId === cfg.chain.id;
  const { rounds } = useRounds(ids);
  const bets = useBets(ids, address);
  const { owed } = useOwed(address);
  const withdraw = useTx();

  const rows = rounds
    .filter((r) => isTerminal(r.status))
    .map((r) => ({ round: r, bet: bets.get(r.id) }))
    .filter((x) => x.bet && claimable(x.round, x.bet))
    .map((x) => {
      const b = x.bet!;
      const r = x.round;
      const amount = r.status === Status.Cancelled ? b.amount : (b.amount * (pool(r) - r.rake)) / (r.winner === 0 ? r.total0 : r.total1);
      return { round: r, amount };
    });

  return (
    <Panel title="Your winnings and refunds" id="claims">
      {!address && <p className="hint">Connect a wallet to see unclaimed winnings, refunds and credit.</p>}
      {address && rows.length === 0 && <p className="hint">Nothing to claim across the last {ids.length} rounds.</p>}
      {rows.length > 0 && <ul className="claims">{rows.map((x) => <ClaimRow key={String(x.round.id)} round={x.round} amount={x.amount} />)}</ul>}
      {address && owed !== null && (
        <div className="owed">
          <p>Credit held for you: <b className="num">{fmtEth(owed, 6)}</b>. {owed > 0n ? 'A payment to you could not be delivered; withdraw it here.' : 'Payments that cannot be delivered are credited here.'}</p>
          {owed > 0n && (
            <>
              <button type="button" className="btn" disabled={!onChain || withdraw.busy} onClick={() => withdraw.run({ address: cfg.game.address, abi: cfg.game.abi, functionName: 'withdraw' })}>
                {withdraw.busy ? 'Withdrawing…' : `Withdraw ${fmtEth(owed, 6)}`}
              </button>
              <TxStatus state={withdraw.state} label="withdrawal" />
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
