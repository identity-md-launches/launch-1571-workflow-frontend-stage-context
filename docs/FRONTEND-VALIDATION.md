# Frontend validation

Evidence for the `web/` source and the committed `dist/` export, recorded by the worker that built
them on 2026-10-13. Everything below was run on this worker from the repository root unless a
`cd web` is shown. Tool versions: Node 24.21.0, npm 11.19.0, Vite 7.3.7, React 19.3.0, wagmi
2.19.5, viem 2.57.5, TypeScript 5.9.3, vitest 3.2.7, Playwright 1.64.0 with Chromium headless
shell 156.

The Solidity, Foundry and keeper checks are in [VALIDATION.md](VALIDATION.md); this file covers
only the frontend.

## Commands and results

| Command | Result |
|---|---|
| `cd web && npm ci` | Clean install from `package-lock.json`; only npm's install-scripts warning about `utf-8-validate`, no errors |
| `cd web && npm run typecheck` (`tsc --noEmit -p tsconfig.json`) | Pass, no diagnostics |
| `cd web && npm test` (`vitest run`) | 1 file, 15 tests pass: payout math from docs/ABI.md, `getRound` decoding, claim eligibility, public cancel timing, bytes32 seed encoding, replay verification, Universal Router / V4 swap calldata, slippage, pool id, formatting |
| `cd web && npm run build` | typecheck, Vite production build, then `scripts/manifest.mjs`: `imd-deployment.json written: 2 contracts, 10 assets, 819 KiB` |
| `node test/scratch/verify-manifest.mjs` (worker scaffold) | `manifest OK`: top-level keys exactly `version, launchId, chainId, sourceCommit, attestationHash, contracts, assets, poolKey, network, walletAddChain`; identifiers and contract set equal the handoff; `poolKey` equals the handoff key; `network` and `walletAddChain` byte-equal to `.imd/reads/network.json`; both ABI files are raw arrays whose canonical keccak matches the handoff `abiHash` and whose content equals `docs/abi/<Contract>.json`; the asset list equals the file inventory of `dist/` minus the manifest; every SHA-256 recomputed and equal; all paths relative; no address or URL outside the allowed blocks |
| Playwright interaction walk, `node test/scratch/walk.mjs` | Chromium: 64 checks pass, 0 console errors, 0 failed or 4xx/5xx requests (details below). WebKit: could not launch, see limitations |
| Design probe, `IMD_PLAYWRIGHT=$HOME/.imd-taste/node_modules/playwright/index.mjs node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` | 16 of 16 checks pass at 320, 390 and 1440 (render, layout, targets, contrast, casing, tracking, eyebrows, type-sizes, type-faces, glyphs, slogans, repetition, copy-budget, chrome, motion, share) |

Export size: 10 files, 819 KiB, largest file `og.png` at 144 KiB, far below the 128-asset,
8 MiB-per-file and total body budgets. A trial build with a WalletConnect project id (written to
`test/scratch/`, not committed) produced 91 files and about 2 MiB, also inside the limits.

## Interaction walk

`test/scratch/walk.mjs` serves `dist/` over plain HTTP (as a gateway would, so the relative
manifest and ABI fetches are real), then runs two scenarios at each of 320×844, 390×844 and
1440×900 in Chromium. It is worker scaffolding; `test/scratch/` is not part of the submission.

**A. Read-only visitor, no wallet.** The page boots from `imd-deployment.json`, loads both ABI
files, and reads the live game on Sepolia through the configured public RPCs: `roundCount` is 0
at validation time, so the arena shows the empty state ("Back a cat. Win the pot.", the eight-cat
roster, "No fight is open yet."). Checked: title, description, og:title, og:image and favicon
present; no horizontal overflow and no element past the viewport edge; at 390 the headline, the
roster and the wallet button are all inside the first screen; the two "How it works" address rows
show the whole 42-character address with Copy on its last line and inside the viewport; no em
dash in the site's own text; "Recent fights" shows "No fights yet."; the trade panel shows the
live pool price (50,000,000 MEOW per ETH), a live quote for 0.01 ETH from the quoter's
`quoteExactInputSingle` via `simulateContract`, and "Connect a wallet to trade." Pressing
"Connect wallet" with no provider opens the hint "No browser wallet found. Install MetaMask or
Rabby to play; reads work without one. This build has no WalletConnect project id, so there is no
QR option." without widening the page.

**B. Mock EIP-1193 wallet on chain 0x1.** An init script injects a test-only `window.ethereum`
that answers accounts, chain id, switch and add-chain requests and refuses everything else with
code 4200; it holds no key and cannot broadcast. Checked: connecting shows the "Wrong network"
button, the banner "Your wallet is on another network. This game runs on Sepolia (chain
11155111)." and "Switch to Sepolia to trade."; pressing "Switch to Sepolia" sends
`wallet_switchEthereumChain` with `0xaa36a7`, receives 4902, sends `wallet_addEthereumChain` with
parameters deep-equal to `walletAddChain` in `.imd/reads/network.json`, then switches again; the
header then shows the short address and the banner is gone; the trade panel shows the account's
live balance and quote, and the Swap button is enabled exactly when a quote exists and the
balance covers the amount (the mock account happens to hold Sepolia ETH, so it was enabled);
pressing Swap simulates `execute` against the public RPC, then the wallet's refusal to sign is
shown as "The Provider does not support the requested method." with exactly one
`eth_sendTransaction` attempt and nothing broadcast; the account menu with the full address does
not overflow at any width; Disconnect returns to "Connect wallet". Screenshots for each state were
written to `test/scratch/walk/shots/` and reviewed; the 390 first-screen shot shows the header,
headline, lede, empty-state hint and roster with no overlap.

## Better Interface review

Coverage: the pinned guide's workflow and the core principles of all six domains were applied
while building and re-read for this revision; the "without a browser" checks were done on the
source and the "with a browser" checks through the Playwright walk and the design probe above
(Chromium only).

| Domain | Findings this round (`file:line` at the time) and fixes |
|---|---|
| Accessibility | Pressing "Connect wallet" with no provider used to call `connect` with no connector (`web/src/components/Header.tsx:28`); the generic injected connector is now dropped when `window.ethereum` is absent, and the button opens a `role="status"` hint instead. The hint is a positioned popover, so the header no longer reflows. |
| Layout | The "How it works" addresses were one sentence with two inline Copy buttons that broke mid-address at 390 (`web/src/App.tsx:61`); they are now a two-row definition list, `.about-addrs` in `web/src/styles.css`, with the address wrapping inside its link and Copy beside it. No horizontal overflow at 320, 390 or 1440 with the longest values rendered (full addresses, the account menu, the no-wallet hint). |
| Writing | Em-dash placeholders in the history Seed and Link cells (`web/src/components/History.tsx:40-41`) and the trade panel's Balance, You receive and Minimum cells (`web/src/components/Swap.tsx:117-120`) are now empty cells. The empty-arena and claims hints were shortened; first-screen prose is 41 words at 390 (bar 60). |
| Typography | Unchanged: one scale of six sizes, three weights (400, 600, 800), the headline is the heaviest type, no tracked capitals above headings. Probe `type-sizes` and `type-faces` pass. |
| Colors | Unchanged tokens; probe `contrast` measured every text pair at 4.5:1 or better (3:1 for large). |
| UI | Transaction actions stay disabled off-chain, before a quote, or without balance; the wrong-network state keeps a single "Switch to Sepolia" control; the swap simulates before asking the wallet to sign and shows the failure text. |

## Limitations and untested live-chain behaviour

- **WebKit did not run.** Playwright downloaded WebKit, but this machine lacks its system
  libraries and offers no root access to install them. Every rendered check above is Chromium
  only; no WebKit or Firefox observation is claimed.
- **No round exists on chain** (`roundCount` is 0 at validation time), so `placeBet`, the VRF
  request, `settle`, `claim`, `cancelRound` and `withdraw` were not exercised against the live
  contract. Their eligibility, payout and seed logic is covered by the vitest suite, and their
  controls render disabled unless the wallet is connected on Sepolia and the round state allows
  them. The settled-fight replay overlay was validated only through the engine unit tests.
- **No real transaction was broadcast.** Approvals and swaps were taken to the signing step with
  a mock wallet that refuses to sign; a swap through the Universal Router with a real wallet and
  the Permit2 approval path for selling MEOW (two approvals, then swap) are untested live.
- **WalletConnect was not connected end to end.** No project id was supplied, so the committed
  export has no WalletConnect connector; the gated build path was only verified to compile,
  bundle its chunks and keep inside the manifest limits.
- **Owner panel** controls were not exercised with the owner's wallet.
- Public RPC responses were live at validation time; a later outage of all three listed URLs
  shows the arena's error notice instead of data.
