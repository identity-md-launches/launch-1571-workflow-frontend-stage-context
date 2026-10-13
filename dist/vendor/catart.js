/* CAT WARS portrait art: catSVG(cat, uid) returns an inline <svg> string (200x200 viewBox).
 * `cat` only needs {name}; names must match engine.js CATS[i].name. `uid` must be unique per SVG on the page
 * (it prefixes gradient/filter ids). Extracted verbatim from ui-reference/index.html. */
  /* ============ CAT ART (NFT-style PFP, pure SVG) ============ */
  const CAT_ART = {
    TIGRIS:  {token:'#0421', rarity:'EPIC',      bg:['#ffa25e','#6e1628'], fur:'#f28b2c', dark:'#b8520f', muzzle:'#fff1dc', pattern:'stripes', mark:'#2a1508', iris:'#a6ff4d', eyes:'angry', mouth:'fang', acc:'bandana', accColor:'#e63946'},
    SHADOW:  {token:'#0013', rarity:'LEGENDARY', bg:['#6b45c4','#0b0818'], fur:'#2a2633', dark:'#121017', muzzle:'#3b3646', iris:'#ffd23f', eyes:'glow', acc:'ninja', accColor:'#3d2166', whisker:'#9a90b0', innerEar:'#6a4b7a'},
    MOCHI:   {token:'#1337', rarity:'RARE',      bg:['#ffd6ec','#a45cf0'], fur:'#fbf6ee', dark:'#dccdb8', muzzle:'#ffffff', pattern:'calico', iris:'#6b4a2b', eyes:'happy', mouth:'w', blush:true, chubby:true, acc:'bow', accColor:'#ff5fa8'},
    LEO:     {token:'#0001', rarity:'MYTHIC',    bg:['#ffe38a','#a3401a'], fur:'#e9b34d', dark:'#b27a1c', muzzle:'#fbe7bd', iris:'#f7c948', eyes:'normal', mouth:'w', mane:'#7a3e10', acc:'crown'},
    GLITCH:  {token:'#8080', rarity:'EPIC',      bg:['#2de2e6','#1d0e45'], fur:'#9aa6b8', dark:'#5e6a7e', muzzle:'#dfe5ee', pattern:'circuit', mark:'#3ddcff', eyes:'visor', mouth:'w', acc:'antenna'},
    ZOOMIES: {token:'#0300', rarity:'RARE',      bg:['#d6ff4d','#1f6b35'], fur:'#c9a27a', dark:'#8c6440', muzzle:'#fff4e4', pattern:'stripes', mark:'#5c3d22', iris:'#4fc3ff', eyes:'crazy', mouth:'tongue', acc:'tuft'},
    GRUMPY:  {token:'#0666', rarity:'UNCOMMON',  bg:['#9cc9ff','#26315e'], fur:'#efe3d2', dark:'#c9b69c', muzzle:'#f7efe4', pattern:'mask', mark:'#7a624d', iris:'#5fb3e8', eyes:'grumpy', mouth:'frown', acc:'beanie', accColor:'#3f6fb5'},
    NOVA:    {token:'#2077', rarity:'LEGENDARY', bg:['#ff5fd2','#140733'], fur:'#f3c250', dark:'#c48a22', muzzle:'#fff3d4', pattern:'spots', mark:'#2b1a0e', iris:'#ff6ad5', eyes:'normal', mouth:'w', acc:'helmet', stars:true},
  };
  const RARITY_COLOR = {UNCOMMON:'#9be15d', RARE:'#3ddcff', EPIC:'#c77dff', LEGENDARY:'#ffcc45', MYTHIC:'#ff5f5f'};

  const RAYS = (()=>{ let d=''; for(let k=0;k<16;k++){ const a1=k*2*Math.PI/16, a2=(k*2+1)*Math.PI/16;
    d += `M100 95L${(100+170*Math.cos(a1)).toFixed(1)} ${(95+170*Math.sin(a1)).toFixed(1)}L${(100+170*Math.cos(a2)).toFixed(1)} ${(95+170*Math.sin(a2)).toFixed(1)}Z`; } return d; })();
  const STARS = [[18,22,1.6],[40,48,1],[26,80,1.3],[172,20,1.5],[186,58,1],[160,44,1],[14,130,1.2],[190,120,1.4],[60,16,1],[140,12,1.2],[178,90,.9],[30,160,1]];

  function catSVG(c, uid){
    const a = CAT_ART[c.name], P = 'ca' + uid, O = '#1a1020';
    const w = a.chubby ? 1.1 : 1;
    const X = (x) => +(100 + (x-100)*w).toFixed(1);
    const st = `stroke="${O}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
    const MIR = 'matrix(-1 0 0 1 200 0)';
    const both = (s) => s + `<g transform="${MIR}">${s}</g>`;
    const head = `M${X(42)} 100C${X(42)} 62 ${X(70)} 48 100 48C${X(130)} 48 ${X(158)} 62 ${X(158)} 100C${X(158)} 118 ${X(152)} 126 ${X(162)} 134L${X(146)} 136C${X(136)} 148 ${X(120)} 156 100 156C${X(80)} 156 ${X(64)} 148 ${X(54)} 136L${X(38)} 134C${X(48)} 126 ${X(42)} 118 ${X(42)} 100Z`;
    let s = '';

    /* defs */
    s += `<defs>
      <radialGradient id="${P}bg" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="${a.bg[0]}"/><stop offset="1" stop-color="${a.bg[1]}"/></radialGradient>
      <linearGradient id="${P}fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a.fur}"/><stop offset=".65" stop-color="${a.fur}"/><stop offset="1" stop-color="${a.dark}"/></linearGradient>
      <linearGradient id="${P}body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a.dark}"/><stop offset=".5" stop-color="${a.fur}"/><stop offset="1" stop-color="${a.dark}"/></linearGradient>
      <linearGradient id="${P}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset=".5" stop-color="#ffc629"/><stop offset="1" stop-color="#c77a00"/></linearGradient>
      <linearGradient id="${P}visor" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3ddcff"/><stop offset="1" stop-color="#ff2fd6"/></linearGradient>
      <radialGradient id="${P}vig" cx="50%" cy="48%" r="72%"><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
      <radialGradient id="${P}shade" cx="50%" cy="30%" r="70%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>
      <filter id="${P}glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="${P}clip"><path d="${head}"/></clipPath>
    </defs>`;

    /* background */
    s += `<rect width="200" height="200" fill="url(#${P}bg)"/>`;
    s += `<path d="${RAYS}" fill="#fff" opacity=".07"/>`;
    if(a.stars) s += STARS.map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${.5+r/4}"/>`).join('')
      + `<path d="M170 150l2 6 6 2-6 2-2 6-2-6-6-2 6-2z M24 104l1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5-4.5-1.5 4.5-1.5z" fill="#fff"/>`;

    /* body + chest */
    s += `<path d="M26 200C30 160 62 146 100 146C138 146 170 160 174 200Z" fill="url(#${P}body)" ${st}/>`;
    s += `<path d="M76 200Q84 162 100 158Q116 162 124 200Z" fill="${a.muzzle}" opacity=".9"/>`;
    if(a.acc === 'ninja') s += `<path d="M26 200C30 162 60 150 100 150C140 150 170 162 174 200Z" fill="${a.accColor}" ${st}/><path d="M100 150L88 200M100 150L112 200" stroke="${O}" stroke-width="2" opacity=".5"/>`;

    /* lion mane */
    if(a.mane){
      let d=''; const n=18;
      for(let k=0;k<n*2;k++){ const r = k%2 ? 66 : 90, t = k*Math.PI/n - Math.PI/2; d += (k?'L':'M') + (100+r*Math.cos(t)).toFixed(1) + ' ' + (104+r*0.92*Math.sin(t)).toFixed(1); }
      s += `<path d="${d}Z" fill="${a.mane}" ${st}/>`;
      d=''; for(let k=0;k<n*2;k++){ const r = k%2 ? 58 : 76, t = (k+.5)*Math.PI/n - Math.PI/2; d += (k?'L':'M') + (100+r*Math.cos(t)).toFixed(1) + ' ' + (104+r*0.92*Math.sin(t)).toFixed(1); }
      s += `<path d="${d}Z" fill="#a8581a" opacity=".9"/>`;
    }

    /* ears */
    if(a.mane){
      s += both(`<ellipse cx="56" cy="58" rx="14" ry="13" fill="url(#${P}fur)" ${st}/><ellipse cx="57" cy="60" rx="7" ry="6.5" fill="#8a4a14"/>`);
    } else if(a.acc !== 'beanie'){
      s += both(`<path d="M${X(50)} 78Q${X(40)} 34 ${X(54)} 18Q${X(76)} 30 ${X(92)} 52Z" fill="url(#${P}fur)" ${st}/>
        <path d="M${X(57)} 68Q${X(52)} 40 ${X(58)} 31Q${X(72)} 41 ${X(82)} 54Z" fill="${a.innerEar||'#ff9fb8'}"/>
        <path d="M${X(58)} 60Q${X(58)} 48 ${X(62)} 42" stroke="#fff" stroke-width="1.5" opacity=".6" fill="none"/>`);
    }

    /* head */
    s += `<path d="${head}" fill="url(#${P}fur)"/>`;
    s += `<g clip-path="url(#${P}clip)">`;
    if(a.pattern === 'stripes'){
      s += `<path d="M100 48L94 72L106 72Z M84 50L81 66L91 63Z M116 50L119 66L109 63Z" fill="${a.mark}"/>`;
      s += both(`<path d="M38 96L66 102L38 108Z M40 114L62 117L42 124Z M46 130L60 130L50 136Z" fill="${a.mark}"/>`);
    } else if(a.pattern === 'spots'){
      s += [[70,64,5,4],[84,56,4,3],[116,56,4,3],[130,64,5,4],[54,82,4,3.5],[146,82,4,3.5],[60,136,3,3],[140,136,3,3],[100,60,4,3],[50,110,3,2.5],[150,110,3,2.5],[92,70,2.5,2],[108,70,2.5,2]]
        .map(([x,y,rx,ry])=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${a.mark}"/>`).join('');
      s += both(`<path d="M86 104Q82 118 76 130" stroke="${a.mark}" stroke-width="3" fill="none" stroke-linecap="round"/>`); // tear marks
    } else if(a.pattern === 'calico'){
      s += `<path d="M30 110C30 60 66 42 98 44C92 68 72 86 30 110Z" fill="#f4a259"/><path d="M170 100C168 62 136 44 110 46C118 64 138 80 170 100Z" fill="#3b2f2f"/>`;
    } else if(a.pattern === 'mask'){
      s += `<path d="M92 48Q100 84 108 48Z" fill="${a.mark}" opacity=".55"/>`;
      s += `<ellipse cx="100" cy="122" rx="30" ry="22" fill="${a.mark}" opacity=".55"/>`;
      s += both(`<ellipse cx="76" cy="98" rx="20" ry="14" fill="${a.mark}" opacity=".45"/>`);
    } else if(a.pattern === 'circuit'){
      s += `<g stroke="${a.mark}" stroke-width="2" fill="none" filter="url(#${P}glow)">
        <path d="M100 48V64L92 72M100 64L108 72"/>
        <path d="M40 112H58L66 120V136M160 112H142L134 120V136"/>
        <path d="M46 88H56M154 88H144"/></g>
        <g fill="${a.mark}"><circle cx="92" cy="72" r="2.5"/><circle cx="108" cy="72" r="2.5"/><circle cx="66" cy="136" r="2.5"/><circle cx="134" cy="136" r="2.5"/><circle cx="56" cy="88" r="2"/><circle cx="144" cy="88" r="2"/></g>`;
    }
    s += `<path d="${head}" fill="url(#${P}shade)"/>`;
    s += `</g>`;
    s += `<path d="${head}" fill="none" ${st}/>`;
    s += `<path d="M${X(62)} 66Q${X(76)} 54 ${X(92)} 52" stroke="#fff" stroke-width="3" opacity=".35" fill="none" stroke-linecap="round"/>`; // rim light

    /* muzzle + blush */
    s += `<ellipse cx="89" cy="123" rx="14" ry="10.5" fill="${a.muzzle}"/><ellipse cx="111" cy="123" rx="14" ry="10.5" fill="${a.muzzle}"/>`;
    if(a.blush) s += `<ellipse cx="${X(62)}" cy="118" rx="10" ry="5.5" fill="#ff6fa8" opacity=".45"/><ellipse cx="${X(138)}" cy="118" rx="10" ry="5.5" fill="#ff6fa8" opacity=".45"/>`;

    /* eyes (drawn for the left eye, mirrored for the right) */
    const x = 78, y = 96;
    const almond = `M${x-15} ${y}Q${x} ${y-16} ${x+15} ${y}Q${x} ${y+14} ${x-15} ${y}Z`;
    const irisEye = (slit=3.4) => `<path d="${almond}" fill="${a.iris}" ${st}/>
      <ellipse cx="${x}" cy="${y+5}" rx="9" ry="3.5" fill="#fff" opacity=".28"/>
      <ellipse cx="${x}" cy="${y}" rx="${slit}" ry="10" fill="#120a0a"/>
      <circle cx="${x+5}" cy="${y-4}" r="3.2" fill="#fff"/><circle cx="${x-4}" cy="${y+4}" r="1.4" fill="#fff"/>`;
    let eye = '';
    if(a.eyes === 'normal') eye = irisEye();
    else if(a.eyes === 'glow') eye = `<g filter="url(#${P}glow)">${irisEye(2)}</g>`;
    else if(a.eyes === 'angry') eye = irisEye(2.6)
      + `<path d="M${x-19} ${y-19}L${x+19} ${y-19}L${x+19} ${y-3}L${x-19} ${y-11}Z" fill="${a.fur}"/>`
      + `<path d="M${x-17} ${y-11}L${x+17} ${y-3}" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`;
    else if(a.eyes === 'grumpy') eye = irisEye(3)
      + `<path d="M${x-19} ${y-19}L${x+19} ${y-19}L${x+19} ${y-4}L${x-19} ${y+1}Z" fill="${a.mark}"/>`
      + `<path d="M${x-17} ${y+1}L${x+17} ${y-4}" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`
      + `<path d="M${x-14} ${y-14}L${x+12} ${y-19}" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`;
    else if(a.eyes === 'happy') eye = `<path d="M${x-12} ${y+4}Q${x} ${y-12} ${x+12} ${y+4}" stroke="${O}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <path d="M${x-15} ${y-6}L${x-19} ${y-9}M${x-13} ${y-10}L${x-15} ${y-15}" stroke="${O}" stroke-width="2" stroke-linecap="round"/>`;
    else if(a.eyes === 'crazy') eye = `<circle cx="${x}" cy="${y}" r="14" fill="#fff" ${st}/>
      <path d="M${x-12} ${y+4}l5-1M${x-11} ${y+8}l4-3" stroke="#ff4d6d" stroke-width="1.2"/>
      <circle cx="${x+3}" cy="${y+1}" r="7.5" fill="${a.iris}"/><circle cx="${x+3}" cy="${y+1}" r="3.2" fill="#120a0a"/>
      <circle cx="${x+6}" cy="${y-3}" r="2.2" fill="#fff"/>`;
    if(eye) s += both(eye);
    if(a.eyes === 'visor'){
      s += `<rect x="52" y="82" width="96" height="28" rx="14" fill="#0b0f1e" ${st}/>`;
      s += `<rect x="56" y="85" width="88" height="22" rx="11" fill="url(#${P}visor)" opacity=".9"/>`;
      for(let yy=88; yy<106; yy+=3.5) s += `<path d="M60 ${yy}H140" stroke="#000" stroke-width="1" opacity=".22"/>`;
      s += `<g filter="url(#${P}glow)"><rect x="66" y="92" width="22" height="7" rx="3.5" fill="#fff"/><rect x="112" y="92" width="22" height="7" rx="3.5" fill="#fff"/></g>`;
      s += `<path d="M62 88H92" stroke="#fff" stroke-width="2.5" opacity=".6" stroke-linecap="round"/>`;
    }

    /* nose + mouth */
    s += `<path d="M93 111Q100 108 107 111L100 119Z" fill="${a.nose||'#ff8fab'}" ${st} stroke-width="2.5"/>`;
    s += `<path d="M96 112Q98 111 100 111.5" stroke="#fff" stroke-width="1.5" opacity=".7" fill="none"/>`;
    if(a.mouth === 'tongue') s += `<path d="M94 125Q100 142 106 125Z" fill="#ff5d8f" ${st} stroke-width="2.5"/><path d="M100 127V134" stroke="#c23a64" stroke-width="1.5"/>`;
    if(a.mouth === 'frown') s += `<path d="M100 119V124M86 133Q100 121 114 133" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    else s += both(`<path d="M100 119Q100 127 92.5 127.5Q87.5 127.5 85.5 123" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    if(a.mouth === 'fang') s += `<path d="M91 127L94 135L97 127Z M103 127L106 135L109 127Z" fill="#fff" ${st} stroke-width="1.8"/>`;
    s += both(`<path d="M70 118L30 110M70 123L28 125M71 128L34 139" stroke="${a.whisker||O}" stroke-width="1.6" opacity=".75" stroke-linecap="round"/>`);

    /* accessories */
    if(a.acc === 'bandana'){
      s += `<path d="M42 74Q100 54 158 74L159 88Q100 68 41 88Z" fill="${a.accColor}" ${st}/>`;
      s += `<path d="M60 74l3 3M80 68l3 3M120 68l3 3M140 74l3 3M100 65l3 3" stroke="#fff" stroke-width="2" opacity=".85" stroke-linecap="round"/>`;
      s += `<path d="M156 78L182 64L176 84Z M156 84L180 98L168 102Z" fill="${a.accColor}" ${st}/><circle cx="157" cy="81" r="5" fill="${a.accColor}" ${st}/>`;
    }
    if(a.acc === 'ninja'){
      s += `<path d="M42 116Q100 102 158 116L152 150Q100 168 48 150Z" fill="${a.accColor}" ${st}/>`;
      s += `<path d="M50 124Q100 112 150 124" stroke="#fff" stroke-width="2" opacity=".15" fill="none"/>`;
      s += `<path d="M112 76L128 108" stroke="#d0506f" stroke-width="3" stroke-linecap="round"/><path d="M114 86l7-2M118 94l7-2M122 102l6-2" stroke="#d0506f" stroke-width="2" stroke-linecap="round"/>`;
      s += `<path d="M150 120L178 108L170 128Z M150 132L176 142L162 146Z" fill="${a.accColor}" ${st}/>`;
    }
    if(a.acc === 'bow'){
      s += `<g transform="translate(${X(64)} 50) rotate(-18)"><path d="M0 0L-18 -12L-18 12Z M0 0L18 -12L18 12Z" fill="${a.accColor}" ${st}/><circle r="6" fill="${a.accColor}" ${st}/><path d="M-13 -5L-13 5M13 -5L13 5" stroke="#fff" stroke-width="2" opacity=".6" stroke-linecap="round"/></g>`;
    }
    if(a.acc === 'crown'){
      s += `<path d="M70 60L73 26L87 42L100 18L113 42L127 26L130 60Z" fill="url(#${P}gold)" ${st}/>`;
      s += `<path d="M70 60Q100 52 130 60L130 66Q100 58 70 66Z" fill="#c77a00" ${st} stroke-width="2.5"/>`;
      s += `<circle cx="100" cy="46" r="5" fill="#ff3860" ${st} stroke-width="2"/><circle cx="84" cy="50" r="3.5" fill="#3ddcff" ${st} stroke-width="2"/><circle cx="116" cy="50" r="3.5" fill="#6bff8a" ${st} stroke-width="2"/>`;
      s += `<circle cx="73" cy="25" r="3" fill="#fff3a8" ${st} stroke-width="2"/><circle cx="100" cy="17" r="3" fill="#fff3a8" ${st} stroke-width="2"/><circle cx="127" cy="25" r="3" fill="#fff3a8" ${st} stroke-width="2"/>`;
      s += `<path d="M98 40l2-5 2 5" stroke="#fff" stroke-width="1.5" opacity=".8" fill="none"/>`;
    }
    if(a.acc === 'antenna'){
      s += `<path d="M130 56L146 22" stroke="${O}" stroke-width="3.5" stroke-linecap="round"/><path d="M130 56L146 22" stroke="#c9d3e0" stroke-width="1.5" stroke-linecap="round"/>`;
      s += `<circle cx="147" cy="20" r="6" fill="#3ddcff" ${st} stroke-width="2.5" filter="url(#${P}glow)"/>`;
      s += `<rect x="92" y="152" width="16" height="10" rx="2" fill="#0b0f1e" ${st} stroke-width="2"/><circle cx="100" cy="157" r="2.5" fill="#ff2fd6" filter="url(#${P}glow)"/>`;
    }
    if(a.acc === 'tuft'){
      s += `<path d="M84 54L86 30L95 46L100 24L105 46L114 30L116 54Z" fill="url(#${P}fur)" ${st}/>`;
      s += `<path d="M162 28L150 52L160 52L148 76L174 44L163 44L172 28Z" fill="#ffe14d" ${st} stroke-width="2.5"/>`;
      s += `<path d="M38 60q-6 10 0 14q6-4 0-14Z" fill="#8fdcff" ${st} stroke-width="2"/>`;
    }
    if(a.acc === 'beanie'){
      s += `<path d="M44 84Q42 30 100 28Q158 30 156 84Z" fill="${a.accColor}" ${st}/>`;
      s += `<path d="M64 80Q64 44 80 36M84 80Q84 40 94 30M116 80Q116 40 106 30M136 80Q136 44 120 36" stroke="#000" stroke-width="2" opacity=".18" fill="none"/>`;
      s += `<path d="M40 74Q100 60 160 74L160 90Q100 76 40 90Z" fill="#2c4f86" ${st}/>`;
      s += `<path d="M50 80v6M60 78v6M70 76v6M80 75v6M90 74v6M100 74v6M110 74v6M120 75v6M130 76v6M140 78v6M150 80v6" stroke="#fff" stroke-width="1.5" opacity=".25"/>`;
      s += `<circle cx="100" cy="26" r="11" fill="#f2f2f2" ${st}/><path d="M94 20q4-3 8 0" stroke="#fff" stroke-width="2" fill="none"/>`;
    }
    if(a.acc !== 'antenna' && a.acc !== 'ninja'){
      s += `<path d="M62 152Q100 170 138 152L140 161Q100 180 60 161Z" fill="${a.accColor||'#e63946'}" ${st} stroke-width="2.5"/>`;
      s += `<circle cx="100" cy="174" r="7" fill="url(#${P}gold)" ${st} stroke-width="2.5"/><path d="M97 172h6" stroke="#8a5a00" stroke-width="1.5"/>`;
    }
    if(a.acc === 'helmet'){
      s += `<circle cx="100" cy="100" r="82" fill="#bfe8ff" opacity=".07"/><circle cx="100" cy="100" r="82" fill="none" stroke="#e8f6ff" stroke-width="3.5" opacity=".7"/>`;
      s += `<path d="M44 62Q62 30 100 24" stroke="#fff" stroke-width="7" opacity=".45" fill="none" stroke-linecap="round"/><path d="M40 78Q42 72 44 68" stroke="#fff" stroke-width="5" opacity=".35" stroke-linecap="round"/>`;
      s += `<path d="M34 170Q100 200 166 170L170 184Q100 216 30 184Z" fill="#dfe6f0" ${st}/><circle cx="100" cy="190" r="5" fill="#ff5fd2" filter="url(#${P}glow)"/>`;
    }

    s += `<rect width="200" height="200" fill="url(#${P}vig)"/>`;
    return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.name}">${s}</svg>`;
  }


if (typeof module !== 'undefined' && module.exports) module.exports = { CAT_ART, RARITY_COLOR, catSVG };
else Object.assign(globalThis, { CAT_ART, RARITY_COLOR, catSVG });
