(function () {
  'use strict';
  const TABLE='ugec_project_presentations';
  const DRIVE_URL='https://drive.google.com/drive/folders/17gkH9LvSss5zHnAsgzcQwh21coyCWvW3?usp=drive_link';
  let entries=[],loadError='',generation=0;
  function renderPresentations() {
    const form=$('projectPresentationForm');
    form.classList.toggle('hidden',profile?.role!=='team');
    $('projectPresentationListTitle').textContent=profile?.role==='mentor'?'العروض المرفوعة من الفرق':'تسليمات العرض التقديمي لفريقك';
    $('projectPresentationStatus').textContent=loadError;
    $('projectPresentationSubmitBtn').disabled=!!loadError;
    const items=profile?entries:[];
    list('projectPresentationsList',items,item=>{
      const team=state.universities.find(t=>t.id===item.team_id);
      const teamName=team?[team.name,team.group].filter(Boolean).join(' • '):item.team_id;
      return card(item.file_name,[...(profile?.role==='mentor'?['الفريق: '+teamName]:[]),
        'تاريخ التسجيل: '+dateText(item.created_at),item.notes||''],
        [button('فتح العرض / فولدر التسليم',()=>openFile(item,'file_url'))]);
    });
  }
  async function loadPresentations() {
    const token=++generation;
    if(!profile||!user){entries=[];loadError='';renderPresentations();return;}
    const accountId=user.id;
    try {
      const next=[];
      for(let from=0;;from+=1000){
        const {data,error}=await db.from(TABLE).select('*').order('created_at',{ascending:false}).order('id').range(from,from+999);
        if(error)throw error;
        next.push(...data);if(data.length<1000)break;
      }
      if(token!==generation||user?.id!==accountId)return;
      entries=next;loadError='';
    } catch(err) {
      if(token!==generation||user?.id!==accountId)return;
      entries=[];
      loadError=/schema cache|does not exist|PGRST205/i.test((err?.message||'')+' '+(err?.code||''))
        ?'تفعيل تسليم العروض يتطلب تشغيل presentations-setup.sql بواسطة المشرف، ثم تحديث بيانات المنصة.'
        :'تعذر تحميل العروض. اضغط تحديث البيانات للمحاولة مجددًا.';
    }
    renderPresentations();
  }
  window.submitProjectPresentation=function(e){
    e.preventDefault();
    return run(async()=>{
      if(profile?.role!=='team'||!profile.team_id)throw Error('تسجيل دخول فريق الجامعة مطلوب.');
      const fileName=$('projectPresentationName').value.trim();
      const notes=$('projectPresentationNotes').value.trim();
      if(!fileName||fileName.length>250)throw Error('اكتب اسم ملف العرض، بحد أقصى 250 حرفًا.');
      if(!$('projectPresentationConfirmed').checked)throw Error('ارفع العرض على Drive وانتظر اكتمال الرفع، ثم أكد ذلك.');
      const fileURL=externalURL($('projectPresentationURL').value)||DRIVE_URL;
      if(fileURL.length>2048||notes.length>5000)throw Error('الرابط أو الملاحظات أطول من الحد المسموح.');
      const accountId=user.id;
      const {data,error}=await db.from(TABLE).insert({team_id:profile.team_id,file_name:fileName,file_url:fileURL,notes}).select('id');
      if(error)throw error;
      if(!data?.length)throw Error('لم يتم تأكيد تسجيل العرض. حدّث البيانات وحاول مجددًا.');
      if(user?.id!==accountId)return;
      $('projectPresentationForm').reset();
      await loadPresentations();
      $('projectPresentationStatus').textContent=loadError
        ?'تم تسجيل العرض، لكن تعذر تحديث القائمة. اضغط تحديث البيانات.'
        :'تم تسجيل رفع العرض التقديمي بنجاح، ويمكن للمشرف الاطلاع عليه.';
    });
  };
  const originalReload=reloadData;
  reloadData=async function(...args){await originalReload.apply(this,args);await loadPresentations();};
  const originalReset=resetAuth;
  resetAuth=function(...args){generation++;entries=[];loadError='';const result=originalReset.apply(this,args);$('projectPresentationForm').reset();renderPresentations();return result;};
})();
