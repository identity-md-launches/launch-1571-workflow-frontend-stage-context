import { createRequire } from 'node:module';
// Load the verbatim engine and art the way index.html does: as plain scripts registering globals.
// Under Node they may export via module.exports instead; cover both.
const require = createRequire(import.meta.url);
const g = globalThis as Record<string, unknown>;
const engine = require('../public/vendor/engine.js') as { CATS?: unknown };
if (engine && engine.CATS) g.CatWarsEngine = engine;
const art = require('../public/vendor/catart.js') as { catSVG?: unknown };
if (art && art.catSVG) Object.assign(g, art);
if (!g.CatWarsEngine || !g.catSVG) throw new Error('vendor scripts did not register globals');
