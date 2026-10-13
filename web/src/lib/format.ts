import { formatUnits, type Address } from 'viem';

/** Human-readable token amount; trims trailing zeros, keeps up to `max` decimals. */
export function fmtUnits(value: bigint, decimals = 18, max = 4): string {
  const s = formatUnits(value, decimals);
  const [int, frac = ''] = s.split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (max === 0) return intFmt;
  let f = frac.slice(0, max).replace(/0+$/, '');
  if (f === '' && value !== 0n && frac !== '' && BigInt(frac.slice(0, max) || '0') === 0n) {
    // value is nonzero but rounds to zero at this precision: show the smallest visible step
    f = '0'.repeat(max - 1) + '1';
    return `<${intFmt}.${f}`;
  }
  return f ? `${intFmt}.${f}` : intFmt;
}

export const fmtEth = (wei: bigint, max = 4) => `${fmtUnits(wei, 18, max)} ETH`;

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function explorerAddr(explorer: string, a: Address): string {
  return `${explorer.replace(/\/$/, '')}/address/${a}`;
}
export function explorerTx(explorer: string, h: string): string {
  return `${explorer.replace(/\/$/, '')}/tx/${h}`;
}

export function fmtCountdown(seconds: number): string {
  if (seconds <= 0) return '0:00';
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h >= 100 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function fmtMultiplier(x: number | null): string {
  if (x === null || !Number.isFinite(x)) return '—';
  if (x >= 10_000) return '>9999×';
  return `${x.toFixed(2)}×`;
}

export function fmtPct(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

export function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
