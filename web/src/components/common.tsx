import { useState, type ReactNode } from 'react';
import type { Address } from 'viem';
import { useConfig } from '../hooks';
import { explorerAddr, explorerTx, shortAddr } from '../lib/format';
import type { TxState } from '../hooks';
import { catSVG } from '../lib/engine';

export function Portrait({ name, uid, className }: { name: string; uid: string; className?: string }) {
  return <div className={`portrait ${className ?? ''}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: catSVG(name, uid) }} />;
}

export function AddressLink({ address, full }: { address: Address; full?: boolean }) {
  const cfg = useConfig();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <span className="addr">
      {cfg.explorer ? (
        <a href={explorerAddr(cfg.explorer, address)} target="_blank" rel="noreferrer" className="mono" title={address}>
          {full ? address : shortAddr(address)}
        </a>
      ) : (
        <span className="mono" title={address}>{full ? address : shortAddr(address)}</span>
      )}
      <button type="button" className="icon-btn" onClick={copy} aria-label={`Copy address ${address}`}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

export function TxStatus({ state, label }: { state: TxState; label?: string }) {
  const cfg = useConfig();
  if (state.phase === 'idle') return null;
  const link = state.hash && cfg.explorer ? (
    <a href={explorerTx(cfg.explorer, state.hash)} target="_blank" rel="noreferrer">View transaction</a>
  ) : null;
  const text =
    state.phase === 'simulating' ? `Checking ${label ?? 'transaction'}…`
    : state.phase === 'signing' ? 'Confirm in your wallet…'
    : state.phase === 'pending' ? 'Sent. Waiting for confirmation…'
    : state.phase === 'confirmed' ? 'Confirmed.'
    : state.error ?? 'Failed.';
  const cls = state.phase === 'error' ? 'tx tx-error' : state.phase === 'confirmed' ? 'tx tx-ok' : 'tx tx-pending';
  return (
    <p className={cls} role={state.phase === 'error' ? 'alert' : 'status'} aria-live="polite">
      {text} {link}
    </p>
  );
}

export function Panel({ title, children, id, aside }: { title: string; children: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <section className="panel" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <div className="panel-head">
        <h2 id={id ? `${id}-h` : undefined}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'warn' | 'error'; children: ReactNode }) {
  return <p className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : undefined}>{children}</p>;
}
