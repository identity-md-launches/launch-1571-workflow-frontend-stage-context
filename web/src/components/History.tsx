import { useConfig, useRoundTxHashes, useRounds } from '../hooks';
import { CATS, displayName, seedHexFromRandomWord } from '../lib/engine';
import { pool, Status, STATUS_LABEL, type Round } from '../lib/game';
import { explorerAddr, explorerTx, fmtEth } from '../lib/format';
import { Panel } from './common';

const SIDE_NAME = ['Red', 'Blue'] as const;

export function History({ ids, onReplay }: { ids: bigint[]; onReplay: (r: Round) => void }) {
  const cfg = useConfig();
  const { rounds, isLoading } = useRounds(ids);
  const tx = useRoundTxHashes(ids);
  const sorted = [...rounds].sort((a, b) => (a.id > b.id ? -1 : 1));
  return (
    <Panel title="Recent fights" id="history">
      {ids.length === 0 && <p className="hint">No fights yet.</p>}
      {isLoading && ids.length > 0 && <p className="hint">Loading rounds…</p>}
      {sorted.length > 0 && (
        <table className="history">
          <thead>
            <tr><th scope="col">Round</th><th scope="col">Matchup</th><th scope="col">Outcome</th><th scope="col">Pool</th><th scope="col">Seed</th><th scope="col">Link</th></tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const hash = tx.data?.[r.id.toString()];
              const link = hash && cfg.explorer ? explorerTx(cfg.explorer, hash) : cfg.explorer ? explorerAddr(cfg.explorer, cfg.game.address) : null;
              return (
                <tr key={String(r.id)}>
                  <td className="num">{String(r.id)}</td>
                  <td>{displayName(CATS[r.catA].name)} vs {displayName(CATS[r.catB].name)}</td>
                  <td>
                    {r.status === Status.Settled ? (
                      <>
                        {SIDE_NAME[r.winner]} {displayName(CATS[r.winner === 0 ? r.catA : r.catB].name)}, {r.turns} turns{' '}
                        <button type="button" className="link-btn" onClick={() => onReplay(r)}>Replay</button>
                      </>
                    ) : STATUS_LABEL[r.status]}
                  </td>
                  <td className="num">{fmtEth(pool(r), 5)}</td>
                  <td className="mono seed-cell">{r.status === Status.Settled ? seedHexFromRandomWord(r.randomWord) : '—'}</td>
                  <td>{link ? <a href={link} target="_blank" rel="noreferrer">{hash ? 'Transaction' : 'Contract'}</a> : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
