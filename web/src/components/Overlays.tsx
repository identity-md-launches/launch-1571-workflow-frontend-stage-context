import { useEffect, useMemo, useRef, useState } from 'react';
import { useAccount } from 'wagmi';
import { useBet, useConfig, useTx } from '../hooks';
import { CATS, displayName, replayRound, type FightEvent } from '../lib/engine';
import { claimable, pool, Status, type Round } from '../lib/game';
import { fmtEth } from '../lib/format';
import { Portrait, TxStatus } from './common';

const SIDE_NAME = ['Red', 'Blue'] as const;
const STEP_MS = 900;

function useReducedMotion(): boolean {
  const [r, setR] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setR(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return r;
}

/** Fight replay followed by the result; both are one modal so focus returns once. */
export function ReplayOverlay({ round, onClose }: { round: Round; onClose: () => void }) {
  const cfg = useConfig();
  const { address, chainId, isConnected } = useAccount();
  const onChain = isConnected && chainId === cfg.chain.id;
  const reduced = useReducedMotion();
  const replay = useMemo(() => replayRound(round.catA, round.catB, round.randomWord, round.winner, round.turns), [round]);
  const events = replay.result.events;
  const [step, setStep] = useState(reduced ? events.length : 1);
  const done = step >= events.length;
  const dialogRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const claim = useTx();
  const { bet } = useBet(round.id, address);

  useEffect(() => {
    opener.current = document.activeElement;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, done]);

  useEffect(() => { logRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' }); }, [step]);

  const shown: FightEvent[] = events.slice(0, step);
  const snap = shown[shown.length - 1]?.snap ?? [{ hp: CATS[round.catA].hp, max: CATS[round.catA].hp, status: [] }, { hp: CATS[round.catB].hp, max: CATS[round.catB].hp, status: [] }];
  const cats = [round.catA, round.catB];
  const myClaim = bet ? claimable(round, bet) : false;
  const winnerTotal = round.winner === 0 ? round.total0 : round.total1;
  const myPayout = bet && bet.amount > 0n && winnerTotal > 0n ? (bet.amount * (pool(round) - round.rake)) / winnerTotal : 0n;
  const iWon = bet && bet.amount > 0n && bet.side === round.winner;

  return (
    <div className="overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="replay-h" tabIndex={-1} ref={dialogRef}>
        <div className="dialog-head">
          <h2 id="replay-h">Round {String(round.id)}: {done ? 'result' : `turn ${shown[shown.length - 1]?.turn ?? 1}`}</h2>
          <div className="dialog-ctl">
            {!done && <button type="button" className="btn btn-ghost" onClick={() => setStep(events.length)}>Skip</button>}
            <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">Close</button>
          </div>
        </div>
        <div className="fighters">
          {([0, 1] as const).map((i) => (
            <div key={i} className={`fighter side-${i} ${done && round.winner === i ? 'winner' : ''} ${done && round.winner !== i ? 'loser' : ''}`}>
              <Portrait name={CATS[cats[i]].name} uid={`fight${i}`} />
              <p className="f-name">{SIDE_NAME[i]} {displayName(CATS[cats[i]].name)}</p>
              <div className="hp" role="progressbar" aria-valuemin={0} aria-valuemax={snap[i].max} aria-valuenow={snap[i].hp} aria-label={`${displayName(CATS[cats[i]].name)} HP`}>
                <span style={{ width: `${(100 * snap[i].hp) / snap[i].max}%` }} />
              </div>
              <p className="num hp-text">{snap[i].hp} / {snap[i].max}</p>
              {snap[i].status.length > 0 && <p className="f-status">{snap[i].status.join(' · ')}</p>}
            </div>
          ))}
        </div>
        <ol className="log" ref={logRef} aria-live="polite">
          {shown.map((ev, i) => (
            <li key={i} className={`log-${ev.actor} log-${ev.kind}`} dangerouslySetInnerHTML={{ __html: ev.text }} />
          ))}
        </ol>
        {done && (
          <div className="result">
            <p className="result-head">
              {SIDE_NAME[round.winner]} {displayName(CATS[cats[round.winner]].name)} wins {replay.result.reason === 'ko' ? 'by knockout' : 'on decision'} in {round.turns} turns.
            </p>
            <p className={replay.verified ? 'verified' : 'tx tx-error'}>
              {replay.verified
                ? 'Verified: the local replay from the on-chain seed matches the settled winner and turn count.'
                : `Mismatch: the local replay gives ${SIDE_NAME[replay.result.winner]} in ${replay.result.turns} turns, but the chain recorded ${SIDE_NAME[round.winner]} in ${round.turns}. Do not trust this replay.`}
            </p>
            <p className="hint seed">Seed <span className="mono">{replay.seedHex}</span></p>
            {bet && bet.amount > 0n ? (
              <p className="outcome">
                {iWon
                  ? <>You backed the winner. Your {fmtEth(bet.amount, 6)} returns <b className="num">{fmtEth(myPayout, 6)}</b>{bet.claimed ? ' (claimed).' : '.'}</>
                  : <>You backed {SIDE_NAME[bet.side]} with {fmtEth(bet.amount, 6)}. Better luck next fight.</>}
              </p>
            ) : (
              <p className="outcome">You had no bet in this round.</p>
            )}
            {myClaim && round.status === Status.Settled && (
              <>
                <button type="button" className="btn btn-primary" disabled={!onChain || claim.busy} onClick={() => claim.run({ address: cfg.game.address, abi: cfg.game.abi, functionName: 'claim', args: [round.id] })}>
                  {claim.busy ? 'Claiming…' : `Claim ${fmtEth(myPayout, 6)}`}
                </button>
                <TxStatus state={claim.state} label="claim" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
