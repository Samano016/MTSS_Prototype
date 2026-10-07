/* MTSS Tracker - data lives in this browser (localStorage) until you swap the Store adapter. */
const KEY = 'mtss_v1';
const TIERS = ['Tier 1', 'Tier 2', 'Tier 3'];
const MODS = {
  behavior: { tab: 'Behavior / SEL', title: 'Behavior & Social-Emotional', f: [
    ['date', 'Date', 'date'], ['student', 'Student', 'student'], ['grade', 'Grade', 'text'],
    ['type', 'Category', ['Disruption', 'Defiance', 'Aggression', 'Peer conflict', 'Anxiety / emotional', 'Positive behavior']],
    ['tier', 'Tier', TIERS], ['notes', 'Notes / intervention', 'textarea']] },
  academic: { tab: 'Academics', title: 'Academic Progress', f: [
    ['date', 'Date', 'date'], ['student', 'Student', 'student'], ['grade', 'Grade', 'text'],
    ['subject', 'Subject', ['Reading', 'Math', 'Writing', 'Science', 'Other']],
    ['assessment', 'Assessment', 'text'], ['score', 'Score (%)', 'number'],
    ['tier', 'Tier', TIERS], ['notes', 'Notes / intervention', 'textarea']] },
  attendance: { tab: 'Attendance', title: 'Attendance & Tardies', f: [
    ['date', 'Date', 'date'], ['student', 'Student', 'student'], ['grade', 'Grade', 'text'],
    ['status', 'Status', ['Absent (unexcused)', 'Absent (excused)', 'Tardy']],
    ['notes', 'Reason / notes', 'textarea']] },
  comm: { tab: 'Communication Log', title: 'Communication Log', f: [
    ['date', 'Date', 'date'], ['author', 'Teacher / staff', 'text'], ['student', 'Student (optional)', 'student'],
    ['type', 'Type', ['Daily update', 'Weekly update', 'Parent contact', 'Team meeting', 'Admin note']],
    ['notes', 'Details', 'textarea']] }
};
const PAL = ['#7a1f2b', '#6b6b6b', '#c96a76', '#b9b9b9', '#3e0f16', '#e3b5bb'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };

/* ---- Storage adapter: replace load/save with Firebase/Supabase calls for shared data ---- */
const blank = () => ({ behavior: [], academic: [], attendance: [], comm: [] });
function load() { try { return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY))); } catch { return blank(); } }
function save() { localStorage.setItem(KEY, JSON.stringify(data)); }

let data = load(), charts = {};

/* ---- Build UI ---- */
function build() {
  const tabs = [['dashboard', 'Dashboard'], ...Object.entries(MODS).map(([k, m]) => [k, m.tab])];
  $('#tabs').innerHTML = tabs.map(([k, t]) => `<button data-t="${k}">${t}</button>`).join('');
  let h = `<section id="dashboard"><h2>Administrator Dashboard</h2>
    <div class="filter"><label>Date range
      <select id="range"><option value="30">Last 30 days</option><option value="60">Last 60 days</option>
      <option value="90">Last 90 days</option><option value="9999">All time</option></select></label></div>
    <div class="kpis" id="kpis"></div>
    <div class="grid">
      <div class="card"><h3>Behavior incidents per week</h3><canvas id="c1"></canvas></div>
      <div class="card"><h3>Behavior by category</h3><canvas id="c2"></canvas></div>
      <div class="card"><h3>Average score by subject</h3><canvas id="c3"></canvas></div>
      <div class="card"><h3>Absences &amp; tardies per week</h3><canvas id="c4"></canvas></div>
      <div class="card"><h3>Entries by tier (behavior + academic)</h3><canvas id="c5"></canvas></div>
      <div class="card"><h3>Communication entries per week</h3><canvas id="c6"></canvas></div>
    </div>
    <div class="card"><h3>Students needing attention (behavior ≥ 3, absences + tardies ≥ 5, or average score &lt; 70)</h3>
      <div class="scroll" id="flags"></div></div></section>`;
  for (const [k, m] of Object.entries(MODS)) {
    h += `<section id="${k}"><h2>${m.title}</h2><div class="card"><form data-k="${k}">` +
      m.f.map(([n, l, t]) => {
        const wide = t === 'textarea' ? ' class="wide"' : '';
        if (Array.isArray(t)) return `<label>${l}<select name="${n}">${t.map(o => `<option>${o}</option>`).join('')}</select></label>`;
        if (t === 'textarea') return `<label${wide}>${l}<textarea name="${n}"></textarea></label>`;
        if (t === 'student') return `<label>${l}<input name="${n}" list="students" ${n === 'student' && k !== 'comm' ? 'required' : ''}></label>`;
        return `<label>${l}<input name="${n}" type="${t}" ${t === 'date' ? `value="${today()}"` : ''} ${t === 'number' ? 'min="0" max="100" required' : ''} ${t === 'date' ? 'required' : ''}></label>`;
      }).join('') + `<button class="primary">Add entry</button></form></div>
      <div class="card"><input class="search" placeholder="Search records..." data-s="${k}"><div class="scroll" id="t-${k}"></div></div></section>`;
  }
  $('#main').innerHTML = h;
}

function show(k) {
  document.querySelectorAll('section').forEach(s => s.classList.toggle('on', s.id === k));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === k));
  if (k === 'dashboard') dash();
  location.hash = k;
}

/* ---- Tables ---- */
function table(k) {
  const m = MODS[k], q = ($(`[data-s="${k}"]`).value || '').toLowerCase();
  const rows = data[k].filter(r => JSON.stringify(r).toLowerCase().includes(q)).sort((a, b) => b.date.localeCompare(a.date));
  $('#t-' + k).innerHTML = rows.length ? `<table><tr>${m.f.map(f => `<th>${f[1]}</th>`).join('')}<th></th></tr>` +
    rows.map(r => `<tr>${m.f.map(([n]) => `<td>${esc(r[n])}</td>`).join('')}<td><button class="del" data-k="${k}" data-id="${r.id}" title="Delete">✕</button></td></tr>`).join('') + '</table>'
    : '<p class="empty">No records yet.</p>';
}
function students() {
  const s = new Set(); Object.values(data).forEach(a => a.forEach(r => r.student && s.add(r.student.trim())));
  $('#students').innerHTML = [...s].sort().map(n => `<option value="${esc(n)}">`).join('');
}
const refresh = () => { Object.keys(MODS).forEach(table); students(); if ($('#dashboard').classList.contains('on')) dash(); };

/* ---- Dashboard ---- */
const wk = d => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
function chart(id, type, labels, sets) {
  charts[id]?.destroy();
  const circ = type === 'doughnut';
  charts[id] = new Chart($('#' + id), { type, data: { labels, datasets: sets.map((s, i) => ({ ...s, backgroundColor: circ ? PAL : (s.color || PAL[i]), borderColor: s.color || PAL[i] })) },
    options: { responsive: true, plugins: { legend: { display: circ || sets.length > 1 } }, scales: circ ? {} : { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
}
function weekly(id, type, series) { // series: [[label, rows], ...]
  const weeks = [...new Set(series.flatMap(([, r]) => r.map(x => wk(x.date))))].sort();
  chart(id, type, weeks, series.map(([label, rows], i) => ({ label, data: weeks.map(w => rows.filter(x => wk(x.date) === w).length), color: PAL[i === 0 ? 0 : 1], tension: .3 })));
}
function count(rows, key) { const m = {}; rows.forEach(r => m[r[key]] = (m[r[key]] || 0) + 1); return m; }
function dash() {
  const days = +$('#range').value, cut = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const D = {}; for (const k in data) D[k] = data[k].filter(r => r.date >= cut);
  const abs = D.attendance.filter(r => r.status.startsWith('Absent')), tar = D.attendance.filter(r => r.status === 'Tardy');
  const neg = D.behavior.filter(r => r.type !== 'Positive behavior');
  const avg = D.academic.length ? Math.round(D.academic.reduce((a, r) => a + +r.score, 0) / D.academic.length) : '–';
  const t23 = [...D.behavior, ...D.academic].filter(r => r.tier !== 'Tier 1');
  $('#kpis').innerHTML = [[neg.length, 'Behavior incidents'], [avg === '–' ? avg : avg + '%', 'Average academic score'], [abs.length, 'Absences'],
    [tar.length, 'Tardies'], [t23.length, 'Tier 2/3 entries'], [D.comm.length, 'Communication entries']]
    .map(([n, l]) => `<div class="kpi"><b>${n}</b><span>${l}</span></div>`).join('');
  weekly('c1', 'bar', [['Incidents', neg]]);
  const bc = count(D.behavior, 'type'); chart('c2', 'doughnut', Object.keys(bc), [{ data: Object.values(bc) }]);
  const sub = {}; D.academic.forEach(r => (sub[r.subject] = sub[r.subject] || []).push(+r.score));
  chart('c3', 'bar', Object.keys(sub), [{ label: 'Avg %', data: Object.values(sub).map(a => Math.round(a.reduce((x, y) => x + y, 0) / a.length)) }]);
  weekly('c4', 'line', [['Absences', abs], ['Tardies', tar]]);
  const tc = count([...D.behavior, ...D.academic], 'tier'); chart('c5', 'doughnut', Object.keys(tc), [{ data: Object.values(tc) }]);
  weekly('c6', 'bar', [['Entries', D.comm]]);
  // flagged students
  const S = {}, get = n => S[n] = S[n] || { b: 0, a: 0, s: [] };
  neg.forEach(r => get(r.student).b++); D.attendance.forEach(r => get(r.student).a++); D.academic.forEach(r => get(r.student).s.push(+r.score));
  const out = Object.entries(S).map(([n, v]) => {
    const av = v.s.length ? Math.round(v.s.reduce((x, y) => x + y, 0) / v.s.length) : null, why = [];
    if (v.b >= 3) why.push(`${v.b} behavior incidents`);
    if (v.a >= 5) why.push(`${v.a} absences/tardies`);
    if (av !== null && av < 70) why.push(`avg score ${av}%`);
    return { n, why };
  }).filter(x => x.why.length);
  $('#flags').innerHTML = out.length ? '<table><tr><th>Student</th><th>Reasons</th></tr>' +
    out.map(x => `<tr><td>${esc(x.n)}</td><td>${x.why.map(w => `<span class="tag">${w}</span>`).join('')}</td></tr>`).join('') + '</table>'
    : '<p class="empty">No students meet the flag criteria in this range.</p>';
}

/* ---- Events ---- */
build();
$('#tabs').onclick = e => e.target.dataset.t && show(e.target.dataset.t);
$('#main').addEventListener('submit', e => {
  e.preventDefault(); const f = e.target, k = f.dataset.k, r = { id: Date.now() };
  new FormData(f).forEach((v, n) => r[n] = v.trim());
  data[k].push(r); save(); f.reset(); f.querySelector('[type=date]').value = today(); refresh();
});
$('#main').addEventListener('click', e => {
  if (e.target.classList.contains('del') && confirm('Delete this record?')) {
    const { k, id } = e.target.dataset; data[k] = data[k].filter(r => r.id != id); save(); refresh();
  }
});
$('#main').addEventListener('input', e => { if (e.target.dataset.s) table(e.target.dataset.s); });
$('#range').onchange = dash;
$('#exportBtn').onclick = () => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `mtss-backup-${today()}.json`; a.click();
};
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = e => {
  const rd = new FileReader();
  rd.onload = () => { try { data = Object.assign(blank(), JSON.parse(rd.result)); save(); refresh(); alert('Import complete.'); } catch { alert('Invalid file.'); } };
  rd.readAsText(e.target.files[0]);
};
refresh(); show(MODS[location.hash.slice(1)] || location.hash === '#dashboard' ? location.hash.slice(1) : 'dashboard');
