'use strict';

const DEFAULT_EMPLOYEES = [
  'กรองกาญจน์ ถิ่นถา (อิ๋ว)',
  'พรทิพย์ โป๊ะโดย (แป้ง)',
  'จารุพัฒน์ หมื่นกัณฑ์ (เจมส์)',
  'อนุพงศ์ กันทา (โจ)',
  'แพรพรรณ แก้วมา (พิม)',
  'ธวัชชัย อรรถโสภา (ก้อง)',
  'ชฎาทิพย์ ติรวงษ์ดนุพล (นัท)',
  'นฏกร ทานกระโทก (ฟ้า)',
  'ณัฐพงษ์ มะโนวรรณา (นัท)',
  'นรบดี ใจงาม (ไบร์ท)',
  'ณัฐชนน กันทหล้า (น้อย)'
];
const RATES = { loan: 2.50, doc: 2.50, close: 5.00 };
const TARGETS = { MV: 1500000, CSR: 1500000, BN: 500000, ECR: 100000, KK: 300000 };
const SYSTEMS = ['MV', 'CSR', 'BN', 'ECR', 'KK'];
const SLA_MINUTES = 20;
const $ = (id) => document.getElementById(id);

const state = {
  records: [],
  shops: [],
  employees: DEFAULT_EMPLOYEES.slice(),
  editing: null,
  currentSection: 'overview',
  caseStartedAt: null,
  stepTimes: { loan: null, doc: null, close: null },
  charts: {},
  employeeSummary: [],
  attendanceSummary: null,
  targetSummary: [],
  commissionSummary: null,
  lastAutoSyncAt: 0,
  autoSync: true
};

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clean(value) { return String(value ?? '').trim(); }
function money(value, digits = 0) { return (Number(value) || 0).toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits }); }
function shortMoney(value) { const n = Number(value) || 0; if (n >= 1000000) return `${(n / 1000000).toLocaleString('th-TH', { maximumFractionDigits: 1 })}M`; if (n >= 1000) return `${Math.round(n / 1000).toLocaleString('th-TH')}K`; return n.toLocaleString('th-TH'); }
function getEmployeeList() { return Array.from(new Set((state.employees?.length ? state.employees : DEFAULT_EMPLOYEES).map(clean).filter(Boolean))); }
function nickname(name) { const m = String(name || '').match(/\(([^)]+)\)/); return m ? m[1] : String(name || '').slice(0, 2); }

function showLoading(show, title = 'กำลังดำเนินการ...', detail = 'โปรดรอสักครู่') {
  const el = $('loading');
  if (!el) return;
  $('loading-title').textContent = title;
  $('loading-detail').textContent = detail;
  el.classList.toggle('hidden', !show);
}

function toast(message, type = 'success') {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.className = `toast ${type}`;
  setTimeout(() => el.classList.add('hidden'), 3600);
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new Error(body.message || body.error || 'เกิดข้อผิดพลาด');
  return body;
}

function setHealth(ok) {
  const el = $('health-status');
  if (!el) return;
  el.textContent = ok ? 'LIVE' : 'ERROR';
  el.className = `live-pill ${ok ? 'live' : 'error'}`;
}

function setLastSync(text) {
  const el = $('last-sync');
  if (el) el.textContent = text || new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
}

function getSystem(contractNo) {
  const t = clean(contractNo).toUpperCase();
  if (t.startsWith('CSR')) return 'CSR';
  if (t.startsWith('ECR')) return 'ECR';
  if (t.startsWith('MV')) return 'MV';
  if (t.startsWith('BN')) return 'BN';
  if (t.startsWith('KK')) return 'KK';
  return '';
}

function docRequiredForSystem(contractNo) {
  const sys = getSystem(contractNo);
  return sys === 'MV' || sys === 'CSR';
}

function calculateCaseStatus(contractNo, loan, doc, close) {
  const sys = getSystem(contractNo);
  if (!sys) return '';
  if (sys === 'MV' || sys === 'CSR') {
    if (loan && doc && close) return 'เสร็จสมบูรณ์';
    if (loan) return 'อนุมัติ-รอปิดเคส';
    return '';
  }
  if (sys === 'BN' || sys === 'ECR' || sys === 'KK') {
    if (loan && close) return 'เสร็จสมบูรณ์';
    if (loan) return 'อนุมัติ-รอปิดเคส';
  }
  return '';
}

function bangkokDateParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true }).formatToParts(value).reduce((acc, part) => { if (part.type !== 'literal') acc[part.type] = part.value; return acc; }, {});
  return { day: parts.day, month: parts.month, year: parts.year, hour: parts.hour, minute: parts.minute, dayPeriod: String(parts.dayPeriod || '').toUpperCase() };
}
function todayKey() { const p = bangkokDateParts(); return `${p.year}-${p.month}-${p.day}`; }
function formatRealtimeDisplay(value = new Date()) { const p = bangkokDateParts(value); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute} ${p.dayPeriod}`; }
function formatDisplayFromDateKey(dateKey) { const m = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (dateKey || ''); }
function monthKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }

function destroyChart(id) { if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; } }
function makeChart(id, type, labels, datasets, options = {}) {
  if (typeof Chart === 'undefined') return;
  const canvas = $(id);
  if (!canvas) return;
  destroyChart(id);
  state.charts[id] = new Chart(canvas, { type, data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: options.textColor || '#64748b' } } }, scales: type === 'doughnut' ? {} : { x: { ticks: { color: options.textColor || '#64748b' }, grid: { color: 'rgba(148,163,184,.18)' }, stacked: !!options.stacked }, y: { beginAtZero: true, ticks: { color: options.textColor || '#64748b', callback: options.moneyAxis ? (v) => shortMoney(v) : undefined }, grid: { color: 'rgba(148,163,184,.18)' }, stacked: !!options.stacked } } } });
}

async function loadAll({ silent = false } = {}) {
  try {
    if (!silent) showLoading(true, 'กำลังโหลดข้อมูล...', 'กำลังอ่านข้อมูลจาก Google Sheet ผ่าน Apps Script');
    const month = $('commission-month')?.value || monthKey();
    const attendanceDate = $('attendance-date')?.value || todayKey();
    let dashboardRes;
    try {
      dashboardRes = await api(`/api/dashboard?month=${encodeURIComponent(month)}&attendanceDate=${encodeURIComponent(attendanceDate)}`);
    } catch (_err) {
      // fallback เผื่อวางไฟล์ backend ไม่ครบ: ยังให้หน้าเคสกับร้านค้าใช้งานได้
      const [approvalRes, shopRes] = await Promise.all([
        api('/api/approvals'),
        api('/api/shops').catch(() => ({ shops: [] }))
      ]);
      dashboardRes = { records: approvalRes.records || [], shops: shopRes.shops || [] };
    }
    state.records = dashboardRes.records || [];
    state.shops = dashboardRes.shops || [];
    try {
      const shopRes = await api('/api/shops');
      if (Array.isArray(shopRes.shops)) state.shops = shopRes.shops;
    } catch (shopError) {
      if (!state.shops.length && !silent) {
        toast(`โหลดฐานร้านค้าไม่สำเร็จ: ${shopError.message}`, 'warn');
      }
    }
    state.employees = dashboardRes.employees?.length ? dashboardRes.employees : DEFAULT_EMPLOYEES.slice();
    state.employeeSummary = dashboardRes.employeeSummary || [];
    state.attendanceSummary = dashboardRes.attendanceSummary || null;
    state.targetSummary = dashboardRes.targetSummary || [];
    state.commissionSummary = dashboardRes.commissionSummary || null;
    fillShopDatalist();
    fillFilterOptions();
    renderAll();
    setHealth(true);
    setLastSync(dashboardRes.lastSync);
  } catch (error) {
    setHealth(false);
    toast(error.message, 'error');
  } finally {
    if (!silent) showLoading(false);
  }
}

async function checkHealth() {
  try {
    await api('/api/health');
    setHealth(true);
  } catch (_) { setHealth(false); }
}

function getKpi(records = state.records) {
  return {
    total: records.length,
    amount: records.reduce((sum, r) => sum + (Number(r.price) || 0), 0),
    loan: records.filter((r) => r.loanApproval).length,
    doc: records.filter((r) => r.docApproval).length,
    close: records.filter((r) => r.closeApproval).length,
    complete: records.filter((r) => r.caseStatus === 'เสร็จสมบูรณ์').length,
    wait: records.filter((r) => r.caseStatus === 'อนุมัติ-รอปิดเคส').length,
    shops: new Set(records.map((r) => r.shop).filter(Boolean)).size
  };
}

function systemOfRecord(r) { return SYSTEMS.includes(r.system) ? r.system : (getSystem(r.contractNo) || 'KK'); }
function byDate(records, mode = 'count') {
  const map = new Map();
  records.forEach((r) => {
    if (!r.date) return;
    if (!map.has(r.date)) map.set(r.date, { date: r.date, MV: 0, CSR: 0, BN: 0, ECR: 0, KK: 0, total: 0, shops: new Set() });
    const row = map.get(r.date);
    const sys = systemOfRecord(r);
    if (mode === 'amount') {
      row[sys] += Number(r.price) || 0;
      row.total += Number(r.price) || 0;
    } else if (mode === 'shops') {
      row.shops.add(`${sys}|${r.shop || ''}`);
    } else {
      row[sys] += 1;
      row.total += 1;
    }
  });
  const rows = Array.from(map.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (mode === 'shops') {
    rows.forEach((row) => {
      row.MV = row.CSR = row.BN = row.ECR = row.KK = row.total = 0;
      row.shops.forEach((key) => { const sys = key.split('|')[0]; if (SYSTEMS.includes(sys)) { row[sys] += 1; row.total += 1; } });
    });
  }
  return rows;
}

function miniDailyTable(rows, isMoney = false) {
  if (!rows.length) return '<div class="empty">ไม่พบข้อมูล</div>';
  return `<div class="overview-table"><table><thead><tr><th>วันที่</th>${SYSTEMS.map((s) => `<th>${s}</th>`).join('')}<th>Total</th></tr></thead><tbody>${rows.slice(0, 8).map((r) => `<tr><td>${formatDisplayFromDateKey(r.date)}</td>${SYSTEMS.map((s) => `<td class="right">${isMoney ? shortMoney(r[s]) : money(r[s])}</td>`).join('')}<td class="right"><b>${isMoney ? shortMoney(r.total) : money(r.total)}</b></td></tr>`).join('')}</tbody></table></div>`;
}

function renderOverview() {
  const k = getKpi();
  const cards = [
    ['จำนวนเคสทั้งหมด', money(k.total), 'fa-file-lines', ''],
    ['ยอดรวมสินเชื่อ', `฿${money(k.amount)}`, 'fa-money-bill-wave', 'green'],
    ['จำนวนร้านค้า', `${money(k.shops)} ร้านค้า`, 'fa-store', 'orange'],
    ['อนุมัติ-รอปิดเคส', money(k.wait), 'fa-hourglass-half', 'orange'],
    ['เสร็จสมบูรณ์', money(k.complete), 'fa-circle-check', 'green'],
    ['อนุมัติใบสินเชื่อ', money(k.loan), 'fa-file-circle-check', ''],
    ['อนุมัติเอกสาร', money(k.doc), 'fa-file-signature', ''],
    ['อนุมัติปิดเคส', money(k.close), 'fa-lock', 'green']
  ];
  $('overview-kpis').innerHTML = cards.map(([label, value, icon, cls]) => `<div class="kpi-card ${cls}"><i class="fa-solid ${icon}"></i><div class="label">${label}</div><div class="value">${value}</div></div>`).join('');
  $('overview-case-daily').innerHTML = miniDailyTable(byDate(state.records), false);
  $('overview-revenue-daily').innerHTML = miniDailyTable(byDate(state.records, 'amount'), true);
  $('overview-shop-daily').innerHTML = miniDailyTable(byDate(state.records, 'shops'), false);

  const amountRows = byDate(state.records, 'amount').slice(0, 10).reverse();
  makeChart('overviewRevenueChart', 'bar', amountRows.map((r) => formatDisplayFromDateKey(r.date)), SYSTEMS.map((sys) => ({ label: sys, data: amountRows.map((r) => r[sys]), stack: 'x' })), { stacked: true, moneyAxis: true });
  const sysTotals = SYSTEMS.map((sys) => state.records.filter((r) => systemOfRecord(r) === sys).length);
  makeChart('overviewSystemChart', 'doughnut', SYSTEMS, [{ label: 'จำนวนเคส', data: sysTotals }]);
}

let realtimeClockInterval = null;
function setInput(id, value) { const el = $(id); if (el) el.value = value ?? ''; }
function setText(id, value) { const el = $(id); if (el) el.textContent = value || '-'; }
function stopRealtimeClock() { if (realtimeClockInterval) clearInterval(realtimeClockInterval); realtimeClockInterval = null; }
function resetSlaState() {
  state.caseStartedAt = new Date();
  state.stepTimes = { loan: null, doc: null, close: null };
  setInput('caseReceivedAt', formatRealtimeDisplay(state.caseStartedAt));
  setInput('loanCompletedAt', ''); setInput('docCompletedAt', ''); setInput('closeCompletedAt', '');
  setInput('slaMinutes', String(SLA_MINUTES)); setInput('slaStatus', 'RUNNING'); setInput('tatMinutes', '0');
  updateSlaControl();
}
function elapsedMinutesForSla() { if (!state.caseStartedAt) return Number($('tatMinutes')?.value || 0) || 0; const end = state.stepTimes.close || new Date(); return Math.max(0, Math.floor((end.getTime() - state.caseStartedAt.getTime()) / 60000)); }
function updateSlaControl() {
  const target = Number($('slaMinutes')?.value || SLA_MINUTES) || SLA_MINUTES;
  const received = $('caseReceivedAt')?.value || (state.caseStartedAt ? formatRealtimeDisplay(state.caseStartedAt) : '-');
  const loanAt = $('loanCompletedAt')?.value || '-';
  const docAt = $('docCompletedAt')?.value || '-';
  const closeAt = $('closeCompletedAt')?.value || '-';
  const hasClosed = closeAt !== '-';
  let elapsed = elapsedMinutesForSla();
  let status = $('slaStatus')?.value || 'RUNNING';
  if (state.caseStartedAt) {
    const end = state.stepTimes.close || new Date();
    const withinTarget = (end.getTime() - state.caseStartedAt.getTime()) <= target * 60 * 1000;
    status = hasClosed ? (withinTarget ? 'PASS' : 'FAIL') : (withinTarget ? 'RUNNING' : 'FAIL');
    elapsed = Math.max(0, Math.floor((end.getTime() - state.caseStartedAt.getTime()) / 60000));
    setInput('slaStatus', status); setInput('tatMinutes', String(elapsed));
  }
  setText('sla-received-time', received); setText('sla-loan-time', loanAt); setText('sla-doc-time', docAt); setText('sla-close-time', closeAt); setText('sla-elapsed-time', `${elapsed} นาที`); setText('sla-target-badge', `เข้า ${target} นาที`);
  const badge = $('sla-status-badge'); if (badge) { badge.textContent = status || 'RUNNING'; badge.className = `sla-status ${String(status || 'RUNNING').toLowerCase()}`; }
}
function updateRealtimeClock() {
  if (!$('dateDisplay') || !$('date') || state.editing) { updateSlaControl(); return; }
  $('dateDisplay').value = formatRealtimeDisplay(); $('date').value = todayKey(); updateSlaControl();
}
function startRealtimeClock() { stopRealtimeClock(); updateRealtimeClock(); realtimeClockInterval = setInterval(updateRealtimeClock, 1000); }
function setFormDateDefault() { state.editing = null; resetSlaState(); startRealtimeClock(); }

function fillEmployeeOptions() {
  const select = $('loanApproval');
  if (!select) return;
  select.innerHTML = '<option value="">-- เลือกผู้อนุมัติ --</option>' + getEmployeeList().map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
}
function ensureShopDatalist() {
  const input = $('shop');
  if (!input) return null;

  let list = $('shop-list') || $('shopList');
  if (!list) {
    list = document.createElement('datalist');
    list.id = 'shop-list';
    input.insertAdjacentElement('afterend', list);
  }

  input.setAttribute('list', list.id);
  input.setAttribute('autocomplete', 'off');
  return list;
}

function fillShopDatalist() {
  const list = ensureShopDatalist();
  if (!list) return;

  const seen = new Set();
  const rows = (state.shops || [])
    .map((item) => ({ shop: clean(item.shop), province: clean(item.province) }))
    .filter((item) => {
      const key = item.shop.toLowerCase();
      if (!item.shop || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.shop.localeCompare(b.shop, 'th'));

  list.innerHTML = rows
    .map((item) => `<option value="${esc(item.shop)}" label="${esc(item.province || '')}">${esc(item.province || '')}</option>`)
    .join('');
}

function syncProvinceFromShop() {
  const shopInput = $('shop');
  const provinceInput = $('province');
  if (!shopInput || !provinceInput) return;

  const target = clean(shopInput.value).toLowerCase();
  const found = (state.shops || []).find((item) => clean(item.shop).toLowerCase() === target);
  if (found) provinceInput.value = found.province || '';
}

async function syncShops(options = {}) {
  const silent = options && options.silent === true;
  try {
    if (!silent) showLoading(true, 'กำลังซิงก์ร้านค้า...', 'กำลังอ่านข้อมูลจากแท็บ ร้านอยู่จังหวัดไหน');
    const res = await api('/api/shops');
    state.shops = Array.isArray(res.shops) ? res.shops : [];
    fillShopDatalist();
    fillFilterOptions();
    if (!silent) toast(state.shops.length ? `ซิงก์ร้านค้าเรียบร้อย (${state.shops.length} ร้าน)` : 'ยังไม่พบข้อมูลร้านค้าใน Sheet', state.shops.length ? 'success' : 'warn');
  } catch (e) {
    if (!silent) toast(e.message, 'error');
  } finally {
    if (!silent) showLoading(false);
  }
}
async function saveCurrentShop() { const shop = clean($('shop')?.value || $('shop-master-name')?.value); const province = clean($('province')?.value || $('shop-master-province')?.value); if (!shop || !province) return toast('กรุณากรอกร้านค้าและจังหวัด', 'warn'); try { showLoading(true, 'กำลังบันทึกร้านค้า...', 'กำลังอัปเดตฐานข้อมูลร้านค้า'); const res = await api('/api/shops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop, province }) }); toast(res.message || 'บันทึกร้านค้าเรียบร้อย'); await syncShops(); } catch (e) { toast(e.message, 'error'); } finally { showLoading(false); } }
function hasExistingEvidence(type) { return Boolean($(`${type}EvidenceExisting`)?.value); }
function hasFile(id) { return Boolean($(id)?.files?.length); }
function hasLoanEvidence() { return hasExistingEvidence('loan') || hasFile('loanEvidenceFile'); }
function hasDocEvidence() { return hasExistingEvidence('doc') || hasFile('docEvidenceFile'); }
function hasCloseEvidence() { return hasExistingEvidence('close') || hasFile('closeEvidenceFile'); }
function setStepCompletedAt(type, done, fromNewFile = false) { const hidden = $(`${type}CompletedAt`); if (!hidden) return; if (!done) { hidden.value = ''; state.stepTimes[type] = null; return; } if (state.editing && !fromNewFile && !hidden.value) return; if (!state.stepTimes[type]) state.stepTimes[type] = new Date(); if (!hidden.value) hidden.value = formatRealtimeDisplay(state.stepTimes[type]); }
function setProgressState(id, status) { const el = $(id); if (!el) return; el.classList.remove('pending', 'active', 'done'); el.classList.add(status); }
function setLineState(id, done) { const el = $(id); if (el) el.classList.toggle('done', Boolean(done)); }
function markStep(id, enabled, done) { const card = $(id); if (!card) return; card.classList.toggle('locked', !enabled); card.classList.toggle('done', Boolean(done)); }
function syncLockedApprovers() { const owner = $('loanApproval')?.value || ''; setText('loan-owner', owner || 'ยังไม่ได้เลือกผู้อนุมัติ'); setText('doc-owner', owner || 'ล็อกตามผู้อนุมัติใบสินเชื่อ'); setText('close-owner', owner || 'ล็อกตามผู้อนุมัติใบสินเชื่อ'); setInput('docApproval', $('enableDocStep')?.checked ? owner : ''); setInput('closeApproval', $('enableCloseStep')?.checked ? owner : ''); setInput('docApprovalDisplay', $('enableDocStep')?.checked ? owner : ''); setInput('closeApprovalDisplay', $('enableCloseStep')?.checked ? owner : ''); }
function updateProgressCircles({ hasOwner, loanReady, docChecked, docReady, closeChecked, closeReady, docRequired }) { setProgressState('progress-created', 'done'); setLineState('line-created-loan', true); setProgressState('progress-loan', loanReady ? 'done' : hasOwner ? 'active' : 'pending'); setLineState('line-loan-doc', loanReady && (!docRequired || docChecked)); setProgressState('progress-doc', docReady ? 'done' : loanReady ? 'active' : 'pending'); setLineState('line-doc-close', closeChecked || closeReady); setProgressState('progress-close', closeReady ? 'done' : (loanReady && (docReady || !docRequired)) ? 'active' : 'pending'); }
function updateWorkflowState() {
  if (!$('loanApproval')) return;
  syncLockedApprovers();
  const hasOwner = Boolean($('loanApproval').value);
  const loanReady = hasOwner && hasLoanEvidence();
  const docRequired = docRequiredForSystem($('contractNo').value);
  const docEnabled = loanReady;
  let docChecked = $('enableDocStep').checked;
  let docReady = docChecked && hasDocEvidence();
  let closeEnabled = docRequired ? docReady : loanReady;
  let closeChecked = $('enableCloseStep').checked;
  let closeReady = closeChecked && hasCloseEvidence();
  $('enableDocStep').disabled = !docEnabled; $('docEvidenceFile').disabled = !docEnabled || !docChecked; $('enableCloseStep').disabled = !closeEnabled; $('closeEvidenceFile').disabled = !closeEnabled || !closeChecked;
  if (!docEnabled) {
  $('enableDocStep').checked = false;
  setInput('docApproval', '');
  setInput('docApprovalDisplay', '');
  }
  if (!closeEnabled) {
  $('enableCloseStep').checked = false;
  setInput('closeApproval', '');
  setInput('closeApprovalDisplay', '');
  }
  syncLockedApprovers(); docChecked = $('enableDocStep').checked; docReady = docChecked && hasDocEvidence(); closeEnabled = docRequired ? docReady : loanReady; closeChecked = $('enableCloseStep').checked; closeReady = closeChecked && hasCloseEvidence();
  markStep('loan-step-card', true, loanReady); markStep('doc-step-card', docEnabled, docReady); markStep('close-step-card', closeEnabled, closeReady);
  setStepCompletedAt('loan', loanReady, hasFile('loanEvidenceFile')); setStepCompletedAt('doc', docReady, hasFile('docEvidenceFile')); setStepCompletedAt('close', closeReady, hasFile('closeEvidenceFile'));
  setText('loan-state', hasLoanEvidence() ? 'PASS' : '-'); setText('doc-state', docReady ? 'PASS' : docChecked ? 'WAIT' : '-'); setText('close-state', closeReady ? 'PASS' : closeChecked ? 'WAIT' : '-'); setText('same-owner-state', hasOwner ? 'LOCKED' : '-');
  setInput('caseStatus', calculateCaseStatus($('contractNo').value, $('loanApproval').value, $('docApproval').value, $('closeApproval').value));
  updateSlaControl(); updateProgressCircles({ hasOwner, loanReady, docChecked, docReady, closeChecked, closeReady, docRequired });
  setText('workflow-helper', docRequired ? 'ระบบ MV/CSR: ต้องมีหลักฐานใบสินเชื่อ → เอกสาร → ปิดเคส ตามลำดับ' : 'ระบบ BN/ECR/KK: เอกสารไม่บังคับ แต่ถ้าทำต้องเป็นผู้อนุมัติคนเดียวกันและต้องมีหลักฐาน');
}
function setEvidenceLink(type, url) { const hidden = $(`${type}EvidenceExisting`); const link = $(`${type}EvidenceLink`); if (hidden) hidden.value = url || ''; if (link) { link.href = url || '#'; link.classList.toggle('hidden', !url); } }
function clearForm() { $('approval-form')?.reset(); state.editing = null; setFormDateDefault(); ['loan', 'doc', 'close'].forEach((type) => setEvidenceLink(type, '')); updateWorkflowState(); }
function loadRecordToForm(record) { state.editing = record; state.caseStartedAt = null; state.stepTimes = { loan: null, doc: null, close: null }; stopRealtimeClock(); setInput('date', record.date || todayKey()); setInput('dateDisplay', record.date ? `${formatDisplayFromDateKey(record.date)} (ข้อมูลเดิม)` : formatRealtimeDisplay()); setInput('caseReceivedAt', record.caseReceivedAt || ''); setInput('loanCompletedAt', record.loanCompletedAt || ''); setInput('docCompletedAt', record.docCompletedAt || ''); setInput('closeCompletedAt', record.closeCompletedAt || ''); setInput('slaMinutes', record.slaMinutes || SLA_MINUTES); setInput('slaStatus', record.slaStatus || ''); setInput('tatMinutes', record.tatMinutes || ''); setInput('loanApproval', record.loanApproval || ''); setInput('contractNo', record.contractNo || ''); setInput('shop', record.shop || ''); setInput('province', record.province || ''); setInput('price', record.price ? Number(record.price).toLocaleString('th-TH') : ''); setInput('note', record.note || ''); $('enableDocStep').checked = Boolean(record.docApproval || record.docEvidence); $('enableCloseStep').checked = Boolean(record.closeApproval || record.closeEvidence); setEvidenceLink('loan', record.loanEvidence || ''); setEvidenceLink('doc', record.docEvidence || ''); setEvidenceLink('close', record.closeEvidence || ''); switchSection('case'); updateWorkflowState(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function validateBeforeSubmit() { const owner = $('loanApproval').value; const priceRaw = String($('price').value || '').replace(/,/g, '').trim(); if (!owner) throw new Error('กรุณาเลือกผู้อนุมัติใบสินเชื่อ'); if (!$('contractNo').value.trim()) throw new Error('กรุณากรอกเลขสัญญา'); if (!$('shop').value.trim()) throw new Error('กรุณากรอกร้านค้า'); if (!priceRaw || Number(priceRaw) <= 0) throw new Error('กรุณากรอกราคาสินค้า'); if (!hasLoanEvidence()) throw new Error('กรุณาแนบหลักฐานใบสินเชื่อ'); if ($('enableDocStep').checked && !hasDocEvidence()) throw new Error('กรุณาแนบหลักฐานอนุมัติเอกสาร'); if ($('enableCloseStep').checked && !hasCloseEvidence()) throw new Error('กรุณาแนบหลักฐานปิดเคส'); if ($('enableCloseStep').checked && docRequiredForSystem($('contractNo').value) && !$('enableDocStep').checked) throw new Error('ระบบ MV/CSR ต้องทำขั้นตอนเอกสารก่อนปิดเคส'); }
async function submitForm(event) { event.preventDefault(); const submit = $('submit-btn'); try { updateWorkflowState(); validateBeforeSubmit(); updateSlaControl(); const formData = new FormData($('approval-form')); formData.set('docApproval', $('enableDocStep').checked ? $('loanApproval').value : ''); formData.set('closeApproval', $('enableCloseStep').checked ? $('loanApproval').value : ''); formData.set('price', String($('price').value || '').replace(/,/g, '')); submit.disabled = true; submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...'; showLoading(true, 'กำลังบันทึกข้อมูล...', 'กำลังอัปโหลดรูปเข้า Google Drive และบันทึกลง Google Sheet'); const result = await api('/api/approvals', { method: 'POST', body: formData }); if (clean($('shop').value) && clean($('province').value)) api('/api/shops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shop: $('shop').value, province: $('province').value }) }).catch(() => {}); toast(result.message || 'บันทึกข้อมูลเรียบร้อย'); clearForm(); await loadAll({ silent: true }); } catch (error) { toast(error.message, 'error'); } finally { submit.disabled = false; submit.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> บันทึกข้อมูล'; showLoading(false); } }

function workBadge(value) { return value ? `<span class="badge ok">${esc(value)}</span>` : '<span class="badge empty">-</span>'; }
function evidenceBadge(url) { return url ? `<a class="badge evidence" href="${esc(url)}" target="_blank" rel="noreferrer">ดูรูป</a>` : '<span class="badge empty">-</span>'; }
function statusBadge(value) { if (value === 'เสร็จสมบูรณ์') return `<span class="badge success">${esc(value)}</span>`; if (value === 'อนุมัติ-รอปิดเคส') return `<span class="badge wait">${esc(value)}</span>`; return '<span class="badge empty">-</span>'; }
function slaBadge(value) { const status = String(value || '').toUpperCase(); if (status === 'PASS') return '<span class="badge success">PASS</span>'; if (status === 'FAIL') return '<span class="badge fail">FAIL</span>'; if (status === 'RUNNING') return '<span class="badge wait">RUNNING</span>'; return '<span class="badge empty">-</span>'; }
function getTableRows(data) { if (!data.length) return '<tr><td colspan="17" class="empty-row">ไม่พบข้อมูล</td></tr>'; return data.map((r) => `<tr><td><div class="row-actions"><button class="row-edit" type="button" data-contract="${esc(r.contractNo)}">แก้ไข</button><button class="row-delete" type="button" data-contract="${esc(r.contractNo)}">ลบ</button></div></td><td>${esc(r.dateThai || formatDisplayFromDateKey(r.date) || '-')}</td><td class="center"><span class="badge system">${esc(r.system || getSystem(r.contractNo) || '-')}</span></td><td>${workBadge(r.loanApproval)}</td><td>${evidenceBadge(r.loanEvidence)}</td><td>${workBadge(r.docApproval)}</td><td>${evidenceBadge(r.docEvidence)}</td><td>${workBadge(r.closeApproval)}</td><td>${evidenceBadge(r.closeEvidence)}</td><td>${esc(r.shop || '-')}</td><td>${esc(r.province || '-')}</td><td><b>${esc(r.contractNo || '-')}</b></td><td class="right">${money(r.price)}</td><td>${esc(r.note || '')}</td><td>${statusBadge(r.caseStatus)}</td><td>${slaBadge(r.slaStatus)}</td><td>${r.tatMinutes !== undefined && r.tatMinutes !== '' ? `${esc(r.tatMinutes)} นาที` : '-'}</td></tr>`).join(''); }
function tableHtml(data) { return `<div class="table-wrap"><table><thead><tr><th>จัดการ</th><th>วันที่</th><th>ระบบ</th><th>ใบสินเชื่อ</th><th>หลักฐาน</th><th>เอกสาร</th><th>หลักฐาน</th><th>ปิดเคส</th><th>หลักฐาน</th><th>ร้านค้า</th><th>จังหวัด</th><th>เลขสัญญา</th><th>ราคา</th><th>หมายเหตุ</th><th>สถานะ</th><th>SLA</th><th>TAT</th></tr></thead><tbody>${getTableRows(data)}</tbody></table></div>`; }
function bindTableActions(root = document) { root.querySelectorAll('.row-edit').forEach((button) => button.addEventListener('click', () => { const record = state.records.find((item) => item.contractNo === button.dataset.contract); if (record) loadRecordToForm(record); })); root.querySelectorAll('.row-delete').forEach((button) => button.addEventListener('click', () => deleteRecord(button.dataset.contract))); }
async function deleteRecord(contractNo) { if (!contractNo) return; const record = state.records.find((item) => item.contractNo === contractNo); const msg = record ? `ยืนยันลบเคส ${record.contractNo}?\nระบบจะลบแถวใน Sheet และย้ายรูปหลักฐานไป Trash ใน Drive` : 'ยืนยันลบข้อมูล?'; if (!confirm(msg)) return; try { showLoading(true, 'กำลังลบข้อมูล...', 'กำลังลบแถวใน Sheet และย้ายรูปเข้า Trash'); await api(`/api/approvals/${encodeURIComponent(contractNo)}`, { method: 'DELETE' }); toast('ลบข้อมูลเรียบร้อย'); await loadAll({ silent: true }); } catch (e) { toast(e.message, 'error'); } finally { showLoading(false); } }
function filterText(record, q) { return [record.contractNo, record.shop, record.province, record.loanApproval, record.docApproval, record.closeApproval, record.caseStatus, record.note].join(' ').toLowerCase().includes(q); }
function renderDailyTable() { const q = clean($('daily-search')?.value).toLowerCase(); const sys = $('daily-system')?.value || ''; let rows = state.records.slice().reverse(); if (q) rows = rows.filter((r) => filterText(r, q)); if (sys) rows = rows.filter((r) => systemOfRecord(r) === sys); if (!q && !sys) rows = rows.slice(0, 30); $('daily-table').innerHTML = tableHtml(rows); bindTableActions($('daily-table')); }
function renderSummary() { let rows = state.records.slice(); const q = clean($('summary-keyword')?.value).toLowerCase(); const st = $('summary-status')?.value || ''; const mo = $('summary-month')?.value || ''; const from = $('summary-from')?.value || ''; const to = $('summary-to')?.value || ''; const sys = $('summary-system')?.value || ''; if (q) rows = rows.filter((r) => filterText(r, q)); if (st) rows = rows.filter((r) => r.caseStatus === st); if (mo) rows = rows.filter((r) => String(r.date || '').slice(0, 7) === mo); if (from) rows = rows.filter((r) => r.date >= from); if (to) rows = rows.filter((r) => r.date <= to); if (sys) rows = rows.filter((r) => systemOfRecord(r) === sys); $('summary-table').innerHTML = tableHtml(rows); bindTableActions($('summary-table')); }
function kpiFiltered() { const from = $('kpi-from')?.value || ''; const to = $('kpi-to')?.value || ''; return state.records.filter((r) => (!from || r.date >= from) && (!to || r.date <= to)); }
function buildStatusStats(records) { const stats = { wait: {}, closed: {}, other: {} }; ['wait', 'closed', 'other'].forEach((g) => SYSTEMS.forEach((s) => { stats[g][s] = { count: 0, amount: 0 }; })); records.forEach((r) => { const sys = systemOfRecord(r); const g = r.caseStatus === 'อนุมัติ-รอปิดเคส' ? 'wait' : r.caseStatus === 'เสร็จสมบูรณ์' ? 'closed' : 'other'; stats[g][sys].count += 1; stats[g][sys].amount += Number(r.price) || 0; }); return stats; }
function totalStat(group, field) { return Object.values(group).reduce((s, x) => s + (Number(x[field]) || 0), 0); }
function kpiSplit(stat) { return `<div class="tat-strip" style="padding:0;margin-top:12px">${SYSTEMS.map((s) => `<div><b>${money(stat[s].count)}</b><span>${s}<br>฿${shortMoney(stat[s].amount)}</span></div>`).join('')}</div>`; }
function renderKpi() { const rows = kpiFiltered(); const stats = buildStatusStats(rows); $('kpi-cards').innerHTML = [{ title: 'อนุมัติ-รอปิดเคส', icon: 'fa-clock', stat: stats.wait, cls: 'wait' }, { title: 'ปิดเคสแล้ว', icon: 'fa-circle-check', stat: stats.closed, cls: 'closed' }, { title: 'อื่น ๆ / รออนุมัติ', icon: 'fa-circle-exclamation', stat: stats.other, cls: 'other' }].map((x) => `<div class="kpi-stat"><small><i class="fa-solid ${x.icon}"></i> ${x.title}</small><div class="value">${money(totalStat(x.stat, 'count'))} รายการ</div><b>฿${money(totalStat(x.stat, 'amount'))}</b>${kpiSplit(x.stat)}</div>`).join(''); $('kpi-wait-daily').innerHTML = miniDailyTable(byDate(rows.filter((r) => r.caseStatus === 'อนุมัติ-รอปิดเคส'))); $('kpi-closed-daily').innerHTML = miniDailyTable(byDate(rows.filter((r) => r.caseStatus === 'เสร็จสมบูรณ์'))); $('kpi-amount-daily').innerHTML = miniDailyTable(byDate(rows.filter((r) => r.caseStatus === 'เสร็จสมบูรณ์'), 'amount'), true); const daily = byDate(rows.filter((r) => r.caseStatus === 'เสร็จสมบูรณ์')).slice(0, 12).reverse(); makeChart('kpiDailyChart', 'line', daily.map((r) => formatDisplayFromDateKey(r.date)), [{ label: 'ปิดเคสแล้ว', data: daily.map((r) => r.total), borderWidth: 2, tension: .35 }]); const sysTotals = SYSTEMS.map((s) => rows.filter((r) => systemOfRecord(r) === s).length); makeChart('kpiSystemChart', 'bar', SYSTEMS, [{ label: 'จำนวนรายการ', data: sysTotals }]); }
function approvalFiltered(type) { const prefix = type; const status = type === 'complete' ? 'เสร็จสมบูรณ์' : 'อนุมัติ-รอปิดเคส'; let rows = state.records.filter((r) => r.caseStatus === status); const from = $(`${prefix}-from`)?.value || ''; const to = $(`${prefix}-to`)?.value || ''; const employee = $(`${prefix}-employee`)?.value || ''; const shop = $(`${prefix}-shop`)?.value || ''; const province = $(`${prefix}-province`)?.value || ''; const sys = $(`${prefix}-system`)?.value || ''; if (from) rows = rows.filter((r) => r.date >= from); if (to) rows = rows.filter((r) => r.date <= to); if (employee) rows = rows.filter((r) => r.loanApproval === employee || r.docApproval === employee || r.closeApproval === employee); if (shop) rows = rows.filter((r) => r.shop === shop); if (province) rows = rows.filter((r) => r.province === province); if (sys) rows = rows.filter((r) => systemOfRecord(r) === sys); return rows; }
function renderApprovalSections() { const complete = approvalFiltered('complete'); const wait = approvalFiltered('wait'); $('complete-count').textContent = complete.length; $('wait-count').textContent = wait.length; $('complete-table').innerHTML = tableHtml(complete); $('wait-table').innerHTML = tableHtml(wait); bindTableActions($('complete-table')); bindTableActions($('wait-table')); }
function buildCommissionSummary(records, month = monthKey()) { const map = new Map(getEmployeeList().map((name) => [name, { employee: name, loan: 0, doc: 0, close: 0, total: 0, amount: 0 }])); const used = new Set(); records.forEach((r) => { if (month && String(r.date || '').slice(0, 7) !== month) return; [['loanApproval', 'loan', 'อนุมัติใบสินเชื่อ'], ['docApproval', 'doc', 'อนุมัติเอกสาร'], ['closeApproval', 'close', 'อนุมัติปิดเคส']].forEach(([field, key, label]) => { const employee = r[field]; if (!employee || !map.has(employee)) return; const unique = `${r.contractNo}|${label}`; if (used.has(unique)) return; used.add(unique); const s = map.get(employee); s[key] += 1; s.total += 1; s.amount += RATES[key]; }); }); return Array.from(map.values()).sort((a, b) => b.amount - a.amount); }
function kpiLevel(total) { if (total >= 95) return 'Diamond'; if (total >= 90) return 'Platinum'; if (total >= 85) return 'Gold'; if (total >= 75) return 'Silver'; return 'Bronze'; }
function renderCommission() { const month = $('commission-month')?.value || monthKey(); const rows = buildCommissionSummary(state.records, month); $('commission-table').innerHTML = `<div class="table-wrap"><table><thead><tr><th>พนักงาน</th><th>ใบสินเชื่อ</th><th>เอกสาร</th><th>ปิดเคส</th><th>รวมงาน</th><th>ค่าคอมรวม</th><th>KPI</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.employee)}</td><td class="center">${r.loan}</td><td class="center">${r.doc}</td><td class="center">${r.close}</td><td class="center"><b>${r.total}</b></td><td class="right">${money(r.amount, 2)}</td><td class="center"><span class="badge system">${kpiLevel(r.total)}</span></td></tr>`).join('')}</tbody></table></div>`; renderRanking(); }
function renderRanking() { const rows = buildCommissionSummary(state.records, $('commission-month')?.value || monthKey()).filter((r) => r.total > 0).slice(0, 10); $('ranking-list').innerHTML = rows.length ? rows.map((r, i) => `<div class="rank-item"><div><span class="rank-no">${i + 1}</span><b>${esc(r.employee)}</b></div><div><b>${money(r.amount, 2)} ฿</b> <span class="badge system">${kpiLevel(r.total)}</span></div></div>`).join('') : '<div class="empty">ยังไม่มี Ranking</div>'; }
function renderEmployees() { const rows = buildCommissionSummary(state.records, $('commission-month')?.value || monthKey()); const q = clean($('employee-keyword')?.value).toLowerCase(); let data = rows; if (q) data = data.filter((r) => `${r.employee} ${nickname(r.employee)}`.toLowerCase().includes(q)); $('employee-count').textContent = data.length; const totals = { loan: rows.reduce((s, r) => s + r.loan, 0), doc: rows.reduce((s, r) => s + r.doc, 0), close: rows.reduce((s, r) => s + r.close, 0) }; $('employee-role-summary').innerHTML = [['อนุมัติสินเชื่อ', totals.loan, 'fa-file-circle-check'], ['อนุมัติเอกสาร', totals.doc, 'fa-file-signature'], ['อนุมัติปิดเคส', totals.close, 'fa-circle-check']].map(([label, num, icon]) => `<div class="role-card"><div><i class="fa-solid ${icon}"></i> ${label}</div><div class="num">${money(num)}</div></div>`).join(''); $('employee-cards').innerHTML = data.map((r) => `<div class="employee-card"><h4>${esc(r.employee)}</h4><div class="employee-sub">พนักงานอนุมัติสินเชื่อ · ${nickname(r.employee)}</div><div class="employee-kpis"><span>Loan<br>${r.loan}</span><span>Doc<br>${r.doc}</span><span>Close<br>${r.close}</span><span>${kpiLevel(r.total)}</span></div><b>${r.total} เคส</b><br><span class="employee-sub">ค่าคอม ${money(r.amount, 2)} ฿</span></div>`).join('') || '<div class="empty">ไม่พบข้อมูลพนักงาน</div>'; const top = rows.slice(0, 10).reverse(); makeChart('employeeWorkChart', 'bar', top.map((r) => nickname(r.employee)), [{ label: 'รวมงาน', data: top.map((r) => r.total) }]); makeChart('employeeRoleChart', 'doughnut', ['ใบสินเชื่อ', 'เอกสาร', 'ปิดเคส'], [{ label: 'งาน', data: [totals.loan, totals.doc, totals.close] }]); }
function renderTargets() { const cards = (state.targetSummary?.length ? state.targetSummary.map((x) => ({ sys: x.system, target: x.target, current: x.current, percent: x.percent, count: x.count, remaining: x.remaining })) : SYSTEMS.map((sys) => { const target = TARGETS[sys]; const records = state.records.filter((r) => systemOfRecord(r) === sys); const current = records.reduce((sum, r) => sum + (Number(r.price) || 0), 0); const percent = target ? current / target * 100 : 0; return { sys, target, current, percent, count: records.length, remaining: target - current }; })); $('target-cards').innerHTML = cards.map((x) => `<div class="target-card"><b>${x.sys}</b><div class="num">${money(x.current)}</div><small>เป้าหมาย ${money(x.target)} · ${x.count} สัญญา · ${Number(x.percent || 0).toFixed(1)}%</small><div class="progress"><span style="width:${Math.min(100, Number(x.percent) || 0)}%"></span></div></div>`).join(''); $('target-table').innerHTML = `<div class="table-wrap"><table><thead><tr><th>ระบบ</th><th>เป้าหมาย</th><th>ยอดปัจจุบัน</th><th>คงเหลือ/เกิน</th><th>%</th><th>จำนวนสัญญา</th></tr></thead><tbody>${cards.map((x) => `<tr><td class="center"><b>${x.sys}</b></td><td class="right">${money(x.target)}</td><td class="right">${money(x.current)}</td><td class="right">${money(x.remaining)}</td><td class="center">${Number(x.percent || 0).toFixed(1)}%</td><td class="center">${x.count}</td></tr>`).join('')}</tbody></table></div>`; }
function renderShops() { const map = new Map(); state.records.forEach((r) => { if (!r.shop) return; const key = r.shop; if (!map.has(key)) map.set(key, { shop: key, province: r.province || '', count: 0, amount: 0 }); const x = map.get(key); x.count += 1; x.amount += Number(r.price) || 0; if (!x.province && r.province) x.province = r.province; }); const rank = Array.from(map.values()).sort((a, b) => b.amount - a.amount); $('shop-ranking').innerHTML = rank.length ? `<div class="table-wrap"><table><thead><tr><th>ร้านค้า</th><th>จังหวัด</th><th>จำนวนเคส</th><th>ยอดสินเชื่อ</th></tr></thead><tbody>${rank.slice(0, 20).map((x) => `<tr><td>${esc(x.shop)}</td><td>${esc(x.province)}</td><td class="center">${x.count}</td><td class="right">${money(x.amount)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ยังไม่มีข้อมูลร้านค้า</div>'; $('shop-master-table').innerHTML = `<div class="table-wrap"><table><thead><tr><th>ร้านค้า</th><th>จังหวัด</th></tr></thead><tbody>${state.shops.map((s) => `<tr><td>${esc(s.shop)}</td><td>${esc(s.province || '')}</td></tr>`).join('') || '<tr><td colspan="2" class="empty-row">ยังไม่มีฐานร้านค้า</td></tr>'}</tbody></table></div>`; }
function fillSelect(id, items, label) { const el = $(id); if (!el) return; const old = el.value; el.innerHTML = `<option value="">${label}</option>` + items.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join(''); if (items.includes(old)) el.value = old; }
function fillFilterOptions() { const shops = Array.from(new Set([...state.shops.map((s) => s.shop), ...state.records.map((r) => r.shop)].map(clean).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th')); const provinces = Array.from(new Set([...state.shops.map((s) => s.province), ...state.records.map((r) => r.province)].map(clean).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'th')); ['complete-employee', 'wait-employee'].forEach((id) => fillSelect(id, getEmployeeList(), 'พนักงานทั้งหมด')); ['complete-shop', 'wait-shop'].forEach((id) => fillSelect(id, shops, 'ทุกร้านค้า')); ['complete-province', 'wait-province'].forEach((id) => fillSelect(id, provinces, 'ทุกจังหวัด')); }

async function updateCaseStatusesFromBackend() {
  try {
    showLoading(true, 'กำลังอัปเดตสถานะเคส...', 'กำลังคำนวณสถานะจากข้อมูลล่าสุด');
    await api('/api/reports/status', { method: 'POST' });
    toast('อัปเดตสถานะเคสเรียบร้อย');
    await loadAll({ silent: true });
  } catch (error) { toast(error.message, 'error'); }
  finally { showLoading(false); }
}

async function createDailyReportFromBackend() {
  try {
    showLoading(true, 'กำลังสร้างรายงานประจำวัน...', 'กำลังเขียนข้อมูลลงแท็บรายการเคสอนุมัติประจำวัน');
    await api('/api/reports/daily', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: todayKey() }) });
    toast('สร้างรายงานประจำวันเรียบร้อย');
  } catch (error) { toast(error.message, 'error'); }
  finally { showLoading(false); }
}

async function calculateCommissionToSheet() {
  try {
    const month = $('commission-month')?.value || monthKey();
    showLoading(true, 'กำลังคำนวณค่าคอม...', `กำลังเขียน Commission ประจำเดือน ${month} ลง Google Sheet`);
    const result = await api('/api/reports/commission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month }) });
    state.commissionSummary = result;
    toast('คำนวณและบันทึกค่าคอมลง Sheet เรียบร้อย');
    await loadAll({ silent: true });
  } catch (error) { toast(error.message, 'error'); }
  finally { showLoading(false); }
}

function exportTable(selector, filename) { const table = document.querySelector(selector); if (!table) return toast('ไม่มีข้อมูลสำหรับ Export', 'warn'); const html = `<!doctype html><html><head><meta charset="UTF-8"></head><body>${table.outerHTML}</body></html>`; const blob = new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xls`; a.click(); URL.revokeObjectURL(a.href); }
function renderAll() { renderOverview(); renderDailyTable(); renderSummary(); renderKpi(); renderApprovalSections(); renderEmployees(); renderTargets(); renderShops(); renderCommission(); }
function switchSection(section) { state.currentSection = section; document.querySelectorAll('.section').forEach((el) => el.classList.toggle('active', el.id === `sec-${section}`)); document.querySelectorAll('.nav button').forEach((btn) => btn.classList.toggle('active', btn.dataset.section === section)); const titles = { overview: 'ภาพรวม', case: 'บันทึก / แก้ไขเคส', summary: 'ตารางสรุป', kpi: 'Dashboard KPI', complete: 'งานเสร็จสมบูรณ์', wait: 'งานรอปิดเคส', employees: 'พนักงาน', targets: 'เป้าหมายระบบ', shops: 'ร้านค้า Top Sale', commission: 'รายงานค่าคอม', ranking: 'Top 10 Ranking' }; $('page-title').textContent = titles[section] || 'ภาพรวม'; $('sidebar').classList.remove('open'); setTimeout(() => { if (section === 'overview') renderOverview(); if (section === 'kpi') renderKpi(); if (section === 'employees') renderEmployees(); }, 50); }
function bindEvents() {
  document.querySelectorAll('.nav button').forEach((button) => button.addEventListener('click', () => switchSection(button.dataset.section)));
  document.querySelectorAll('[data-refresh]').forEach((button) => button.addEventListener('click', () => loadAll()));
  $('menu-btn')?.addEventListener('click', () => $('sidebar').classList.toggle('open'));
  $('theme-btn')?.addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('darkMode', document.body.classList.contains('dark') ? '1' : '0'); renderAll(); });
  $('approval-form')?.addEventListener('submit', submitForm);
  $('clear-btn')?.addEventListener('click', clearForm); $('reset-btn')?.addEventListener('click', clearForm);
  $('sync-shops-btn')?.addEventListener('click', syncShops); $('save-shop-btn')?.addEventListener('click', saveCurrentShop); $('shop-master-save')?.addEventListener('click', async () => { setInput('shop', $('shop-master-name').value); setInput('province', $('shop-master-province').value); await saveCurrentShop(); renderShops(); });
  ['loanApproval', 'contractNo', 'loanEvidenceFile', 'docEvidenceFile', 'closeEvidenceFile', 'enableDocStep', 'enableCloseStep'].forEach((id) => $(id)?.addEventListener('change', updateWorkflowState));
  $('shop')?.addEventListener('input', syncProvinceFromShop);
  $('price')?.addEventListener('input', () => { const raw = $('price').value.replace(/,/g, '').replace(/[^0-9.]/g, ''); $('price').value = raw ? Number(raw).toLocaleString('th-TH') : ''; });
  ['daily-search', 'daily-system'].forEach((id) => $(id)?.addEventListener('input', renderDailyTable)); $('daily-clear')?.addEventListener('click', () => { setInput('daily-search', ''); setInput('daily-system', ''); renderDailyTable(); });
  ['summary-keyword', 'summary-status', 'summary-month', 'summary-from', 'summary-to', 'summary-system'].forEach((id) => { $(id)?.addEventListener('input', renderSummary); $(id)?.addEventListener('change', renderSummary); }); $('summary-clear')?.addEventListener('click', () => { ['summary-keyword', 'summary-status', 'summary-month', 'summary-from', 'summary-to', 'summary-system'].forEach((id) => setInput(id, '')); renderSummary(); }); $('summary-export')?.addEventListener('click', () => exportTable('#summary-table table', 'summary'));
  ['kpi-from', 'kpi-to'].forEach((id) => $(id)?.addEventListener('change', renderKpi)); $('kpi-clear')?.addEventListener('click', () => { setInput('kpi-from', ''); setInput('kpi-to', ''); renderKpi(); });
  ['complete-from', 'complete-to', 'complete-employee', 'complete-shop', 'complete-province', 'complete-system', 'wait-from', 'wait-to', 'wait-employee', 'wait-shop', 'wait-province', 'wait-system'].forEach((id) => $(id)?.addEventListener('change', renderApprovalSections));
  $('complete-clear')?.addEventListener('click', () => { ['complete-from', 'complete-to', 'complete-employee', 'complete-shop', 'complete-province', 'complete-system'].forEach((id) => setInput(id, '')); renderApprovalSections(); });
  $('wait-clear')?.addEventListener('click', () => { ['wait-from', 'wait-to', 'wait-employee', 'wait-shop', 'wait-province', 'wait-system'].forEach((id) => setInput(id, '')); renderApprovalSections(); });
  $('complete-export')?.addEventListener('click', () => exportTable('#complete-table table', 'approval_complete')); $('wait-export')?.addEventListener('click', () => exportTable('#wait-table table', 'approval_wait'));
  $('employee-keyword')?.addEventListener('input', renderEmployees); $('employee-status')?.addEventListener('change', renderEmployees);
  $('commission-month')?.addEventListener('change', () => { renderCommission(); renderEmployees(); }); $('commission-export')?.addEventListener('click', () => exportTable('#commission-table table', 'commission')); $('commission-save')?.addEventListener('click', calculateCommissionToSheet); $('status-update')?.addEventListener('click', updateCaseStatusesFromBackend); $('daily-report-save')?.addEventListener('click', createDailyReportFromBackend);
}
function init() { if (localStorage.getItem('darkMode') === '1') document.body.classList.add('dark'); setInput('summary-month', monthKey()); setInput('commission-month', monthKey()); fillEmployeeOptions(); setFormDateDefault(); bindEvents(); updateWorkflowState(); checkHealth(); loadAll(); setInterval(() => { if (document.visibilityState === 'visible') loadAll({ silent: true }); }, 60000); }
document.addEventListener('DOMContentLoaded', init);
