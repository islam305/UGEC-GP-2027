(function(){
  'use strict';
  let directory=[],directoryError='',generation=0;
  function privateTeamCard(team){
    const result=node('div',undefined,'ugec-card rounded-2xl p-4 ugec-private-team');
    result.append(node('div',[team.university_name,team.group_name].filter(Boolean).join(' • '),'font-bold'));
    const content=node('div',undefined,'ugec-private-team-body');
    const blurred=node('div',undefined,'ugec-private-team-blur');
    blurred.setAttribute('aria-hidden','true');
    // Decorative placeholders only: other teams' private data never enters DOM.
    ['المشروع وبيانات الفريق','أسماء أعضاء المجموعة','المشرفون والمهندسون','تفاصيل الإنجاز والتقييم'].forEach(text=>blurred.append(node('div',text)));
    const lock=node('div',undefined,'ugec-private-team-lock');
    lock.append(node('span','🔒'),node('span','تفاصيل خاصة بهذا الفريق'));
    content.append(blurred,lock);result.append(content);return result;
  }
  const originalTeams=renderTeams;
  renderTeams=function(){
    if(state.isMentor){originalTeams();return;}
    const own=state.universities.find(t=>t.id===state.currentUni);
    const all=directory.length?directory:state.universities.map(t=>({team_id:t.id,university_name:t.name,group_name:t.group||''}));
    list('teamsList',all,t=>t.team_id===state.currentUni&&own?teamCard(own):privateTeamCard(t));
    if(directoryError)$('teamsList').append(node('p',directoryError,'text-sm text-slate-400'));
  };
  async function loadDirectory(){
    const token=++generation,accountId=user?.id;
    if(!profile||!accountId){directory=[];directoryError='';renderTeams();return;}
    try{
      const {data,error}=await db.rpc('ugec_team_directory');if(error)throw error;
      if(token!==generation||user?.id!==accountId)return;
      directory=data||[];directoryError='';
    }catch{
      if(token!==generation||user?.id!==accountId)return;
      directory=[];directoryError='تعذر تحميل أسماء الفرق الأخرى. يلزم تفعيل team-directory-setup.sql ثم تحديث البيانات.';
    }
    renderTeams();
  }
  const originalReload=reloadData;
  reloadData=async function(...args){await originalReload.apply(this,args);await loadDirectory();};
  const originalReset=resetAuth;
  resetAuth=function(...args){generation++;directory=[];directoryError='';clearPrint();return originalReset.apply(this,args);};

  function section(title){const s=node('section',undefined,'ugec-report-section');s.append(node('h2',title));return s;}
  function table(headers,records){
    const t=node('table',undefined,'ugec-report-table'),thead=node('thead'),tr=node('tr');
    headers.forEach(h=>{const th=node('th',h);th.scope='col';tr.append(th);});thead.append(tr);t.append(thead);
    const tbody=node('tbody');records.forEach(values=>{const row=node('tr');values.forEach(value=>row.append(node('td',value)));tbody.append(row);});t.append(tbody);return t;
  }
  function bounded(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;}
  function latestFor(teamId,taskId){return state.submissions.filter(s=>s.uniId===teamId&&s.taskId===taskId).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)||String(b.id).localeCompare(String(a.id)))[0];}
  renderReport=function(){
    const paper=node('article',undefined,'ugec-report-paper');paper.dir='rtl';
    const header=node('div',undefined,'ugec-report-header'),brand=node('div');
    brand.append(node('div','UGEC','ugec-report-brand'),node('div','GP SPONSORSHIP 2027','ugec-report-brand-sub'));
    const title=node('div');title.append(node('h1','تقرير متابعة مشروعات التخرج'),node('p',state.isMentor?'تقرير شامل للفرق المشاركة':'تقرير الفريق • '+(state.universities.find(t=>t.id===state.currentUni)?.name||'فريق الجامعة')));
    header.append(brand,title);paper.append(header);
    const stamp=node('div',undefined,'ugec-report-meta');
    stamp.append(node('span','تاريخ الإصدار: '+new Date().toLocaleString('ar-EG',{timeZone:'Africa/Cairo'})),node('span',state.isMentor?'نطاق التقرير: الفرق المتاحة للمشرف':'نطاق التقرير: بيانات فريقك فقط'));paper.append(stamp);
    // Only the existing authorized team records feed the report, never directory.
    const teams=state.universities.filter(t=>state.isMentor||t.id===state.currentUni);
    const pending=state.submissions.filter(s=>teams.some(t=>t.id===s.uniId)&&s.status==='under_review').length;
    const progress=teams.length?Math.round(teams.reduce((sum,t)=>sum+bounded(t.progress),0)/teams.length):0;
    const stats=node('div',undefined,'ugec-report-stats');
    [[teams.length,'الفرق'],[state.tasks.length,'التاسكات'],[pending,'تسليمات تحت المراجعة'],[progress+'%','متوسط إنجاز الفرق']].forEach(([value,label])=>{const box=node('div');box.append(node('strong',String(value)),node('span',label));stats.append(box);});paper.append(stats);
    const overview=section('ملخص الفرق والمشروعات');
    if(teams.length)overview.append(table(['الجامعة','المجموعة','المشروع','الإنجاز','التقييم العام'],teams.map(t=>[t.name,t.group||'—',t.project||'—',bounded(t.progress)+'%',bounded(t.score)+' / 100'])));
    else overview.append(node('p','لا توجد بيانات فرق متاحة لهذا الحساب.','ugec-report-empty'));
    paper.append(overview);
    const followup=section('متابعة التاسكات • أحدث تسليم لكل فريق');
    const taskRows=[];
    teams.forEach(team=>state.tasks.forEach(task=>{
      const sub=latestFor(team.id,task.id);
      taskRows.push([[team.name,team.group].filter(Boolean).join(' • '),task.title,task.deadline||'—',sub?statusText(sub.status):'لم يُسلّم',sub&&sub.score!==''&&sub.score!=null?bounded(sub.score)+' / 100':'—']);
    }));
    if(taskRows.length)followup.append(table(['الفريق','التاسك','الموعد المحدد','حالة التسليم','الدرجة'],taskRows));
    else followup.append(node('p','لا توجد تاسكات مسجلة بعد.','ugec-report-empty'));
    paper.append(followup);
    const footer=node('div',undefined,'ugec-report-footer');
    footer.append(node('span','UGEC • United Group for Engineering Consultancy'),node('span','أُنشئ بواسطة منصة دعم مشروعات التخرج 2027'));paper.append(footer);
    $('reportContent').replaceChildren(paper);
  };
  function clearPrint(){document.body.classList.remove('ugec-print-report');$('ugecPrintableReport')?.remove();}
  function preparePrint(){
    if(!profile)return false;
    renderReport();$('ugecPrintableReport')?.remove();
    const copy=$('reportContent').firstElementChild.cloneNode(true),container=node('div');
    container.id='ugecPrintableReport';container.append(copy);document.body.append(container);
    document.body.classList.add('ugec-print-report');return true;
  }
  window.printComprehensiveReport=function(){
    if(!preparePrint())return;
    try{window.print();}catch(err){clearPrint();showError(err);}
  };
  window.addEventListener('beforeprint',()=>{
    if(profile&&!$('tab-report').classList.contains('hidden'))preparePrint();
  });
  window.addEventListener('afterprint',clearPrint);
})();
