import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfig, useGameSettings, useRound } from './hooks';
import { Status, type Round } from './lib/game';
import { Header, NetworkGate } from './components/Header';
import { Arena } from './components/Arena';
import { ReplayOverlay } from './components/Overlays';
import { Claims } from './components/Claims';
import { History } from './components/History';
import { Swap } from './components/Swap';
import { OwnerPanel } from './components/OwnerPanel';
import { AddressLink } from './components/common';

const HISTORY_SIZE = 10n;

export default function App() {
  const cfg = useConfig();
  const { settings, error: settingsError } = useGameSettings();
  const count = settings?.roundCount ?? null;
  const currentId = count !== null && count > 0n ? count - 1n : null;
  const { round, error: roundError } = useRound(currentId);
  const [replay, setReplay] = useState<Round | null>(null);
  const lastStatus = useRef<{ id: bigint; status: number } | null>(null);

  // Auto-open the replay once when the displayed round settles during this session.
  useEffect(() => {
    if (!round) return;
    const prev = lastStatus.current;
    if (prev && prev.id === round.id && prev.status !== Status.Settled && round.status === Status.Settled) setReplay(round);
    lastStatus.current = { id: round.id, status: round.status };
  }, [round]);

  const historyIds = useMemo(() => {
    if (count === null || count === 0n) return [] as bigint[];
    const from = count > HISTORY_SIZE ? count - HISTORY_SIZE : 0n;
    const ids: bigint[] = [];
    for (let i = from; i < count; i++) ids.push(i);
    return ids;
  }, [count]);

  const closeReplay = useCallback(() => setReplay(null), []);

  return (
    <>
      <a className="skip" href="#arena">Skip to the arena</a>
      <Header />
      <NetworkGate />
      <main>
        <Arena round={round} settings={settings} roundError={(roundError ?? settingsError) as Error | null} onReplay={setReplay} />
        {settings && <OwnerPanel settings={settings} current={round} />}
        <Claims ids={historyIds} />
        <History ids={historyIds} onReplay={setReplay} />
        <Swap />
        <section className="panel about" aria-labelledby="about-h">
          <h2 id="about-h">How it works</h2>
          <ul className="about-list">
            <li>Each round pits two cats from the roster. Back RED or BLUE with ETH before the lock time; you can add to your side but not switch.</li>
            <li>After the lock, anyone requests a Chainlink VRF random word and pays its fee; stakes never pay it. A one-sided round is refunded instead.</li>
            <li>Settlement replays the deterministic engine on chain from the random word. Winners split the pot pro rata minus the round's rake, claimable here.</li>
            <li>Rounds that stall can be cancelled by anyone after the timeout, refunding every stake. The owner can never move player ETH.</li>
          </ul>
          <p className="hint">Game <AddressLink address={cfg.game.address} full /> on {cfg.chain.name}. Token {cfg.token.symbol} <AddressLink address={cfg.token.address} full />.</p>
        </section>
      </main>
      <footer className="footer">
        <p>Experimental game. Only play where online wagering is legal for you. 18+.</p>
      </footer>
      {replay && <ReplayOverlay round={replay} onClose={closeReplay} />}
    </>
  );
}
