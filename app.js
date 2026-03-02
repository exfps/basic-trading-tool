/* ==========================================================
   TradeLab — app.js
   Educational tool. Not financial advice.
========================================================== */
'use strict';

/* ── helpers ── */
const $  = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);

function show(el)     { if (typeof el === 'string') el = $(el); if (el) el.style.display = ''; }
function hide(el)     { if (typeof el === 'string') el = $(el); if (el) el.style.display = 'none'; }
function setErr(id,m) { const e=$(id); if(e) e.textContent = m; }
function clrErr(id)   { setErr(id,''); }

function floorStep(v, step) {
  const dp = (step.toString().split('.')[1]||'').length;
  return parseFloat((Math.floor(v/step)*step).toFixed(dp));
}

function fmt(v, d=2) {
  if (v===null||v===undefined||isNaN(v)) return '—';
  return Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
}

function money(v) {
  if (v===null||isNaN(v)) return '—';
  return (v<0?'-':'')+'$'+fmt(Math.abs(v),2);
}

function stat(label, value, cls='', delay=0) {
  return `<div class="stat-item" style="--sd:${delay}s">
    <div class="stat-label">${label}</div>
    <div class="stat-val ${cls}">${value}</div>
  </div>`;
}

/* ══════════════════════════════════════════
   TAB NAVIGATION  — pure display toggling,
   no class-based visibility conflicts
══════════════════════════════════════════ */
const tabBtns  = document.querySelectorAll('.tab-btn');
const panels   = [0,1,2].map(i => $(`panel-${i}`));
const tabInk   = $('tab-ink');
let   activeTab = 0;

function moveInk(btn) {
  if (!btn || !tabInk) return;
  const parent = btn.closest('.tab-nav-inner');
  if (!parent) return;
  const pr = parent.getBoundingClientRect();
  const br = btn.getBoundingClientRect();
  tabInk.style.left  = (br.left - pr.left) + 'px';
  tabInk.style.width = br.width + 'px';
}

function switchTab(idx) {
  activeTab = idx;
  tabBtns.forEach((b,i) => {
    b.classList.toggle('active', i===idx);
  });
  panels.forEach((p,i) => {
    if (i === idx) {
      p.style.display = 'block';
      // re-trigger animation
      p.style.animation = 'none';
      void p.offsetWidth;
      p.style.animation = '';
    } else {
      p.style.display = 'none';
    }
  });
  moveInk(tabBtns[idx]);
}

tabBtns.forEach((btn, idx) => {
  btn.addEventListener('click', () => switchTab(idx));
});

// init
requestAnimationFrame(() => {
  switchTab(0);
});

window.addEventListener('resize', () => moveInk(tabBtns[activeTab]));

/* ══════════════════════════════════════════
   TAB 0 — POSITION SIZE CALCULATOR
══════════════════════════════════════════ */

const cInstr = $('c-instrument');
$('c-instrument').addEventListener('change', updateInstrUI);
$('nq-type').addEventListener('change', () => {
  $('nq-tval').value = $('nq-type').value === 'nq' ? '5.00' : '0.50';
  $('nq-margin').value = $('nq-type').value === 'nq' ? '1000' : '100';
});

function updateInstrUI() {
  if (cInstr.value === 'gold') {
    show('gold-settings');
    hide('nq-settings');
  } else {
    hide('gold-settings');
    show('nq-settings');
  }
}

function validateCalc() {
  clrErr('c-risk-err'); clrErr('c-stop-err'); clrErr('c-global-err');
  let ok = true;
  const risk  = parseFloat($('c-risk').value);
  const bal   = parseFloat($('c-balance').value);
  const entry = parseFloat($('c-entry').value);
  const stop  = parseFloat($('c-stop').value);

  if (risk > 2.0)             { setErr('c-risk-err','Max 2.0% allowed.'); $('c-calc').disabled=true; return false; }
  if (isNaN(risk)||risk<=0)   { setErr('c-risk-err','Required.'); ok=false; }
  if (isNaN(bal)||bal<=0)     { setErr('c-global-err','Enter account balance.'); ok=false; }
  if (isNaN(entry)||entry<=0) { setErr('c-global-err','Enter entry price.'); ok=false; }
  if (isNaN(stop)||stop<=0)   { setErr('c-stop-err','Enter stop loss.'); ok=false; }
  if (!isNaN(entry)&&!isNaN(stop)&&Math.abs(entry-stop)<0.0001) {
    setErr('c-stop-err','Stop distance is too small — adjust prices.');
    $('c-calc').disabled=true; return false;
  }
  $('c-calc').disabled = !ok;
  return ok;
}

['c-balance','c-risk','c-entry','c-stop','c-tp','g-cs','g-step','g-lev','nq-tick','nq-tval','nq-margin']
  .forEach(id => { const el=$(id); if(el) el.addEventListener('input', validateCalc); });

$('c-calc').addEventListener('click', () => {
  if (!validateCalc()) return;

  const bal      = parseFloat($('c-balance').value);
  const riskPct  = parseFloat($('c-risk').value)/100;
  const entry    = parseFloat($('c-entry').value);
  const stopP    = parseFloat($('c-stop').value);
  const tp       = parseFloat($('c-tp').value)||null;
  const maxRisk  = bal * riskPct;
  const stopDist = Math.abs(entry - stopP);
  let html='', formula='';

  if (cInstr.value === 'gold') {
    const cs      = parseFloat($('g-cs').value)||100;
    const step    = parseFloat($('g-step').value)||0.01;
    const lev     = parseFloat($('g-lev').value)||100;
    const rpl     = stopDist * cs;
    if (rpl<=0) { setErr('c-global-err','Risk per lot is zero.'); return; }
    const rawLots = maxRisk / rpl;
    const lots    = floorStep(rawLots, step);
    const actual  = lots * rpl;
    const notional   = lots * cs * entry;
    const margin     = notional / lev;
    const marginPct  = bal>0 ? margin/bal*100 : 0;

    html += stat('Stop Distance',   `$${fmt(stopDist,2)}`, '', 0);
    html += stat('Max $ Risk',      money(maxRisk),        'acc', 0.04);
    html += stat('Position Size',   `${fmt(lots,2)} lots`, 'pos', 0.08);
    html += stat('Actual $ Risk',   money(actual),         '', 0.12);
    html += stat('Notional Value',  money(notional),       '', 0.16);
    html += stat('Margin Required', money(margin),         marginPct>20?'neg':'', 0.20);
    html += stat('Margin Used',     `${fmt(marginPct,1)}%`,marginPct>20?'neg':'', 0.24);
    if (marginPct>50) html += `<div class="stat-warn" style="--sd:.26s">Margin exceeds 50% of your balance. Consider reducing size or increasing leverage.</div>`;

    if (tp) {
      const tpD=Math.abs(tp-entry), rr=tpD/stopDist, profit=lots*tpD*cs;
      html += stat('R:R',             `1 : ${fmt(rr,2)}`, 'acc', 0.28);
      html += stat('Potential Profit',money(profit),      'pos', 0.32);
      html += stat('R Multiple',      `${fmt(rr,2)}R`,    'pos', 0.36);
    }

    formula = `Stop distance = |${entry} − ${stopP}| = ${fmt(stopDist,4)} pts
Risk per lot = ${fmt(stopDist,4)} × ${cs} = ${fmt(rpl,4)}
Max $ risk = ${fmt(bal,2)} × ${fmt(riskPct*100,2)}% = ${fmt(maxRisk,4)}
Raw lots = ${fmt(maxRisk,4)} ÷ ${fmt(rpl,4)} = ${fmt(rawLots,6)}
Lots (floor to ${step}) = ${fmt(lots,2)}
Notional = ${fmt(lots,2)} × ${cs} × ${fmt(entry,2)} = ${fmt(notional,2)}
Margin = ${fmt(notional,2)} ÷ ${lev} = ${fmt(margin,2)}`;

  } else {
    const tickSz  = parseFloat($('nq-tick').value)||0.25;
    const tickVal = parseFloat($('nq-tval').value)||($('nq-type').value==='nq'?5:0.5);
    const margPC  = parseFloat($('nq-margin').value)||($('nq-type').value==='nq'?1000:100);
    const ticks   = stopDist / tickSz;
    const rpc     = ticks * tickVal;
    if (rpc<=0) { setErr('c-global-err','Risk per contract is zero.'); return; }
    const raw  = maxRisk / rpc;
    const cts  = Math.floor(raw);
    const actual  = cts * rpc;
    const label   = $('nq-type').value.toUpperCase();
    const totMarg = cts * margPC;
    const mPct    = bal>0 ? totMarg/bal*100 : 0;

    html += stat('Stop (pts)',      `${fmt(stopDist,2)}`,  '', 0);
    html += stat('Stop (ticks)',    `${fmt(ticks,1)}`,     '', 0.04);
    html += stat('Max $ Risk',      money(maxRisk),        'acc', 0.08);
    html += stat('Contracts',       `${cts} ${label}`,     'pos', 0.12);
    html += stat('Actual $ Risk',   money(actual),         '', 0.16);
    html += stat('Margin/Contract', money(margPC),         '', 0.20);
    html += stat('Total Margin',    money(totMarg),        mPct>20?'neg':'', 0.24);
    html += stat('Margin Used',     `${fmt(mPct,1)}%`,     mPct>20?'neg':'', 0.28);
    if (mPct>50) html += `<div class="stat-warn" style="--sd:.30s">Total margin exceeds 50% of balance. Consider fewer contracts.</div>`;

    if (tp) {
      const tpPts=Math.abs(tp-entry), tpTk=tpPts/tickSz, rr=tpPts/stopDist, profit=cts*tpTk*tickVal;
      html += stat('R:R',             `1 : ${fmt(rr,2)}`, 'acc', 0.32);
      html += stat('Potential Profit',money(profit),      'pos', 0.36);
      html += stat('R Multiple',      `${fmt(rr,2)}R`,    'pos', 0.40);
    }

    formula = `Stop distance = ${fmt(stopDist,4)} pts
Stop in ticks = ${fmt(stopDist,4)} ÷ ${tickSz} = ${fmt(ticks,2)}
Risk/contract = ${fmt(ticks,2)} × ${fmt(tickVal,2)} = ${fmt(rpc,4)}
Max $ risk = ${fmt(bal,2)} × ${fmt(riskPct*100,2)}% = ${fmt(maxRisk,4)}
Contracts (floor) = ${cts}
Total margin = ${cts} × ${fmt(margPC,2)} = ${fmt(totMarg,2)}`;
  }

  $('c-stats').innerHTML = html;
  $('c-formula').textContent = formula;
  show('c-results');
  setTimeout(() => $('c-results').scrollIntoView({behavior:'smooth',block:'nearest'}), 60);
});

/* ══════════════════════════════════════════
   TAB 1 — RISK MANAGEMENT
══════════════════════════════════════════ */

const rInstr = $('r-instr');
rInstr.addEventListener('change', updateRiskUI);

function updateRiskUI() {
  const v = rInstr.value;
  $('r-stop-lbl').textContent   = v==='gold' ? 'Typical Stop ($)'    : 'Typical Stop (pts)';
  $('r-stop-hint').textContent  = v==='gold' ? 'Gold: price distance' : `${v.toUpperCase()}: point distance`;
  $('r-stop').placeholder       = v==='gold' ? '10' : '20';
  $('r-lev-lbl').innerHTML      = v==='gold'
    ? 'Leverage <span class="chip">e.g. 100</span>'
    : 'Initial Margin / contract ($) <span class="chip">check broker</span>';
  if (v==='nq')  { $('r-lev').value='1000'; $('r-lev').placeholder='1000'; }
  if (v==='mnq') { $('r-lev').value='100';  $('r-lev').placeholder='100'; }
  if (v==='gold'){ $('r-lev').value='100';  $('r-lev').placeholder='100'; }
  $('r-entry-lbl').textContent = v==='gold' ? 'Typical Entry Price' : 'Typical Entry Price';
  $('r-entry').placeholder     = v==='gold' ? '1950.00' : '18000';
}

function validateRisk() {
  clrErr('r-risk-err'); clrErr('r-daily-err');
  let ok = true;
  const r = parseFloat($('r-risk').value);
  const d = parseFloat($('r-daily').value);
  if (r>2.0)          { setErr('r-risk-err','Max 2.0%.'); $('r-calc').disabled=true; return false; }
  if (d>4.0)          { setErr('r-daily-err','Max 4.0%.'); $('r-calc').disabled=true; return false; }
  if (isNaN(r)||r<=0) { setErr('r-risk-err','Required.'); ok=false; }
  if (isNaN(d)||d<=0) { setErr('r-daily-err','Required.'); ok=false; }
  $('r-calc').disabled = !ok;
  return ok;
}

['r-bal','r-risk','r-daily','r-trades','r-stop','r-lev','r-entry']
  .forEach(id => { const el=$(id); if(el) el.addEventListener('input', validateRisk); });

$('r-calc').addEventListener('click', () => {
  if (!validateRisk()) return;
  const bal     = parseFloat($('r-bal').value);
  const rPct    = parseFloat($('r-risk').value)/100;
  const dPct    = parseFloat($('r-daily').value)/100;
  const tpd     = parseInt($('r-trades').value)||1;
  const stopSz  = parseFloat($('r-stop').value)||0;
  const instr   = rInstr.value;
  const levOrM  = parseFloat($('r-lev').value)||(instr==='gold'?100:instr==='nq'?1000:100);
  const ep      = parseFloat($('r-entry').value)||0;

  if (isNaN(bal)||bal<=0) { setErr('r-risk-err','Enter account balance.'); return; }

  const maxPT = bal * rPct;
  const maxD  = bal * dPct;

  let rpu=0, ulabel='';
  if (instr==='gold')    { rpu=stopSz*100;          ulabel='lots'; }
  else if (instr==='nq') { rpu=(stopSz/0.25)*5;     ulabel='NQ contracts'; }
  else                   { rpu=(stopSz/0.25)*0.5;   ulabel='MNQ contracts'; }

  const sz = rpu>0 ? (instr==='gold'?floorStep(maxPT/rpu,0.01):Math.floor(maxPT/rpu)) : null;

  let marginPU=0, totM=0, mPct=0;
  if (instr==='gold'&&ep>0&&sz) {
    marginPU = (100*ep)/levOrM;
    totM     = sz * marginPU;
    mPct     = totM/bal*100;
  } else if (instr!=='gold'&&sz) {
    marginPU = levOrM;
    totM     = sz * marginPU;
    mPct     = totM/bal*100;
  }

  let html='';
  html += stat('Max $ / Trade',  money(maxPT), 'acc',  0);
  html += stat('Max $ / Day',    money(maxD),  'neg',  0.04);
  html += stat('Trades Today',   `${tpd}`,     '',     0.08);
  html += stat('Risk / Trade',   `${fmt(rPct*100,2)}%`, '', 0.12);
  if (sz!==null&&stopSz>0)
    html += stat('Max Size', `${instr==='gold'?fmt(sz,2):sz} ${ulabel}`, 'pos', 0.16);
  if (rPct*tpd>dPct)
    html += stat('Max Trades',`${Math.floor(dPct/rPct)}`, 'neg', 0.20);
  if (marginPU>0) {
    html += stat(instr==='gold'?'Margin / Lot':'Margin / Contract', money(marginPU), '', 0.24);
    html += stat('Total Margin', money(totM), mPct>20?'neg':'', 0.28);
    html += stat('Margin Used',  `${fmt(mPct,1)}%`, mPct>20?'neg':'', 0.32);
  }

  $('r-stats').innerHTML = html;

  const flags=[];
  if (tpd>5)          flags.push('High frequency (>5/day) increases emotional risk.');
  if (rPct>=0.015)    flags.push('Risk per trade near maximum. Consider 0.5–1.0%.');
  if (dPct>=0.03)     flags.push('Daily loss limit near maximum (4%). A few losses will trigger it.');
  if (mPct>50)        flags.push(`Margin is ${fmt(mPct,1)}% of your balance — dangerously high.`);
  if (sz!==null&&sz<1&&instr!=='gold') flags.push('Position rounds to 0 contracts. Increase account or widen stop.');

  const fe=$('r-flags');
  if (flags.length) {
    fe.innerHTML=`<div class="red-flags-title">Red Flags</div><ul>${flags.map(f=>`<li>${f}</li>`).join('')}</ul>`;
    show(fe);
  } else {
    hide(fe);
  }

  show('r-results');
  setTimeout(() => $('r-results').scrollIntoView({behavior:'smooth',block:'nearest'}), 60);
});

/* ══════════════════════════════════════════
   TAB 2 — TRADE JOURNAL
══════════════════════════════════════════ */

const STORE = 'tradelab_v3';
let trades=[], editId=null;

function loadTrades() {
  try { const r=localStorage.getItem(STORE); trades=r?JSON.parse(r):[]; if(!Array.isArray(trades)) trades=[]; }
  catch { trades=[]; }
}
function saveTrades() {
  try { localStorage.setItem(STORE, JSON.stringify(trades)); } catch(e){console.error(e);}
}
function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

function setNow() {
  const now=new Date();
  $('j-dt').value=new Date(now-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
setNow();

$('j-setup').addEventListener('change', () => {
  $('j-custom-row').style.display = $('j-setup').value==='custom' ? '' : 'none';
});

function clearForm() {
  setNow();
  ['j-instr','j-dir','j-size','j-entry','j-sl','j-tp','j-pl','j-r','j-url','j-notes'].forEach(id=>{
    const el=$(id); if(!el) return;
    if(el.tagName==='SELECT') el.selectedIndex=0; else el.value='';
  });
  $('j-setup').value='Breakout';
  $('j-custom').value='';
  $('j-custom-row').style.display='none';
  clrErr('j-err');
  editId=null;
  $('j-form-title').textContent='New Entry';
  hide('j-cancel');
}

$('j-cancel').addEventListener('click', clearForm);

$('j-save').addEventListener('click', () => {
  clrErr('j-err');
  const dt    = $('j-dt').value;
  const entry = $('j-entry').value;
  if (!dt)    { setErr('j-err','Date/time required.'); return; }
  if (!entry) { setErr('j-err','Entry price required.'); return; }
  const setupRaw = $('j-setup').value;
  const setup    = setupRaw==='custom' ? ($('j-custom').value.trim()||'Other') : setupRaw;
  const t = {
    id:       editId||uid(),
    dt, instrument:$('j-instr').value, direction:$('j-dir').value,
    entry:    parseFloat(entry)||0,
    sl:       $('j-sl').value!==''  ? parseFloat($('j-sl').value)  : null,
    tp:       $('j-tp').value!==''  ? parseFloat($('j-tp').value)  : null,
    size:     $('j-size').value!=='' ? parseFloat($('j-size').value): null,
    pl:       $('j-pl').value!==''  ? parseFloat($('j-pl').value)  : null,
    r:        $('j-r').value!==''   ? parseFloat($('j-r').value)   : null,
    setup, url:$('j-url').value.trim(), notes:$('j-notes').value.trim()
  };
  if (editId) { const i=trades.findIndex(x=>x.id===editId); if(i!==-1) trades[i]=t; }
  else trades.unshift(t);
  saveTrades(); clearForm(); render();
  const btn=$('j-save');
  btn.textContent='Saved ✓';
  setTimeout(()=>{ btn.innerHTML='Save Trade <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 3.5L5.5 10 2 6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'; },1400);
});

function render() {
  const srch = $('j-search').value.toLowerCase();
  const fi   = $('j-fi').value;
  const fd   = $('j-fd').value;
  const fr   = $('j-fr').value;
  const from = $('j-from').value;
  const to   = $('j-to').value;

  const list = trades.filter(t => {
    if (fi && t.instrument!==fi) return false;
    if (fd && t.direction!==fd)  return false;
    if (fr==='win'  && (t.pl===null||t.pl<=0))  return false;
    if (fr==='loss' && (t.pl===null||t.pl>=0))  return false;
    if (fr==='be'   && t.pl!==0)                return false;
    if (from && t.dt<from) return false;
    if (to   && t.dt.slice(0,10)>to) return false;
    if (srch && ![t.notes,t.setup,t.instrument].join(' ').toLowerCase().includes(srch)) return false;
    return true;
  });

  const tbody=$('j-tbody');
  tbody.innerHTML='';
  if (!list.length) {
    show('j-empty');
  } else {
    hide('j-empty');
    list.forEach(t => {
      const plC = t.pl>0?'td-pos':t.pl<0?'td-neg':'';
      const plS = t.pl!==null?(t.pl>=0?'+':'')+money(t.pl).replace('$',''):'—';
      const rS  = t.r!==null?(t.r>=0?'+':'')+fmt(t.r,2)+'R':'—';
      const tr  = document.createElement('tr');
      tr.innerHTML=`
        <td>${t.dt.replace('T',' ').slice(0,16)}</td>
        <td>${t.instrument}</td>
        <td>${t.direction}</td>
        <td>${t.entry}</td>
        <td>${t.sl??'—'}</td>
        <td>${t.size??'—'}</td>
        <td class="${plC}">${plS}</td>
        <td>${rS}</td>
        <td>${t.setup}</td>
        <td>
          <button class="act-btn edit-btn" data-id="${t.id}">Edit</button>
          <button class="act-btn del del-btn" data-id="${t.id}">Del</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }
  renderStats(list);
}

function renderStats(list) {
  const sc=$('j-stats-card');
  if (!trades.length) { hide(sc); return; }
  show(sc);
  const closed=list.filter(t=>t.pl!==null);
  const wins=closed.filter(t=>t.pl>0), losses=closed.filter(t=>t.pl<0);
  const wr=closed.length?wins.length/closed.length*100:null;
  const rL=list.filter(t=>t.r!==null);
  const avgR=rL.length?rL.reduce((s,t)=>s+t.r,0)/rL.length:null;
  const tot=closed.reduce((s,t)=>s+t.pl,0);
  const gw=wins.reduce((s,t)=>s+t.pl,0);
  const gl=Math.abs(losses.reduce((s,t)=>s+t.pl,0));
  const pf=gl>0?gw/gl:null;
  const best=closed.length?Math.max(...closed.map(t=>t.pl)):null;
  const worst=closed.length?Math.min(...closed.map(t=>t.pl)):null;
  let peak=0,run=0,maxDD=0;
  [...closed].reverse().forEach(t=>{ run+=t.pl; if(run>peak)peak=run; const dd=peak-run; if(dd>maxDD)maxDD=dd; });

  let h='';
  h+=stat('Trades',     `${list.length}`,                '',                0);
  h+=stat('Win Rate',   wr!==null?`${fmt(wr,1)}%`:'—',  wr>=50?'pos':'neg',0.04);
  h+=stat('Avg R',      avgR!==null?`${fmt(avgR,2)}R`:'—', avgR>=0?'pos':'neg',0.08);
  h+=stat('Total P/L',  money(tot),                      tot>=0?'pos':'neg',0.12);
  h+=stat('Profit Factor',pf!==null?fmt(pf,2):'—',      pf>=1?'pos':'neg', 0.16);
  h+=stat('Best Trade', best!==null?money(best):'—',     'pos',             0.20);
  h+=stat('Worst Trade',worst!==null?money(worst):'—',   'neg',             0.24);
  h+=stat('Est. Max DD',maxDD>0?money(maxDD):'$0.00',    '',                0.28);
  $('j-stats-grid').innerHTML=h;
}

$('j-tbody').addEventListener('click', e=>{
  const btn=e.target.closest('button'); if(!btn) return;
  const id=btn.dataset.id;
  if (btn.classList.contains('edit-btn')) {
    const t=trades.find(x=>x.id===id); if(!t) return;
    editId=id;
    $('j-dt').value=$('j-instr').value=$('j-dir').value='';
    $('j-dt').value=t.dt; $('j-instr').value=t.instrument; $('j-dir').value=t.direction;
    ['entry','sl','tp','size','pl','r','url','notes'].forEach(k=>{
      const el=$(k==='sl'?'j-sl':k==='tp'?'j-tp':k==='url'?'j-url':`j-${k}`);
      if(el) el.value=t[k]??'';
    });
    const opts=Array.from($('j-setup').options).map(o=>o.value);
    if(opts.includes(t.setup)){$('j-setup').value=t.setup;$('j-custom-row').style.display='none';}
    else{$('j-setup').value='custom';$('j-custom').value=t.setup;$('j-custom-row').style.display='';}
    $('j-form-title').textContent='Edit Entry';
    show('j-cancel');
    window.scrollTo({top:0,behavior:'smooth'});
  }
  if (btn.classList.contains('del-btn')&&confirm('Delete this trade?')) {
    trades=trades.filter(x=>x.id!==id); saveTrades(); render();
  }
});

['j-search','j-fi','j-fd','j-fr','j-from','j-to'].forEach(id=>{
  const el=$(id); if(el) el.addEventListener('input', render);
});

$('j-clear-f').addEventListener('click',()=>{
  ['j-search','j-from','j-to'].forEach(id=>{const e=$(id);if(e)e.value='';});
  ['j-fi','j-fd','j-fr'].forEach(id=>{const e=$(id);if(e)e.value='';});
  render();
});

/* CSV export */
$('j-export').addEventListener('click',()=>{
  if(!trades.length){alert('No trades to export.');return;}
  const cols=['id','dt','instrument','direction','entry','sl','tp','size','pl','r','setup','url','notes'];
  const esc=v=>{const s=String(v??'');return(s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s.replace(/"/g,'""')}"`  :s;};
  const csv=[cols.join(','),...trades.map(t=>cols.map(c=>esc(t[c])).join(','))].join('\n');
  const a=Object.assign(document.createElement('a'),{
    href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),
    download:`tradelab_${new Date().toISOString().slice(0,10)}.csv`
  });
  a.click(); URL.revokeObjectURL(a.href);
});

/* CSV import */
$('j-import').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const lines=ev.target.result.split('\n').filter(l=>l.trim());
    if(lines.length<2){showIMsg('No data rows found.',true);return;}
    const hdrs=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
    const req=['dt','instrument','direction','entry'];
    const miss=req.filter(c=>!hdrs.includes(c));
    if(miss.length){showIMsg(`Missing columns: ${miss.join(', ')}`,true);return;}
    let imp=0,skip=0;
    for(let i=1;i<lines.length;i++){
      try{
        const vals=parseCSV(lines[i]);
        const row={};
        hdrs.forEach((h,idx)=>{row[h]=(vals[idx]||'').trim();});
        if(!row.dt||!row.instrument||!row.direction||!row.entry){skip++;continue;}
        const t={id:row.id||uid(),dt:row.dt,instrument:row.instrument,direction:row.direction,
          entry:parseFloat(row.entry)||0,sl:row.sl?parseFloat(row.sl):null,
          tp:row.tp?parseFloat(row.tp):null,size:row.size?parseFloat(row.size):null,
          pl:row.pl!==''?parseFloat(row.pl):null,r:row.r!==''?parseFloat(row.r):null,
          setup:row.setup||'Other',url:row.url||'',notes:row.notes||''};
        if(!trades.find(x=>x.id===t.id)){trades.unshift(t);imp++;}else skip++;
      }catch{skip++;}
    }
    saveTrades(); render();
    showIMsg(`Imported ${imp} trade(s). Skipped ${skip}.`,false);
  };
  reader.readAsText(f);
  e.target.value='';
});

function parseCSV(line){
  const r=[];let cur='',inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){r.push(cur);cur='';}else cur+=c;
  }
  r.push(cur); return r;
}

function showIMsg(msg,err){
  const el=$('j-import-msg');
  el.textContent=msg;
  el.style.background=err?'var(--red-bg)':'var(--amber-bg)';
  el.style.borderColor=err?'var(--red-border)':'rgba(245,158,11,0.3)';
  el.style.color=err?'#fca5a5':'#fcd34d';
  show(el);
  setTimeout(()=>hide(el),5000);
}

/* Delete all */
$('j-delete-all').addEventListener('click',()=>show('modal'));
$('modal-no').addEventListener('click',()=>hide('modal'));
$('modal-yes').addEventListener('click',()=>{ trades=[];saveTrades();hide('modal');render(); });
$('modal').addEventListener('click',e=>{if(e.target===$('modal'))hide('modal');});

/* ══ INIT ══ */
loadTrades();
render();
updateInstrUI();
updateRiskUI();
