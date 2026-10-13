/* CAT WARS — deterministic fight engine.
 *
 * Same 32-byte seed + same two cats  =>  exactly the same fight, on any machine.
 * The on-chain program (programs/cat_wars/src/engine.rs) is a line-by-line port of this file;
 * any change here MUST be mirrored there, including the ORDER of random draws.
 *
 * All math is integer (percent / floor division) so JS and Rust agree bit-for-bit.
 * Works in the browser (window.CatWarsEngine) and in Node (require('./engine.js')).
 */
(function(root){
  'use strict';

  /* ---------- roster (index = on-chain cat id; never reorder, only append) ----------
     Skill fields, all integers:
       dmg: damage % (160 = 1.6×) · hits · crit: crit chance % (default 10) · pierce: ignore DEF
       stun: stun chance % · lifesteal: % of damage healed · heal: % of max HP
       shield: % damage reduction · buff: +% ATK · weaken: −% enemy ATK
       curse: enemy miss chance % · dodge: evade next attack · turns: duration · cd: cooldown */
  const CATS = [
    {name:'TIGRIS', title:'Jungle Brawler', hp:260, atk:39, def:30, spd:22, skills:[
      {name:'Pounce', icon:'🐾', dmg:160, cd:2, desc:'Heavy 1.6× strike'},
      {name:'Roar', icon:'📢', weaken:30, turns:2, cd:4, desc:'Enemy ATK −30% for 2 turns'},
      {name:'Frenzy', icon:'🌀', dmg:55, hits:3, cd:3, desc:'3 rapid slashes'},
    ]},
    {name:'SHADOW', title:'Void Assassin', hp:220, atk:43, def:24, spd:32, skills:[
      {name:'Shadow Step', icon:'👤', dodge:1, cd:3, desc:'Evade the next attack'},
      {name:'Backstab', icon:'🗡️', dmg:135, crit:45, cd:2, desc:'1.35× · 45% crit chance'},
      {name:'Bad Luck', icon:'🪬', curse:35, turns:2, cd:4, desc:'Enemy misses 35% for 2 turns'},
    ]},
    {name:'MOCHI', title:'Chonky Tank', hp:295, atk:32, def:40, spd:12, skills:[
      {name:'Belly Flop', icon:'💥', dmg:130, stun:35, cd:3, desc:'1.3× · 35% stun'},
      {name:'Nap Time', icon:'💤', heal:22, cd:4, desc:'Heal 22% max HP'},
      {name:'Fluff Armor', icon:'🧶', shield:40, turns:2, cd:4, desc:'−40% damage taken, 2 turns'},
    ]},
    {name:'LEO', title:'Pride King', hp:290, atk:41, def:40, spd:18, skills:[
      {name:'Royal Roar', icon:'👑', buff:35, turns:2, cd:4, desc:'ATK +35% for 2 turns'},
      {name:'Mane Slash', icon:'⚔️', dmg:150, cd:2, desc:'Heavy 1.5× slash'},
      {name:'Pride Guard', icon:'🛡️', shield:30, heal:8, turns:2, cd:4, desc:'−30% dmg taken · heal 8%'},
    ]},
    {name:'GLITCH', title:'Cyber Cat', hp:240, atk:43, def:32, spd:26, skills:[
      {name:'Laser Pointer', icon:'🔴', dmg:40, stun:60, cd:4, desc:'0.4× · 60% stun'},
      {name:'Byte', icon:'💾', dmg:125, pierce:1, cd:2, desc:'1.25× · ignores DEF'},
      {name:'Overclock', icon:'⚡', buff:25, turns:3, cd:5, desc:'ATK +25% for 3 turns'},
    ]},
    {name:'ZOOMIES', title:'3AM Menace', hp:220, atk:38, def:22, spd:35, skills:[
      {name:'Zoomies', icon:'💨', dmg:40, hits:4, cd:3, desc:'4 chaotic hits'},
      {name:'Knock Off Table', icon:'🏺', dmg:180, cd:3, desc:'Massive 1.8× smash'},
      {name:'Catnip', icon:'🌿', heal:12, buff:20, turns:2, cd:4, desc:'Heal 12% · ATK +20%'},
    ]},
    {name:'GRUMPY', title:'Eternal Frown', hp:295, atk:41, def:44, spd:17, skills:[
      {name:'Hiss', icon:'🐍', weaken:25, turns:3, cd:4, desc:'Enemy ATK −25% for 3 turns'},
      {name:'Spite Bite', icon:'🩸', dmg:140, lifesteal:60, cd:2, desc:'1.4× · heals 60% of dmg'},
      {name:'Cold Shoulder', icon:'🧊', shield:45, turns:1, cd:3, desc:'−45% damage taken, 1 turn'},
    ]},
    {name:'NOVA', title:'Cosmic Cheetah', hp:220, atk:38, def:28, spd:30, skills:[
      {name:'Meteor Claw', icon:'☄️', dmg:180, cd:4, desc:'Devastating 1.8× strike'},
      {name:'Star Dash', icon:'✨', dodge:1, cd:3, desc:'Evade the next attack'},
      {name:'Gravity Purr', icon:'🌌', dmg:70, stun:40, cd:3, desc:'0.7× · 40% stun'},
    ]},
  ];
  const BASIC = {name:'Scratch', icon:'🐾', dmg:100, cd:0};
  const MAX_TURNS = 30;
  const SKILL_USE_PCT = 70;

  /* ---------- PRNG: xoshiro128** seeded from the first 16 bytes of the seed (little-endian u32s) ---------- */
  function makeRng(seed){
    if(!(seed instanceof Uint8Array) || seed.length !== 32) throw new Error('seed must be 32 bytes');
    const s = new Uint32Array(4);
    for(let i=0;i<4;i++) s[i] = (seed[i*4] | seed[i*4+1]<<8 | seed[i*4+2]<<16 | seed[i*4+3]<<24) >>> 0;
    if((s[0]|s[1]|s[2]|s[3]) === 0) s[0] = 1;
    const rotl = (x,k) => ((x << k) | (x >>> (32-k))) >>> 0;
    function next(){
      const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
      const t = (s[1] << 9) >>> 0;
      s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
      s[2] ^= t; s[3] = rotl(s[3], 11);
      return result;
    }
    return { next, below:(n) => next() % n };
  }

  const fdiv = (a,b) => Math.floor(a/b);

  /* ---------- the fight ----------
     Returns {winner:0|1, reason:'ko'|'decision', turns, events}. `events` is only for the UI replay;
     the on-chain port computes just the winner. */
  function simulate(catA, catB, seed){
    const rng = makeRng(seed);
    const mk = (c) => ({c, hp:c.hp, max:c.hp, cds:[0,0,0], buff:null, weak:null, shield:null, curse:null, dodge:false, stunned:false, stunImmune:false});
    const F = [mk(CATS[catA]), mk(CATS[catB])];
    const events = [];

    const statuses = (f) => {
      const s = [];
      if(f.shield) s.push('🛡️ −' + f.shield.v + '% dmg');
      if(f.buff) s.push('⬆️ ATK +' + f.buff.v + '%');
      if(f.weak) s.push('⬇️ ATK −' + f.weak.v + '%');
      if(f.curse) s.push('🪬 ' + f.curse.v + '% miss');
      if(f.dodge) s.push('👤 evade');
      if(f.stunned) s.push('💫 stunned');
      return s;
    };
    const snap = () => F.map(f => ({hp:Math.max(0, f.hp), max:f.max, status:statuses(f)}));

    function pickSkill(self){
      const ready = [];
      self.c.skills.forEach((s, idx) => {
        if(self.cds[idx] > 0) return;
        if(s.heal && !s.dmg && self.hp*100 > self.max*70) return;
        if(s.shield && self.shield) return;
        if(s.buff && !s.heal && self.buff) return;
        if(s.dodge && self.dodge) return;
        ready.push(idx);
      });
      if(ready.length > 0 && rng.below(100) < SKILL_USE_PCT) return ready[rng.below(ready.length)];
      return -1;
    }

    function act(i, turn){
      const self = F[i], foe = F[1-i];
      for(let k=0;k<3;k++) if(self.cds[k] > 0) self.cds[k]--;
      if(self.stunned){
        self.stunned = false; self.stunImmune = true;
        events.push({turn, actor:i, kind:'stunned', text:`<b>${self.c.name}</b> is stunned 💫 and loses the turn`, snap:snap()});
        return;
      }
      self.stunImmune = false;
      const idx = pickSkill(self);
      const s = idx < 0 ? BASIC : self.c.skills[idx];
      if(idx >= 0) self.cds[idx] = s.cd;

      const parts = [];
      let heal = 0, total = 0, crit = false, miss = false, stunned = false;

      if(s.heal) heal += fdiv(self.max * s.heal, 100);
      if(s.shield){ self.shield = {v:s.shield, t:s.turns}; parts.push(`−${s.shield}% dmg taken`); }
      if(s.buff){ self.buff = {v:s.buff, t:s.turns}; parts.push(`ATK +${s.buff}%`); }
      if(s.dodge){ self.dodge = true; parts.push('ready to evade'); }
      if(s.weaken){ foe.weak = {v:s.weaken, t:s.turns}; parts.push(`${foe.c.name} ATK −${s.weaken}%`); }
      if(s.curse){ foe.curse = {v:s.curse, t:s.turns}; parts.push(`${foe.c.name} cursed`); }

      if(s.dmg){
        if(foe.dodge){
          foe.dodge = false; miss = true; parts.push(`${foe.c.name} evades!`);
        } else if(self.curse && rng.below(100) < self.curse.v){
          miss = true; parts.push('misses (bad luck)');
        } else {
          const hits = s.hits || 1;
          const atkPct = 100 + (self.buff ? self.buff.v : 0) - (self.weak ? self.weak.v : 0);
          const def = s.pierce ? 0 : foe.c.def;
          for(let h=0; h<hits; h++){
            let d = self.c.atk * atkPct * s.dmg;            // scale 10^4
            d = fdiv(d * 100, 100 + def);
            d = fdiv(d * (85 + rng.below(31)), 100);         // ±15% variance
            if(rng.below(100) < (s.crit || 10)){ d = fdiv(d * 175, 100); crit = true; }
            if(foe.shield) d = fdiv(d * (100 - foe.shield.v), 100);
            total += Math.max(1, fdiv(d, 10000));
          }
          foe.hp -= total;
          parts.unshift(`${total} dmg${hits>1?` (${hits} hits)`:''}${crit?' CRIT!':''}`);
          if(s.lifesteal) heal += fdiv(total * s.lifesteal, 100);
          if(s.stun && foe.hp > 0 && !foe.stunImmune && rng.below(100) < s.stun){ foe.stunned = true; stunned = true; parts.push(`${foe.c.name} stunned 💫`); }
        }
      }
      if(heal){ heal = Math.min(heal, self.max - self.hp); self.hp += heal; if(heal > 0) parts.push(`+${heal} HP`); }

      events.push({turn, actor:i, kind:'skill', skill:s, dmg:total, heal, crit, miss, stunned,
        text:`<b>${self.c.name}</b> uses ${s.icon} <b>${s.name}</b> → ${parts.join(' · ')}`, snap:snap()});
    }

    const tick = (f) => ['buff','weak','shield','curse'].forEach(k => { if(f[k] && --f[k].t <= 0) f[k] = null; });

    let turn = 0;
    while(F[0].hp > 0 && F[1].hp > 0 && turn < MAX_TURNS){
      turn++;
      const i0 = F[0].c.spd + rng.below(13), i1 = F[1].c.spd + rng.below(13);
      const order = i0 >= i1 ? [0,1] : [1,0];
      for(const i of order){
        if(F[0].hp <= 0 || F[1].hp <= 0) break;
        act(i, turn);
      }
      F.forEach(tick);
    }

    let winner, reason;
    if(F[1].hp <= 0){ winner = 0; reason = 'ko'; }
    else if(F[0].hp <= 0){ winner = 1; reason = 'ko'; }
    else { winner = F[0].hp * F[1].max >= F[1].hp * F[0].max ? 0 : 1; reason = 'decision'; }
    const loser = 1 - winner;
    events.push({turn, actor:winner, kind:'end',
      text: reason === 'ko'
        ? `🏆 <b>${F[winner].c.name}</b> knocks out ${F[loser].c.name} in ${turn} turns!`
        : `🏆 Time! <b>${F[winner].c.name}</b> wins on HP decision`,
      snap:snap()});
    return {winner, reason, turns:turn, events};
  }

  /* ---------- helpers ---------- */
  function hexToSeed(hex){
    hex = hex.replace(/^0x/, '');
    if(!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('seed hex must be 64 chars');
    const out = new Uint8Array(32);
    for(let i=0;i<32;i++) out[i] = parseInt(hex.substr(i*2, 2), 16);
    return out;
  }
  const seedToHex = (seed) => Array.from(seed, b => b.toString(16).padStart(2,'0')).join('');

  // Estimated win rate for catA using locally generated seeds (display only, never used for settlement).
  function simWinRate(catA, catB, n, randomBytes){
    let w = 0;
    for(let k=0;k<n;k++) if(simulate(catA, catB, randomBytes(32)).winner === 0) w++;
    return w / n;
  }

  const api = {CATS, MAX_TURNS, makeRng, simulate, simWinRate, hexToSeed, seedToHex};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CatWarsEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
