import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, addDoc, setDoc, onSnapshot, query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ============================================================
// 1) FIREBASE CONFIGURATION
// ============================================================
// Replace these placeholders with the Web App configuration
// from Firebase Console > Project settings > Your apps.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const FIREBASE_READY = !Object.values(firebaseConfig).some((value) => String(value).startsWith("YOUR_"));

let firebase = null;
let auth = null;
let db = null;
if (FIREBASE_READY) {
  try {
    firebase = initializeApp(firebaseConfig);
    auth = getAuth(firebase);
    db = getFirestore(firebase);
  } catch (error) {
    console.error(error);
  }
}

// ============================================================
// 2) APP STATE
// ============================================================
const state = {
  mode: FIREBASE_READY && auth && db ? "firebase" : "demo",
  user: null,
  profile: null,
  students: [],
  records: [],
  currentView: "dashboard",
  selectedStudentId: "",
  unsubscribers: [],
  demoUser: { uid: "demo-admin", email: "demo@school.org", displayName: "Demo Administrator" }
};

const $ = (id) => document.getElementById(id);
const todayISO = () => new Date().toISOString().slice(0, 10);

// ============================================================
// 3) VIEW / UI HELPERS
// ============================================================
function showOnly(id) {
  ["auth-view", "setup-view", "main-app"].forEach((viewId) => $(viewId).classList.add("hidden"));
  $(id).classList.remove("hidden");
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2600);
}
function showNotice(message, type = "") {
  const el = $("global-notice");
  el.className = `notice ${type ? `notice-${type}` : ""}`;
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => el.classList.add("hidden"), 4500);
}
function fmtDate(value) {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
}
function getStudent(id) { return state.students.find((s) => s.id === id); }
function studentName(id) { return getStudent(id)?.name || "Unknown student"; }
function recordCountForStudent(id) { return state.records.filter((r) => r.studentId === id).length; }
function roleName() { return state.profile?.role || (state.mode === "demo" ? "admin" : "staff"); }
function schoolId() { return state.profile?.schoolId || "demo-school"; }
function setCurrentDateOnForms() {
  document.querySelectorAll('input[type="date"]').forEach((input) => { if (!input.value) input.value = todayISO(); });
}

function populateStudentSelect(selectId, allowAll = false) {
  const select = $(selectId);
  if (!select) return;
  const previous = select.value;
  select.innerHTML = allowAll ? `<option value="all">All students</option>` : `<option value="">Select student…</option>`;
  [...state.students].sort((a, b) => a.name.localeCompare(b.name)).forEach((student) => {
    const option = document.createElement("option");
    option.value = student.id;
    option.textContent = `${student.name} — ${student.studentNumber}`;
    select.appendChild(option);
  });
  if ([...select.options].some((o) => o.value === previous)) select.value = previous;
}
function populateAllStudentFilters() {
  populateStudentSelect("behavior-student");
  populateStudentSelect("academic-student");
  populateStudentSelect("attendance-student");
  populateStudentSelect("communication-student");
  populateStudentSelect("behavior-filter", true);
  populateStudentSelect("academic-filter", true);
  populateStudentSelect("attendance-filter", true);
  populateStudentSelect("communication-filter", true);
  populateStudentSelect("dashboard-student", false);
  const dash = $("dashboard-student");
  if (state.selectedStudentId && [...dash.options].some((o) => o.value === state.selectedStudentId)) dash.value = state.selectedStudentId;
  else if (state.students[0]) dash.value = state.students[0].id;
}

// ============================================================
// 4) DEMO STORAGE
// ============================================================
const DEMO_KEY = "mtss_local_v2_empty";
function defaultDemoData() {
  return { students: [], records: [] };
}
function shiftDate(days) {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}
function loadDemoData() {
  const stored = localStorage.getItem(DEMO_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { /* reset below */ }
  }
  const data = defaultDemoData();
  localStorage.setItem(DEMO_KEY, JSON.stringify(data));
  return data;
}
function saveDemoData() {
  localStorage.setItem(DEMO_KEY, JSON.stringify({ students: state.students, records: state.records }));
}

// ============================================================
// 5) DATA LAYER
// ============================================================
async function addStudent(data) {
  const payload = { ...data, schoolId: schoolId(), createdBy: state.user.uid };
  if (state.mode === "demo") {
    const student = { ...payload, id: `s-${Date.now()}` };
    state.students.push(student);
    saveDemoData();
    renderAll();
    return student;
  }
  const ref = await addDoc(collection(db, "students"), { ...payload, createdAt: serverTimestamp() });
  return { id: ref.id, ...payload };
}

async function addRecord(data) {
  const payload = Object.fromEntries(Object.entries({ ...data, schoolId: schoolId(), createdBy: state.user.uid }).filter(([, value]) => value !== undefined));
  if (state.mode === "demo") {
    const record = { ...payload, id: `r-${Date.now()}` };
    state.records.push(record);
    saveDemoData();
    renderAll();
    return record;
  }
  const ref = await addDoc(collection(db, "records"), { ...payload, createdAt: serverTimestamp() });
  return { id: ref.id, ...payload };
}

function startDemo() {
  stopListeners();
  state.mode = "demo";
  state.user = state.demoUser;
  state.profile = { name: "Demo Administrator", role: "admin", schoolId: "demo-school", schoolName: "Demo School" };
  const data = loadDemoData();
  state.students = data.students;
  state.records = data.records;
  state.selectedStudentId = state.students[0]?.id || "";
  enterApp();
}

async function startFirebaseForUser(user) {
  state.mode = "firebase";
  state.user = user;
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (!userDoc.exists()) {
    showOnly("setup-view");
    return;
  }
  state.profile = userDoc.data();
  if (!state.profile.schoolId || state.profile.schoolId === "UNASSIGNED") {
    showOnly("setup-view");
    return;
  }
  subscribeFirebaseData();
  enterApp();
}
function subscribeFirebaseData() {
  stopListeners();
  const studentsQ = query(collection(db, "students"), where("schoolId", "==", schoolId()));
  const recordsQ = query(collection(db, "records"), where("schoolId", "==", schoolId()));
  state.unsubscribers.push(onSnapshot(studentsQ, (snapshot) => {
    state.students = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    if (!state.selectedStudentId && state.students[0]) state.selectedStudentId = state.students[0].id;
    renderAll();
  }, (error) => { console.error(error); showNotice(`Could not load students: ${error.message}`, "error"); }));
  state.unsubscribers.push(onSnapshot(recordsQ, (snapshot) => {
    state.records = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    renderAll();
  }, (error) => { console.error(error); showNotice(`Could not load records: ${error.message}`, "error"); }));
}
function stopListeners() { state.unsubscribers.forEach((fn) => { try { fn(); } catch {} }); state.unsubscribers = []; }

// ============================================================
// 6) DASHBOARD CALCULATIONS / CHARTS
// ============================================================
function scopedRecords() {
  if ($("dashboard-scope")?.value === "student") {
    const id = $("dashboard-student")?.value || state.selectedStudentId;
    return state.records.filter((r) => r.studentId === id);
  }
  return state.records;
}
function renderDashboard() {
  const records = scopedRecords();
  $("stat-students").textContent = state.students.length;
  $("stat-behavior").textContent = records.filter((r) => r.module === "behavior").length;
  $("stat-academic").textContent = records.filter((r) => r.module === "academic").length;
  $("stat-attendance").textContent = records.filter((r) => r.module === "attendance").length;
  $("stat-communication").textContent = records.filter((r) => r.module === "communication").length;
  drawAreaChart(records);
  drawTrendChart(records);
  renderAttentionList();
  renderRecentComms();
}
function drawAreaChart(records) {
  const canvas = $("area-chart");
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 500, height = 260;
  canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const items = [
    ["Behavior / SEL", records.filter((r) => r.module === "behavior").length],
    ["Academic", records.filter((r) => r.module === "academic").length],
    ["Attendance", records.filter((r) => r.module === "attendance").length],
    ["Communication", records.filter((r) => r.module === "communication").length]
  ];
  const max = Math.max(1, ...items.map((x) => x[1]));
  const left = 130, right = 18, top = 20, rowH = 49, barH = 20;
  ctx.font = "12px system-ui";
  items.forEach(([label, value], i) => {
    const y = top + i * rowH;
    ctx.fillStyle = "#6f7078"; ctx.fillText(label, 0, y + 15);
    ctx.fillStyle = "#f0e7ea"; ctx.fillRect(left, y, width - left - right, barH);
    const barW = ((width - left - right) * value) / max;
    ctx.fillStyle = "#7a1631"; ctx.fillRect(left, y, barW, barH);
    ctx.fillStyle = "#26262b"; ctx.font = "700 12px system-ui"; ctx.fillText(String(value), left + Math.max(barW + 7, 18), y + 15);
    ctx.font = "12px system-ui";
  });
}
function drawTrendChart(records) {
  const canvas = $("trend-chart");
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 650, height = 260;
  canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const days = Array.from({ length: 30 }, (_, i) => shiftDate(i - 29));
  const values = days.map((d) => records.filter((r) => String(r.date || "").slice(0, 10) === d).length);
  const max = Math.max(1, ...values);
  const left = 34, right = 14, top = 18, bottom = 26;
  const plotW = width - left - right, plotH = height - top - bottom;
  ctx.strokeStyle = "#e8e8ec"; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const y = top + plotH - (plotH * i / 4); ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke(); }
  ctx.font = "11px system-ui"; ctx.fillStyle = "#6f7078";
  [0, 7, 14, 21, 29].forEach((idx) => { const x = left + plotW * (idx / 29); ctx.fillText(days[idx].slice(5), x - 10, height - 7); });
  ctx.beginPath();
  values.forEach((v, i) => { const x = left + plotW * (i / 29); const y = top + plotH - (plotH * v / max); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.strokeStyle = "#7a1631"; ctx.lineWidth = 3; ctx.stroke();
  values.forEach((v, i) => { const x = left + plotW * (i / 29); const y = top + plotH - (plotH * v / max); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 4.2, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#7a1631"; ctx.lineWidth = 2; ctx.stroke(); });
}
function renderAttentionList() {
  const el = $("attention-list");
  const rows = state.students.map((student) => {
    const records = state.records.filter((r) => r.studentId === student.id);
    const concerns = records.filter((r) => r.module === "behavior" || (r.module === "academic" && ["Watch", "Below target"].includes(r.status)) || r.module === "attendance").length;
    return { student, entries: records.length, concerns };
  }).sort((a, b) => b.concerns - a.concerns || b.entries - a.entries).slice(0, 6);
  if (!rows.length) { el.innerHTML = `<div class="small muted">No students yet.</div>`; return; }
  el.innerHTML = rows.map(({ student, entries, concerns }) => `
    <div class="attention-row">
      <div class="attention-main"><div class="attention-name">${escapeHtml(student.name)}</div><div class="attention-meta">Grade ${escapeHtml(student.grade)} · ${escapeHtml(student.tier)}</div></div>
      <span class="badge ${concerns >= 2 ? "badge-red" : concerns ? "badge-burgundy" : "badge-neutral"}">${concerns} concern${concerns === 1 ? "" : "s"}</span>
      <button class="row-action" data-student-id="${student.id}">Open</button>
    </div>`).join("");
  el.querySelectorAll("[data-student-id]").forEach((button) => button.addEventListener("click", () => { state.selectedStudentId = button.dataset.studentId; $("dashboard-student").value = state.selectedStudentId; switchView("students"); renderStudents(); }));
}
function renderRecentComms() {
  const el = $("recent-comms");
  const items = state.records.filter((r) => r.module === "communication").sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 5);
  el.innerHTML = items.length ? items.map((r) => `<div class="activity-item"><div class="record-top"><span class="record-title">${escapeHtml(studentName(r.studentId))}</span><span class="record-meta">${fmtDate(r.date)}</span></div><div class="record-meta">${escapeHtml(r.method)} · ${escapeHtml(r.audience)} · ${escapeHtml(r.staff)}</div><div class="record-body">${escapeHtml(r.notes)}</div></div>`).join("") : `<div class="small muted">No communication entries yet.</div>`;
}

// ============================================================
// 7) MODULE RENDERERS
// ============================================================
function renderStudents() {
  const search = $("student-search").value.trim().toLowerCase();
  const students = [...state.students].filter((s) => `${s.name} ${s.studentNumber}`.toLowerCase().includes(search));
  $("student-count").textContent = `${students.length} student${students.length === 1 ? "" : "s"}`;
  $("student-table-body").innerHTML = students.length ? students.map((s) => `<tr><td><strong>${escapeHtml(s.name)}</strong></td><td>${escapeHtml(s.grade)}</td><td>${escapeHtml(s.studentNumber)}</td><td><span class="badge badge-burgundy">${escapeHtml(s.tier)}</span></td><td>${recordCountForStudent(s.id)}</td><td><button class="row-action" data-select-student="${s.id}">Select</button></td></tr>`).join("") : `<tr><td colspan="6" class="muted center">No students match this search.</td></tr>`;
  $("student-table-body").querySelectorAll("[data-select-student]").forEach((button) => button.addEventListener("click", () => { state.selectedStudentId = button.dataset.selectStudent; populateAllStudentFilters(); showToast(`${studentName(state.selectedStudentId)} selected`); }));
}
function filteredRecords(module, filterId) {
  const studentFilter = $(filterId)?.value || "all";
  return state.records.filter((r) => r.module === module && (studentFilter === "all" || r.studentId === studentFilter));
}
function renderBehavior() {
  const records = filteredRecords("behavior", "behavior-filter");
  $("behavior-list").innerHTML = records.length ? records.map((r) => `<div class="record-card"><div class="record-top"><div class="record-title">${escapeHtml(studentName(r.studentId))}</div><span class="badge ${r.severity === 3 ? "badge-red" : r.severity === 2 ? "badge-burgundy" : "badge-neutral"}">Severity ${escapeHtml(r.severity)}</span></div><div class="record-meta">${fmtDate(r.date)} · ${escapeHtml(r.type)} · ${escapeHtml(r.staff || "Staff")}</div><div class="record-tags"><span class="badge badge-neutral">${escapeHtml(r.intervention || "No intervention")}</span></div><div class="record-body">${escapeHtml(r.notes || "No notes.")}</div></div>`).join("") : emptyRecord("No behavior / SEL entries yet.");
}
function renderAcademic() {
  let records = filteredRecords("academic", "academic-filter");
  const status = $("academic-status-filter").value;
  if (status !== "all") records = records.filter((r) => r.status === status);
  $("academic-list").innerHTML = records.length ? records.map((r) => `<div class="record-card"><div class="record-top"><div class="record-title">${escapeHtml(studentName(r.studentId))} · ${escapeHtml(r.subject)}</div><span class="badge ${r.status === "Below target" ? "badge-red" : r.status === "Watch" ? "badge-burgundy" : "badge-green"}">${escapeHtml(r.status)}</span></div><div class="record-meta">${fmtDate(r.date)} · ${escapeHtml(r.metric)} · ${escapeHtml(r.staff || "Staff")}</div><div class="record-tags"><span class="badge badge-neutral">Score: ${r.score ?? "—"}</span><span class="badge badge-neutral">Target: ${r.target ?? "—"}</span><span class="badge badge-neutral">${escapeHtml(r.intervention || "None")}</span></div><div class="record-body">${escapeHtml(r.notes || "No notes.")}</div></div>`).join("") : emptyRecord("No academic entries match the current filters.");
}
function renderAttendance() {
  const records = filteredRecords("attendance", "attendance-filter");
  $("attendance-absences").textContent = records.filter((r) => r.type === "Absent").length;
  $("attendance-tardies").textContent = records.filter((r) => r.type === "Tardy").length;
  $("attendance-unexcused").textContent = records.filter((r) => ["No", ""].includes(r.excused) && ["Absent", "Tardy"].includes(r.type)).length;
  $("attendance-list").innerHTML = records.length ? records.map((r) => `<div class="record-card"><div class="record-top"><div class="record-title">${escapeHtml(studentName(r.studentId))}</div><span class="badge ${r.type === "Absent" ? "badge-red" : "badge-burgundy"}">${escapeHtml(r.type)}</span></div><div class="record-meta">${fmtDate(r.date)} · ${r.minutes ? `${escapeHtml(r.minutes)} min · ` : ""}${escapeHtml(r.excused || "No")} · ${escapeHtml(r.staff || "Attendance")}</div><div class="record-body">${escapeHtml([r.reason, r.notes].filter(Boolean).join(" — ") || "No additional notes.")}</div></div>`).join("") : emptyRecord("No attendance entries yet.");
}
function renderCommunication() {
  const records = filteredRecords("communication", "communication-filter");
  $("communication-list").innerHTML = records.length ? records.map((r) => `<div class="record-card"><div class="record-top"><div class="record-title">${escapeHtml(studentName(r.studentId))}</div><span class="badge ${r.followup === "Needed" ? "badge-red" : r.followup === "Completed" ? "badge-green" : "badge-neutral"}">${escapeHtml(r.followup || "None")}</span></div><div class="record-meta">${fmtDate(r.date)} · ${escapeHtml(r.method)} · ${escapeHtml(r.audience)} · ${escapeHtml(r.staff)}</div><div class="record-body">${escapeHtml(r.notes)}</div></div>`).join("") : emptyRecord("No communication entries yet.");
}
function emptyRecord(text) { return `<div class="small muted">${escapeHtml(text)}</div>`; }

function renderAll() {
  populateAllStudentFilters();
  renderDashboard();
  renderStudents();
  renderBehavior();
  renderAcademic();
  renderAttendance();
  renderCommunication();
  setCurrentDateOnForms();
  $("school-label").textContent = state.profile?.schoolName || (state.mode === "demo" ? "Demo School" : state.profile?.schoolId || "School");
  $("mode-badge").textContent = state.mode === "demo" ? "Demo Mode" : `Live · ${roleName()}`;
  $("mode-badge").className = `badge ${state.mode === "demo" ? "badge-neutral" : "badge-green"}`;
  $("connection-status").textContent = state.mode === "demo" ? "Browser storage" : "Cloud connected";
}

// ============================================================
// 8) NAVIGATION
// ============================================================
function switchView(view) {
  state.currentView = view;
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $(`view-${view}`).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// 9) FORM HANDLERS
// ============================================================
function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}
async function submitModuleForm(event, module) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = formObject(form);
  const studentId = data.studentId;
  if (!studentId || !getStudent(studentId)) { showNotice("Please select a student.", "warning"); return; }
  try {
    await addRecord({ module, ...data, severity: module === "behavior" ? Number(data.severity || 1) : undefined, score: module === "academic" ? numberOrNull(data.score) : undefined, target: module === "academic" ? numberOrNull(data.target) : undefined, minutes: module === "attendance" ? Number(data.minutes || 0) : undefined, staff: data.staff || (module === "attendance" ? "Attendance" : state.profile?.name || "Staff") });
    form.reset();
    setCurrentDateOnForms();
    showToast(`${moduleLabel(module)} entry saved`);
    if (state.mode === "firebase") await refreshFirebaseSnapshotFallback();
  } catch (error) {
    console.error(error); showNotice(`Could not save entry: ${error.message}`, "error");
  }
}
function numberOrNull(value) { return value === "" || value == null ? null : Number(value); }
function moduleLabel(module) { return ({ behavior: "Behavior / SEL", academic: "Academic", attendance: "Attendance", communication: "Communication" }[module]); }
async function refreshFirebaseSnapshotFallback() {
  try {
    const [studentSnap, recordSnap] = await Promise.all([
      getDocs(query(collection(db, "students"), where("schoolId", "==", schoolId()))),
      getDocs(query(collection(db, "records"), where("schoolId", "==", schoolId())))
    ]);
    state.students = studentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.records = recordSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  } catch (error) { console.error(error); }
}

// ============================================================
// 10) APP ENTRY / AUTH
// ============================================================
function enterApp() {
  showOnly("main-app");
  renderAll();
  switchView(state.currentView);
}
function authMessage(message = "", isError = true) {
  const el = $("auth-message");
  if (!message) { el.classList.add("hidden"); return; }
  el.textContent = message;
  el.className = `notice ${isError ? "notice-error" : ""}`;
}

$("demo-login").addEventListener("click", () => startDemo());
$("show-register").addEventListener("click", () => {
  $("register-form").classList.remove("hidden");
  $("login-form").classList.add("hidden");
  $("show-register").classList.add("hidden");
  $("demo-login").classList.add("hidden");
});
$("hide-register").addEventListener("click", (event) => {
  event.preventDefault();
  $("register-form").classList.add("hidden");
  $("login-form").classList.remove("hidden");
  $("show-register").classList.remove("hidden");
  $("demo-login").classList.remove("hidden");
});
$("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.mode !== "firebase") { authMessage("Firebase is not configured. Use Demo Mode or finish the setup steps."); return; }
  try {
    const credential = await createUserWithEmailAndPassword(auth, $("register-email").value.trim(), $("register-password").value);
    await setDoc(doc(db, "users", credential.user.uid), {
      name: $("register-name").value.trim(),
      role: "staff",
      schoolId: "UNASSIGNED",
      schoolName: "Unassigned"
    });
    authMessage("Account created. An administrator must assign your school profile before you can enter data.", false);
  } catch (error) {
    console.error(error); authMessage(error.message || "Account creation failed.");
  }
});
$("setup-demo").addEventListener("click", () => startDemo());
$("setup-signout").addEventListener("click", async () => { if (auth) await signOut(auth); showOnly("auth-view"); });
$("logout-btn").addEventListener("click", async () => {
  stopListeners();
  if (state.mode === "firebase" && auth) await signOut(auth);
  state.user = null; state.profile = null;
  showOnly("auth-view");
});
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.mode !== "firebase") { authMessage("Firebase is not configured. Use Demo Mode or finish the setup steps below."); return; }
  authMessage("");
  try {
    await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-password").value);
  } catch (error) {
    console.error(error); authMessage(error.message || "Sign-in failed.");
  }
});

// Click text/button links that point to another view.
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-go]");
  if (target) switchView(target.dataset.go);
});
$("nav-tabs").addEventListener("click", (event) => { const button = event.target.closest(".nav-item"); if (button) switchView(button.dataset.view); });

$("dashboard-scope").addEventListener("change", renderDashboard);
$("dashboard-student").addEventListener("change", (event) => { state.selectedStudentId = event.target.value; renderDashboard(); });
$("student-search").addEventListener("input", renderStudents);
["behavior-filter", "academic-filter", "academic-status-filter", "attendance-filter", "communication-filter"].forEach((id) => $(id).addEventListener("change", () => { if (id.startsWith("behavior")) renderBehavior(); else if (id.startsWith("academic")) renderAcademic(); else if (id.startsWith("attendance")) renderAttendance(); else renderCommunication(); }));

$("behavior-form").addEventListener("submit", (e) => submitModuleForm(e, "behavior"));
$("academic-form").addEventListener("submit", (e) => submitModuleForm(e, "academic"));
$("attendance-form").addEventListener("submit", (e) => submitModuleForm(e, "attendance"));
$("communication-form").addEventListener("submit", (e) => submitModuleForm(e, "communication"));

$("open-student-modal").addEventListener("click", () => $("student-modal").classList.remove("hidden"));
$("close-student-modal").addEventListener("click", () => $("student-modal").classList.add("hidden"));
$("student-modal").addEventListener("click", (event) => { if (event.target === $("student-modal")) $("student-modal").classList.add("hidden"); });
$("student-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const student = await addStudent(formObject(form));
    if (state.mode === "demo") state.selectedStudentId = student.id;
    form.reset();
    $("student-modal").classList.add("hidden");
    populateAllStudentFilters();
    renderAll();
    showToast("Student added");
    if (state.mode === "firebase") await refreshFirebaseSnapshotFallback();
  } catch (error) { console.error(error); showNotice(`Could not add student: ${error.message}`, "error"); }
});

$("export-csv").addEventListener("click", () => {
  const rows = [
    ["module", "date", "student", "studentId", "staff", "type", "status", "subject", "metric", "score", "target", "minutes", "excused", "method", "audience", "intervention", "followup", "notes"]
  ];
  state.records.forEach((r) => rows.push([r.module, r.date, studentName(r.studentId), r.studentId, r.staff || "", r.type || "", r.status || "", r.subject || "", r.metric || "", r.score ?? "", r.target ?? "", r.minutes ?? "", r.excused || "", r.method || "", r.audience || "", r.intervention || "", r.followup || "", r.notes || ""]));
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `mtss-export-${todayISO()}.csv`; a.click(); URL.revokeObjectURL(url);
});

window.addEventListener("resize", () => { if (!$("main-app").classList.contains("hidden")) renderDashboard(); });

// ============================================================
// 11) AUTH STATE
// ============================================================
if (state.mode === "firebase") {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { showOnly("auth-view"); return; }
    try { await startFirebaseForUser(user); } catch (error) { console.error(error); showNotice(`Could not load your school profile: ${error.message}`, "error"); }
  });
} else {
  showOnly("auth-view");
}
