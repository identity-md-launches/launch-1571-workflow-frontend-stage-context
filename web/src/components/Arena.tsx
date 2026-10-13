import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { parseEther } from 'viem';
import { useBackers, useBet, useChainNow, useConfig, useTx, useVrfQuote, type GameSettings } from '../hooks';
import { CATS, CAT_ART, RARITY_COLOR, displayName } from '../lib/engine';
import { claimable, estimatedRake, multiplier, pool, poolShares, projectedPayout, publicCancelAllowed, Status, STATUS_LABEL, type Round } from '../lib/game';
import { fmtCountdown, fmtEth, fmtMultiplier, fmtPct, fmtTime, shortAddr } from '../lib/format';
import { AddressLink, Notice, Portrait, TxStatus } from './common';

const CHIPS = ['0.001', '0.005', '0.01', '0.05'];
const SIDE_NAME = ['Red', 'Blue'] as const;

export function CatCard({ catId, side, round, compact }: { catId: number; side: 0 | 1; round: Round | null; compact?: boolean }) {
  const cat = CATS[catId];
  const art = CAT_ART[cat.name];
  const shares = round ? poolShares(round) : [50, 50];
  const mult = round ? multiplier(round, side) : null;
  return (
    <div className={`cat side-${side}`}>
      <div className="cat-top">
        <Portrait name={cat.name} uid={`arena${side}`} />
        <div className="cat-id">
          <p className="cat-side">{SIDE_NAME[side]}</p>
          <h3 className="cat-name">{displayName(cat.name)}</h3>
          <p className="cat-title">{cat.title}</p>
          <p className="cat-tag"><span style={{ color: RARITY_COLOR[art.rarity] }}>{art.rarity.charAt(0) + art.rarity.slice(1).toLowerCase()}</span> {art.token}</p>
        </div>
      </div>
      {round && (
        <dl className="odds">
          <div><dt>Pool share</dt><dd>{shares[side]}%</dd></div>
          <div><dt>Payout</dt><dd className="num">{fmtMultiplier(mult)}</dd></div>
          <div><dt>Backers</dt><dd className="num">{String(side === 0 ? round.bettors0 : round.bettors1)}</dd></div>
        </dl>
      )}
      {!compact && (
        <details className="cat-details">
          <summary>Stats and skills</summary>
          <dl className="stats">
            <div><dt>HP</dt><dd className="num">{cat.hp}</dd></div>
            <div><dt>Attack</dt><dd className="num">{cat.atk}</dd></div>
            <div><dt>Defense</dt><dd className="num">{cat.def}</dd></div>
            <div><dt>Speed</dt><dd className="num">{cat.spd}</dd></div>
          </dl>
          <ul className="skills">
            {cat.skills.map((s) => (
              <li key={s.name}><span className="skill-name">{s.name}</span> <span className="skill-desc">{s.desc}, cooldown {s.cd}</span></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function TimerRing({ round, now }: { round: Round; now: number }) {
  const lock = Number(round.lockAt);
  const remaining = Math.max(0, lock - now);
  const open = round.status === Status.Open && remaining > 0;
  const label = open ? fmtCountdown(remaining) : round.status === Status.Open ? 'Locked' : STATUS_LABEL[round.status];
  return (
    <div className="timer" role="timer" aria-live="off" aria-label={open ? `Betting closes in ${fmtCountdown(remaining)}` : label}>
      <span className={`timer-num num ${open ? '' : 'timer-text'}`}>{label}</span>
      <span className="timer-sub">{open ? 'until lock' : `Round ${String(round.id)}`}</span>
    </div>
  );
}

function TugBar({ round }: { round: Round }) {
  const [s0] = poolShares(round);
  return (
    <div className="tug" role="img" aria-label={`RED holds ${s0}% of the pool`}>
      <span className="tug-0" style={{ width: `${s0}%` }} />
    </div>
  );
}

export function Arena({ round, settings, roundError, onReplay }: { round: Round | null; settings: GameSettings | null; roundError: Error | null; onReplay: (r: Round) => void }) {
  const cfg = useConfig();
  const now = useChainNow();
  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === cfg.chain.id;

  if (!settings && !roundError) {
    return <section className="arena arena-empty" aria-busy="true"><p className="hint">Loading the arena from {cfg.chain.name}…</p></section>;
  }
  if (roundError && !round) {
    return <section className="arena arena-empty"><Notice kind="error">Could not read the game contract: {roundError.message.split('\n')[0]}</Notice></section>;
  }
  if (!round) {
    return (
      <section className="arena arena-empty" id="arena">
        <h1 className="headline">Back a cat. Win the pot.</h1>
        <p className="lede">Bet ETH on Red or Blue. The fight is decided on chain by Chainlink VRF; winners split the pot.</p>
        <p className="hint">No fight is open yet. This page updates when the keeper opens one.</p>
        <ul className="roster">
          {CATS.map((c, i) => (
            <li key={c.name}><Portrait name={c.name} uid={`roster${i}`} /><span>{displayName(c.name)}</span></li>
          ))}
        </ul>
      </section>
    );
  }

  const remaining = Math.max(0, Number(round.lockAt) - now);
  const bettingOpen = round.status === Status.Open && remaining > 0;
  const p = pool(round);

  return (
    <section className="arena" id="arena" aria-label={`Round ${String(round.id)}`}>
      <div className="arena-grid">
        <CatCard catId={round.catA} side={0} round={round} />
        <div className="center">
          <TimerRing round={round} now={now} />
          <p className="pot"><span className="pot-label">Pot</span> <span className="num pot-num">{fmtEth(p)}</span></p>
          <TugBar round={round} />
          <p className={`status status-${round.status}`}>{STATUS_LABEL[round.status]}</p>
        </div>
        <CatCard catId={round.catB} side={1} round={round} />
      </div>
      <BetPanel round={round} settings={settings!} bettingOpen={bettingOpen} onChain={onChain} player={address} />
      <RoundActions round={round} settings={settings!} now={now} onChain={onChain} player={address} onReplay={onReplay} />
    </section>
  );
}

function BetPanel({ round, settings, bettingOpen, onChain, player }: { round: Round; settings: GameSettings; bettingOpen: boolean; onChain: boolean; player?: `0x${string}` }) {
  const [amount, setAmount] = useState('0.01');
  const [side, setSide] = useState<0 | 1 | null>(null);
  const tx = useTx();
  const cfg = useConfig();
  const { bet } = useBet(round.id, player);
  const parsed = useMemo(() => { try { return parseEther(amount as `${number}`); } catch { return null; } }, [amount]);
  const belowMin = parsed !== null && parsed < settings.minBet;
  const lockedSide = bet && bet.amount > 0n ? (bet.side as 0 | 1) : null;
  useEffect(() => { if (lockedSide !== null) setSide(lockedSide); }, [lockedSide]);
  const chosen = lockedSide ?? side;
  const projected = parsed && chosen !== null ? projectedPayout(round, chosen, parsed) : null;

  const reason = !bettingOpen
    ? round.status === Status.Open ? 'Betting is locked. The result can be requested now.' : `This round is ${STATUS_LABEL[round.status].toLowerCase()}.`
    : !player ? 'Connect a wallet to place a bet.'
    : !onChain ? `Switch your wallet to ${cfg.chain.name} to bet.`
    : parsed === null ? 'Enter an ETH amount.'
    : belowMin ? `Minimum bet is ${fmtEth(settings.minBet, 6)}.`
    : null;
  const canBet = reason === null && !tx.busy;

  const place = async (s: 0 | 1) => {
    setSide(s);
    if (!canBet || parsed === null) return;
    await tx.run({ address: cfg.game.address, abi: cfg.game.abi, functionName: 'placeBet', args: [round.id, s], value: parsed });
  };

  return (
    <div className="bet" id="bet">
      <div className="bet-row">
        <label className="field">
          <span>Bet amount (ETH)</span>
          <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.trim())} aria-describedby="bet-help" className="num" />
        </label>
        <div className="chips" role="group" aria-label="Quick amounts">
          {CHIPS.map((c) => (
            <button key={c} type="button" className={`chip ${amount === c ? 'chip-on' : ''}`} onClick={() => setAmount(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className="bet-sides">
        <button type="button" className="btn btn-red" disabled={!canBet || lockedSide === 1} onClick={() => place(0)} aria-pressed={chosen === 0}>
          {tx.busy && side === 0 ? 'Betting…' : `Back ${SIDE_NAME[0]} ${displayName(CATS[round.catA].name)}`}
        </button>
        <button type="button" className="btn btn-blue" disabled={!canBet || lockedSide === 0} onClick={() => place(1)} aria-pressed={chosen === 1}>
          {tx.busy && side === 1 ? 'Betting…' : `Back ${SIDE_NAME[1]} ${displayName(CATS[round.catB].name)}`}
        </button>
      </div>
      <p id="bet-help" className="hint">
        {reason ?? (projected !== null && chosen !== null
          ? `If ${SIDE_NAME[chosen]} wins with the pool as it stands, ${fmtEth(parsed!, 6)} returns about ${fmtEth(projected, 6)} after the ${fmtPct(round.rakeBps)} rake. Later bets change this.`
          : `Minimum ${fmtEth(settings.minBet, 6)}. Pick a side; you cannot switch sides in a round. Rake ${fmtPct(round.rakeBps)} of the pot.`)}
      </p>
      {bet && bet.amount > 0n && (
        <p className="mine">Your bet: <b className="num">{fmtEth(bet.amount, 6)}</b> on {SIDE_NAME[bet.side]}{bet.claimed ? ', claimed' : ''}.</p>
      )}
      <TxStatus state={tx.state} label="bet" />
    </div>
  );
}

function RoundActions({ round, settings, now, onChain, player, onReplay }: { round: Round; settings: GameSettings; now: number; onChain: boolean; player?: `0x${string}`; onReplay: (r: Round) => void }) {
  const cfg = useConfig();
  const request = useTx();
  const settle = useTx();
  const cancel = useTx();
  const claim = useTx();
  const { bet } = useBet(round.id, player);
  const backers = useBackers(round.id);
  const nowB = BigInt(now);
  const lockPassed = nowB >= round.lockAt;
  const canRequest = round.status === Status.Open && lockPassed;
  const oneSided = round.total0 === 0n || round.total1 === 0n;
  const vrf = useVrfQuote(canRequest && !oneSided);
  const isAdmin = !!player && (player.toLowerCase() === settings.owner.toLowerCase() || player.toLowerCase() === settings.keeper.toLowerCase());
  const canCancel = (round.status === Status.Open && isAdmin) || publicCancelAllowed(round, nowB);
  const myClaim = bet ? claimable(round, bet) : false;
  const payout = bet && round.status === Status.Settled ? (bet.amount * (pool(round) - round.rake)) / (round.winner === 0 ? round.total0 : round.total1) : bet?.amount ?? 0n;

  return (
    <div className="actions">
      {round.status === Status.Open && !lockPassed && (
        <p className="hint">Betting locks at {fmtTime(Number(round.lockAt))}. After that anyone can request the result.</p>
      )}
      {canRequest && (
        <div className="action">
          <button type="button" className="btn" disabled={!onChain || request.busy || (!oneSided && !vrf.data)} onClick={() =>
            request.run({ address: cfg.game.address, abi: cfg.game.abi, functionName: 'requestResult', args: [round.id], value: oneSided ? 0n : vrf.data!.suggested })}>
            {request.busy ? 'Requesting…' : oneSided ? 'Close round and refund' : 'Request the fight result'}
          </button>
          <p className="hint">
            {oneSided
              ? 'Only one side has bets, so the round is cancelled and every stake is refunded. No randomness fee is needed.'
              : vrf.data
                ? `You pay the Chainlink VRF fee of about ${fmtEth(vrf.data.price, 5)} (sending ${fmtEth(vrf.data.suggested, 5)}; the excess is returned). Stakes never pay it.`
                : vrf.error ? 'Could not quote the randomness fee right now.' : 'Quoting the randomness fee…'}
            {!onChain && ' Connect on the right network to send it.'}
          </p>
          <TxStatus state={request.state} label="request" />
        </div>
      )}
      {round.status === Status.Requested && (
        <p className="hint">Randomness requested at {fmtTime(Number(round.requestedAt))}. Chainlink delivers the word after three confirmations; then anyone can settle.</p>
      )}
      {round.status === Status.Fulfilled && (
        <div className="action">
          <button type="button" className="btn btn-primary" disabled={!onChain || settle.busy} onClick={() => settle.run({ address: cfg.game.address, abi: cfg.game.abi, functionName: 'settle', args: [round.id] })}>
            {settle.busy ? 'Settling…' : 'Settle the fight'}
          </button>
          <p className="hint">The random word has arrived. Settling runs the fight on chain and unlocks claims.{!onChain && ' Connect on the right network to send it.'}</p>
          <TxStatus state={settle.state} label="settlement" />
        </div>
      )}
      {round.status === Status.Settled && (
        <div className="action result-line">
          <p>
            <b>{SIDE_NAME[round.winner]} {displayName(CATS[round.winner === 0 ? round.catA : round.catB].name)}</b> won in {round.turns} turns.
            Pool {fmtEth(pool(round))}, rake {fmtEth(round.rake, 6)}.
          </p>
          <button type="button" className="btn" onClick={() => onReplay(round)}>Watch the replay</button>
        </div>
      )}
      {round.status === Status.Cancelled && <p className="hint">This round was cancelled. Every stake can be refunded below.</p>}
      {myClaim && (
        <div className="action">
          <button type="button" className="btn btn-primary" disabled={!onChain || claim.busy} onClick={() => claim.run({ address: cfg.game.address, abi: cfg.game.abi, functionName: 'claim', args: [round.id] })}>
            {claim.busy ? 'Claiming…' : round.status === Status.Cancelled ? `Refund ${fmtEth(bet!.amount, 6)}` : `Claim ${fmtEth(payout, 6)}`}
          </button>
          <TxStatus state={claim.state} label="claim" />
        </div>
      )}
      {canCancel && (
        <div className="action">
          <button type="button" className="btn btn-ghost" disabled={!onChain || cancel.busy} onClick={() => cancel.run({ address: cfg.game.address, abi: cfg.game.abi, functionName: 'cancelRound', args: [round.id] })}>
            {cancel.busy ? 'Cancelling…' : 'Cancel round and refund stakes'}
          </button>
          <p className="hint">{round.status === Status.Open && isAdmin ? 'Owner or keeper may cancel an open round at any time.' : 'The timeout has passed, so anyone may cancel this round.'}</p>
          <TxStatus state={cancel.state} label="cancellation" />
        </div>
      )}
      <div className="backers">
        <h3>Backers</h3>
        {backers.isLoading && <p className="hint">Loading bets…</p>}
        {backers.data && backers.data.backers.length === 0 && <p className="hint">No bets yet{backers.data.partial ? ' (recent blocks only)' : ''}.</p>}
        {backers.data && backers.data.backers.length > 0 && (
          <ul className="backer-list">
            {backers.data.backers.map((b) => (
              <li key={b.player} className={`backer side-${b.side}`}>
                <span className="dot" aria-hidden="true" />
                <span className="backer-side">{SIDE_NAME[b.side]}</span>
                <span className="mono">{player && b.player.toLowerCase() === player.toLowerCase() ? 'You' : shortAddr(b.player)}</span>
                <span className="num">{fmtEth(b.amount, 5)}</span>
              </li>
            ))}
          </ul>
        )}
        {backers.data?.partial && backers.data.backers.length > 0 && <p className="hint">Showing bets from recent blocks only; totals above are exact.</p>}
        <p className="hint">Estimated rake now {fmtEth(estimatedRake(round), 6)}. Contract <AddressLink address={cfg.game.address} /></p>
      </div>
    </div>
  );
}
