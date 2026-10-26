(function () {
  'use strict';
  let overlay, awards=[], index=0, timer, previousFocus, generation=0;
  function el(tag,text,cls) {
    const item=document.createElement(tag);
    if(text!==undefined)item.textContent=text;
    if(cls)item.className=cls;
    return item;
  }
  function hide() {
    clearTimeout(timer);
    if(!overlay)return;
    overlay.remove();overlay=null;
    document.body.classList.remove('ugec-celebrating');
    document.removeEventListener('keydown',onKey);
    if(previousFocus?.isConnected)previousFocus.focus();
  }
  function onKey(e) {
    if(e.key==='Escape'){e.preventDefault();hide();return;}
    if(e.key!=='Tab'||!overlay)return;
    const buttons=[...overlay.querySelectorAll('button:not(:disabled)')];
    const first=buttons[0],last=buttons[buttons.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
  function paint() {
    if(!overlay||!awards.length)return;
    const award=awards[index];
    overlay.querySelector('.ugec-award-task').textContent=award.task_title;
    overlay.querySelector('.ugec-award-score').textContent=award.score+' / 100';
    overlay.querySelector('.ugec-award-count').textContent=awards.length>1?'إنجاز '+(index+1)+' من '+awards.length:'';
    overlay.querySelector('.ugec-award-more').hidden=awards.length<2;
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(!overlay)return;
      awards=awards.filter(x=>x.deadline>performance.now());index=0;
      if(awards.length)paint();else hide();
    },Math.max(0,award.deadline-performance.now()));
  }
  function show(items) {
    hide();
    awards=items.filter(x=>Number(x.score)>60&&Number(x.remaining_seconds)>0)
      .map(x=>({...x,deadline:performance.now()+Number(x.remaining_seconds)*1000}));
    if(!awards.length)return;
    index=0;previousFocus=document.activeElement;
    overlay=el('section',undefined,'ugec-award-overlay');
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-labelledby','ugec-award-title');overlay.dir='rtl';
    const confetti=el('div',undefined,'ugec-award-confetti');confetti.setAttribute('aria-hidden','true');
    for(let i=0;i<48;i++){
      const bit=el('i');bit.style.setProperty('--x',(i*37%100)+'%');
      bit.style.setProperty('--delay',-(i%8)*0.45+'s');bit.style.setProperty('--turn',(i*47)+'deg');
      bit.style.setProperty('--color',['#f9ce62','#40dbea','#ee86ad','#fff2c6'][i%4]);confetti.append(bit);
    }
    overlay.append(confetti);
    const content=el('div',undefined,'ugec-award-content');
    content.append(el('p','UGEC GP SPONSORSHIP 2027','ugec-award-brand'),el('div','🏆','ugec-award-trophy'));
    const title=el('h1','Congratulations!','ugec-award-title');title.id='ugec-award-title';title.dir='ltr';content.append(title);
    const team=state.universities.find(t=>t.id===profile?.team_id);
    content.append(el('p',team?[team.name,team.group].filter(Boolean).join(' • '):'فريق الجامعة','ugec-award-team'));
    content.append(el('p','أبطال! إنجاز جديد يستحق الاحتفال 🎉','ugec-award-message'));
    const box=el('div',undefined,'ugec-award-result');
    box.append(el('p','أبدعتم في تاسك','ugec-award-caption'),el('h2','','ugec-award-task'),el('p','','ugec-award-score'));
    content.append(box,el('p','فخورين باجتهادكم… ومستنّيين منكم نجاحات أكتر!','ugec-award-message'));
    const controls=el('div',undefined,'ugec-award-controls');
    const enter=el('button','دخول المنصة ✨','ugec-award-enter');enter.type='button';enter.onclick=hide;
    const more=el('button','الإنجاز التالي ←','ugec-award-more');more.type='button';
    more.onclick=()=>{awards=awards.filter(x=>x.deadline>performance.now());if(!awards.length){hide();return;}index=(index+1)%awards.length;paint();};
    controls.append(enter,more);content.append(controls,el('p','','ugec-award-count'));
    overlay.append(content);document.body.append(overlay);document.body.classList.add('ugec-celebrating');
    document.addEventListener('keydown',onKey);paint();enter.focus();
  }
  const originalEstablish=establish;
  establish=async function(...args) {
    const token=++generation;
    hide();await originalEstablish.apply(this,args);
    if(profile?.role!=='team')return;
    const accountId=user?.id;
    try {
      const {data,error}=await db.rpc('ugec_login_celebrations');
      if(error){console.warn('تعذر تحميل تهنئة الفريق؛ راجع إعداد celebrations-setup.sql.');return;}
      if(token===generation&&user?.id===accountId&&profile?.role==='team')show(data||[]);
    } catch {console.warn('تعذر تحميل التهنئة. تسجيل الدخول يعمل كالمعتاد.');}
  };
  const originalReset=resetAuth;
  resetAuth=function(...args){generation++;hide();return originalReset.apply(this,args);};
})();
