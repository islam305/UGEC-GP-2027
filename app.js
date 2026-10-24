'use strict';
const STORAGE_KEY = 'UGEC_GP2027_PRO_V1';
const BUCKET = 'ugec-files';
const kinds = ['teams','sessions','inputs','tasks','submissions','settings'];
const fields = {
  teams: ['name','group','members','coordinator','primaryEngineer','secondaryEngineer','advisor','progress','score','project'],
  sessions: ['legacyReferences','title','presenter','date','time','desc','videoLink'],
  inputs: ['legacyReferences','title','ref','desc','link','storagePath','fileName'],
  tasks: ['title','desc','deadline','format','createdAt'],
  submissions: ['legacyReferences','taskId','uniId','rev','fileName','fileLink','storagePath','notes','status','score','major','minor','date'],
  settings: ['sessions','tasks','pending','progress']
};
let db, profile, user, busy = false, refreshing = false;
let rows = new Map();
let notificationStates = new Map();
let notificationsReady = false;
let state = emptyState();
function $(id) { return document.getElementById(id); }
function emptyState() { return {isMentor:false,currentUni:null,universities:[],sessions:[],inputs:[],tasks:[],submissions:[],notifications:[],global:{sessions:0,tasks:0,pending:0,progress:0}}; }
function key(kind,id) { return kind+':'+id; }
function uid() { return crypto.randomUUID(); }
function clean(kind,data) {
  return Object.fromEntries(fields[kind].filter(f => Object.hasOwn(data,f)).map(f => [f,data[f]]));
}
let statusTimeout = null;
function status(message,error=false) {
  const el=$('cloudStatus');
  el.textContent=message;
  el.style.color=error?'#fca5a5':'#7dd3fc';
  if(message) {
    el.classList.remove('h-0','opacity-0');
    if(statusTimeout) clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
      el.classList.add('h-0','opacity-0');
    }, 5000);
  } else {
    el.classList.add('h-0','opacity-0');
  }
}
function errorText(err) {
  const m=err?.message || String(err);
  if (/Invalid login credentials/i.test(m)) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (/Email not confirmed/i.test(m)) return 'البريد غير مؤكد. راجع رسالة التأكيد أو إعداد الحساب في Supabase.';
  if (/ugec_profiles|ugec_documents|schema cache|relation .* does not exist/i.test(m)) return 'إعداد قاعدة البيانات غير مكتمل. نفّذ setup.sql في SQL Editor أولاً.';
  return m;
}
function showError(err) { status('لم تكتمل العملية: '+errorText(err),true); alert(errorText(err)); }
async function run(action) {
  if(busy) return;
  if(refreshing) {status("جاري تحديث البيانات، حاول مجددًا بعد لحظة.");return;}
  busy=true;
  const buttons=[...document.querySelectorAll('form button, #importLegacyBtn')];
  const previous=buttons.map(b=>b.disabled);
  buttons.forEach(b=>b.disabled=true);
  try { if(!navigator.onLine) throw Error('لا يوجد اتصال بالإنترنت. لم يتم حفظ تغييراتك.'); await action(); }
  catch(err) { showError(err); }
  finally {buttons.forEach((b,i)=>b.disabled=previous[i]);busy=false;}
}
function closeModals() { document.querySelectorAll('.ugec-modal').forEach(m=>m.classList.add('hidden')); }
function openMentorLogin() { closeModals(); $('mentorLoginModal').classList.remove('hidden'); }
function openUniLogin() { closeModals(); $('uniLoginModal').classList.remove('hidden'); }
async function initData() {
  try {
    if(!window.supabase || !window.UGEC_CONFIG) throw Error('تعذر تحميل مكتبة الاتصال. تحقق من اتصال الإنترنت وأعد تحميل الصفحة.');
    db=window.supabase.createClient(UGEC_CONFIG.url,UGEC_CONFIG.key);
    const {data,error}=await db.auth.getSession(); if(error) throw error;
    if(data.session) await establish(data.session.user);
    else status('جاهز لتسجيل الدخول. استخدم حساب البريد الإلكتروني الجديد.');
    db.auth.onAuthStateChange(event=>{ if(event==='SIGNED_OUT') resetAuth(); });
  } catch(err) {status(errorText(err),true);}
}
async function login(e,role) {
  e.preventDefault();
  await run(async()=>{
    if(!db) throw Error('الاتصال غير جاهز. أعد تحميل الصفحة.');
    const prefix=role==='mentor'?'mentor':'uni';
    const {data,error}=await db.auth.signInWithPassword({email:$(prefix+'Email').value.trim(),password:$(prefix+'Pass').value});
    if(error) throw error;
    try { await establish(data.user,role); }
    catch(err) {await db.auth.signOut();throw err;}
    $(prefix+'Pass').value=''; closeModals();
  });
}
function loginMentor(e) { return login(e,'mentor'); }
function loginUni(e) { return login(e,'team'); }
async function establish(account,expectedRole) {
  const {data,error}=await db.from('ugec_profiles').select('role,team_id').eq('user_id',account.id).maybeSingle();
  if(error) throw error;
  if(!data) throw Error('حسابك ليس له صلاحية بعد. يلزم ربطه بدور وفريق باستخدام accounts.sql.');
  if(expectedRole && data.role!==expectedRole) throw Error('استخدم بوابة الدخول المناسبة لدور حسابك.');
  user=account;profile=data;
  await reloadData();
  $('authGate').classList.add('hidden'); $('appShell').classList.remove('hidden');
  $('notifBtn').classList.remove('hidden');
  $('logoutBtn').classList.remove('hidden'); $('refreshBtn').classList.remove('hidden');
  $('activeRoleLabel').textContent=state.isMentor?'مشرف / المنسق':state.universities[0]?.name||'فريق الجامعة';
  $('mentorSettingsBtn').classList.toggle('hidden',!state.isMentor);
  $('legacyBackupPanel').classList.toggle('hidden',!state.isMentor);
  $('tabReviewsBtn').classList.toggle('hidden',!state.isMentor);
  document.querySelectorAll('.mentor-action').forEach(b=>b.classList.toggle('hidden',!state.isMentor));
}
function resetAuth() {
  user=null;profile=null;rows.clear();notificationStates.clear();notificationsReady=false;state=emptyState();closeModals();renderAll();
  $('legacyBackupPanel').classList.add('hidden');
  $('appShell').classList.add('hidden');$('authGate').classList.remove('hidden');
  ['logoutBtn','mentorSettingsBtn','refreshBtn','notifBtn'].forEach(id=>$(id).classList.add('hidden'));
  document.querySelectorAll('.mentor-action').forEach(b=>b.classList.add('hidden'));
  status('تم تسجيل الخروج.');
}
async function logout() { await run(async()=>{const {error}=await db.auth.signOut();if(error) throw error;resetAuth();}); }
async function reloadData() {
  if(!profile || refreshing) return;
  refreshing=true;
  try {
    const next=new Map();
    for(let from=0;;from+=1000) {
      const {data,error}=await db.from('ugec_documents').select('*').order('kind').order('id').range(from,from+999);
      if(error) throw error;
      for(const row of data) next.set(key(row.kind,row.id),row);
      if(data.length<1000) break;
    }
    const nextState=emptyState();
    nextState.isMentor=profile.role==='mentor';nextState.currentUni=profile.team_id;
    for(const row of next.values()) {
      const data={...clean(row.kind,row.data),id:row.id};
      if(row.kind==='settings') {if(row.id==='global') nextState.global={...nextState.global,...data};}
      else nextState[row.kind==='teams'?'universities':row.kind].push(data);
    }
    rows=next;state=nextState;await loadNotificationStates();renderAll();
  } finally {refreshing=false;}
}
async function refreshData() { if(busy) return; await run(reloadData); }
function requireMentor() { if(profile?.role!=='mentor') throw Error('هذه العملية متاحة للمشرف فقط.'); }
async function put(kind,id,data,insertOnly=false) {
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw Error('معرّف السجل غير صالح.');
  const old=insertOnly?null:rows.get(key(kind,id));
  const payload={kind,id,data:clean(kind,data),team_id:kind==='teams'?id:kind==='submissions'?data.uniId:null,version:old?old.version+1:1};
  let query=old?db.from('ugec_documents').update(payload).eq('kind',kind).eq('id',id).eq('version',old.version):db.from('ugec_documents').insert(payload);
  const {data:saved,error}=await query.select('id');
  if(error) throw error;
  if(!saved?.length) throw Error('السجل تغيّر أو الصلاحية غير كافية. حدّث البيانات ثم أعد فتح النموذج.');
}
async function commit(kind,id,data) {await put(kind,id,data);await reloadData();closeModals();}
function externalURL(value) {
  if(value==null || value==='') return '';
  if(typeof value!=='string') throw Error('الرابط يجب أن يكون نصًا يبدأ بـ https://');
  if(!value.trim()) return '';
  let url;
  try { url=new URL(value.trim()); }
  catch { throw Error('الرابط غير مكتمل. أدخل عنوانًا يبدأ بـ https://، أو ارفع الملف نفسه بدل كتابة اسمه.'); }
  if(!['https:','http:'].includes(url.protocol)) throw Error('استخدم رابط https أو http صالحًا.');
  return url.href;
}
async function uploadFile(inputId,folder) {
  const file=$(inputId).files[0]; if(!file) return null;
  if(file.size>20*1024*1024) throw Error('الحد الأقصى للملف 20 ميجابايت. استخدم رابطًا خارجيًا للملفات الأكبر.');
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['pdf','dwg','dxf','zip','xlsx','xls','doc','docx','ppt','pptx','png','jpg','jpeg','txt','csv'].includes(ext)) throw Error('صيغة الملف غير مدعومة.');
  const path=folder+'/'+uid()+'.'+ext;
  const {error}=await db.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
  if(error) throw error;
  return {storagePath:path,fileName:file.name};
}
async function openFile(record,field='link') {
  await run(async()=>{
    let url;
    if(record.storagePath) {
      const {data,error}=await db.storage.from(BUCKET).createSignedUrl(record.storagePath,60,{download:record.fileName||true});
      if(error) throw error;url=data.signedUrl;
    } else url=externalURL(record[field]);
    if(!url) throw Error('لا يوجد ملف أو رابط في هذا السجل.');
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.click();
  });
}
function saveSession(e) { e.preventDefault();return run(async()=>{
  requireMentor();const id=$('sessionId').value||uid();const old=state.sessions.find(s=>s.id===id);
  await commit('sessions',id,{title:$('sessionTitle').value,presenter:$('sessionPresenter').value,date:$('sessionDate').value,time:$('sessionTime').value,desc:$('sessionDesc').value,videoLink:old?.videoLink||'',legacyReferences:old?.legacyReferences||{}});
}); }
function saveSessionVideo(e) {e.preventDefault();return run(async()=>{
  requireMentor();const id=$('sessionVideoId').value;const old=state.sessions.find(s=>s.id===id);if(!old) throw Error('السيشن غير موجودة.');
  await commit('sessions',id,{...old,videoLink:externalURL($('sessionVideoLink').value)});
});}
function saveInput(e) {e.preventDefault();return run(async()=>{
  requireMentor();const id=$('inputId').value||uid();const old=state.inputs.find(i=>i.id===id)||{};
  const link=externalURL($('inputLink').value);
  if($('inputFile').files[0] && link) throw Error('اختار ملفًا أو رابطًا خارجيًا، وليس الاثنين.');
  const file=await uploadFile('inputFile','shared');
  const obj={legacyReferences:(!file&&!link)?old.legacyReferences||{}:{},title:$('inputTitle').value,ref:$('inputRef').value,desc:$('inputDesc').value,link,...(file||(!link?{storagePath:old.storagePath||'',fileName:old.fileName||''}:{}))};
  await commit('inputs',id,obj);
});}
function saveTask(e) {e.preventDefault();return run(async()=>{
  requireMentor();const id=$('taskId').value||uid();const old=state.tasks.find(t=>t.id===id);
  await commit('tasks',id,{title:$('taskTitle').value,desc:$('taskDesc').value,deadline:$('taskDeadline').value,format:$('taskFormat').value,createdAt:old?.createdAt||Date.now()});
});}
function submitTask(e) {e.preventDefault();return run(async()=>{
  if(profile?.role!=='team') throw Error('تسجيل دخول الفريق مطلوب.');
  const fileLink=externalURL($('submitFileLink').value);
  if($('submitFile').files[0] && fileLink) throw Error('اختار ملفًا أو رابطًا خارجيًا، وليس الاثنين.');
  const file=await uploadFile('submitFile',profile.team_id);
  if(!file && !fileLink) throw Error('اختر ملفًا أو أدخل رابط تسليم صالحًا.');
  await commit('submissions',uid(),{taskId:$('submitTaskId').value,uniId:profile.team_id,rev:$('submitRev').value,fileName:file?.fileName||$('submitFileName').value,fileLink,...(file||{}),notes:$('submitNotes').value,status:'under_review',score:'',major:'',minor:'',date:new Date().toISOString()});
});}
function saveReview(e) {e.preventDefault();return run(async()=>{
  requireMentor();const id=$('reviewSubId').value;const old=state.submissions.find(s=>s.id===id);if(!old) throw Error('التسليم غير موجود.');
  const score=Number($('reviewScore').value);if(!Number.isFinite(score)||score<0||score>100) throw Error('التقييم من صفر إلى 100.');
  await commit('submissions',id,{...old,score,status:$('reviewStatus').value,major:$('reviewMajor').value,minor:$('reviewMinor').value});
});}
function saveTeam(e) {e.preventDefault();return run(async()=>{
  requireMentor();const id=$('teamId').value||uid();
  const obj={name:$('teamUniName').value,group:$('teamGroup').value,members:$('teamMembers').value,coordinator:$('teamCoordinator').value,primaryEngineer:$('teamPrimaryEngineer').value,secondaryEngineer:$('teamSecondaryEngineer').value,advisor:$('teamAdvisor').value,progress:Number($('teamProgress').value)||0,score:Number($('teamScore').value)||0,project:$('teamProject').value};
  if([obj.progress,obj.score].some(x=>x<0||x>100)) throw Error('النسبة والدرجة من صفر إلى 100.');
  await commit('teams',id,obj);
});}
function saveGlobalSettings() {return run(async()=>{
  requireMentor();
  const raw=$('gsProgress').value.trim();
  const progress=Number(raw);
  if(raw==='' || !Number.isFinite(progress) || progress<0 || progress>100) throw Error('نسبة استكمال المشروع يجب أن تكون من صفر إلى 100.');
  await commit('settings','global',{...automaticStats(),progress});
});}
async function removeRecord(kind,id) {
  if(!confirm('حذف هذا السجل؟ لن تُحذف الملفات المخزنة تلقائيًا.')) return;
  await run(async()=>{requireMentor();const old=rows.get(key(kind,id));if(!old) throw Error('السجل غير موجود.');
    const {data,error}=await db.from('ugec_documents').delete().eq('kind',kind).eq('id',id).eq('version',old.version).select('id');
    if(error) throw error;if(!data.length) throw Error('السجل تغيّر. حدّث الصفحة وأعد المحاولة.');await reloadData();
  });
}
function deleteSession(id) {return removeRecord('sessions',id);}
function deleteInput(id) {return removeRecord('inputs',id);}
function deleteTask(id) {return removeRecord('tasks',id);}
function exportLegacy() {
  try {requireMentor();const raw=localStorage.getItem(STORAGE_KEY);if(!raw) throw Error('لا توجد بيانات قديمة في هذا المتصفح. افتح الموقع من المتصفح الذي استخدمته سابقًا.');JSON.parse(raw);downloadJSON(raw,'UGEC-private-legacy-backup.json');}
  catch(err) {showError(err);}
}
function downloadJSON(raw,name) {const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportCloud() {requireMentor();downloadJSON(JSON.stringify(state,null,2),'UGEC-cloud-backup.json');}
function importLegacy() {return run(async()=>{
  requireMentor();const file=$('legacyImport').files[0];
  const raw=file?await file.text():localStorage.getItem(STORAGE_KEY);
  if(!raw) throw Error('لا توجد بيانات قديمة. اختر نسخة JSON أو استخدم المتصفح القديم.');
  const legacy=JSON.parse(raw);
  if(!legacy || !Array.isArray(legacy.universities) || !Array.isArray(legacy.tasks)) throw Error('صيغة النسخة غير صحيحة.');
  if(!confirm('استيراد السجلات الناقصة فقط؟ السجلات الحالية لن تتغير. النسخة الأصلية قد تحتوي كلمات مرور قديمة؛ احتفظ بها خاصة.')) return;
  const batch=[];
  let unresolvedCount=0;
  for(const kind of kinds) {
    const records=kind==='settings'?[{id:'global',...(legacy.global||{})}]:(legacy[kind==='teams'?'universities':kind]||[]);
    if(!Array.isArray(records)) throw Error('قسم غير صالح: '+kind);
    for(const item of records) {
      if(!item || !/^[A-Za-z0-9_-]{1,100}$/.test(item.id||'')) throw Error('معرّف غير صالح في '+kind);
      const data=clean(kind,item);
      for(const field of ['link','fileLink','videoLink']) if(data[field]) {
        try { data[field]=externalURL(data[field]); }
        catch {
          data.legacyReferences={...(data.legacyReferences||{}),[field]:String(data[field])};
          data[field]='';unresolvedCount++;
        }
      }
      if(kind==='submissions' && (!data.uniId||!data.taskId)) throw Error('تسليم بدون معرّف فريق أو تاسك.');
      batch.push({kind,id:item.id,data});
    }
  }
  // Validate the entire snapshot before creating any records. Keep credentials out.
  let imported=0,skipped=0;
  try {
    for(const item of batch) {
      if(rows.has(key(item.kind,item.id))) {skipped++;continue;}
      await put(item.kind,item.id,item.data,true);imported++;
    }
  } catch(err) {throw Error('تم حفظ '+imported+' سجل قبل توقف الاستيراد. حدّث البيانات ثم أعد الاستيراد لتكملة الناقص. '+errorText(err));}
  finally {await reloadData();}
  alert('تم استيراد '+imported+' سجل وتجاوز '+skipped+' سجل موجود. '+(unresolvedCount?'تم الاحتفاظ بـ '+unresolvedCount+' مرجع غير صالح كنص بدل رابط؛ راجعها وأعد رفع ملفاتها أو صحح روابطها. ':'')+'كلمات المرور القديمة لم تُنقل؛ أنشئ الحسابات الجديدة حسب accounts.sql.');
});}
// Plain text nodes and event listeners prevent stored data from becoming HTML/code.
function node(tag,text,cls='') {const el=document.createElement(tag);if(text!==undefined)el.textContent=text;el.className=cls;return el;}
function button(text,action) {const b=node('button',text,'ugec-chip');b.type='button';b.addEventListener('click',action);return b;}
function list(id,items,render) {const target=$(id);target.replaceChildren();items.forEach((x,i)=>target.append(render(x,i)));if(!items.length)target.append(node('p','لا توجد بيانات بعد.','text-sm text-slate-400'));}
function card(title,lines=[],actions=[]) {const c=node('div',undefined,'ugec-card rounded-2xl p-4 space-y-2');c.append(node('div',title,'font-bold'));lines.forEach(t=>c.append(node('div',t,'text-sm text-slate-400 whitespace-pre-wrap')));const a=node('div',undefined,'flex flex-wrap gap-2');actions.forEach(b=>a.append(b));c.append(a);return c;}
function latestSub(taskId) {return state.submissions.filter(s=>s.taskId===taskId&&s.uniId===state.currentUni).sort((a,b)=>(Date.parse(b.date)||Number(b.id.replace(/\D/g,''))||0)-(Date.parse(a.date)||Number(a.id.replace(/\D/g,''))||0))[0];}
function statusText(s) {return s==='approved'?'معتمد':s==='revision'?'يحتاج تعديل':'تحت المراجعة';}
function dateText(s) {if(!s)return '-';const d=new Date(s);return Number.isNaN(d.getTime())?s:d.toLocaleString('ar-EG');}
function taskActions(t) {
  if(state.isMentor) return [button('تعديل',()=>openAddTaskModal(t.id)),button('حذف',()=>deleteTask(t.id))];
  if(!state.currentUni) return [];
  const sub=latestSub(t.id);const actions=[];
  if(sub) actions.push(button(statusText(sub.status)+' • '+(sub.score===''?'لم يقيّم':sub.score+'/100'),()=>showTaskResult(sub.id)));
  if(!sub||sub.status==='revision') actions.push(button(sub?'رفع إصدار جديد':'رفع التسليم',()=>openSubmitModal(t.id)));
  return actions;
}
function renderTasks() {list('tasksList',state.tasks.slice().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)),(t,i)=>card('تاسك '+(i+1)+': '+t.title,[t.desc||'', 'الموعد: '+(t.deadline||'-'),'الصيغة: '+(t.format||'-')],taskActions(t)));}
function legacyReferenceText(record) {return Object.entries(record.legacyReferences||{}).filter(([field])=>!record[field]&&!record.storagePath).map(([,text])=>'مرجع قديم يحتاج رابطًا صالحًا أو إعادة رفع: '+text).join('\n');}
function sessionCard(s) {const actions=[];if(s.videoLink) actions.push(button('مشاهدة الفيديو',()=>openFile(s,'videoLink')));if(state.isMentor)actions.push(button('تعديل',()=>openAddSessionModal(s.id)),button('رابط الفيديو',()=>openSessionVideoModal(s.id)),button('حذف',()=>deleteSession(s.id)));return card(s.title,[s.presenter||'',(s.date||'')+' '+(s.time||''),s.desc||'',legacyReferenceText(s)],actions);}
function renderSessions() {list('sessionsList',state.sessions,sessionCard);}
function renderInputs() {list('inputsList',state.inputs,i=>{const actions=[];if(i.link||i.storagePath)actions.push(button('تنزيل / فتح الملف',()=>openFile(i)));if(state.isMentor)actions.push(button('تعديل',()=>openAddInputModal(i.id)),button('حذف',()=>deleteInput(i.id)));return card(i.title+(i.ref?' • '+i.ref:''),[i.desc||'',i.fileName||'',legacyReferenceText(i)],actions);});}
function renderReviews() {list('reviewsList',state.isMentor?state.submissions:[],s=>{const t=state.tasks.find(t=>t.id===s.taskId);const u=state.universities.find(u=>u.id===s.uniId);const actions=[button('تقييم / تعديل التقييم',()=>openReview(s.id))];if(s.fileLink||s.storagePath)actions.push(button('تنزيل التسليم',()=>openFile(s,'fileLink')));return card((u?.name||s.uniId)+' • '+(t?.title||'تاسك محذوف'),['الإصدار: '+s.rev+' • '+dateText(s.date),'الملف: '+(s.fileName||'-'),s.notes||'',legacyReferenceText(s),statusText(s.status)+' • الدرجة: '+(s.score??'-')],actions);});}
function teamCard(u) {return card(u.name+' '+(u.group||''),['معرّف الفريق: '+u.id,'المشروع: '+(u.project||'-'),'الأعضاء:\n'+(u.members||'-'),'Project Coordinator: '+(u.coordinator||'-'),'Primary Engineer: '+(u.primaryEngineer||'-'),'Secondary Engineer: '+(u.secondaryEngineer||'-'),'الإنجاز: '+(u.progress||0)+'% • التقييم: '+(u.score||0)+'/100'],state.isMentor?[button('تعديل',()=>openAddTeamModal(u.id))]:[]);}
function renderTeams() {list('teamsList',state.universities,teamCard);}
function average(id) {const scores=state.submissions.filter(s=>s.uniId===id&&s.score!==''&&s.score!=null).map(s=>Number(s.score));return scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;}
function renderDashboard() {
  list('dashTasks',state.tasks,t=>card(t.title,[t.deadline||''],taskActions(t)));
  list('dashSessions',state.sessions.slice(0,3),sessionCard);
  $('dashRightTitle').textContent=state.isMentor?'تصنيف المجموعات':'فريقك';
  $('dashRanking').classList.toggle('hidden',!state.isMentor);$('dashTeams').classList.toggle('hidden',state.isMentor);
  list('dashRanking',state.isMentor?state.universities.slice().sort((a,b)=>average(b.id)-average(a.id)):[],u=>card(u.name,[average(u.id).toFixed(1)+'/100']));
  list('dashTeams',state.isMentor?[]:state.universities,teamCard);
  list('dashSupervisors',state.universities,u=>card(u.name,[u.coordinator||'-',u.primaryEngineer||'-',u.secondaryEngineer||'-']));
}
function renderReport() {
  const table=node('table',undefined,'table-ugec');const head=node('tr');['الجامعة','الفريق','المشروع','الإنجاز','التقييم'].forEach(x=>head.append(node('th',x)));const thead=node('thead');thead.append(head);table.append(thead);const body=node('tbody');state.universities.forEach(u=>{const r=node('tr');[u.name,u.group||'-',u.project||'-',(u.progress||0)+'%',(u.score||0)+'/100'].forEach(x=>r.append(node('td',x)));body.append(r);});table.append(body);$('reportContent').replaceChildren(table);
}
function automaticStats() {
  return {
    sessions:state.sessions.length,
    tasks:state.tasks.length,
    pending:state.submissions.filter(s=>s.status==='under_review').length
  };
}
function displayedStats() {return {...automaticStats(),progress:state.global.progress||0};}
function updateStats() {
  const stats=displayedStats();
  ['Sessions','Tasks','Pending','Progress'].forEach(s=>{
    $('stat'+s).textContent=stats[s.toLowerCase()];
    $('gs'+s).value=stats[s.toLowerCase()];
  });
}
function renderAll() {updateNotificationIndicator();updateStats();renderDashboard();renderSessions();renderInputs();renderTasks();renderReviews();renderTeams();renderReport();}
function showTaskResult(id) {const s=state.submissions.find(s=>s.id===id);if(!s)return;const modal=$('resultModal');const t=state.tasks.find(t=>t.id===s.taskId);$('resultContent').replaceChildren(card(t?.title||'نتيجة التسليم',['الإصدار: '+s.rev,'الحالة: '+statusText(s.status),'الدرجة: '+(s.score===''?'لم يقيّم':s.score+'/100'),legacyReferenceText(s),'ملاحظات رئيسية: '+(s.major||'-'),'ملاحظات فرعية: '+(s.minor||'-')],(s.storagePath||s.fileLink)?[button('تنزيل التسليم',()=>openFile(s,'fileLink'))]:[]));closeModals();modal.classList.remove('hidden');}
function openGlobalSettings() {requireMentor();closeModals();updateStats();$('globalSettingsModal').classList.remove('hidden');}
function openReview(id) {const s=state.submissions.find(s=>s.id===id);if(!s)return;closeModals();$('reviewSubId').value=id;$('reviewScore').value=s.score??'';$('reviewStatus').value=s.status;$('reviewMajor').value=s.major||'';$('reviewMinor').value=s.minor||'';$('reviewModal').classList.remove('hidden');}

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


function openSessionVideoModal(id) {
  if (!state.isMentor) return;
  closeModals();
  $('sessionVideoId').value = id;
  const s = state.sessions.find(x => x.id === id);
  $('sessionVideoLink').value = s && s.videoLink ? s.videoLink : '';
  $('sessionVideoModal').classList.remove('hidden');
}


function openAddInputModal(id = null) {
  closeModals();
  $('inputFile').value='';
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


function openSubmitModal(id) {
  closeModals();
  $('submitFile').value='';
  $('submitTaskId').value = id;
  $('submitRev').value = '';
  $('submitFileName').value = '';
  $('submitFileLink').value = '';
  $('submitNotes').value = '';
  $('submitTaskModal').classList.remove('hidden');
}


function openAddTeamModal(id = null) {
  requireMentor();
  closeModals();
  $('teamIdentity').textContent = id ? 'معرّف الفريق: '+id : 'سيظهر معرّف الفريق بعد الحفظ. إنشاء حساب الدخول يتم من لوحة Supabase.';
  $('teamId').value = id || '';
  if (id) {
    const u = state.universities.find(x => x.id === id);
    if (u) {
      $('teamUniName').value = u.name;
      $('teamGroup').value = u.group || '';
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
    $('teamUniName').value = ''; $('teamGroup').value = ''; $('teamMembers').value = ''; $('teamCoordinator').value = ''; $('teamPrimaryEngineer').value = ''; $('teamSecondaryEngineer').value = ''; $('teamAdvisor').value = ''; $('teamProgress').value = ''; $('teamScore').value = ''; $('teamProject').value = '';
    $('teamModalTitle').textContent = 'إضافة فريق';
  }
  $('teamModal').classList.remove('hidden');
}


document.addEventListener('click',e=>{
  const b=e.target.closest('.tab-btn');if(!b)return;
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  document.querySelectorAll('.tab-pane').forEach(x=>x.classList.add('hidden'));$('tab-'+b.dataset.tab)?.classList.remove('hidden');
});
setInterval(()=>{if(profile&&!busy&&!refreshing&&!document.hidden&&!document.querySelector('.ugec-modal:not(.hidden)'))reloadData().catch(err=>status('تعذر تحديث البيانات: '+errorText(err),true));},60000);
window.addEventListener('offline',()=>status('الاتصال مقطوع. البيانات المعروضة آخر نسخة محمّلة؛ الحفظ يحتاج الإنترنت.',true));
window.addEventListener('online',()=>{if(profile)refreshData();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initData);else initData();

function notificationId(row) {return row.kind+':'+row.id+':'+row.version;}
function currentNotifications() {
  return [...rows.values()].filter(r=>['sessions','inputs','tasks','submissions'].includes(r.kind))
    .sort((a,b)=>b.updated_at.localeCompare(a.updated_at)||notificationId(a).localeCompare(notificationId(b)));
}
function visibleNotifications() {return currentNotifications().filter(r=>!notificationStates.get(notificationId(r))?.dismissed);}
async function loadNotificationStates() {
  notificationStates=new Map();notificationsReady=false;
  if(!user) return;
  try {
    for(let from=0;;from+=1000) {
      const {data,error}=await db.from('ugec_notification_states').select('notification_id,seen,dismissed')
        .eq('user_id',user.id).order('notification_id').range(from,from+999);
      if(error) throw error;
      data.forEach(item=>notificationStates.set(item.notification_id,item));
      if(data.length<1000) break;
    }
    notificationsReady=true;
  } catch {
    // Notifications setup must not block signing in or working on the platform.
    notificationStates.clear();
  }
}
function updateNotificationIndicator() {
  const unread=visibleNotifications().filter(r=>!notificationStates.get(notificationId(r))?.seen).length;
  $('notifDot').classList.toggle('hidden',!user||unread===0);
  $('notifBtn').setAttribute('aria-label',unread?'الإشعارات: '+unread+' غير مقروءة':'الإشعارات');
  $('notifBtn').title=unread?'لديك '+unread+' إشعار غير مقروء':'الإشعارات';
}
function renderNotifications() {
  const notices=visibleNotifications();
  const target=$('notificationsList');target.replaceChildren();
  notices.forEach(r=>target.append(card(r.data.title||'تحديث تسليم • '+(r.data.rev||''),
    [dateText(r.updated_at),r.kind==='submissions'?statusText(r.data.status):'تم تحديث بيانات المنصة'],
    [button('حذف الإشعار',()=>dismissNotification(notificationId(r)))])));
  if(!notices.length)target.append(node('p','لا توجد إشعارات.','text-sm text-slate-400'));
  $('dismissAllNotificationsBtn').disabled=!notificationsReady||!notices.length;
  $('notificationsStatus').textContent=notificationsReady?'الحذف يخص حسابك فقط.':'يلزم تنفيذ ملف notifications-setup.sql لتفعيل حفظ القراءة والحذف.';
  updateNotificationIndicator();
}
function requireNotificationsReady() {
  if(!user) throw Error('سجّل الدخول أولًا.');
  if(!notificationsReady) throw Error('نفّذ notifications-setup.sql مرة واحدة في Supabase، ثم حدّث بيانات المنصة.');
}
async function persistNotificationChanges(ids,dismissed=false) {
  requireNotificationsReady();
  for(let i=0;i<ids.length;i+=100) {
    const batch=ids.slice(i,i+100);
    if(dismissed) {
      const {error}=await db.from('ugec_notification_states').upsert(batch.map(id=>({user_id:user.id,notification_id:id,seen:true,dismissed:true})),{onConflict:'user_id,notification_id'});
      if(error) throw error;
    } else {
      // Preserve any dismissal already saved from another device.
      let result=await db.from('ugec_notification_states').upsert(batch.map(id=>({user_id:user.id,notification_id:id,seen:true,dismissed:false})),{onConflict:'user_id,notification_id',ignoreDuplicates:true});
      if(result.error) throw result.error;
      result=await db.from('ugec_notification_states').update({seen:true}).eq('user_id',user.id).in('notification_id',batch);
      if(result.error) throw result.error;
    }
  }
  await loadNotificationStates();
  if(!notificationsReady) throw Error('تم إرسال التغييرات لكن تعذر تأكيدها. حدّث البيانات وحاول مجددًا.');
}
function openNotifications() {
  if(!user) return;
  closeModals();renderNotifications();$('notificationsModal').classList.remove('hidden');
  if(!notificationsReady) return;
  const unread=visibleNotifications().filter(r=>!notificationStates.get(notificationId(r))?.seen).map(notificationId);
  if(unread.length) return run(async()=>{await persistNotificationChanges(unread);renderNotifications();});
}
function dismissNotification(id) {return run(async()=>{
  requireNotificationsReady();
  if(!visibleNotifications().some(r=>notificationId(r)===id)) return;
  await persistNotificationChanges([id],true);renderNotifications();
});}
function dismissAllNotifications() {return run(async()=>{
  requireNotificationsReady();
  const ids=visibleNotifications().map(notificationId);
  if(!ids.length || !confirm('حذف كل الإشعارات الحالية من حسابك فقط؟')) return;
  await persistNotificationChanges(ids,true);renderNotifications();
});}

const quranVerses = [
  { text: '﴿ فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا ﴾', ref: '[ الشرح: 5-6 ]' },
  { text: '﴿ وَقُل رَّبِّ زِدْنِي عِلْمًا ﴾', ref: '[ طه: 114 ]' },
  { text: '﴿ وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا ۝ وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ﴾', ref: '[ الطلاق: 2-3 ]' },
  { text: '﴿ وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ ﴾', ref: '[ البقرة: 186 ]' },
  { text: '﴿ سَيَجْعَلُ اللَّهُ بَعْدَ عُسْرٍ يُسْرًا ﴾', ref: '[ الطلاق: 7 ]' },
  { text: '﴿ وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ ۝ وَأَنَّ سَعْيَهُ سَوْفَ يُرَىٰ ﴾', ref: '[ النجم: 39-40 ]' },
  { text: '﴿ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ ﴾', ref: '[ البقرة: 153 ]' },
  { text: '﴿ لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ﴾', ref: '[ البقرة: 286 ]' },
  { text: '﴿ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ ﴾', ref: '[ الرعد: 28 ]' },
  { text: '﴿ وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ ﴾', ref: '[ الطلاق: 3 ]' },
  { text: '﴿ إنَّ رَبِّي لَطِيفٌ لِّمَا يَشَاءُ ﴾', ref: '[ يوسف: 100 ]' },
  { text: '﴿ وَرَحْمَتِي وَسِعَتْ كُلَّ شَيْءٍ ﴾', ref: '[ الأعراف: 156 ]' },
  { text: '﴿ وَبَشِّرِ الصَّابِرِينَ ﴾', ref: '[ البقرة: 155 ]' },
  { text: '﴿ ادْعُونِي أَسْتَجِبْ لَكُمْ ﴾', ref: '[ غافر: 60 ]' },
  { text: '﴿ وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ وَرَسُولُهُ وَالْمُؤْمِنُونَ ﴾', ref: '[ التوبة: 105 ]' }
];

let currentVerseIndex = 0;
let quranHideTimeout = null;

function showQuranToast() {
  const toast = $('quranToast');
  const textEl = $('quranText');
  const refEl = $('quranRef');
  const progressEl = $('quranProgress');
  if (!toast || !textEl || !refEl || !progressEl) return;

  const verse = quranVerses[currentVerseIndex];
  textEl.textContent = verse.text;
  refEl.textContent = verse.ref;

  progressEl.classList.remove('animate-countdown');
  void progressEl.offsetWidth;
  progressEl.classList.add('animate-countdown');

  toast.classList.remove('toast-hidden');
  toast.classList.add('toast-visible');

  if (quranHideTimeout) clearTimeout(quranHideTimeout);

  quranHideTimeout = setTimeout(() => {
    hideQuranToast();
    currentVerseIndex = (currentVerseIndex + 1) % quranVerses.length;
  }, 15000);
}

function hideQuranToast() {
  const toast = $('quranToast');
  if (toast) {
    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hidden');
  }
}

function nextQuranVerse() {
  currentVerseIndex = (currentVerseIndex + 1) % quranVerses.length;
  showQuranToast();
}

function initQuranWidget() {
  setTimeout(() => {
    showQuranToast();
  }, 3000);

  setInterval(() => {
    showQuranToast();
  }, 65000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQuranWidget);
} else {
  initQuranWidget();
}
