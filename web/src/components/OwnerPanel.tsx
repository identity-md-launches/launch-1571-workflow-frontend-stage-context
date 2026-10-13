import { useState } from 'react';
import { useAccount } from 'wagmi';
import { isAddress, parseEther } from 'viem';
import { useConfig, useTx, type GameSettings } from '../hooks';
import { CATS, displayName } from '../lib/engine';
import { Status, type Round } from '../lib/game';
import { fmtEth, fmtPct } from '../lib/format';
import { AddressLink, Panel, TxStatus } from './common';

/** Owner and keeper controls: one control per setting, visible only to those accounts. */
export function OwnerPanel({ settings, current }: { settings: GameSettings; current: Round | null }) {
  const cfg = useConfig();
  const { address, chainId, isConnected } = useAccount();
  const onChain = isConnected && chainId === cfg.chain.id;
  const me = address?.toLowerCase();
  const isOwner = !!me && me === settings.owner.toLowerCase();
  const isKeeper = !!me && me === settings.keeper.toLowerCase();
  const [catA, setCatA] = useState(0);
  const [catB, setCatB] = useState(1);
  const [rake, setRake] = useState(String(settings.rakeBps));
  const [duration, setDuration] = useState(String(settings.bettingDuration));
  const [minBet, setMinBet] = useState('0.001');
  const [treasury, setTreasury] = useState('');
  const [keeper, setKeeper] = useState('');
  const open = useTx(); const tRake = useTx(); const tDur = useTx(); const tMin = useTx(); const tTre = useTx(); const tKeep = useTx(); const tPause = useTx();
  const base = { address: cfg.game.address, abi: cfg.game.abi } as const;

  if (!isOwner && !isKeeper) return null;
  const roundOpen = current?.status === Status.Open;
  const parsedMin = (() => { try { return parseEther(minBet as `${number}`); } catch { return null; } })();

  return (
    <Panel title={isOwner ? 'Owner controls' : 'Keeper controls'} id="admin">
      <p className="hint">Signed in as {isOwner ? 'the owner' : 'the keeper'}: <AddressLink address={address!} />. Owner {settings.owner === address ? 'you' : <AddressLink address={settings.owner} />}, keeper <AddressLink address={settings.keeper} />, treasury <AddressLink address={settings.treasury} />.</p>
      <div className="admin-grid">
        <div className="admin-item">
          <h3>Open a round</h3>
          <div className="bet-row">
            <label className="field"><span>RED cat</span>
              <select value={catA} onChange={(e) => setCatA(Number(e.target.value))}>{CATS.map((c, i) => <option key={c.name} value={i}>{displayName(c.name)}</option>)}</select>
            </label>
            <label className="field"><span>BLUE cat</span>
              <select value={catB} onChange={(e) => setCatB(Number(e.target.value))}>{CATS.map((c, i) => <option key={c.name} value={i}>{displayName(c.name)}</option>)}</select>
            </label>
          </div>
          <button type="button" className="btn btn-primary" disabled={!onChain || open.busy || catA === catB || roundOpen || settings.paused} onClick={() => open.run({ ...base, functionName: 'openRound', args: [catA, catB] })}>
            {open.busy ? 'Opening…' : 'Open round'}
          </button>
          <p className="hint">{settings.paused ? 'New rounds are paused.' : roundOpen ? 'A round is already open; wait until it is requested or cancelled.' : catA === catB ? 'Pick two different cats.' : `Betting stays open ${String(settings.bettingDuration)} seconds, rake ${fmtPct(settings.rakeBps)}.`}</p>
          <TxStatus state={open.state} label="round opening" />
        </div>
        {isOwner && (
          <>
            <div className="admin-item">
              <h3>Rake</h3>
              <label className="field"><span>Basis points (0 to 1000), now {settings.rakeBps}</span><input className="num" inputMode="numeric" value={rake} onChange={(e) => setRake(e.target.value)} /></label>
              <button type="button" className="btn" disabled={!onChain || tRake.busy} onClick={() => tRake.run({ ...base, functionName: 'setRakeBps', args: [Number(rake)] })}>{tRake.busy ? 'Saving…' : 'Set rake'}</button>
              <TxStatus state={tRake.state} />
            </div>
            <div className="admin-item">
              <h3>Betting duration</h3>
              <label className="field"><span>Seconds (60 to 86400), now {String(settings.bettingDuration)}</span><input className="num" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} /></label>
              <button type="button" className="btn" disabled={!onChain || tDur.busy} onClick={() => tDur.run({ ...base, functionName: 'setBettingDuration', args: [BigInt(duration || '0')] })}>{tDur.busy ? 'Saving…' : 'Set duration'}</button>
              <TxStatus state={tDur.state} />
            </div>
            <div className="admin-item">
              <h3>Minimum bet</h3>
              <label className="field"><span>ETH, now {fmtEth(settings.minBet, 6)}</span><input className="num" inputMode="decimal" value={minBet} onChange={(e) => setMinBet(e.target.value)} /></label>
              <button type="button" className="btn" disabled={!onChain || tMin.busy || !parsedMin || parsedMin === 0n} onClick={() => tMin.run({ ...base, functionName: 'setMinBet', args: [parsedMin!] })}>{tMin.busy ? 'Saving…' : 'Set minimum'}</button>
              <TxStatus state={tMin.state} />
            </div>
            <div className="admin-item">
              <h3>Treasury</h3>
              <label className="field"><span>Address receiving future rake</span><input className="mono" value={treasury} onChange={(e) => setTreasury(e.target.value.trim())} placeholder="0x…" /></label>
              <button type="button" className="btn" disabled={!onChain || tTre.busy || !isAddress(treasury)} onClick={() => tTre.run({ ...base, functionName: 'setTreasury', args: [treasury] })}>{tTre.busy ? 'Saving…' : 'Set treasury'}</button>
              <TxStatus state={tTre.state} />
            </div>
            <div className="admin-item">
              <h3>Keeper</h3>
              <label className="field"><span>Address allowed to open and cancel rounds</span><input className="mono" value={keeper} onChange={(e) => setKeeper(e.target.value.trim())} placeholder="0x…" /></label>
              <button type="button" className="btn" disabled={!onChain || tKeep.busy || !isAddress(keeper)} onClick={() => tKeep.run({ ...base, functionName: 'setKeeper', args: [keeper] })}>{tKeep.busy ? 'Saving…' : 'Set keeper'}</button>
              <TxStatus state={tKeep.state} />
            </div>
            <div className="admin-item">
              <h3>Pause new rounds</h3>
              <p className="hint">{settings.paused ? 'Paused: no new rounds can open. Bets, settlement and claims continue.' : 'Running. Pausing only blocks opening new rounds.'}</p>
              <button type="button" className="btn" disabled={!onChain || tPause.busy} onClick={() => tPause.run({ ...base, functionName: settings.paused ? 'unpause' : 'pause' })}>{tPause.busy ? 'Sending…' : settings.paused ? 'Unpause' : 'Pause'}</button>
              <TxStatus state={tPause.state} />
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
