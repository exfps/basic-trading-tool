/* =====================================================
   TradeLab — app.js
   Educational tool. Not financial advice.
   ===================================================== */
'use strict';

// ══════════════ HELPERS ══════════════
function $(id) { return document.getElementById(id); }
function showEl(el) { (typeof el === 'string' ? $(el) : el)?.classList.remove('hidden'); }
function hideEl(el) { (typeof el === 'string' ? $(el) : el)?.classList.add('hidden'); }
function setErr(id, msg) { const e = $(id); if (e) e.textContent = msg; }
function clearErr(id) { setErr(id, ''); }

function floorToStep(value, step) {
  const dp = (step.toString().split('.')[1] || '').length;
  return parseFloat((Math.floor(value / step) * step).toFixed(dp));
}

function fmt(v, d = 2) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtMoney(v) {
  if (isNaN(v) || v === null) return '—';
  const sign = v < 0 ? '-' : '';
  return `${sign}$${fmt(Math.abs(v), 2)}`;
}

function buildStat(label, value, cls = '', delay = 0) {
  return `<div class="result-item" style="--item-delay:${delay}s">
    <div class="result-label">${label}</div>
    <div class="result-value ${cls}">${value}</div>
  </div>`;
}

// ══════════════ TAB NAVIGATION ══════════════
const tabBtns = document.querySelectorAll('.tab-btn');
const tabSlider = document.getElementById('tab-slider');

function updateSlider(activeBtn) {
  if (!activeBtn || !tabSlider) return;
  const nav = activeBtn.closest('.tabs-inner');
  if (!nav) return;
  const navRect = nav.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();
  tabSlider.style.left = (btnRect.left - navRect.left) + 'px';
  tabSlider.style.width = btnRect.width + 'px';
}

// Init slider position
requestAnimationFrame(() => {
  updateSlider(document.querySelector('.tab-btn.active'));
});

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => {
      t.classList.remove('active', 'tab-enter');
      t.style.display = 'none';
    });

    btn.classList.add('active');
    updateSlider(btn);

    const target = $('tab-' + btn.dataset.tab);
    if (target) {
      target.style.display = 'block';
      target.classList.add('active');
      void target.offsetWidth; // force reflow
      target.classList.add('tab-enter');
    }
  });
});

// ══════════════ TAB 1: POSITION SIZE ══════════════

const instrumentSel = $('c-instrument');
const goldSettings  = $('gold-settings');
const nqSettings    = $('nq-settings');

function updateInstrumentUI() {
  if (instrumentSel.value === 'gold') {
    goldSettings.classList.remove('hidden');
    nqSettings.classList.add('hidden');
  } else {
    goldSettings.classList.add('hidden');
    nqSettings.classList.remove('hidden');
  }
}
instrumentSel.addEventListener('change', updateInstrumentUI);

$('nq-type').addEventListener('change', () => {
  $('nq-tick-value').value = $('nq-type').value === 'nq' ? '5.00' : '0.50';
});

function validateCalc() {
  clearErr('c-risk-err'); clearErr('c-stop-err'); clearErr('c-global-err');
  let ok = true;

  const risk = parseFloat($('c-risk').value);
  if (risk > 2.0) {
    setErr('c-risk-err', 'Max 2.0% allowed.');
    $('c-calculate').disabled = true;
    return false;
  }
  if (isNaN(risk) || risk <= 0) { setErr('c-risk-err', 'Enter a valid risk %'); ok = false; }

  const bal = parseFloat($('c-balance').value);
  if (isNaN(bal) || bal <= 0) { setErr('c-global-err', 'Enter account balance.'); ok = false; }

  const entry = parseFloat($('c-entry').value);
  const stop  = parseFloat($('c-stop').value);
  if (isNaN(entry) || entry <= 0) { setErr('c-global-err', 'Enter entry price.'); ok = false; }
  if (isNaN(stop)  || stop  <= 0) { setErr('c-stop-err', 'Enter stop loss.'); ok = false; }

  if (!isNaN(entry) && !isNaN(stop) && Math.abs(entry - stop) < 0.0001) {
    setErr('c-stop-err', 'Stop distance too small — adjust prices.');
    $('c-calculate').disabled = true;
    return false;
  }

  $('c-calculate').disabled = !ok;
  return ok;
}

['c-balance','c-risk','c-entry','c-stop','c-tp','g-contract-size','g-lot-step','nq-tick-size','nq-tick-value']
  .forEach(id => { const el = $(id); if (el) el.addEventListener('input', validateCalc); });

$('c-calculate').addEventListener('click', () => {
  if (!validateCalc()) return;

  const bal      = parseFloat($('c-balance').value);
  const riskPct  = parseFloat($('c-risk').value) / 100;
  const entry    = parseFloat($('c-entry').value);
  const stop     = parseFloat($('c-stop').value);
  const tp       = parseFloat($('c-tp').value) || null;
  const maxRisk  = bal * riskPct;
  const stopDist = Math.abs(entry - stop);

  let html = '', formula = '';

  if (instrumentSel.value === 'gold') {
    const cs        = parseFloat($('g-contract-size').value) || 100;
    const lotStep   = parseFloat($('g-lot-step').value)      || 0.01;
    const leverage  = parseFloat($('g-leverage').value)      || 100;
    const rpl       = stopDist * cs; // risk per lot
    if (rpl <= 0) { setErr('c-global-err', 'Risk per lot is zero.'); return; }
    const rawLots   = maxRisk / rpl;
    const lots      = floorToStep(rawLots, lotStep);
    const actual    = lots * rpl;

    // Margin & notional
    const notional       = lots * cs * entry;           // full position value
    const marginRequired = notional / leverage;
    const marginPct      = bal > 0 ? (marginRequired / bal * 100) : 0;

    html += buildStat('Stop Distance',    `$${fmt(stopDist,2)}`,   '',         0);
    html += buildStat('Max $ Risk',       fmtMoney(maxRisk),       'accent',   0.05);
    html += buildStat('Position Size',    `${fmt(lots,2)} lots`,   'positive', 0.10);
    html += buildStat('Actual $ Risk',    fmtMoney(actual),        '',         0.15);
    html += buildStat('Notional Value',   fmtMoney(notional),      '',         0.20);
    html += buildStat('Margin Required',  fmtMoney(marginRequired),marginPct > 20 ? 'negative' : '', 0.25);
    html += buildStat('Margin Used',      `${fmt(marginPct,1)}% of balance`, marginPct > 20 ? 'negative' : '', 0.30);

    if (marginPct > 50) {
      html += `<div class="result-warn" style="--item-delay:0.32s">Margin required exceeds 50% of your balance. Consider reducing position size or increasing leverage.</div>`;
    }

    if (tp) {
      const tpDist = Math.abs(tp - entry);
      const rr     = tpDist / stopDist;
      const profit = lots * tpDist * cs;
      html += buildStat('R:R',              `1 : ${fmt(rr,2)}`, 'accent',   0.35);
      html += buildStat('Potential Profit', fmtMoney(profit),   'positive', 0.40);
      html += buildStat('R Multiple',       `${fmt(rr,2)}R`,    'positive', 0.45);
    }

    formula = `
Stop distance = |${entry} − ${stop}| = ${fmt(stopDist,4)} pts<br>
Risk per 1 lot = Stop dist × Contract size = ${fmt(stopDist,4)} × ${cs} = ${fmt(rpl,4)}<br>
Max $ risk = ${fmt(bal,2)} × ${fmt(riskPct*100,2)}% = ${fmt(maxRisk,4)}<br>
Raw lots = ${fmt(maxRisk,4)} / ${fmt(rpl,4)} = ${fmt(rawLots,6)}<br>
Lots (floor to ${lotStep} step) = ${fmt(lots,2)}<br>
Notional value = Lots × Contract size × Entry = ${fmt(lots,2)} × ${cs} × ${fmt(entry,2)} = ${fmt(notional,2)}<br>
Margin required = Notional ÷ Leverage = ${fmt(notional,2)} ÷ ${leverage} = ${fmt(marginRequired,2)}`;
  } else {
    const tickSz    = parseFloat($('nq-tick-size').value)  || 0.25;
    const tickVal   = parseFloat($('nq-tick-value').value) || ($('nq-type').value === 'nq' ? 5 : 0.5);
    const marginPer = parseFloat($('nq-margin').value)     || ($('nq-type').value === 'nq' ? 1000 : 100);
    const ticks     = stopDist / tickSz;
    const rpc       = ticks * tickVal;
    if (rpc <= 0) { setErr('c-global-err', 'Risk per contract is zero.'); return; }
    const raw        = maxRisk / rpc;
    const contracts  = Math.floor(raw);
    const actual     = contracts * rpc;
    const label      = $('nq-type').value.toUpperCase();

    // Margin
    const totalMargin = contracts * marginPer;
    const marginPct   = bal > 0 ? (totalMargin / bal * 100) : 0;

    html += buildStat('Stop (pts)',       `${fmt(stopDist,2)}`,    '',         0);
    html += buildStat('Stop (ticks)',     `${fmt(ticks,1)}`,       '',         0.05);
    html += buildStat('Max $ Risk',       fmtMoney(maxRisk),       'accent',   0.10);
    html += buildStat('Contracts',        `${contracts} ${label}`, 'positive', 0.15);
    html += buildStat('Actual $ Risk',    fmtMoney(actual),        '',         0.20);
    html += buildStat('Margin / Contract',fmtMoney(marginPer),     '',         0.25);
    html += buildStat('Total Margin',     fmtMoney(totalMargin),   marginPct > 20 ? 'negative' : '', 0.30);
    html += buildStat('Margin Used',      `${fmt(marginPct,1)}% of balance`, marginPct > 20 ? 'negative' : '', 0.35);

    if (marginPct > 50) {
      html += `<div class="result-warn" style="--item-delay:0.37s">Total margin exceeds 50% of your balance. Consider fewer contracts.</div>`;
    }

    if (tp) {
      const tpPts  = Math.abs(tp - entry);
      const tpTk   = tpPts / tickSz;
      const rr     = tpPts / stopDist;
      const profit = contracts * tpTk * tickVal;
      html += buildStat('R:R',              `1 : ${fmt(rr,2)}`, 'accent',   0.40);
      html += buildStat('Potential Profit', fmtMoney(profit),   'positive', 0.45);
      html += buildStat('R Multiple',       `${fmt(rr,2)}R`,    'positive', 0.50);
    }

    formula = `
Stop distance = ${fmt(stopDist,4)} pts<br>
Stop in ticks = ${fmt(stopDist,4)} / ${tickSz} = ${fmt(ticks,2)}<br>
Risk per contract = ${fmt(ticks,2)} × ${fmt(tickVal,2)} = ${fmt(rpc,4)}<br>
Max $ risk = ${fmt(bal,2)} × ${fmt(riskPct*100,2)}% = ${fmt(maxRisk,4)}<br>
Contracts (floor) = ${contracts}<br>
Total margin = ${contracts} contracts × ${fmt(marginPer,2)} = ${fmt(totalMargin,2)}`;
  }

  $('c-results-grid').innerHTML = html;
  $('c-formula-text').innerHTML = formula;
  showEl('c-results');
  setTimeout(() => $('c-results')?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);
});

// ══════════════ TAB 2: RISK MANAGEMENT ══════════════

const rInstr = $('r-instrument');

function updateRiskInstrUI() {
  const v = rInstr.value;
  $('r-stop-label').textContent = v === 'gold' ? 'Typical Stop ($)' : 'Typical Stop (pts)';
  $('r-stop-hint').textContent  = v === 'gold' ? 'Gold: price distance in $' : `${v.toUpperCase()}: point distance`;
  $('r-stop-size').placeholder  = v === 'gold' ? '10' : '20';
  // leverage row: show for gold, show margin label for NQ
  const leverageRow = $('r-leverage-row');
  const leverageLabel = $('r-leverage-label');
  if (v === 'gold') {
    leverageRow.classList.remove('hidden');
    leverageLabel.innerHTML = 'Leverage <span class="hint">e.g. 100 for 1:100</span>';
    $('r-leverage').placeholder = '100';
    $('r-entry-price').closest('.field').querySelector('label').textContent = 'Typical Entry Price';
    $('r-entry-price').placeholder = '1950.00';
  } else {
    leverageRow.classList.remove('hidden');
    leverageLabel.innerHTML = 'Initial Margin / contract ($) <span class="hint">check your broker</span>';
    $('r-leverage').placeholder = v === 'nq' ? '1000' : '100';
    $('r-leverage').value = v === 'nq' ? '1000' : '100';
    $('r-entry-price').closest('.field').querySelector('label').textContent = 'Typical Entry Price';
    $('r-entry-price').placeholder = '18000';
  }
}
rInstr.addEventListener('change', updateRiskInstrUI);

function validateRisk() {
  clearErr('r-risk-err'); clearErr('r-daily-err');
  let ok = true;
  const risk  = parseFloat($('r-risk').value);
  const daily = parseFloat($('r-daily-loss').value);
  if (risk > 2.0)  { setErr('r-risk-err', 'Max 2.0%.'); $('r-calculate').disabled = true; return false; }
  if (daily > 4.0) { setErr('r-daily-err', 'Max 4.0%.'); $('r-calculate').disabled = true; return false; }
  if (isNaN(risk)  || risk  <= 0) { setErr('r-risk-err', 'Required.'); ok = false; }
  if (isNaN(daily) || daily <= 0) { setErr('r-daily-err', 'Required.'); ok = false; }
  $('r-calculate').disabled = !ok;
  return ok;
}

['r-balance','r-risk','r-daily-loss','r-trades','r-stop-size'].forEach(id => {
  const el = $(id); if (el) el.addEventListener('input', validateRisk);
});

$('r-calculate').addEventListener('click', () => {
  if (!validateRisk()) return;

  const bal               = parseFloat($('r-balance').value);
  const riskPct           = parseFloat($('r-risk').value) / 100;
  const dailyPct          = parseFloat($('r-daily-loss').value) / 100;
  const tradesPerDay      = parseInt($('r-trades').value) || 1;
  const stopSize          = parseFloat($('r-stop-size').value) || 0;
  const instr             = rInstr.value;
  const leverageOrMargin  = parseFloat($('r-leverage').value) || (instr === 'gold' ? 100 : instr === 'nq' ? 1000 : 100);
  const entryPrice        = parseFloat($('r-entry-price').value) || 0;

  if (isNaN(bal) || bal <= 0) { setErr('r-risk-err', 'Enter account balance.'); return; }

  const maxPerTrade = bal * riskPct;
  const maxDaily    = bal * dailyPct;

  let riskPerUnit = 0, unitLabel = '';
  if (instr === 'gold') {
    riskPerUnit = stopSize * 100; unitLabel = 'lots';
  } else if (instr === 'nq') {
    riskPerUnit = (stopSize / 0.25) * 5; unitLabel = 'NQ contracts';
  } else {
    riskPerUnit = (stopSize / 0.25) * 0.5; unitLabel = 'MNQ contracts';
  }

  const suggestedSz = riskPerUnit > 0
    ? (instr === 'gold' ? floorToStep(maxPerTrade / riskPerUnit, 0.01) : Math.floor(maxPerTrade / riskPerUnit))
    : null;

  // Margin calculation
  let marginPerUnit = 0, totalMargin = 0, marginPct = 0;
  if (instr === 'gold' && entryPrice > 0 && suggestedSz) {
    marginPerUnit = (100 * entryPrice) / leverageOrMargin;
    totalMargin   = suggestedSz * marginPerUnit;
    marginPct     = totalMargin / bal * 100;
  } else if (instr !== 'gold' && suggestedSz) {
    marginPerUnit = leverageOrMargin;
    totalMargin   = suggestedSz * marginPerUnit;
    marginPct     = totalMargin / bal * 100;
  }

  let html = '';
  html += buildStat('Max $ / Trade',  fmtMoney(maxPerTrade), 'accent',   0);
  html += buildStat('Max $ / Day',    fmtMoney(maxDaily),    'negative', 0.05);
  html += buildStat('Trades Today',   `${tradesPerDay}`,     '',         0.10);
  html += buildStat('Risk per Trade', `${fmt(riskPct*100,2)}%`, '',      0.15);

  if (suggestedSz !== null && stopSize > 0) {
    html += buildStat('Max Size', `${instr==='gold' ? fmt(suggestedSz,2) : suggestedSz} ${unitLabel}`, 'positive', 0.20);
  }
  if (riskPct * tradesPerDay > dailyPct) {
    html += buildStat('Max Trades (limits)', `${Math.floor(dailyPct/riskPct)}`, 'negative', 0.25);
  }
  if (marginPerUnit > 0) {
    html += buildStat(instr === 'gold' ? 'Margin / Lot' : 'Margin / Contract', fmtMoney(marginPerUnit), '', 0.30);
    html += buildStat('Total Margin',  fmtMoney(totalMargin), marginPct > 20 ? 'negative' : '', 0.35);
    html += buildStat('Margin Used',   `${fmt(marginPct,1)}% of balance`, marginPct > 20 ? 'negative' : '', 0.40);
  }

  $('r-results-grid').innerHTML = html;

  const flags = [];
  if (tradesPerDay > 5)     flags.push('High frequency (>5/day) increases emotional risk.');
  if (riskPct >= 0.015)     flags.push('Risk per trade is near the maximum. Consider 0.5–1.0%.');
  if (dailyPct >= 0.03)     flags.push('Daily loss limit near maximum. A few losses will trigger it quickly.');
  if (marginPct > 50)       flags.push(`Margin for this position is ${fmt(marginPct,1)}% of your balance — dangerously high.`);
  if (suggestedSz !== null && suggestedSz < 1 && instr !== 'gold') flags.push('Size rounds to 0. Increase account or widen stop.');

  const flagsEl = $('r-flags');
  if (flags.length) {
    flagsEl.innerHTML = `<div class="red-flags-title">Red Flags</div><ul>${flags.map(f=>`<li>${f}</li>`).join('')}</ul>`;
    flagsEl.classList.remove('hidden');
  } else {
    flagsEl.classList.add('hidden');
  }

  showEl('r-results');
  setTimeout(() => $('r-results')?.scrollIntoView({ behavior:'smooth', block:'nearest' }), 50);
});

// ══════════════ TAB 3: TRADE JOURNAL ══════════════

const STORAGE_KEY = 'tradelab_journal_v2';
let trades = [];
let editingId = null;

function loadTrades() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    trades = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(trades)) trades = [];
  } catch { trades = []; }
}

function saveTrades() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trades)); }
  catch (e) { console.error('Storage error:', e); }
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

function setDefaultDatetime() {
  const now = new Date();
  $('j-datetime').value = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}
setDefaultDatetime();

$('j-setup').addEventListener('change', () => {
  const row = $('custom-setup-row');
  $('j-setup').value === 'custom' ? row.classList.remove('hidden') : row.classList.add('hidden');
});

function clearForm() {
  setDefaultDatetime();
  ['j-instrument','j-direction','j-entry','j-stop','j-tp','j-size','j-pl','j-r','j-screenshot','j-notes'].forEach(id => {
    const el = $(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });
  $('j-setup').value = 'Breakout';
  $('j-setup-custom').value = '';
  $('custom-setup-row').classList.add('hidden');
  clearErr('j-err');
  editingId = null;
  $('journal-form-title').textContent = 'New Entry';
  hideEl('j-cancel-edit');
}

$('j-cancel-edit').addEventListener('click', clearForm);

$('j-save').addEventListener('click', () => {
  clearErr('j-err');

  const datetime = $('j-datetime').value;
  const entry    = $('j-entry').value;
  if (!datetime) { setErr('j-err', 'Date/time required.'); return; }
  if (!entry)    { setErr('j-err', 'Entry price required.'); return; }

  const setupRaw = $('j-setup').value;
  const setup    = setupRaw === 'custom' ? ($('j-setup-custom').value.trim() || 'Other') : setupRaw;

  const trade = {
    id:         editingId || genId(),
    datetime,
    instrument: $('j-instrument').value,
    direction:  $('j-direction').value,
    entry:      parseFloat(entry) || 0,
    stop:       $('j-stop').value  !== '' ? parseFloat($('j-stop').value) : null,
    tp:         $('j-tp').value    !== '' ? parseFloat($('j-tp').value)   : null,
    size:       $('j-size').value  !== '' ? parseFloat($('j-size').value) : null,
    pl:         $('j-pl').value    !== '' ? parseFloat($('j-pl').value)   : null,
    r:          $('j-r').value     !== '' ? parseFloat($('j-r').value)    : null,
    setup,
    screenshot: $('j-screenshot').value.trim(),
    notes:      $('j-notes').value.trim(),
  };

  if (editingId) {
    const idx = trades.findIndex(t => t.id === editingId);
    if (idx !== -1) trades[idx] = trade;
  } else {
    trades.unshift(trade);
  }

  saveTrades();
  clearForm();
  renderJournal();

  // brief flash on save button
  const btn = $('j-save');
  btn.textContent = 'Saved!';
  setTimeout(() => { btn.innerHTML = 'Save Trade <svg viewBox="0 0 16 16" fill="none"><path d="M13 4L6.5 11 3 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'; }, 1200);
});

function renderJournal() {
  const search    = $('j-search').value.toLowerCase();
  const fInstr    = $('j-filter-instrument').value;
  const fDir      = $('j-filter-direction').value;
  const fResult   = $('j-filter-result').value;
  const fFrom     = $('j-filter-from').value;
  const fTo       = $('j-filter-to').value;

  const filtered = trades.filter(t => {
    if (fInstr  && t.instrument !== fInstr) return false;
    if (fDir    && t.direction  !== fDir)   return false;
    if (fResult === 'win'  && (t.pl === null || t.pl <= 0))  return false;
    if (fResult === 'loss' && (t.pl === null || t.pl >= 0))  return false;
    if (fResult === 'be'   && t.pl !== 0)                    return false;
    if (fFrom && t.datetime < fFrom) return false;
    if (fTo   && t.datetime.slice(0,10) > fTo) return false;
    if (search) {
      const hay = [t.notes, t.setup, t.instrument].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  const tbody = $('j-tbody');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    showEl('j-empty');
  } else {
    hideEl('j-empty');
    filtered.forEach(t => {
      const row  = document.createElement('tr');
      const plCls = t.pl > 0 ? 'pl-pos' : t.pl < 0 ? 'pl-neg' : '';
      const plStr = t.pl !== null ? (t.pl >= 0 ? '+' : '') + fmtMoney(t.pl).replace('$','') : '—';
      const rStr  = t.r  !== null ? (t.r  >= 0 ? '+' : '') + fmt(t.r,2)  + 'R' : '—';
      row.innerHTML = `
        <td>${t.datetime.replace('T',' ').slice(0,16)}</td>
        <td>${t.instrument}</td>
        <td>${t.direction}</td>
        <td>${t.entry}</td>
        <td>${t.stop ?? '—'}</td>
        <td>${t.size ?? '—'}</td>
        <td class="${plCls}">${plStr}</td>
        <td>${rStr}</td>
        <td>${t.setup}</td>
        <td>
          <button class="action-btn edit-btn" data-id="${t.id}">Edit</button>
          <button class="action-btn del del-btn" data-id="${t.id}">Del</button>
        </td>`;
      tbody.appendChild(row);
    });
  }

  renderStats(filtered);
}

function renderStats(list) {
  const sc = $('j-stats-card');
  if (trades.length === 0) { sc.style.display = 'none'; return; }
  sc.style.display = '';

  const closed  = list.filter(t => t.pl !== null);
  const wins    = closed.filter(t => t.pl > 0);
  const losses  = closed.filter(t => t.pl < 0);
  const wr      = closed.length ? wins.length / closed.length * 100 : null;
  const rList   = list.filter(t => t.r !== null);
  const avgR    = rList.length ? rList.reduce((s,t)=>s+t.r,0)/rList.length : null;
  const totalPL = closed.reduce((s,t)=>s+t.pl,0);
  const gw      = wins.reduce((s,t)=>s+t.pl,0);
  const gl      = Math.abs(losses.reduce((s,t)=>s+t.pl,0));
  const pf      = gl > 0 ? gw/gl : null;
  const best    = closed.length ? Math.max(...closed.map(t=>t.pl)) : null;
  const worst   = closed.length ? Math.min(...closed.map(t=>t.pl)) : null;

  let peak = 0, running = 0, maxDD = 0;
  [...closed].reverse().forEach(t => {
    running += t.pl;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  });

  let html = '';
  html += buildStat('Trades',        `${list.length}`,               '', 0);
  html += buildStat('Win Rate',       wr !== null ? `${fmt(wr,1)}%` : '—', wr >= 50 ? 'positive' : 'negative', 0.04);
  html += buildStat('Avg R',         avgR !== null ? `${fmt(avgR,2)}R` : '—', avgR >= 0 ? 'positive' : 'negative', 0.08);
  html += buildStat('Total P/L',     fmtMoney(totalPL), totalPL >= 0 ? 'positive' : 'negative', 0.12);
  html += buildStat('Profit Factor', pf !== null ? fmt(pf,2) : '—', pf >= 1 ? 'positive' : 'negative', 0.16);
  html += buildStat('Best Trade',    best !== null ? fmtMoney(best)  : '—', 'positive', 0.2);
  html += buildStat('Worst Trade',   worst !== null ? fmtMoney(worst) : '—', 'negative', 0.24);
  html += buildStat('Est. Max DD',   maxDD > 0 ? fmtMoney(maxDD) : '$0.00', '', 0.28);

  $('j-stats-grid').innerHTML = html;
}

// Edit / delete delegation
$('j-tbody').addEventListener('click', e => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.classList.contains('edit-btn')) {
    const t = trades.find(t => t.id === id);
    if (!t) return;
    editingId = id;
    $('j-datetime').value   = t.datetime;
    $('j-instrument').value = t.instrument;
    $('j-direction').value  = t.direction;
    $('j-entry').value      = t.entry ?? '';
    $('j-stop').value       = t.stop  ?? '';
    $('j-tp').value         = t.tp    ?? '';
    $('j-size').value       = t.size  ?? '';
    $('j-pl').value         = t.pl    ?? '';
    $('j-r').value          = t.r     ?? '';
    $('j-screenshot').value = t.screenshot || '';
    $('j-notes').value      = t.notes      || '';
    const opts = Array.from($('j-setup').options).map(o=>o.value);
    if (opts.includes(t.setup)) {
      $('j-setup').value = t.setup;
      $('custom-setup-row').classList.add('hidden');
    } else {
      $('j-setup').value = 'custom';
      $('j-setup-custom').value = t.setup;
      $('custom-setup-row').classList.remove('hidden');
    }
    $('journal-form-title').textContent = 'Edit Entry';
    showEl('j-cancel-edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (btn.classList.contains('del-btn') && confirm('Delete this trade?')) {
    trades = trades.filter(t => t.id !== id);
    saveTrades();
    renderJournal();
  }
});

// Filters
['j-search','j-filter-instrument','j-filter-direction','j-filter-result','j-filter-from','j-filter-to']
  .forEach(id => { const el=$(id); if(el) el.addEventListener('input', renderJournal); });

$('j-clear-filters').addEventListener('click', () => {
  ['j-search','j-filter-from','j-filter-to'].forEach(id => { const el=$(id); if(el) el.value=''; });
  ['j-filter-instrument','j-filter-direction','j-filter-result'].forEach(id => { const el=$(id); if(el) el.value=''; });
  renderJournal();
});

// Export CSV
$('j-export').addEventListener('click', () => {
  if (!trades.length) { alert('No trades to export.'); return; }
  const cols = ['id','datetime','instrument','direction','entry','stop','tp','size','pl','r','setup','screenshot','notes'];
  const esc  = v => { const s=String(v??''); return (s.includes(',')||s.includes('"')||s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s; };
  const csv  = [cols.join(','), ...trades.map(t=>cols.map(c=>esc(t[c])).join(','))].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv],{type:'text/csv'})),
    download: `tradelab_${new Date().toISOString().slice(0,10)}.csv`
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

// Import CSV
$('j-import').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const lines = ev.target.result.split('\n').filter(l=>l.trim());
    if (lines.length < 2) { showImportMsg('No data rows found.', true); return; }
    const headers = lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
    const required = ['datetime','instrument','direction','entry'];
    const missing  = required.filter(c=>!headers.includes(c));
    if (missing.length) { showImportMsg(`Missing columns: ${missing.join(', ')}`, true); return; }
    let imported=0, skipped=0;
    for (let i=1;i<lines.length;i++) {
      try {
        const vals = parseCSVLine(lines[i]);
        const row  = {};
        headers.forEach((h,idx)=>{ row[h]=(vals[idx]||'').trim(); });
        if (!row.datetime||!row.instrument||!row.direction||!row.entry){skipped++;continue;}
        const t = {
          id:         row.id||genId(),
          datetime:   row.datetime, instrument: row.instrument, direction: row.direction,
          entry:      parseFloat(row.entry)||0,
          stop:       row.stop  ? parseFloat(row.stop)  : null,
          tp:         row.tp    ? parseFloat(row.tp)    : null,
          size:       row.size  ? parseFloat(row.size)  : null,
          pl:         row.pl    !== '' ? parseFloat(row.pl)  : null,
          r:          row.r     !== '' ? parseFloat(row.r)   : null,
          setup:      row.setup||'Other', screenshot:row.screenshot||'', notes:row.notes||''
        };
        if (!trades.find(x=>x.id===t.id)){trades.unshift(t);imported++;}
        else skipped++;
      } catch {skipped++;}
    }
    saveTrades(); renderJournal();
    showImportMsg(`Imported ${imported} trade(s). Skipped ${skipped}.`, false);
  };
  reader.readAsText(file);
  e.target.value='';
});

function parseCSVLine(line) {
  const res=[]; let cur='', inQ=false;
  for (let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){res.push(cur);cur='';}
    else cur+=c;
  }
  res.push(cur); return res;
}

function showImportMsg(msg, isErr) {
  const el=$('j-import-msg');
  el.textContent=msg;
  el.style.background = isErr ? 'rgba(232,91,91,0.08)' : 'rgba(232,169,75,0.08)';
  el.style.borderColor= isErr ? 'rgba(232,91,91,0.3)' : 'rgba(232,169,75,0.3)';
  el.style.color = isErr ? '#e85b5b' : '#8a8fa8';
  el.classList.remove('hidden');
  setTimeout(()=>el.classList.add('hidden'), 5000);
}

// Delete all
$('j-delete-all').addEventListener('click', () => showEl('delete-modal'));
$('modal-cancel').addEventListener('click',  () => hideEl('delete-modal'));
$('modal-confirm').addEventListener('click', () => {
  trades=[]; saveTrades(); hideEl('delete-modal'); renderJournal();
});
$('delete-modal').addEventListener('click', e => { if(e.target===$('delete-modal')) hideEl('delete-modal'); });

// ══════════════ INIT ══════════════
loadTrades();
renderJournal();
updateInstrumentUI();
updateRiskInstrUI();
