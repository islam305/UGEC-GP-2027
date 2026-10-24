const SUPABASE_URL = 'https://qbwtohpodkkxptfxilkz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFid3RvaHBvZGtreHB0ZnhpbGt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MzU1MjMsImV4cCI6MjEwODQxMTUyM30.wLFf5guNMYbE71XvFB1c2M7QrXPQUl6aQweKELmY1oc';

let supabase = null;
if (window.supabase) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const STORAGE_KEY = 'UGEC_GP2027_PRO_V1';

const defaultState = {
  mentorPassword: 'ugec@2027',
  isMentor: false,
  currentUni: null,
  notifications: [],
  global: {
    sessions: 2,
    tasks: 3,
    pending: 0,
    progress: 10
  },
  universities: [
    {
      id: 'u1',
      name: 'جامعة القاهرة',
      group: 'مجموعة 1',
      pass: 'cairo1',
      members: 'أسماء أعضاء الفريق',
      coordinator: '',
      primaryEngineer: '',
      secondaryEngineer: '',
      advisor: '',
      project: 'مشروع تخرج محطة الجهد العالي',
      progress: 10,
      score: 0
    },
    {
      id: 'u2',
      name: 'جامعة القاهرة',
      group: 'مجموعة 2',
      pass: 'cairo2',
      members: '',
      coordinator: '',
      primaryEngineer: '',
      secondaryEngineer: '',
      advisor: '',
      project: '',
      progress: 10,
      score: 0
    },
    {
      id: 'u3',
      name: 'جامعة سوهاج',
      group: '',
      pass: 'sohag1',
      members: '',
      coordinator: '',
      primaryEngineer: '',
      secondaryEngineer: '',
      advisor: '',
      project: '',
      progress: 10,
      score: 0
    },
    {
      id: 'u4',
      name: 'جامعة قنا',
      group: '',
      pass: 'qena1',
      members: '',
      coordinator: '',
      primaryEngineer: '',
      secondaryEngineer: '',
      advisor: '',
      project: '',
      progress: 10,
      score: 0
    },
    {
      id: 'u5',
      name: 'جامعة الزقازيق',
      group: '',
      pass: 'zag1',
      members: '',
      coordinator: '',
      primaryEngineer: '',
      secondaryEngineer: '',
      advisor: '',
      project: '',
      progress: 10,
      score: 0
    }
  ],
  sessions: [
    { id: 's1', title: 'السيشن الأولى', presenter: 'استشاري UGEC', date: '2026-01-01', time: '', desc: '' },
    { id: 's2', title: 'السيشن الثانية', presenter: 'استشاري UGEC', date: '2026-02-01', time: '', desc: '' }
  ],
  inputs: [],
  tasks: [
    { id: 't1', title: 'التاسك الأول', desc: '', deadline: '', format: 'DWG/PDF', createdAt: Date.now() },
    { id: 't2', title: 'التاسك الثاني', desc: '', deadline: '', format: 'DWG/PDF', createdAt: Date.now() },
    { id: 't3', title: 'التاسك الثالث', desc: '', deadline: '', format: 'DWG/PDF', createdAt: Date.now() }
  ],
  submissions: []
};

let state = JSON.parse(JSON.stringify(defaultState));
let dataLoaded = false;

async function initData() {
  if (!supabase) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = { ...JSON.parse(JSON.stringify(defaultState)), ...parsed };
      } else {
        state = JSON.parse(JSON.stringify(defaultState));
      }
    } catch (e) {
      state = JSON.parse(JSON.stringify(defaultState));
    }
    dataLoaded = true;
    renderAll();
    updateStats();
    return;
  }
  try {
    const { data, error } = await supabase.from('app_state').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    if (data && data.state) {
      state = { ...JSON.parse(JSON.stringify(defaultState)), ...data.state };
    } else {
      state = JSON.parse(JSON.stringify(defaultState));
      await supabase.from('app_state').upsert({ id: 1, state: state, updated_at: new Date().toISOString() });
    }
  } catch (e) {
    console.error('Supabase load error:', e);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = { ...JSON.parse(JSON.stringify(defaultState)), ...parsed };
      } else {
        state = JSON.parse(JSON.stringify(defaultState));
      }
    } catch (e2) {
      state = JSON.parse(JSON.stringify(defaultState));
    }
  }
  dataLoaded = true;
  renderAll();
  updateStats();
}

function loadState() {
  return state;
}

async function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
  if (supabase) {
    try {
      await supabase.from('app_state').upsert({ id: 1, state: state, updated_at: new Date().toISOString() });
    } catch (e) {
      console.error('Supabase save error:', e);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initData);
} else {
  initData();
}

function $(id) { return document.getElementById(id); }

function closeModals() {
  document.querySelectorAll('.ugec-modal').forEach(m => m.classList.add('hidden'));
}

function openMentorLogin() {
  closeModals();
  $('mentorLoginModal').classList.remove('hidden');
}

function openUniLogin() {
  closeModals();
  const sel = $('uniSelect');
  sel.innerHTML = state.universities.map(u => `<option value="${u.id}">${u.name} ${u.group ? '- ' + u.group : ''}</option>`).join('');
  $('uniLoginModal').classList.remove('hidden');
}

function loginMentor(e) {
  e.preventDefault();
  if ($('mentorPass').value === state.mentorPassword) {
    state.isMentor = true;
    state.currentUni = null;
    saveState();
    enterApp('مشرف / المنسق');
    closeModals();
  } else {
    alert('كلمة المرور غير صحيحة');
  }
}

function loginUni(e) {
  e.preventDefault();
  const id = $('uniSelect').value;
  const u = state.universities.find(x => x.id === id);
  if (!u) return alert('خطأ');
  if ($('uniPass').value === u.pass) {
    state.isMentor = false;
    state.currentUni = u.id;
    saveState();
    enterApp(`${u.name} ${u.group || ''}`.trim());
    closeModals();
  } else {
    alert('كلمة المرور غير صحيحة');
  }
}

function enterApp(label) {
  $('authGate').classList.add('hidden');
  $('appShell').classList.remove('hidden');
  $('activeRoleLabel').textContent = label;
  $('logoutBtn').classList.remove('hidden');
  $('notifBtn').classList.remove('hidden');
  if (state.isMentor) {
    $('mentorSettingsBtn').classList.remove('hidden');
    document.querySelectorAll('.mentor-action').forEach(b => b.classList.remove('hidden'));
    $('tabReviewsBtn').classList.remove('hidden');
  }
  updateStats();
  updateNotif();
  renderAll();
}

function logout() {
  state.isMentor = false;
  state.currentUni = null;
  saveState();
  location.reload();
}

function updateStats() {
  $('statSessions').textContent = state.global.sessions;
  $('statTasks').textContent = state.global.tasks;
  $('statPending').textContent = state.global.pending;
  $('statProgress').textContent = state.global.progress;
}

function openGlobalSettings() {
  closeModals();
  $('gsSessions').value = state.global.sessions;
  $('gsTasks').value = state.global.tasks;
  $('gsPending').value = state.global.pending;
  $('gsProgress').value = state.global.progress;
  $('globalSettingsModal').classList.remove('hidden');
}

function saveGlobalSettings() {
  state.global.sessions = +$('gsSessions').value || 0;
  state.global.tasks = +$('gsTasks').value || 0;
  state.global.pending = +$('gsPending').value || 0;
  state.global.progress = +$('gsProgress').value || 0;
  saveState();
  updateStats();
  closeModals();
  renderAll();
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
    $('tab-' + btn.dataset.tab).classList.remove('hidden');
    renderAll();
  });
});

function renderAll() {
  renderDashboard();
  renderSessions();
  renderInputs();
  renderTasks();
  renderReviews();
  renderTeams();
  renderReport();
}

function getCumulativeScore(uniId) {
  const subs = state.submissions.filter(s => s.uniId === uniId);
  if (!subs.length) return 0;
  let total = 0;
  let count = 0;
  subs.forEach(s => {
    if (s.score !== '' && s.score !== null && s.score !== undefined) {
      total += Number(s.score) || 0;
      count++;
    }
  });
  if (count === 0) return 0;
  return Math.round((total / count) * 10) / 10;
}

function showTaskResult(subId) {
  closeModals();
  const s = state.submissions.find(x => x.id === subId);
  if (!s) return;
  const t = state.tasks.find(x => x.id === s.taskId);
  const score = Number(s.score) || 0;
  let extra = '';
  if (score >= 60) {
    extra = '<div class="mt-4 text-center text-2xl font-extrabold text-emerald-400 animate-pulse">🎉 Congratulations 🎉</div>';
  }
  const modal = document.createElement('div');
  modal.className = 'ugec-modal';
  modal.innerHTML = `
    <div class="ugec-modal-backdrop" onclick="this.parentElement.remove()"></div>
    <div class="ugec-modal-content max-w-md">
      <div class="flex items-center justify-between mb-4">
        <div class="font-bold">تفاصيل تصحيح التاسك</div>
        <button onclick="this.closest('.ugec-modal').remove()"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="space-y-3 text-sm">
        <div class="flex items-center justify-between"><span class="text-slate-400">عنوان التاسك</span><span>${t ? t.title : '-'}</span></div>
        <div class="flex items-center justify-between"><span class="text-slate-400">رقم الإصدار</span><span>${s.rev || '-'}</span></div>
        <div class="flex items-center justify-between"><span class="text-slate-400">الحالة</span><span class="${s.status === 'approved' ? 'text-emerald-400' : s.status === 'revision' ? 'text-amber-400' : 'text-sky-300'}">${statusText(s.status)}</span></div>
        <div class="flex items-center justify-between"><span class="text-slate-400">الدرجة</span><span class="font-bold ${score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'}">${s.score || '-'} / 100</span></div>
        <div class="border-t border-ugec-border pt-3 space-y-2">
          <div class="text-slate-300">الملاحظات الرئيسية</div>
          <div class="text-slate-400 whitespace-pre-wrap">${s.major || '-'}</div>
        </div>
        <div class="space-y-2">
          <div class="text-slate-300">الملاحظات الفرعية</div>
          <div class="text-slate-400 whitespace-pre-wrap">${s.minor || '-'}</div>
        </div>
        ${extra}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function renderDashboard() {
  const dashTasks = $('dashTasks');
  
  if (!state.isMentor && state.currentUni) {
    const myUniId = state.currentUni;
    const tasksOrdered = [...state.tasks].sort((a, b) => {
      const da = a.createdAt || 0;
      const db = b.createdAt || 0;
      return da - db;
    });
    dashTasks.innerHTML = tasksOrdered.map((t, idx) => {
      const mySub = state.submissions.find(s => s.taskId === t.id && s.uniId === myUniId);
      let btn = '';
      if (mySub && mySub.score !== '' && mySub.score !== null && mySub.score !== undefined) {
        btn = `<button onclick="showTaskResult('${mySub.id}')"><span class="ugec-chip green">إظهار النتيجة</span></button>`;
      } else if (mySub) {
        btn = `<span class="ugec-chip amber">قيد المراجعة</span>`;
      } else {
        btn = `<button onclick="openSubmitModal('${t.id}')"><span class="ugec-chip amber">رفع التسليم</span></button>`;
      }
      return `
        <div class="list-row">
          <div class="flex-1">
            <div class="flex items-center justify-between gap-2">
              <div class="font-semibold text-sm">تاسك ${idx + 1}: ${t.title}</div>
              <span class="ugec-chip">صيغة: ${t.format || '-'}</span>
            </div>
            <div class="text-xs text-slate-400 mt-1">الموعد النهائي: ${t.deadline ? t.deadline.replace('T', ' ') : '-'}</div>
          </div>
          <div class="flex items-center gap-2">${btn}</div>
        </div>
      `;
    }).join('') || '<div class="text-sm text-slate-500">لا توجد تاسكات</div>';
  } else {
    dashTasks.innerHTML = state.tasks.slice().sort((a, b) => {
      const da = a.createdAt || 0;
      const db = b.createdAt || 0;
      return da - db;
    }).slice(0, 4).map((t, idx) => `
      <div class="list-row">
        <div>
          <div class="font-semibold text-sm">تاسك ${idx + 1}: ${t.title}</div>
          <div class="text-xs text-slate-400">الموعد النهائي: ${t.deadline ? t.deadline.replace('T', ' ') : '-'}</div>
        </div>
        <span class="ugec-chip">صيغة: ${t.format || '-'}</span>
      </div>
    `).join('') || '<div class="text-sm text-slate-500">لا توجد تاسكات</div>';
  }

  const dashSessions = $('dashSessions');
  dashSessions.innerHTML = state.sessions.slice(0, 3).map(s => {
    let videoBtn = '';
    if (state.isMentor) {
      videoBtn = `<button onclick="openSessionVideoModal('${s.id}')"><span class="ugec-chip">${s.videoLink ? 'تعديل فيديو السيشن' : 'رفع فيديو السيشن'}</span></button>`;
    } else if (state.currentUni && s.videoLink) {
      videoBtn = `<button onclick="openSessionVideo('${s.videoLink.replace(/'/g, "\\'")}')"><span class="ugec-chip green">مشاهدة فيديو السيشن</span></button>`;
    }
    return `
      <div class="list-row">
        <div class="flex-1">
          <div class="font-semibold text-sm">${s.title}</div>
          <div class="text-xs text-slate-400">${s.presenter} | ${s.date} ${s.time || ''}</div>
        </div>
        <div class="flex items-center gap-2">${videoBtn}</div>
      </div>
    `;
  }).join('') || '<div class="text-sm text-slate-500">لا توجد سيشنات</div>';

  const dashRightTitle = $('dashRightTitle');
  const dashTeams = $('dashTeams');
  const dashRanking = $('dashRanking');

  if (state.isMentor) {
    if (dashRightTitle) dashRightTitle.textContent = 'تصنيف أفضل المجموعات';
    if (dashTeams) dashTeams.classList.add('hidden');
    if (dashRanking) {
      dashRanking.classList.remove('hidden');
      const ranking = [...state.universities].map(u => ({
        ...u,
        avg: getCumulativeScore(u.id)
      })).sort((a, b) => b.avg - a.avg);
      dashRanking.innerHTML = ranking.map((u, idx) => `
        <div class="flex items-center justify-between text-sm border-b border-ugec-border last:border-0 pb-2 last:pb-0">
          <div class="flex items-center gap-2">
            <span class="w-5 text-center ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-700' : 'text-slate-500'} font-bold">${idx + 1}</span>
            <div>
              <div class="font-semibold">${u.name} ${u.group || ''}</div>
              <div class="text-[10px] text-slate-500">${u.project || ''}</div>
            </div>
          </div>
          <div class="text-right">
            <div class="font-bold ${u.avg >= 90 ? 'text-emerald-400' : u.avg >= 80 ? 'text-sky-300' : u.avg >= 70 ? 'text-amber-400' : 'text-slate-300'}">${u.avg.toFixed(1)}</div>
            <div class="text-[10px] text-slate-500">متوسط تقييم</div>
          </div>
        </div>
      `).join('') || '<div class="text-sm text-slate-500">لا توجد تقييمات بعد</div>';
    }
  } else {
    if (dashRightTitle) dashRightTitle.textContent = 'الجامعات المشاركة';
    if (dashTeams) {
      dashTeams.classList.remove('hidden');
      let teamsToShow = state.universities;
      if (!state.isMentor && state.currentUni) {
        teamsToShow = state.universities.filter(u => u.id === state.currentUni);
      }
      dashTeams.innerHTML = teamsToShow.map(u => `
        <div class="border-b border-ugec-border last:border-0 pb-2 last:pb-0">
          <div class="flex items-center justify-between text-sm">
            <div class="font-semibold">${u.name} ${u.group || ''}</div>
            <span class="text-slate-400">${u.progress}%</span>
          </div>
          <div class="mt-2 text-xs text-slate-300">أعضاء الفريق:</div>
          <div class="mt-1 text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">${u.members && u.members.trim() ? u.members.replace(/،/g, '\n').replace(/,/g, '\n') : '-'}</div>
        </div>
      `).join('') || '<div class="text-sm text-slate-500">لا توجد بيانات</div>';
    }
    if (dashRanking) dashRanking.classList.add('hidden');
  }

  const dashSupervisors = $('dashSupervisors');
  const supList = [];
  if (state.isMentor) {
    state.universities.forEach(u => {
      if (u.coordinator || u.primaryEngineer || u.secondaryEngineer) {
        supList.push({ uni: u, coord: u.coordinator, pri: u.primaryEngineer, sec: u.secondaryEngineer });
      }
    });
    dashSupervisors.innerHTML = supList.map(s => `
      <div class="border-b border-ugec-border last:border-0 pb-2 last:pb-0 space-y-1">
        <div class="text-sm font-semibold">${s.uni.name} ${s.uni.group || ''}</div>
        <div class="text-xs text-slate-400">Project Coordinator : <span class="text-sky-300">${s.coord || '-'}</span></div>
        <div class="text-xs text-slate-400">Primary Engineer : <span class="text-sky-300">${s.pri || '-'}</span></div>
        <div class="text-xs text-slate-400">Secondary Engineer : <span class="text-sky-300">${s.sec || '-'}</span></div>
      </div>
    `).join('') || '<div class="text-sm text-slate-500">يتم تحديدهم من إعدادات الفرق</div>';
  } else if (state.currentUni) {
    const u = state.universities.find(x => x.id === state.currentUni);
    if (u && (u.coordinator || u.primaryEngineer || u.secondaryEngineer)) {
      dashSupervisors.innerHTML = `
        <div class="space-y-1">
          <div class="text-xs text-slate-400">Project Coordinator : <span class="text-sky-300">${u.coordinator || '-'}</span></div>
          <div class="text-xs text-slate-400">Primary Engineer : <span class="text-sky-300">${u.primaryEngineer || '-'}</span></div>
          <div class="text-xs text-slate-400">Secondary Engineer : <span class="text-sky-300">${u.secondaryEngineer || '-'}</span></div>
        </div>
      `;
    } else {
      dashSupervisors.innerHTML = '<div class="text-sm text-slate-500">يتم تحديدهم من إعدادات الفرق</div>';
    }
  } else {
    dashSupervisors.innerHTML = '<div class="text-sm text-slate-500">يتم تحديدهم من إعدادات الفرق</div>';
  }
}

function openAddSessionModal(id = null) {
  closeModals();
  $('sessionId').value = id || '';
  if (id) {
    const s = state.sessions.find(x => x.id === id);
    if (s) { $('sessionTitle').value = s.title; $('sessionPresenter').value = s.presenter; $('sessionDate').value = s.date; $('sessionTime').value = s.time || ''; $('sessionDesc').value = s.desc || ''; }
    $('sessionModalTitle').textContent = 'تعديل السيشن';
  } else {
    $('sessionTitle').value = ''; $('sessionPresenter').value = ''; $('sessionDate').value = ''; $('sessionTime').value = ''; $('sessionDesc').value = '';
    $('sessionModalTitle').textContent = 'إدراج سيشن جديدة';
  }
  $('addSessionModal').classList.remove('hidden');
}

function pushNotif(text) {
  if (!state.notifications) state.notifications = [];
  state.notifications.unshift({ id: 'n' + Date.now(), text, date: new Date().toLocaleString('ar-EG') });
  saveState();
  updateNotif();
}

function updateNotif() {
  if (!$('notifDot')) return;
  const has = state.notifications && state.notifications.length && !state.isMentor ? true : false;
  if (!state.isMentor && state.currentUni && has) {
    $('notifDot').classList.remove('hidden');
  } else {
    $('notifDot').classList.add('hidden');
  }
}

function openNotifications() {
  closeModals();
  const list = $('notificationsList');
  if (!state.notifications || !state.notifications.length) {
    list.innerHTML = '<div class="text-sm text-slate-500 text-center py-4">لا توجد إشعارات</div>';
  } else {
    list.innerHTML = state.notifications.map(n => `
      <div class="list-row">
        <div class="text-sm">${n.text}</div>
        <div class="text-xs text-slate-500">${n.date}</div>
      </div>
    `).join('');
    if (!state.isMentor) state.notifications = [];
    saveState();
    updateNotif();
  }
  $('notificationsModal').classList.remove('hidden');
}

function saveSession(e) {
  e.preventDefault();
  if (!state.isMentor) return;
  const id = $('sessionId').value || 's' + Date.now();
  const existing = state.sessions.find(x => x.id === id);
  const obj = { 
    id, 
    title: $('sessionTitle').value, 
    presenter: $('sessionPresenter').value, 
    date: $('sessionDate').value, 
    time: $('sessionTime').value, 
    desc: $('sessionDesc').value,
    videoLink: existing ? existing.videoLink : ''
  };
  const idx = state.sessions.findIndex(x => x.id === id);
  if (idx >= 0) state.sessions[idx] = obj; else { state.sessions.push(obj); pushNotif('تم إضافة سيشن جديد: ' + obj.title); }
  saveState();
  closeModals();
  renderAll();
}

function openSessionVideoModal(id) {
  if (!state.isMentor) return;
  closeModals();
  $('sessionVideoId').value = id;
  const s = state.sessions.find(x => x.id === id);
  $('sessionVideoLink').value = s && s.videoLink ? s.videoLink : '';
  $('sessionVideoModal').classList.remove('hidden');
}

function saveSessionVideo(e) {
  e.preventDefault();
  if (!state.isMentor) return;
  const id = $('sessionVideoId').value;
  const idx = state.sessions.findIndex(x => x.id === id);
  if (idx >= 0) {
    state.sessions[idx].videoLink = $('sessionVideoLink').value.trim();
    saveState();
    closeModals();
    renderAll();
    alert('تم رفع رابط الفيديو بنجاح');
  }
}

function openSessionVideo(link) {
  if (!link) return;
  window.open(link, '_blank');
}

function deleteSession(id) {
  if (!state.isMentor) return;
  if (!confirm('حذف السيشن؟')) return;
  state.sessions = state.sessions.filter(x => x.id !== id);
  saveState();
  renderAll();
}

function renderSessions() {
  const list = $('sessionsList');
  list.innerHTML = state.sessions.map(s => {
    let actions = '';
    if (state.isMentor) {
      actions = `<div class="flex items-center gap-2 flex-wrap"><button onclick="openSessionVideoModal('${s.id}')"><span class="ugec-chip">${s.videoLink ? 'تعديل فيديو السيشن' : 'رفع فيديو السيشن'}</span></button><button onclick="openAddSessionModal('${s.id}')"><span class="ugec-chip">تعديل</span></button><button onclick="deleteSession('${s.id}')"><span class="ugec-chip">حذف</span></button></div>`;
    } else if (state.currentUni && s.videoLink) {
      actions = `<button onclick="openSessionVideo('${s.videoLink.replace(/'/g, "\\'")}')"><span class="ugec-chip green">مشاهدة فيديو السيشن</span></button>`;
    }
    return `
      <div class="list-row">
        <div class="flex-1">
          <div class="font-semibold">${s.title}</div>
          <div class="text-xs text-slate-400">${s.presenter} | ${s.date} ${s.time || ''}</div>
          <div class="text-xs text-slate-400">${s.desc || ''}</div>
        </div>
        ${actions}
      </div>
    `;
  }).join('') || '<div class="text-sm text-slate-500">لا توجد سيشنات</div>';
}

function openAddInputModal(id = null) {
  closeModals();
  $('inputId').value = id || '';
  if (id) {
    const x = state.inputs.find(i => i.id === id);
    if (x) { $('inputTitle').value = x.title; $('inputRef').value = x.ref || ''; $('inputDesc').value = x.desc || ''; $('inputLink').value = x.link || ''; }
    $('inputModalTitle').textContent = 'تعديل مدخل فني';
  } else {
    $('inputTitle').value = ''; $('inputRef').value = ''; $('inputDesc').value = ''; $('inputLink').value = '';
    $('inputModalTitle').textContent = 'رفع مدخل فني';
  }
  $('addInputModal').classList.remove('hidden');
}

function saveInput(e) {
  e.preventDefault();
  if (!state.isMentor) return;
  const id = $('inputId').value || 'i' + Date.now();
  const obj = { id, title: $('inputTitle').value, ref: $('inputRef').value, desc: $('inputDesc').value, link: $('inputLink').value };
  const idx = state.inputs.findIndex(x => x.id === id);
  if (idx >= 0) state.inputs[idx] = obj; else { state.inputs.push(obj); pushNotif('تم إضافة مدخل فني جديد: ' + obj.title); }
  saveState();
  closeModals();
  renderAll();
}

function deleteInput(id) {
  if (!state.isMentor) return;
  if (!confirm('حذف المدخل الفني؟')) return;
  state.inputs = state.inputs.filter(x => x.id !== id);
  saveState();
  renderAll();
}

function openInputFile(link) {
  if (!link) return;
  window.open(link, '_blank');
}

function renderInputs() {
  const list = $('inputsList');
  list.innerHTML = state.inputs.map(i => {
    let action = '';
    if (state.isMentor) {
      action = `<div class="flex items-center gap-2"><button onclick="openAddInputModal('${i.id}')"><span class="ugec-chip">تعديل</span></button><button onclick="deleteInput('${i.id}')"><span class="ugec-chip">حذف</span></button></div>`;
    } else if (state.currentUni && i.link) {
      action = `<button onclick="openInputFile('${i.link.replace(/'/g, "\\'")}')"><span class="ugec-chip green">فتح الملف</span></button>`;
    }
    return `
      <div class="list-row">
        <div class="flex-1">
          <div class="font-semibold">${i.title} ${i.ref ? '(' + i.ref + ')' : ''}</div>
          <div class="text-xs text-slate-400">${i.desc || ''}</div>
        </div>
        ${action}
      </div>
    `;
  }).join('') || '<div class="text-sm text-slate-500">لا توجد مدخلات فنية</div>';
}

function openAddTaskModal(id = null) {
  closeModals();
  $('taskId').value = id || '';
  if (id) {
    const t = state.tasks.find(x => x.id === id);
    if (t) { $('taskTitle').value = t.title; $('taskDesc').value = t.desc || ''; $('taskDeadline').value = t.deadline || ''; $('taskFormat').value = t.format || ''; }
    $('taskModalTitle').textContent = 'تعديل التاسك';
  } else {
    $('taskTitle').value = ''; $('taskDesc').value = ''; $('taskDeadline').value = ''; $('taskFormat').value = '';
    $('taskModalTitle').textContent = 'إضافة تاسك جديد';
  }
  $('addTaskModal').classList.remove('hidden');
}

function saveTask(e) {
  e.preventDefault();
  if (!state.isMentor) return;
  const id = $('taskId').value || 't' + Date.now();
  const obj = { id, title: $('taskTitle').value, desc: $('taskDesc').value, deadline: $('taskDeadline').value, format: $('taskFormat').value, createdAt: Date.now() };
  const idx = state.tasks.findIndex(x => x.id === id);
  if (idx >= 0) state.tasks[idx] = obj; else { state.tasks.push(obj); pushNotif('تم إضافة تاسك جديد: ' + obj.title); }
  saveState();
  closeModals();
  renderAll();
}

function deleteTask(id) {
  if (!state.isMentor) return;
  if (!confirm('حذف التاسك؟')) return;
  state.tasks = state.tasks.filter(x => x.id !== id);
  state.submissions = state.submissions.filter(x => x.taskId !== id);
  saveState();
  renderAll();
}

function openSubmitModal(id) {
  closeModals();
  $('submitTaskId').value = id;
  $('submitRev').value = '';
  $('submitFileName').value = '';
  $('submitFileLink').value = '';
  $('submitNotes').value = '';
  $('submitTaskModal').classList.remove('hidden');
}

function submitTask(e) {
  e.preventDefault();
  if (state.isMentor) return;
  if (!state.currentUni) return;
  const obj = {
    id: 'sub' + Date.now(),
    taskId: $('submitTaskId').value,
    uniId: state.currentUni,
    rev: $('submitRev').value,
    fileName: $('submitFileName').value,
    fileLink: $('submitFileLink').value,
    notes: $('submitNotes').value || '',
    status: 'under_review',
    score: '',
    major: '',
    minor: '',
    date: new Date().toLocaleDateString('ar-EG')
  };
  state.submissions.push(obj);
  saveState();
  closeModals();
  renderAll();
}

function renderTasks() {
  const list = $('tasksList');
  const tasksOrdered = [...state.tasks].sort((a, b) => {
    const da = a.createdAt || 0;
    const db = b.createdAt || 0;
    return da - db;
  });
  list.innerHTML = tasksOrdered.map((t, idx) => {
    const mySub = state.submissions.find(s => s.taskId === t.id && s.uniId === state.currentUni);
    let actionBtn = '';
    if (!state.isMentor && state.currentUni) {
      if (mySub && mySub.score !== '' && mySub.score !== null && mySub.score !== undefined) {
        actionBtn = `<button onclick="showTaskResult('${mySub.id}')"><span class="ugec-chip green">إظهار النتيجة</span></button>`;
      } else if (mySub) {
        actionBtn = `<span class="ugec-chip amber">قيد المراجعة</span>`;
      } else {
        actionBtn = `<button onclick="openSubmitModal('${t.id}')"><span class="ugec-chip amber">رفع التسليم</span></button>`;
      }
    } else if (state.isMentor) {
      actionBtn = `<div class="flex items-center gap-2"><button onclick="openAddTaskModal('${t.id}')"><span class="ugec-chip">تعديل</span></button><button onclick="deleteTask('${t.id}')"><span class="ugec-chip">حذف</span></button></div>`;
    }
    return `
      <div class="list-row">
        <div class="flex-1">
          <div class="font-semibold">تاسك ${idx + 1}: ${t.title}</div>
          <div class="text-xs text-slate-400">${t.desc || ''}</div>
          <div class="text-xs text-slate-400">الموعد النهائي: ${t.deadline ? t.deadline.replace('T', ' ') : '-'}</div>
          <div class="text-xs text-slate-400">صيغة التسليم: ${t.format || '-'}</div>
        </div>
        <div class="flex items-center gap-2">
          ${actionBtn}
        </div>
      </div>
    `;
  }).join('') || '<div class="text-sm text-slate-500">لا توجد تاسكات</div>';
}

function statusText(s) {
  if (s === 'approved') return 'معتمد';
  if (s === 'revision') return 'يحتاج تعديل';
  return 'تحت المراجعة';
}

function renderReviews() {
  if (!state.isMentor) { $('reviewsList').innerHTML = '<div class="text-sm text-slate-500">خاص بالمشرف فقط</div>'; return; }
  const list = $('reviewsList');
  if (!state.submissions || state.submissions.length === 0) {
    list.innerHTML = '<div class="text-sm text-slate-500">لا توجد تسليمات</div>';
    return;
  }
  const groups = {};
  state.submissions.forEach(sub => {
    if (!groups[sub.uniId]) groups[sub.uniId] = [];
    groups[sub.uniId].push(sub);
  });
  const html = Object.keys(groups).map(uniId => {
    const u = state.universities.find(x => x.id === uniId);
    const subs = groups[uniId];
    return `
      <div class="ugec-card rounded-2xl p-4 space-y-2">
        <div class="flex items-center justify-between">
          <div class="font-bold">${u ? u.name + (u.group ? ' - ' + u.group : '') : 'جامعة غير محددة'}</div>
          <span class="ugec-chip">${subs.length} تسليم</span>
        </div>
        <div class="space-y-2">
          ${subs.map(sub => {
            const t = state.tasks.find(x => x.id === sub.taskId);
            const isEvaluated = sub.score !== '' && sub.score !== null && sub.score !== undefined;
            return `
              <div class="list-row">
                <div class="flex-1">
                  <div class="font-semibold">${t ? t.title : 'تاسك غير معروف'}</div>
                  <div class="text-xs text-slate-400">إصدار: ${sub.rev} | اسم الملف: ${sub.fileName || sub.file || '-'} | ${sub.fileLink ? '<a href="'+sub.fileLink+'" target="_blank" class="text-sky-300">رابط الملف</a>' : ''} | ${sub.date}</div>
                  <div class="text-xs text-slate-400">ملاحظات الفريق: ${sub.notes || '-'}</div>
                  <div class="text-xs text-slate-400">الدرجة: ${sub.score || '-'} | الحالة: ${statusText(sub.status)}</div>
                </div>
                ${isEvaluated ? `<span class="ugec-chip green">تم التقييم</span>` : `<button onclick="openReview('${sub.id}')"><span class="ugec-chip amber">تقييم</span></button>`}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
  list.innerHTML = html;
}

function openReview(id) {
  closeModals();
  const s = state.submissions.find(x => x.id === id);
  if (!s) return;
  $('reviewSubId').value = s.id;
  $('reviewScore').value = s.score || '';
  $('reviewStatus').value = s.status || 'under_review';
  $('reviewMajor').value = s.major || '';
  $('reviewMinor').value = s.minor || '';
  $('reviewModal').classList.remove('hidden');
}

function saveReview(e) {
  e.preventDefault();
  if (!state.isMentor) return;
  const id = $('reviewSubId').value;
  const idx = state.submissions.findIndex(x => x.id === id);
  if (idx >= 0) {
    state.submissions[idx].score = $('reviewScore').value;
    state.submissions[idx].status = $('reviewStatus').value;
    state.submissions[idx].major = $('reviewMajor').value;
    state.submissions[idx].minor = $('reviewMinor').value;
    const t = state.tasks.find(x => x.id === state.submissions[idx].taskId);
    const status = state.submissions[idx].status;
    const score = state.submissions[idx].score;
    const stTxt = status === 'approved' ? 'معتمد' : status === 'revision' ? 'يحتاج تعديل' : 'تحت المراجعة';
    pushNotif('تم تقييم تسليمك لتاسك: ' + (t ? t.title : '') + ' | الدرجة: ' + (score || '-') + '/100 | الحالة: ' + stTxt);
    saveState();
    closeModals();
    renderAll();
  }
}

function openAddTeamModal(id = null) {
  closeModals();
  $('teamId').value = id || '';
  if (id) {
    const u = state.universities.find(x => x.id === id);
    if (u) {
      $('teamUniName').value = u.name;
      $('teamGroup').value = u.group || '';
      $('teamPass').value = u.pass || '';
      $('teamMembers').value = u.members || '';
      $('teamCoordinator').value = u.coordinator || '';
      $('teamPrimaryEngineer').value = u.primaryEngineer || '';
      $('teamSecondaryEngineer').value = u.secondaryEngineer || '';
      $('teamAdvisor').value = u.advisor || '';
      $('teamProgress').value = u.progress || 0;
      $('teamScore').value = u.score || 0;
      $('teamProject').value = u.project || '';
    }
    $('teamModalTitle').textContent = 'تعديل فريق';
  } else {
    $('teamUniName').value = ''; $('teamGroup').value = ''; $('teamPass').value = ''; $('teamMembers').value = ''; $('teamCoordinator').value = ''; $('teamPrimaryEngineer').value = ''; $('teamSecondaryEngineer').value = ''; $('teamAdvisor').value = ''; $('teamProgress').value = ''; $('teamScore').value = ''; $('teamProject').value = '';
    $('teamModalTitle').textContent = 'إضافة فريق';
  }
  $('teamModal').classList.remove('hidden');
}

function saveTeam(e) {
  e.preventDefault();
  if (!state.isMentor) return;
  const id = $('teamId').value || 'u' + Date.now();
  const obj = {
    id,
    name: $('teamUniName').value,
    group: $('teamGroup').value,
    pass: $('teamPass').value,
    members: $('teamMembers').value,
    coordinator: $('teamCoordinator').value,
    primaryEngineer: $('teamPrimaryEngineer').value,
    secondaryEngineer: $('teamSecondaryEngineer').value,
    advisor: $('teamAdvisor').value,
    progress: +$('teamProgress').value || 0,
    score: +$('teamScore').value || 0,
    project: $('teamProject').value
  };
  const idx = state.universities.findIndex(x => x.id === id);
  if (idx >= 0) state.universities[idx] = obj; else state.universities.push(obj);
  saveState();
  closeModals();
  renderAll();
}

function renderTeams() {
  const list = $('teamsList');
  let teamsToShow = state.universities;
  if (!state.isMentor && state.currentUni) {
    teamsToShow = state.universities.filter(u => u.id === state.currentUni);
  }
  list.innerHTML = teamsToShow.map(u => {
    const isMine = !state.isMentor && state.currentUni === u.id;
    const blur = !state.isMentor && !isMine ? 'filter blur-sm select-none pointer-events-none' : '';
    const overlay = !state.isMentor && !isMine ? '<div class="absolute inset-0 bg-slate-950/40"></div>' : '';
    return `
    <div class="ugec-card rounded-2xl p-4 space-y-2 relative overflow-hidden ${blur} transition">
      ${overlay}
      <div class="relative flex items-center justify-between">
        <div class="font-bold">${u.name} ${u.group ? '- ' + u.group : ''}</div>
        ${state.isMentor ? `<button onclick="openAddTeamModal('${u.id}')"><span class="ugec-chip">تعديل</span></button>` : isMine ? `<span class="ugec-chip amber">جامعتك</span>` : ''}
      </div>
      <div class="relative text-xs text-slate-400">عنوان المشروع: ${u.project || '-'}</div>
      <div class="relative text-xs text-slate-300">أعضاء الفريق:</div>
      <div class="relative text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">${u.members && u.members.trim() ? u.members.replace(/،/g, '\n').replace(/,/g, '\n') : '-'}</div>
      <div class="relative text-xs text-slate-300 mt-2">لجنة المتابعة</div>
      <div class="relative text-xs text-slate-400 space-y-1">
        <div>Project Coordinator : <span class="text-sky-300">${u.coordinator || '-'}</span></div>
        <div>Primary Engineer : <span class="text-sky-300">${u.primaryEngineer || '-'}</span></div>
        <div>Secondary Engineer : <span class="text-sky-300">${u.secondaryEngineer || '-'}</span></div>
      </div>
      <div class="relative flex items-center gap-4 text-xs">
        <div>نسبة الإنجاز: <span class="text-sky-300">${u.progress}%</span></div>
        <div>التقييم الكلي: <span class="text-amber-400">${u.score}/100</span></div>
      </div>
    </div>
  `;
  }).join('');
}

function renderReport() {
  const rep = $('reportContent');
  if (!state.currentUni && !state.isMentor) { rep.innerHTML = '<div class="text-sm text-slate-500">يرجى تسجيل الدخول</div>'; return; }
  let list = state.universities;
  if (!state.isMentor && state.currentUni) list = state.universities.filter(u => u.id === state.currentUni);
  rep.innerHTML = `
    <table class="table-ugec">
      <thead>
        <tr>
          <th>الجامعة</th>
          <th>الفريق</th>
          <th>عنوان المشروع</th>
          <th>لجنة المتابعة</th>
          <th>نسبة الإنجاز</th>
          <th>التقييم الكلي</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(u => `
          <tr>
            <td>${u.name}</td>
            <td>${u.group || '-'}</td>
            <td>${u.project || '-'}</td>
            <td>Project Coordinator : ${u.coordinator || '-'}<br>Primary Engineer : ${u.primaryEngineer || '-'}<br>Secondary Engineer : ${u.secondaryEngineer || '-'}</td>
            <td>${u.progress}%</td>
            <td>${u.score}/100</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
