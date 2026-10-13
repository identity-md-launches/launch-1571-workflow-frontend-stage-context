import { useState } from 'react';
import { useAccount, useBalance, useConnect, useDisconnect } from 'wagmi';
import { useConfig, useNetworkSwitch } from '../hooks';
import { fmtEth, shortAddr } from '../lib/format';

export function Header() {
  const cfg = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const wrongChain = isConnected && chainId !== cfg.chain.id;
  const { data: bal } = useBalance({ address, chainId: cfg.chain.id, query: { enabled: !!address, refetchInterval: 8000 } });

  const injected = connectors.filter((c) => c.type === 'injected' || c.id === 'injected');
  const named = injected.filter((c) => c.id !== 'injected');
  const list = named.length > 0 ? named : injected;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-name">CAT WARS</span>
        {cfg.chain.testnet && <span className="badge" title={`${cfg.chain.name} test network`}>TESTNET</span>}
      </div>
      <div className="wallet">
        {!isConnected ? (
          <div className="menu-wrap">
            <button type="button" className="btn btn-primary" onClick={() => (list.length === 1 ? connect({ connector: list[0] }) : setOpen((o) => !o))} disabled={isPending} aria-expanded={list.length > 1 ? open : undefined}>
              {isPending ? 'Connecting…' : 'Connect wallet'}
            </button>
            {open && list.length > 1 && (
              <ul className="menu" role="menu">
                {list.map((c) => (
                  <li key={c.uid} role="none">
                    <button type="button" role="menuitem" className="menu-item" onClick={() => { setOpen(false); connect({ connector: c }); }}>
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {list.length === 0 && <p className="hint">No browser wallet found. Install MetaMask or Rabby to play; reads work without one.</p>}
            {error && <p className="tx tx-error" role="alert">{error.message.split('\n')[0]}</p>}
          </div>
        ) : (
          <div className="menu-wrap">
            <button type="button" className={`btn ${wrongChain ? 'btn-warn' : 'btn-ghost'}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
              {wrongChain ? 'Wrong network' : <span className="mono">{shortAddr(address!)}</span>}
            </button>
            {open && (
              <div className="menu" role="menu">
                <p className="mono menu-addr">{address}</p>
                {bal && !wrongChain && <p className="hint">Balance {fmtEth(bal.value)}</p>}
                {wrongChain && <SwitchButton />}
                <button type="button" role="menuitem" className="menu-item" onClick={() => { setOpen(false); disconnect(); }}>Disconnect</button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export function SwitchButton() {
  const cfg = useConfig();
  const { switchChain, busy, error } = useNetworkSwitch();
  return (
    <div className="switch-wrap">
      <button type="button" className="btn btn-warn" onClick={switchChain} disabled={busy}>
        {busy ? 'Switching…' : `Switch to ${cfg.chain.name}`}
      </button>
      {error && <p className="tx tx-error" role="alert">{error}</p>}
    </div>
  );
}

/** Banner shown under the header when the wallet is on another chain. */
export function NetworkGate() {
  const cfg = useConfig();
  const { isConnected, chainId } = useAccount();
  if (!isConnected || chainId === cfg.chain.id) return null;
  return (
    <div className="gate" role="alert">
      <p>Your wallet is on another network. This game runs on {cfg.chain.name} (chain {cfg.chain.id}).</p>
      <SwitchButton />
    </div>
  );
}
