#!/usr/bin/env node
/**
 * Emits dist/imd-deployment.json after the static export:
 *  - copies ABI JSON from docs/abi at the pinned source commit into dist/abi and verifies each
 *    canonical keccak256 hash against the deployment handoff;
 *  - copies identifiers, chain, contracts, poolKey (handoff) and network/walletAddChain (network.json);
 *  - lists every other exported file with its SHA-256.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keccak256, toBytes } from 'viem';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const dist = resolve(root, 'dist');
const handoffPath = process.env.IMD_DEPLOYMENT ?? resolve(root, '.imd/reads/deployment.json');
const networkPath = process.env.IMD_NETWORK ?? resolve(root, '.imd/reads/network.json');

if (!existsSync(handoffPath)) throw new Error(`deployment handoff not found at ${handoffPath}`);
const handoff = JSON.parse(readFileSync(handoffPath, 'utf8'));
const network = existsSync(networkPath) ? JSON.parse(readFileSync(networkPath, 'utf8')) : null;

const canonical = (v) => {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

mkdirSync(join(dist, 'abi'), { recursive: true });
const contracts = handoff.contracts.map((c) => {
  const abiSource = resolve(root, 'docs/abi', `${c.name}.json`);
  const abi = JSON.parse(readFileSync(abiSource, 'utf8'));
  const hash = keccak256(toBytes(canonical(abi))).slice(2);
  if (hash !== c.abiHash) throw new Error(`ABI hash mismatch for ${c.name}: ${hash} != ${c.abiHash}`);
  const abiPath = `abi/${c.name}.json`;
  writeFileSync(join(dist, abiPath), JSON.stringify(abi));
  return { name: c.name, address: c.address, abiHash: c.abiHash, abiPath };
});

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const assets = walk(dist)
  .map((p) => relative(dist, p).split('\\').join('/'))
  .filter((p) => p !== 'imd-deployment.json')
  .sort()
  .map((path) => {
    const buf = readFileSync(join(dist, path));
    if (buf.length > 8 * 1024 * 1024) throw new Error(`${path} exceeds 8 MiB`);
    return { path, sha256: sha256(buf) };
  });
if (assets.length > 128) throw new Error(`too many assets: ${assets.length}`);

const manifest = {
  version: 1,
  launchId: handoff.launchId,
  chainId: handoff.chainId,
  sourceCommit: handoff.sourceCommit,
  attestationHash: handoff.attestationHash,
  contracts,
  assets,
};
if (handoff.poolKey) {
  const { currency0, currency1, fee, tickSpacing, hooks } = handoff.poolKey;
  manifest.poolKey = { currency0, currency1, fee, tickSpacing, hooks };
}
if (network?.network) manifest.network = network.network;
if (network?.walletAddChain) manifest.walletAddChain = network.walletAddChain;

writeFileSync(join(dist, 'imd-deployment.json'), JSON.stringify(manifest, null, 2) + '\n');
const total = assets.reduce((s, a) => s + statSync(join(dist, a.path)).size, 0);
console.log(`imd-deployment.json written: ${contracts.length} contracts, ${assets.length} assets, ${(total / 1024).toFixed(0)} KiB`);
