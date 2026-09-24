
const DBKEY='focusPlanV2';
const SETUPKEY='focusPlanSetupV3';
const baseSubjects={
 'تجربی':['زیست','شیمی','فیزیک','ریاضی','ادبیات فارسی','عربی','دینی','زبان انگلیسی'],
 'ریاضی':['ریاضی','فیزیک','شیمی','هندسه','گسسته','حسابان','ادبیات فارسی','عربی','دینی','زبان انگلیسی'],
 'انسانی':['ریاضی و آمار','اقتصاد','ادبیات فارسی','عربی','دینی','زبان انگلیسی','جامعه‌شناسی','روان‌شناسی','تاریخ','جغرافیا','فلسفه','منطق']
};
const middleSubjects={
 'هفتم':['ریاضی','علوم تجربی','فارسی','نگارش','عربی','پیام‌های آسمان','زبان انگلیسی','مطالعات اجتماعی'],
 'هشتم':['ریاضی','علوم تجربی','فارسی','نگارش','عربی','پیام‌های آسمان','زبان انگلیسی','مطالعات اجتماعی'],
 'نهم':['ریاضی','علوم تجربی','فارسی','نگارش','عربی','پیام‌های آسمان','زبان انگلیسی','مطالعات اجتماعی']
};
let db=null;
try{db=JSON.parse(localStorage.getItem(DBKEY)||'null')}catch(e){console.warn('FocusPlan data reset due to invalid storage',e);localStorage.removeItem(DBKEY);db=null}

// مدرسه یک فضای ذخیره‌سازی مستقل هم دارد تا رفرش/نرمال‌سازی سایر داده‌ها
// نتواند برنامه هفتگی را از بین ببرد.
const SCHOOL_WEEK_DAYS=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه'];
const SCHOOL_TABLE_DEFAULT_ROWS=4;
const SCHOOL_TABLE_STORAGE_KEY='focusPlanSchoolWeeklyV2';
const SCHOOL_TABLE_BACKUP_KEY='focusPlanSchoolWeeklyV3';
function readStoredSchoolWeeklyTable(){
  const keys=[SCHOOL_TABLE_BACKUP_KEY,SCHOOL_TABLE_STORAGE_KEY];
  for(const key of keys){
    try{
      const raw=localStorage.getItem(key);
      const parsed=raw?JSON.parse(raw):null;
      if(Array.isArray(parsed)){
        const clean=Array.from({length:4},(_,r)=>Array.from({length:5},(_,c)=>String(parsed?.[r]?.[c]??'').trim()));
        if(clean.some(row=>row.some(Boolean)))return clean;
      }
    }catch(e){}
  }
  return null;
}
function hydrateSchoolWeeklyTable(){
  if(!db||typeof db!=='object')return;
  const stored=readStoredSchoolWeeklyTable();
  if(!stored)return;
  db.settings=(db.settings&&typeof db.settings==='object')?db.settings:{};
  db.settings.schoolWeeklyTable=stored;
  try{localStorage.setItem(DBKEY,JSON.stringify(db))}catch(e){}
}
hydrateSchoolWeeklyTable();
let newLoginDeleteData=false;
let selectedStage=db?.educationStage||null;
let timer=(db?.settings?.timerMin||45)*60,interval=null,selectedStream=db?.stream||null,verifyInterval=null,verifySeconds=0,pendingTimerMinutes=0;let timerTotal=timer,timerRunning=false,timerStartedAt=null,timerFrame=null;const TIMERKEY='focusPlanActiveTimerV1';
const fa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#39;')}
function escAttr(v){return esc(v).replace(/`/g,'&#96;')}
function isoLocal(d=new Date()){d=new Date(d);d.setHours(0,0,0,0);const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`}
function today(){return isoLocal()}
function subjects(){const isMiddle=db?.educationStage==='middle1';let base=isMiddle?(middleSubjects[db?.grade]||[]):(baseSubjects[db?.stream]||[]);if(!base.length&&!isMiddle){const key=Object.keys(baseSubjects).find(k=>String(k).trim()===String(db?.stream||'').trim());base=key?(baseSubjects[key]||[]):[]}if(!base.length&&isMiddle){const key=Object.keys(middleSubjects).find(k=>String(k).trim()===String(db?.grade||'').trim());base=key?(middleSubjects[key]||[]):[]}return [...base,...(db?.customSubjects||[])].map(v=>String(v||'').trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i)}
function persist(){normalizeAntiAbuseState();
 if(!db)return;
 try{normalizeProfileData();ensureDataShape();localStorage.setItem(DBKEY,JSON.stringify(db));setupUI();render();renderPdfArchives();}catch(e){console.error('FocusPlan persist error:',e);try{localStorage.setItem(DBKEY,JSON.stringify(db))}catch(_){} }
}
function fillSelect(id){const el=document.getElementById(id);if(!el)return;const list=subjects();el.innerHTML=list.length?list.map(x=>`<option value="${String(x).replaceAll('\"','&quot;')}">${x}</option>`).join(''):'<option value="">درسی وجود ندارد</option>';el.disabled=!list.length}
function createAccount(){
  const name=(document.getElementById('fullName')?.value||'').trim();
  const classNameVal=(document.getElementById('className')?.value||'').trim();
  const schoolNameVal=(document.getElementById('schoolName')?.value||'').trim();
  const gradeVal=(document.getElementById('grade')?.value||'').trim();
  const isMiddle1=selectedStage==='middle1';
  if(!name||!classNameVal||!schoolNameVal||!gradeVal||(selectedStage==='middle2'&&!selectedStream)){alert('لطفاً همه اطلاعات خواسته‌شده را کامل وارد و انتخاب کن.');return}
  const old=db||{}, keepData=!newLoginDeleteData, baseData=keepData?old:{};
  db={...baseData,educationStage:selectedStage,profile:{...(keepData?(old.profile||{}):{}),name,className:classNameVal,schoolName:schoolNameVal},stream:isMiddle1?'متوسطه اول':selectedStream,grade:gradeVal,plans:keepData?(old.plans||[]):[],tasks:keepData?(old.tasks||[]):[],testTasks:keepData?(old.testTasks||[]):[],sessions:keepData?(old.sessions||[]):[],reviews:keepData?(old.reviews||[]):[],customSubjects:keepData?(old.customSubjects||[]):[],pdfArchives:keepData?(old.pdfArchives||[]):[],subjectChartArchives:keepData?(old.subjectChartArchives||[]):[],settings:keepData?(old.settings||{goal:480,timerMin:45,timerName:'مطالعه'}):{goal:480,timerMin:45,timerName:'مطالعه'}};
  db.settings.timerMin=db.settings.timerMin||45; db.settings.timerName=db.settings.timerName||'مطالعه'; db.profile.name=String(db.profile.name||'').trim(); db.profile.schoolName=String(db.profile.schoolName||'').trim(); db.profile.className=String(db.profile.className||'').trim();
  db.profile={name:String(name),className:String(classNameVal),schoolName:String(schoolNameVal)};
  db.earnedMedals=Array.isArray(db.earnedMedals)?db.earnedMedals:[]; if(!db.earnedMedals.includes('first_login'))db.earnedMedals.unshift('first_login'); db.settings=db.settings||{}; if(!Object.prototype.hasOwnProperty.call(db.settings,'featuredMedalId'))db.settings.featuredMedalId=''; ensureDataShape();
  localStorage.setItem(DBKEY,JSON.stringify(db)); localStorage.setItem(SETUPKEY,'1'); newLoginDeleteData=false; showApp();
}
function showApp(){if(!db)return;try{normalizeProfileData();ensureDataShape();normalizeAntiAbuseState()}catch(e){console.warn("Profile normalize error:",e)}auth.classList.add('hidden');app.classList.remove('hidden');try{setupUI()}catch(e){console.error("setupUI error:",e)}try{ensureTestTaskIds();ensurePdfArchives();ensureSubjectChartArchives()}catch(e){}try{render()}catch(e){console.error("render error:",e)}try{refreshProfileUI()}catch(e){console.error("profile UI error:",e)}}
function normalizeProfileData(){
 if(!db)return;
 db.profile=(db.profile&&typeof db.profile==='object')?db.profile:{};
 // Migrate any older/top-level profile fields into the canonical profile object.
 db.profile.name=String(db.profile.name??db.name??db.studentName??'').trim();
 db.profile.className=String(db.profile.className??db.className??'').trim();
 db.profile.schoolName=String(db.profile.schoolName??db.schoolName??'').trim();
 if(!db.educationStage){
   db.educationStage=['تجربی','ریاضی','انسانی'].includes(db.stream)?'middle2':'middle1';
 }
 if(!db.grade) db.grade=db.educationStage==='middle1'?'هفتم':'دهم';
 localStorage.setItem(DBKEY,JSON.stringify(db));
}
function normalizeAntiAbuseState(){
 if(!db)return; const now=Date.now(), todayKey=isoLocal(new Date()), maxDayMinutes=1440;
 (db.plans||[]).forEach(x=>{if(x.xpUndoCooldownUntil&&x.xpUndoCooldownUntil<now)delete x.xpUndoCooldownUntil;x.min=Math.min(maxDayMinutes,Math.max(1,+x.min||45));if(x.actualMin!=null)x.actualMin=Math.min(maxDayMinutes,Math.max(0,+x.actualMin||0),Math.max(1,Math.round(x.min*2)));x.xpToggleCount=Math.max(0,Math.min(3,+x.xpToggleCount||0));if(x.xpLockUntil&&x.xpLockUntil<now)delete x.xpLockUntil});
 (db.testTasks||[]).forEach(x=>{if(x.xpUndoCooldownUntil&&x.xpUndoCooldownUntil<now)delete x.xpUndoCooldownUntil;x.count=Math.min(10000,Math.max(1,+x.count||1));if(x.actualCount!=null)x.actualCount=Math.min(Math.max(1,Math.round(x.count*2)),Math.max(0,+x.actualCount||0));if(x.actualMin!=null)x.actualMin=Math.min(maxDayMinutes,Math.max(0,+x.actualMin||0));x.xpToggleCount=Math.max(0,Math.min(3,+x.xpToggleCount||0));if(x.xpLockUntil&&x.xpLockUntil<now)delete x.xpLockUntil});
 db.sessions=(db.sessions||[]).filter(s=>{if(!s||!s.date||s.date>todayKey)return false;const min=Math.max(0,+s.min||0),tests=Math.max(0,+s.tests||0);if(min>maxDayMinutes||tests>10000)return false;if(s.source==='plan'&&s.planId){const p=(db.plans||[]).find(p=>p.id===s.planId);if(!p||!p.done||min>Math.round((+p.min||0)*2))return false}if(s.source==='test'&&s.testTaskId){const t=(db.testTasks||[]).find(t=>testTaskKey(t)===s.testTaskId);if(!t||!t.done||tests>Math.round((+t.count||1)*2))return false}return true});
}
function ensureDataShape(){
 db.settings=db.settings||{};db.settings.dashboardPlanOrder=db.settings.dashboardPlanOrder&&typeof db.settings.dashboardPlanOrder==='object'?db.settings.dashboardPlanOrder:{};
 if(!db)return;
 db.settings=(db.settings&&typeof db.settings==='object')?db.settings:{};
 db.settings.goal=Math.max(1,+db.settings.goal||480);
 db.settings.timerMin=Math.max(1,+db.settings.timerMin||45);
 db.settings.timerName=String(db.settings.timerName||'مطالعه');
 db.settings.weeklyStudyGoal=(getActiveWeeklyStudyGoal()==null?Infinity:Math.max(1,+getActiveWeeklyStudyGoal()));
 db.settings.weeklyTestGoal=(getActiveWeeklyTestGoal()==null?Infinity:Math.max(1,+getActiveWeeklyTestGoal()));
 db.settings.tomorrowSeed=Math.max(0,+db.settings.tomorrowSeed||0);
 db.settings.tomorrowSuggestion=Array.isArray(db.settings.tomorrowSuggestion)?db.settings.tomorrowSuggestion:null;
 db.settings.featuredMedalId=String(db.settings.featuredMedalId??'');
 db.plans=Array.isArray(db.plans)?db.plans:[];
 db.tasks=Array.isArray(db.tasks)?db.tasks:[];
 db.testTasks=Array.isArray(db.testTasks)?db.testTasks:[];
 db.sessions=Array.isArray(db.sessions)?db.sessions:[];
 db.customSubjects=Array.isArray(db.customSubjects)?db.customSubjects:[];
 db.reviews=Array.isArray(db.reviews)?db.reviews:[];
 db.pdfArchives=Array.isArray(db.pdfArchives)?db.pdfArchives:[];
 db.subjectChartArchives=Array.isArray(db.subjectChartArchives)?db.subjectChartArchives:[];
 db.sessions.forEach(x=>{x.min=Math.max(0,+x.min||0);x.tests=Math.max(0,+x.tests||0);x.percent=+x.percent||0});
 db.plans.forEach(x=>{x.min=Math.max(1,+x.min||45);x.done=!!x.done;x.important=!!x.important});
 db.testTasks.forEach(x=>{x.count=Math.max(1,+x.count||1);x.done=!!x.done;x.important=!!x.important});
 if(!Object.prototype.hasOwnProperty.call(db.settings,'featuredMedalId'))db.settings.featuredMedalId='';
 if(!Array.isArray(db.earnedMedals))db.earnedMedals=[];
 if(!db.earnedMedals.includes('first_login'))db.earnedMedals.unshift('first_login');
}
function refreshProfileUI(){
 if(!db)return;
 normalizeProfileData();
 const name=String(db.profile.name||'').trim()||'دانش‌آموز';
 const school=String(db.profile.schoolName||'').trim()||'ثبت نشده';
 const cls=String(db.profile.className||'').trim()||'ثبت نشده';
 const stream=db.educationStage==='middle1'?'متوسطه اول':(String(db.stream||'').trim()||'ثبت نشده');
 const grade=String(db.grade||'').trim()||'ثبت نشده';
 const welcome=document.getElementById('welcome');
 const streamLabel=document.getElementById('streamLabel');
 if(welcome)welcome.textContent='سلام '+name+' 👋';
 if(streamLabel)streamLabel.textContent=db.educationStage==='middle1'?('متوسطه اول • پایه '+grade):('رشته: '+stream+' • پایه: '+grade);
 const userLabel=document.getElementById('userLabel');if(userLabel)userLabel.textContent=name;
 const avatar=document.getElementById('avatar');if(avatar)avatar.textContent=name[0]||'د';
 const username=document.getElementById('username');if(username)username.value=name;
 const schoolEl=document.getElementById('settingsSchoolName');if(schoolEl)schoolEl.value=school;
 const classEl=document.getElementById('settingsClassName');if(classEl)classEl.value=cls;
 const streamEl=document.getElementById('settingsStreamView');if(streamEl)streamEl.value=stream;
 const gradeEl=document.getElementById('settingsGradeView');if(gradeEl)gradeEl.value=grade; const mirrors={profileMirrorName:name,profileMirrorSchool:school,profileMirrorClass:cls,profileMirrorStream:stream,profileMirrorGrade:grade};Object.entries(mirrors).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.textContent=val});
}
function setupUI(){
 if(!db)return;
 normalizeProfileData(); ensureDataShape();
 db.profile=db.profile||{}; db.educationStage=db.educationStage||((['تجربی','ریاضی','انسانی'].includes(db.stream))?'middle2':'middle1'); db.grade=db.grade|| (db.educationStage==='middle1'?'هفتم':'دهم'); db.settings=db.settings||{goal:480,timerMin:45,timerName:'مطالعه'}; db.plans=Array.isArray(db.plans)?db.plans:[]; db.tasks=Array.isArray(db.tasks)?db.tasks:[]; db.testTasks=Array.isArray(db.testTasks)?db.testTasks:[]; db.sessions=Array.isArray(db.sessions)?db.sessions:[]; db.customSubjects=Array.isArray(db.customSubjects)?db.customSubjects:[]; db.reviews=Array.isArray(db.reviews)?db.reviews:[]; db.pdfArchives=Array.isArray(db.pdfArchives)?db.pdfArchives:[]; db.subjectChartArchives=Array.isArray(db.subjectChartArchives)?db.subjectChartArchives:[]; db.settings={goal:480,timerMin:45,timerName:'مطالعه',weeklyStudyGoal:null,weeklyTestGoal:null,tomorrowSeed:0,schoolWeeklyTable:null,...(db.settings||{})};
 document.body.classList.remove('stream-default','stream-tajrobi','stream-riazi','stream-ensani','stream-middle','grade-7','grade-8','grade-9','grade-10','grade-11','grade-12');
 let streamClass='stream-default';
 if(db.educationStage==='middle1'){
  // متوسطه اول از همان رابط و همان بستهٔ پس‌زمینهٔ متوسطه دوم استفاده می‌کند:
  // هفتم = تم تجربی، هشتم = تم ریاضی، نهم = تم انسانی؛ هرکدام ۵ حالت روشن/تاریک.
  streamClass=({'هفتم':'stream-tajrobi','هشتم':'stream-riazi','نهم':'stream-ensani'}[db.grade]||'stream-tajrobi');
  document.body.classList.add('grade-'+({"هفتم":7,"هشتم":8,"نهم":9}[db.grade]||7));
}
 else {streamClass=db.stream==='تجربی'?'stream-tajrobi':db.stream==='ریاضی'?'stream-riazi':db.stream==='انسانی'?'stream-ensani':'stream-default'; document.body.classList.add('grade-'+({"دهم":10,"یازدهم":11,"دوازدهم":12}[db.grade]||10));}
 document.body.classList.add(streamClass);
 try { restoreStreamBackground(); } catch(e) { console.warn("FocusPlan background skipped:", e); }
 const nm=document.getElementById('userLabel'),av=document.getElementById('avatar'),wel=document.getElementById('welcome'),sl=document.getElementById('streamLabel'),hs=document.getElementById('headerStream');
 const displayName=String(db.profile?.name||'').trim()||'دانش‌آموز'; if(nm)nm.textContent=displayName; if(av)av.textContent=displayName[0]||'د'; if(wel)wel.textContent=`سلام ${displayName} 👋`; if(sl)sl.textContent=db.educationStage==='middle1'?`متوسطه اول • پایه ${db.grade} • برنامه‌ات را منظم و قدم‌به‌قدم جلو ببر.`:`رشته: ${db.stream} • پایه: ${db.grade} • برنامه‌ات را منظم و قدم‌به‌قدم جلو ببر.`; if(hs)hs.textContent=db.educationStage==='middle1'?`• متوسطه اول • ${db.grade}`:`• ${db.stream} • ${db.grade}`;
 const profileName=String(db.profile?.name||'').trim(), profileSchool=String(db.profile?.schoolName||'').trim(), profileClass=String(db.profile?.className||'').trim();
 // برنامه و میزان تست: درس‌ها و تاریخ‌ها همیشه هنگام ورود/بازشدن بخش‌ها مقداردهی شوند.
 try{
   const pSub=document.getElementById('pSubject'), tSub=document.getElementById('testSubject'), sSub=document.getElementById('sSubject');
   const oldP=pSub?.value, oldT=tSub?.value, oldS=sSub?.value;
   fillSelect('pSubject'); fillSelect('testSubject'); fillSelect('sSubject');
   if(pSub && oldP && [...pSub.options].some(o=>o.value===oldP)) pSub.value=oldP;
   if(tSub && oldT && [...tSub.options].some(o=>o.value===oldT)) tSub.value=oldT;
   if(sSub && oldS && [...sSub.options].some(o=>o.value===oldS)) sSub.value=oldS;
   const pd=document.getElementById('pDate'), td=document.getElementById('testDate');
   if(pd && !pd.value) pd.value=today();
   if(td && !td.value) td.value=today();
 }catch(e){console.warn('Program/Test UI init skipped:',e)}
 const gradeEl=document.getElementById('grade');if(gradeEl)gradeEl.value=String(db.grade||'');
 const sv=document.getElementById('settingsStreamView');if(sv)sv.value=db.educationStage==='middle1'?'متوسطه اول':String(db.stream||'');
 const sc=document.getElementById('settingsSchoolName');if(sc)sc.value=profileSchool||'ثبت نشده';
 const gv=document.getElementById('settingsGradeView');if(gv)gv.value=String(db.grade||'');
 const un=document.getElementById('username');if(un)un.value=profileName;
 const classInput=document.getElementById('settingsClassName');if(classInput)classInput.value=profileClass;
 const classSetup=document.getElementById('className');if(classSetup)classSetup.value=profileClass; const dg=document.getElementById('dashGoalInput');if(dg)dg.value=db.settings.goal||480; const wsg=document.getElementById('weeklyGoalInput');if(wsg)wsg.value=getActiveWeeklyStudyGoal()??''; const wtg=document.getElementById('weeklyTestGoalInput');if(wtg)wtg.value=getActiveWeeklyTestGoal()??''; const tm=document.getElementById('timerMinutes');if(tm)tm.value=db.settings.timerMin||45; const tn=document.getElementById('timerName');if(tn)tn.value=db.settings.timerName||'مطالعه'; const tl=document.getElementById('timerLabel');if(tl)tl.textContent=db.settings.timerName||'مطالعه';showTimer();renderCustomSubjects()
}
function openSettings(){document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.section').forEach(x=>x.classList.remove('active','fp-enter'));const s=document.getElementById('settings');if(s){s.classList.add('active','fp-enter');void s.offsetWidth;s.scrollIntoView({behavior:'smooth',block:'start'});}try{setupUI()}catch(e){console.error('settings setup error:',e)}try{refreshProfileUI()}catch(e){console.error('profile UI error:',e)}}
function logout(){
  // خروج فقط به صفحه ورود برمی‌گردد؛ اطلاعات و برنامه‌ها پاک نمی‌شوند.
  auth.classList.remove('hidden');
  app.classList.add('hidden');
  document.getElementById('stagePanel')?.classList.add('hidden');
  document.getElementById('registerPanel')?.classList.add('hidden');
  document.getElementById('loginPanel')?.classList.remove('hidden');
  showAuthForLogin();
}
function ensureTestTaskIds(){
  if(!db)return false;
  let changed=false;
  db.testTasks=db.testTasks||[];
  db.testTasks.forEach((t,i)=>{
    if(!t.id){t.id=`testTask_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${i}`;changed=true;}
  });
  return changed;
}
function testTaskKey(t){return t?.id||''}
function legacyTestTaskKey(t,index){return `test_${index}_${t?.date||''}_${t?.subject||''}_${t?.topic||''}`}
function hasLinkedTestSession(t,index,list=db.sessions||[]){
  const id=testTaskKey(t), legacy=legacyTestTaskKey(t,index);
  return list.some(s=>s.testTaskId===id||s.testTaskId===legacy);
}
function getPlanTestStats(plan){
 const tasks=(db.testTasks||[]).filter(t=>t.date===plan.date && t.subject===plan.subject);
 let count=0, minutes=0;
 tasks.forEach(t=>{ const idx=(db.testTasks||[]).indexOf(t); const key=testTaskKey(t), legacy=legacyTestTaskKey(t,idx); const linked=(db.sessions||[]).filter(s=>s.testTaskId===key||s.testTaskId===legacy); if(linked.length){ count+=linked.reduce((a,s)=>a+(+s.tests||0),0); minutes+=linked.reduce((a,s)=>a+(+s.min||0),0); } else if(t.done){ count+=+t.actualCount||+t.count||0; minutes+=+t.actualMin||0; } });
 return {count,minutes};
}
function getCurrentWeekStartDate(){const now=new Date();now.setHours(0,0,0,0);const start=new Date(now);start.setDate(now.getDate()-((now.getDay()+1)%7));return start}
function getCurrentWeekKey(){return isoLocal(getCurrentWeekStartDate())}
function openWeeklyOverview(){const box=document.getElementById('weekOverview');const btn=document.querySelector('.weekly-view-btn');if(!box)return;const hidden=box.style.display==='none'||!box.style.display; if(hidden){box.style.display='block';renderWeek();if(btn)btn.textContent='🙈 پنهان کردن برنامه این هفته';}else{box.style.display='none';if(btn)btn.textContent='👀 برنامه این هفته را ببین';}}
function renderWeek(selectedIndex=null){
  const box=document.getElementById('weekOverview');if(!box||!db)return;
  const names=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  const start=getCurrentWeekStartDate();
  const hint=document.getElementById('weekOverviewHint');
  if(hint){const end=new Date(start);end.setDate(start.getDate()+6);hint.textContent=`برنامه این هفته • شنبه ${start.toLocaleDateString('fa-IR')} تا جمعه ${end.toLocaleDateString('fa-IR')}`;}
  if(selectedIndex===null) selectedIndex=(()=>{const now=new Date();const day=now.getDay();return (day+1)%7;})();
  const d=new Date(start);d.setDate(start.getDate()+selectedIndex);const iso=isoLocal(d);
  const items=db.plans.filter(x=>x.date===iso), tasks=(db.tasks||[]).filter(x=>x.date===iso), tests=(db.testTasks||[]).filter(x=>x.date===iso);
  const planHtml=items.length?items.map(x=>{const st=getPlanTestStats(x);const actual=x.done?(+x.actualMin||0):0;return `<div class="plan-line"><b>• ${x.subject}</b>${x.topic&&x.topic!=='مطالعه'?' — '+x.topic:''}<br><span class="muted">برنامه: ${fa(x.min)} دقیقه • تست: ${fa(st.count)}${st.minutes?` • تست‌زنی: ${fa(st.minutes)} دقیقه`:''}${x.done?` • مطالعه واقعی: ${fa(actual)} دقیقه`:''}</span></div>`}).join(''):'<div class="plan-line muted">برنامه‌ای ثبت نشده</div>';
  const taskHtml=tasks.map(x=>`<div class="plan-line"><b>✓ کار: ${x.text}</b><br><span class="muted">${fa(x.min||0)} دقیقه ${x.done?'• انجام شد':''}</span></div>`).join('');
  const testHtml=tests.map(x=>`<div class="plan-line"><b>📝 تست: ${x.subject}</b>${x.topic?' — '+x.topic:''}<br><span class="muted">${fa(x.count||0)} تست${x.done&&x.actualMin?` • ${fa(x.actualMin)} دقیقه`:''}</span></div>`).join('');
  box.innerHTML=`<div class="week-day-picker">${names.map((n,i)=>{const dd=new Date(start);dd.setDate(start.getDate()+i);return `<button type="button" class="week-day-tab ${i===selectedIndex?'active':''} ${isoLocal(dd)===today()?'today':''}" onclick="renderWeek(${i})"><b>${n}</b><small>${dd.toLocaleDateString('fa-IR',{day:'numeric',month:'numeric'})}</small></button>`}).join('')}</div><div class="selected-day-plan"><div class="selected-day-title"><h4>📚 برنامه ${names[selectedIndex]}</h4><span>${d.toLocaleDateString('fa-IR')}</span></div>${planHtml}${taskHtml}${testHtml}</div>`;
}
function normalizeCustomSubjects(){db.customSubjects=Array.from(new Set((Array.isArray(db.customSubjects)?db.customSubjects:[]).map(x=>String(x??'').trim()).filter(Boolean)));return db.customSubjects}
function addCustomSubject(){
  if(!db)return;
  const input=document.getElementById('customSubject');
  const v=(input?.value||'').trim();
  if(!v){alert('نام درس را وارد کن.');return}
  db.customSubjects=Array.isArray(db.customSubjects)?db.customSubjects:[];
  const normalized=v.replace(/\s+/g,' ').trim();
  const existsAny=subjects().some(x=>String(x).replace(/\s+/g,' ').trim().localeCompare(normalized,'fa',{sensitivity:'base'})===0);
  if(existsAny){alert('این درس در حال حاضر در فهرست درس‌ها وجود دارد.');return}
  db.customSubjects.push(normalized);
  localStorage.setItem(DBKEY,JSON.stringify(db));
  if(input)input.value='';
  fillSelect('pSubject');fillSelect('testSubject');fillSelect('sSubject');
  renderCustomSubjects();
  setupUI();
  alert(`درس «${normalized}» اضافه شد. ✅`);
}
function removeCustomSubject(i){
  if(!db)return;
  db.customSubjects=Array.isArray(db.customSubjects)?db.customSubjects:[];
  const index=Number(i);
  if(!Number.isInteger(index)||index<0||index>=db.customSubjects.length)return;
  const removed=db.customSubjects[index];
  db.customSubjects.splice(index,1);
  localStorage.setItem(DBKEY,JSON.stringify(db));
  fillSelect('pSubject');fillSelect('testSubject');fillSelect('sSubject');
  renderCustomSubjects();
  setupUI();
  openSettings();
  alert(`درس «${removed}» حذف شد. حالا می‌توانی دوباره همان درس را اضافه کنی. ✅`);
}
function renderCustomSubjects(){
  const box=document.getElementById('customSubjectList');
  if(!box)return;
  const list=Array.isArray(db?.customSubjects)?db.customSubjects:[];
  box.innerHTML=list.map((x,i)=>`<div class="custom-sub"><span>📘 ${x}</span><button type="button" class="btn danger" onclick="removeCustomSubject(${i})">حذف</button></div>`).join('')||'<div class="empty">هنوز درس دلخواهی اضافه نکردی.</div>';
}
function formatScheduleDate(value){
  if(!value)return 'بدون تاریخ';
  const d=new Date(value+'T12:00:00');
  if(Number.isNaN(d.getTime()))return String(value);
  const days=['یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه','شنبه'];
  const faDate=d.toLocaleDateString('fa-IR',{year:'numeric',month:'2-digit',day:'2-digit'});
  return `📅 ${days[d.getDay()]} • ${faDate}`;
}

function getWeekMetrics(){
 const dates=getWeekDates();
 const sessions=db.sessions||[];
 const weekSessions=sessions.filter(x=>dates.includes(x.date));
 const study=weekSessions.reduce((a,x)=>a+(+x.min||0),0);
 const tests=weekSessions.reduce((a,x)=>a+(+x.tests||0),0)+(db.testTasks||[]).filter(x=>dates.includes(x.date)&&x.done&&!hasLinkedTestSession(x,(db.testTasks||[]).indexOf(x))).reduce((a,x)=>a+(+x.actualCount||+x.count||0),0);
 const plans=(db.plans||[]).filter(x=>dates.includes(x.date));
 const done=plans.filter(x=>x.done).length;
 const active=new Set(weekSessions.map(x=>x.date));
 (db.plans||[]).filter(x=>dates.includes(x.date)&&x.done).forEach(x=>active.add(x.date));
 return {dates,study,tests,plans,done,activeDays:active.size};
}
function getActiveWeeklyGoals(){
 const key=getCurrentWeekKey();
 const store=(db&&db.settings&&db.settings.weeklyGoals&&typeof db.settings.weeklyGoals==='object')?db.settings.weeklyGoals:{};
 const g=store[key];
 if(g&&typeof g==='object') return {study:Number(g.study)||null,tests:Number(g.tests)||null};
 const legacyS=Number(db?.settings?.weeklyStudyGoal), legacyT=Number(db?.settings?.weeklyTestGoal);
 return {study:Number.isFinite(legacyS)&&legacyS>0?legacyS:null,tests:Number.isFinite(legacyT)&&legacyT>0?legacyT:null};
}
function getActiveWeeklyStudyGoal(){return getActiveWeeklyGoals().study}
function getActiveWeeklyTestGoal(){return getActiveWeeklyGoals().tests}

function saveWeeklyGoals(){
 if(!db)return;
 const studyEl=document.getElementById('weeklyGoalInput'), testEl=document.getElementById('weeklyTestGoalInput');
 const study=Number(studyEl?.value), tests=Number(testEl?.value);
 if(!Number.isFinite(study)||study<=0){alert('لطفاً هدف مطالعه را وارد کن.');return;}
 if(!Number.isFinite(tests)||tests<=0){alert('لطفاً هدف تست را وارد کن.');return;}
 db.settings=db.settings||{};
 db.settings.weeklyGoals=(db.settings.weeklyGoals&&typeof db.settings.weeklyGoals==='object'&&!Array.isArray(db.settings.weeklyGoals))?db.settings.weeklyGoals:{};
 const weekKey=getCurrentWeekKey();
 const saved={study:Math.round(study),tests:Math.round(tests),updatedAt:Date.now()};
 db.settings.weeklyGoals[weekKey]=saved;
 db.settings.weeklyStudyGoal=saved.study;
 db.settings.weeklyTestGoal=saved.tests;
 try{localStorage.setItem(DBKEY,JSON.stringify(db));}catch(e){console.error('weekly goal save error',e);alert('ذخیره هدف انجام نشد.');return;}
 // Update the same screen immediately; do not let setupUI overwrite the freshly entered values.
 const wsg=document.getElementById('weeklyGoalInput'), wtg=document.getElementById('weeklyTestGoalInput');
 if(wsg)wsg.value=saved.study;
 if(wtg)wtg.value=saved.tests;
 renderProDashboard();
 render();
 renderProDashboard();
 const live=document.getElementById('weeklyGoalLiveTarget');
 if(live){live.classList.add('is-set');live.textContent=`🎯 هدف ثبت‌شده این هفته: ${fa(saved.study)} دقیقه مطالعه • ${fa(saved.tests)} تست`}
 alert(`هدف ثبت شد: ${fa(saved.study)} دقیقه مطالعه و ${fa(saved.tests)} تست 🎯`);
}
function clearWeeklyGoals(){
 if(!db)return;
 const weekKey=getCurrentWeekKey();
 if(!db.settings)db.settings={};
 if(!db.settings.weeklyGoals || typeof db.settings.weeklyGoals!=='object') db.settings.weeklyGoals={};
 // فقط هدف همین هفته حذف شود؛ هدف هفته‌های دیگر دست‌نخورده بماند.
 delete db.settings.weeklyGoals[weekKey];
 // پاک‌کردن فیلدهای قدیمی برای جلوگیری از برگشت هدف قبلی.
 db.settings.weeklyStudyGoal=null;
 db.settings.weeklyTestGoal=null;
 try{localStorage.setItem(DBKEY,JSON.stringify(db));}catch(e){}
 const a=document.getElementById('weeklyGoalInput'),b=document.getElementById('weeklyTestGoalInput');
 if(a)a.value='';
 if(b)b.value='';
 const live=document.getElementById('weeklyGoalLiveTarget');
 if(live){live.classList.remove('is-set');live.textContent='🎯 هدف این هفته: تعیین نشده';}
 const sv=document.getElementById('weeklyGoalStudyTargetSummary'); if(sv)sv.textContent='تعیین نشده';
 const tv=document.getElementById('weeklyGoalTestTargetSummary'); if(tv)tv.textContent='تعیین نشده';
 const st=document.getElementById('weeklyStudyGoalTarget'); if(st)st.textContent='هدف تعیین نشده';
 const tt=document.getElementById('weeklyTestGoalTarget'); if(tt)tt.textContent='هدف تعیین نشده';
 const sb=document.getElementById('weeklyStudyGoalBar'); if(sb)sb.style.width='0%';
 const tb=document.getElementById('weeklyTestGoalBar'); if(tb)tb.style.width='0%';
 const sp=document.getElementById('weeklyStudyGoalText'); if(sp)sp.textContent='—';
 const tp=document.getElementById('weeklyTestGoalText'); if(tp)tp.textContent='—';
 const show=document.getElementById('weeklyGoalTargetShow'); if(show)show.classList.remove('is-visible');
 const advice=document.getElementById('weeklyGoalAdvice'); if(advice)advice.textContent='هنوز هدف هفتگی‌ات را تعیین نکرده‌ای؛ از بالا یک هدف مشخص کن. 🎯';
 setupUI();
 render();
 renderProDashboard();
 alert('هدف این هفته با موفقیت حذف شد. 🗑️');
}
function renderProDashboard(){
 if(!db)return;
 const t=today(), todayPlans=(db.plans||[]).filter(x=>x.date===t), todayDone=todayPlans.filter(x=>x.done).length;
 const todayStudy=(db.sessions||[]).filter(x=>x.date===t).reduce((a,x)=>a+(+x.min||0),0);
 const goal=Math.max(1,+db.settings.goal||480), studyPct=Math.min(100,Math.round(todayStudy/goal*100));
 const planPct=todayPlans.length?Math.round(todayDone/todayPlans.length*100):0;
 const score=Math.round(studyPct*.65+planPct*.35);
 const scoreEl=document.getElementById('proDashboardScore'); if(scoreEl)scoreEl.textContent=fa(score)+'٪';
 const bar=document.getElementById('proTodayBar'); if(bar)bar.style.width=score+'%';
 const msg=document.getElementById('proDashboardMessage'); if(msg)msg.textContent=score>=100?'امروز فوق‌العاده بود! هدف روزانه را کامل کردی. 🔥':score>=70?'خیلی خوب پیش رفتی؛ کمی دیگر تا یک روز عالی فاصله داری. 💪':score>=35?'شروع خوبی داشتی؛ ادامه بده تا امتیازت بالاتر برود. 🚀':'هنوز اول راهی؛ یک جلسه کوتاه شروع کن و امتیازت را بالا ببر. ✨';
 const meta=document.getElementById('proTodayMeta'); if(meta)meta.textContent=`مطالعه: ${fa(todayStudy)} از ${fa(goal)} دقیقه • برنامه انجام‌شده: ${fa(todayDone)} از ${fa(todayPlans.length)}`;
 const m=getWeekMetrics();
 const wh=document.getElementById('proWeekStudy');if(wh)wh.textContent=fa(Math.floor(m.study/60))+':'+fa(String(m.study%60).padStart(2,'0'));
 const wt=document.getElementById('proWeekTests');if(wt)wt.textContent=fa(m.tests);
 const wr=document.getElementById('proWeekPlanRate');if(wr)wr.textContent=fa(m.plans.length?Math.round(m.done/m.plans.length*100):0)+'٪';
 const wa=document.getElementById('proActiveDays');if(wa)wa.textContent=fa(m.activeDays);
 const activeGoals=getActiveWeeklyGoals(); const sgRaw=activeGoals.study, tgRaw=activeGoals.tests;
 const hasStudyGoal=Number.isFinite(Number(sgRaw))&&Number(sgRaw)>0, hasTestGoal=Number.isFinite(Number(tgRaw))&&Number(tgRaw)>0;
 const sg=hasStudyGoal?Number(sgRaw):0, tg=hasTestGoal?Number(tgRaw):0;
 const sp=hasStudyGoal?Math.min(100,Math.round(m.study/sg*100)):0, tp=hasTestGoal?Math.min(100,Math.round(m.tests/tg*100)):0;
 const sgt=document.getElementById('weeklyStudyGoalText');if(sgt)sgt.textContent=hasStudyGoal?fa(sp)+'٪':'—';
 const tpt=document.getElementById('weeklyTestGoalText');if(tpt)tpt.textContent=hasTestGoal?fa(tp)+'٪':'—';
 const sb=document.getElementById('weeklyStudyGoalBar');if(sb)sb.style.width=sp+'%';const tb=document.getElementById('weeklyTestGoalBar');if(tb)tb.style.width=tp+'%';
 const sv=document.getElementById('weeklyStudyGoalValue');if(sv)sv.textContent=hasStudyGoal?fa(m.study)+' / '+fa(sg)+' دقیقه':fa(m.study)+' دقیقه مطالعه';const st=document.getElementById('weeklyStudyGoalTarget');if(st)st.textContent=hasStudyGoal?'هدف این هفته: '+fa(sg)+' دقیقه':'هدف: تعیین نشده';
 const tv=document.getElementById('weeklyTestGoalValue');if(tv)tv.textContent=hasTestGoal?fa(m.tests)+' / '+fa(tg)+' تست':fa(m.tests)+' تست';const tt=document.getElementById('weeklyTestGoalTarget');if(tt)tt.textContent=hasTestGoal?'هدف این هفته: '+fa(tg)+' تست':'هدف: تعیین نشده';
 const liveTarget=document.getElementById('weeklyGoalLiveTarget');if(liveTarget){liveTarget.classList.toggle('is-set',hasStudyGoal||hasTestGoal);liveTarget.textContent=(hasStudyGoal||hasTestGoal)?`🎯 هدف این هفته: ${hasStudyGoal?fa(sg)+' دقیقه مطالعه':'—'} • ${hasTestGoal?fa(tg)+' تست':'—'}`:'🎯 هدف این هفته: تعیین نشده';} const gss=document.getElementById('weeklyGoalStudyTargetSummary');if(gss)gss.textContent=hasStudyGoal?fa(sg)+' دقیقه':'تعیین نشده';
 const gst=document.getElementById('weeklyGoalTestTargetSummary');if(gst)gst.textContent=hasTestGoal?fa(tg)+' تست':'تعیین نشده';
 const goalShow=document.getElementById('weeklyGoalTargetShow');if(goalShow)goalShow.classList.toggle('is-visible',hasStudyGoal||hasTestGoal);
 const advice=document.getElementById('weeklyGoalAdvice');if(advice){const studyDone=hasStudyGoal&&m.study>=sg,testDone=hasTestGoal&&m.tests>=tg,daysLeft=Math.max(1,7-((new Date().getDay()+1)%7));if(!hasStudyGoal&&!hasTestGoal)advice.textContent='هنوز هدف هفتگی‌ات را تعیین نکرده‌ای؛ از بالا یک هدف مشخص کن. 🎯';else if(studyDone&&testDone)advice.textContent='🎉 هر دو هدف هفتگی را کامل کردی! مدال جدیدت هم باز شد؛ فوق‌العاده ادامه دادی! 🏆';else if(studyDone)advice.textContent=hasTestGoal?'📚 هدف مطالعه هفتگی کامل شد! برای باز کردن مدال کامل هفته، هدف تست را هم کامل کن.':'📚 هدف مطالعه هفتگی کامل شد! آفرین، هدف این هفته را به پایان رساندی. 🏆';else if(hasStudyGoal){const rem=Math.max(0,sg-m.study);advice.textContent=`برای رسیدن به هدف مطالعه حدود ${fa(rem)} دقیقه باقی مانده؛ با میانگین ${fa(Math.ceil(rem/daysLeft))} دقیقه در روز ادامه بده. 🚀`;}else if(hasTestGoal){const rem=Math.max(0,tg-m.tests);advice.textContent=`برای رسیدن به هدف تست حدود ${fa(rem)} تست باقی مانده؛ با میانگین ${fa(Math.ceil(rem/daysLeft))} تست در روز ادامه بده. 🚀`;}}
 renderAchievements();
}
function renderWeeklyChallenges(){
 if(!db)return;
 const grid=document.getElementById('weeklyChallengeGrid'),overall=document.getElementById('weeklyCenterOverall'),badge=document.getElementById('weeklyCenterWeekBadge');
 const m=getWeekMetrics(),g=getActiveWeeklyGoals(),studyGoal=Number(g.study)||0,testGoal=Number(g.tests)||0;
 const challenges=[
  {icon:'📚',title:'استقامت مطالعه',desc:'حداقل ۵ روز در این هفته فعالیت مطالعاتی داشته باش.',target:5,value:m.activeDays,unit:'روز'},
  {icon:'⏱️',title:'جلسه عمیق',desc:'حداقل ۳۰۰ دقیقه مطالعه واقعی در هفته ثبت کن.',target:300,value:m.study,unit:'دقیقه'},
  {icon:'📝',title:'شکار تست',desc:'حداقل ۱۰۰ تست واقعی را تا پایان هفته ثبت کن.',target:100,value:m.tests,unit:'تست'},
  {icon:'🔥',title:'هفته کامل',desc:'اگر هدف‌های شخصی‌ات را تعیین کرده‌ای، هر دو را کامل کن.',target:2,value:(studyGoal&&m.study>=studyGoal?1:0)+(testGoal&&m.tests>=testGoal?1:0),unit:'هدف'}
 ];
 const avg=challenges.reduce((a,c)=>a+Math.min(100,Math.round(c.value/c.target*100)),0)/challenges.length;
 if(overall)overall.textContent=fa(Math.round(avg))+'٪';
 if(badge){const d=getWeekDates();badge.textContent=`${fa(d[0].split('-')[2])} تا ${fa(d[6].split('-')[2])}`;}
 if(!grid)return;
 grid.innerHTML=challenges.map(c=>{const pct=Math.min(100,Math.round(c.value/c.target*100)),done=pct>=100;return `<div class="fp-challenge-card ${done?'is-done':''}"><div class="fp-challenge-icon">${c.icon}</div><div class="fp-challenge-main"><div class="fp-challenge-title"><b>${c.title}</b><span>${done?'✓ کامل شد':fa(pct)+'٪'}</span></div><p>${c.desc}</p><div class="fp-challenge-track"><i style="width:${pct}%"></i></div><div class="fp-challenge-meta"><span>${fa(Math.min(c.value,c.target))} / ${fa(c.target)} ${c.unit}</span><strong>${done?'تکمیل‌شده 🏆':`باقی‌مانده: ${fa(Math.max(0,c.target-c.value))} ${c.unit}`}</strong></div></div></div>`}).join('');
}
function getPerformanceWindowMetrics(offsetDays=0){if(!db)return{study:0,tests:0,plans:0,done:0,active:0};const end=new Date();end.setHours(0,0,0,0);end.setDate(end.getDate()-offsetDays);const start=new Date(end);start.setDate(end.getDate()-6);const keys=[];for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1))keys.push(isoLocal(d));const sessions=(db.sessions||[]).filter(x=>keys.includes(x.date));const plans=(db.plans||[]).filter(x=>keys.includes(x.date));return{study:sessions.reduce((a,x)=>a+(+x.min||0),0),tests:sessions.reduce((a,x)=>a+(+x.tests||0),0)+plans.filter(x=>x.done).reduce((a,x)=>a+(+x.actualTests||0),0),plans:plans.length,done:plans.filter(x=>x.done).length,active:new Set([...sessions.map(x=>x.date),...plans.filter(x=>x.done).map(x=>x.date)]).size}}
function renderPerformanceCenter(){if(!db)return;const cur=getPerformanceWindowMetrics(0),prev=getPerformanceWindowMetrics(7);const pct=prev.study?Math.round((cur.study-prev.study)/prev.study*100):(cur.study?100:0);const dailyGoal=Math.max(1,+db.settings.goal||480),score=Math.round(Math.min(100,(cur.study/(dailyGoal*7))*70+(cur.plans?cur.done/cur.plans*30:0)));const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('currentWeekStudy',fa(Math.floor(cur.study/60))+':'+fa(String(cur.study%60).padStart(2,'0')));set('previousWeekStudy',fa(Math.floor(prev.study/60))+':'+fa(String(prev.study%60).padStart(2,'0')));set('performanceDelta',(pct>0?'+':'')+fa(pct)+'٪');set('performanceStreak',fa(getActivityStreak())+' روز');set('performanceScore',fa(score)+'٪');set('selfCompareText',pct>0?`این هفته ${fa(pct)}٪ بیشتر از ۷ روز قبل مطالعه کرده‌ای. 🔥`:pct<0?`این هفته ${fa(Math.abs(pct))}٪ کمتر از ۷ روز قبل مطالعه کرده‌ای؛ یک قدم کوچک می‌تواند روند را برگرداند. 💪`:'عملکرد مطالعه‌ات نسبت به ۷ روز قبل تقریباً ثابت مانده است. ⚖️');
 const maxStudy=Math.max(cur.study,prev.study,1),maxTests=Math.max(cur.tests,prev.tests,1);[['compareCurrentStudy',cur.study,maxStudy],['comparePreviousStudy',prev.study,maxStudy],['compareCurrentTests',cur.tests,maxTests],['comparePreviousTests',prev.tests,maxTests]].forEach(([id,v,m])=>{const e=document.getElementById(id);if(e)e.style.width=Math.min(100,Math.round(v/m*100))+'%'});set('compareCurrentStudyText',fa(cur.study)+' دقیقه');set('comparePreviousStudyText',fa(prev.study)+' دقیقه');set('compareCurrentTestsText',fa(cur.tests)+' تست');set('comparePreviousTestsText',fa(prev.tests)+' تست');
 const svg=document.getElementById('performanceCenterChart');if(svg){const days=[];const goal=Math.max(1,+db.settings.goal||480);for(let i=13;i>=0;i--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-i);const k=isoLocal(d);const sessions=(db.sessions||[]).filter(x=>x.date===k);const actual=sessions.reduce((a,x)=>{const n=Number(x.min);return a+(Number.isFinite(n)&&n>0?Math.min(1440,n):0)},0);const planned=(db.plans||[]).filter(x=>x.date===k).reduce((a,x)=>{const n=Number(x.min);return a+(Number.isFinite(n)&&n>0?Math.min(1440,n):0)},0);days.push({key:k,actual,planned})}const mx=Math.max(goal,...days.map(d=>Math.max(d.actual,d.planned)),60);const W=760,H=250,L=34,R=18,T=18,B=30,innerW=W-L-R,innerH=H-T-B;const xAt=i=>L+i*innerW/13,yAt=v=>T+innerH-(Math.min(mx,v)/mx)*innerH;const actualPts=days.map((d,i)=>[xAt(i),yAt(d.actual)]),plannedPts=days.map((d,i)=>[xAt(i),yAt(d.planned)]);const mkLine=pts=>pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');const labels=days.map((d,i)=>{const dd=new Date(d.key+'T12:00:00');return `<text x="${xAt(i)}" y="244" text-anchor="middle" font-size="11" fill="currentColor" opacity=".65">${dd.getDate()}</text>`}).join('');const grid=[0,.25,.5,.75,1].map(r=>{const y=T+innerH-r*innerH;return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="currentColor" opacity=".09"/><text x="2" y="${y+4}" font-size="10" fill="currentColor" opacity=".5">${Math.round(mx*r)}</text>`}).join('');const tips=days.map((d,i)=>`<circle cx="${xAt(i)}" cy="${yAt(d.actual)}" r="5" fill="var(--accent2)"><title>${d.key} • مطالعه واقعی: ${d.actual} دقیقه • برنامه: ${d.planned} دقیقه</title></circle>`).join('');svg.innerHTML=`<defs><linearGradient id="pcgMain2" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="var(--accent)"/><stop offset="100%" stop-color="var(--accent2)"/></linearGradient></defs>${grid}<path d="${mkLine(plannedPts)}" fill="none" stroke="currentColor" opacity=".28" stroke-width="2" stroke-dasharray="7 6"/><path d="${mkLine(actualPts)}" fill="none" stroke="url(#pcgMain2)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>${tips}${labels}`}
 renderSubjectPerformanceChart();renderSubjectAnalytics();renderUserLevel();renderAchievements();}
function getWeeklyWeakSubjectRows(){
 const map={};
 const dates=new Set(getWeekDates());
 const add=(subject,min,tests)=>{const s=String(subject||'').trim()||'مطالعه';map[s]??={m:0,t:0};map[s].m+=Math.max(0,+min||0);map[s].t+=Math.max(0,+tests||0)};
 // این بخش عمداً فقط هفته جاری را می‌سنجد؛ آرشیو و جلسات ماه‌های قبل روی آن اثر ندارند.
 (db.sessions||[]).filter(x=>dates.has(x.date)).forEach(x=>add(x.subject,x.min,x.tests));
 (db.testTasks||[]).forEach((x,i)=>{if(x.done&&dates.has(x.date)&&!hasLinkedTestSession(x,i))add(x.subject,x.actualMin||0,x.actualCount||x.count||0)});
 // همه درس‌های فعلی را وارد کن تا درس بدون فعالیت هم به‌درستی «نیاز به تلاش» دیده شود.
 subjects().forEach(s=>{if(!map[s])map[s]={m:0,t:0}});
 return Object.entries(map).map(([s,v])=>({s,m:v.m,t:v.t,score:v.m+v.t*2})).sort((a,b)=>a.score-b.score||a.s.localeCompare(b.s,'fa')).slice(0,5);
}
function renderWeakSubjectsInto(targetId){const box=document.getElementById(targetId);if(!box||!db)return;const rows=getWeeklyWeakSubjectRows();if(!rows.length){box.innerHTML='<div class="empty">هنوز درسی برای بررسی وجود ندارد.</div>';return}const mx=Math.max(...rows.map(x=>x.score),1);box.innerHTML=rows.map(x=>`<div class="weak-row"><b>${esc(x.s)}</b><div><div class="weak-bar"><i style="width:${x.score?Math.max(8,Math.round(x.score/mx*100)):8}%"></i></div><small class="muted">${fa(Math.round(x.m))} دقیقه • ${fa(x.t)} تست</small></div><span>${x.score<60?'🔴 نیاز به توجه':x.score<150?'🟡 قابل بهبود':'🟢 متوسط'}</span></div>`).join('')}
function getUserProgress(){
 const study=(db.sessions||[]).reduce((a,x)=>{let mins=Math.max(0,+x.min||0);if(x.source==='plan'&&x.planId){const p=(db.plans||[]).find(p=>p.id===x.planId);if(p)mins=Math.min(mins,Math.max(1,Math.round((+p.min||0)*2)));}return a+mins},0);
 const tests=(db.sessions||[]).reduce((a,x)=>{let n=Math.max(0,+x.tests||0);if(x.source==='test'&&x.testTaskId){const t=(db.testTasks||[]).find(t=>testTaskKey(t)===x.testTaskId);if(t)n=Math.min(n,Math.max(1,Math.round((+t.count||1)*2)));}return a+n},0)+(db.testTasks||[]).filter(x=>x.done&&!hasLinkedTestSession(x,(db.testTasks||[]).indexOf(x))).reduce((a,x)=>a+Math.min(+x.actualCount||+x.count||0,Math.max(1,Math.round((+x.count||1)*2))),0);
 const plans=(db.plans||[]).filter(x=>x.done).length;
 const active=new Set((db.sessions||[]).map(x=>x.date)); (db.plans||[]).filter(x=>x.done).forEach(x=>active.add(x.date));
 /* XP is STATE-BASED, never action-based: checking/unchecking cannot stack XP. */ const xp=Math.floor(study)+tests+plans*10+active.size*5;
 const level=Math.max(1,Math.floor(xp/100)+1);
 const current=(level-1)*100,next=level*100,percent=Math.min(100,Math.round((xp-current)/(next-current)*100));
 return {study,tests,plans,activeDays:active.size,xp,level,current,next,percent};
}
function renderUserLevel(){
 const p=getUserProgress();
 const names=['تازه‌کار','شروع‌کننده','پرتلاش','منظم','متمرکز','پیشرو','رقیب','قهرمان','نخبه','استاد','استاد تمرکز','فرمانده مطالعه','نابغه برنامه‌ریزی','افسانه‌ای','اسطوره','قله‌نشین','فاتح کنکور','ابر قهرمان','جاودانه','افسانه زنده'];
 const name=names[Math.min(names.length-1,p.level-1)];
 const n=document.getElementById('userLevelName'),m=document.getElementById('userLevelMessage'),b=document.getElementById('userLevelBadge'),x=document.getElementById('userXpText'),nx=document.getElementById('userNextXp'),bar=document.getElementById('userLevelBar');
 if(n)n.textContent=`سطح ${fa(p.level)} · ${name}`; if(m)m.textContent=`با مطالعه، تست و انجام برنامه‌ها XP می‌گیری. سطح بعدی در ${fa(p.next-p.xp)} XP.`; if(b)b.textContent=fa(p.level); if(x)x.textContent=fa(p.xp)+' XP'; if(nx)nx.textContent=p.xp>=p.next?'سطح بعدی باز شد!':fa(p.next-p.xp)+' XP تا سطح بعد'; if(bar)bar.style.width=p.percent+'%';
}
function getAchievementList(){
 if(!db)return[];
 const p=getUserProgress(),week=getWeekMetrics();
 const streak=(()=>{let c=0,d=new Date();d.setHours(0,0,0,0);for(let i=0;i<365;i++){const k=isoLocal(d);const active=(db.sessions||[]).some(x=>x.date===k)||(db.plans||[]).some(x=>x.date===k&&x.done);if(!active)break;c++;d.setDate(d.getDate()-1)}return c})();
 const perfectDays=(db.plans||[]).filter(x=>x.done&&x.date).reduce((m,x)=>{m[x.date]=(m[x.date]||0)+1;return m},{});
 const ach=[
  ['first_login','🎉','اولین ورود','ورود موفق به FocusPlan',true],
  ['study_60','🌱','شروع قدرتمند','اولین ۶۰ دقیقه مطالعه',p.study>=60],
  ['study_600','🔥','۱۰ ساعت مطالعه','رسیدن به ۱۰ ساعت مطالعه',p.study>=600],
  ['study_1500','🏅','۲۵ ساعت مطالعه','رسیدن به ۲۵ ساعت مطالعه',p.study>=1500],
  ['study_3000','🏆','۵۰ ساعت مطالعه','رسیدن به ۵۰ ساعت مطالعه',p.study>=3000],
  ['study_6000','💎','۱۰۰ ساعت مطالعه','رسیدن به ۱۰۰ ساعت مطالعه',p.study>=6000],
  ['study_15000','👑','۲۵۰ ساعت مطالعه','رسیدن به ۲۵۰ ساعت مطالعه',p.study>=15000],
  ['study_30000','📚','۵۰۰ ساعت مطالعه','رسیدن به ۵۰۰ ساعت مطالعه',p.study>=30000],
  ['tests_100','📝','اولین ۱۰۰ تست','ثبت ۱۰۰ تست',p.tests>=100],
  ['tests_500','🎯','۵۰۰ تست','ثبت ۵۰۰ تست',p.tests>=500],
  ['tests_1000','🚀','۱۰۰۰ تست','ثبت ۱۰۰۰ تست',p.tests>=1000],
  ['tests_2500','⚡','۲۵۰۰ تست','ثبت ۲۵۰۰ تست',p.tests>=2500],
  ['tests_5000','🧠','۵۰۰۰ تست','ثبت ۵۰۰۰ تست',p.tests>=5000],
  ['plans_10','📅','برنامه‌ریز حرفه‌ای','انجام ۱۰ برنامه',p.plans>=10],
  ['plans_50','🗓️','برنامه‌ریز منظم','انجام ۵۰ برنامه',p.plans>=50],
  ['plans_100','🏅','استاد برنامه‌ریزی','انجام ۱۰۰ برنامه',p.plans>=100],
  ['week_active','📆','هفته فعال','حداقل ۵ روز فعالیت در یک هفته',week.activeDays>=5],
  ['week_study_100','🎯','هدف هفتگی کامل','رسیدن به ۱۰۰٪ هدف مطالعه هفتگی',week.study>=(getActiveWeeklyStudyGoal()==null?Infinity:Math.max(1,+getActiveWeeklyStudyGoal()))],
  ['week_both_100','🏆','فاتح هفته','کامل کردن هم‌زمان هدف مطالعه و هدف تست هفتگی',week.study>=(getActiveWeeklyStudyGoal()==null?Infinity:Math.max(1,+getActiveWeeklyStudyGoal()))&&week.tests>=(getActiveWeeklyTestGoal()==null?Infinity:Math.max(1,+getActiveWeeklyTestGoal()))],
  ['week_study_120','👑','فراتر از هدف','رسیدن به ۱۲۰٪ هدف مطالعه هفتگی',week.study>=(getActiveWeeklyStudyGoal()==null?Infinity:Math.max(1,+getActiveWeeklyStudyGoal()))*1.2],
  ['week_complete','⚡','هفته کامل','رسیدن به حداقل ۹۰٪ هدف مطالعه هفتگی',week.study>=(getActiveWeeklyStudyGoal()==null?Infinity:Math.max(1,+getActiveWeeklyStudyGoal()))*.9],
  ['streak_7','🔥','استریک ۷ روزه','۷ روز پشت‌سرهم فعالیت',streak>=7],
  ['streak_14','🔥','استریک ۱۴ روزه','۱۴ روز پشت‌سرهم فعالیت',streak>=14],
  ['streak_30','🚀','استریک ۳۰ روزه','۳۰ روز پشت‌سرهم فعالیت',streak>=30],
  ['streak_60','🌋','استریک ۶۰ روزه','۶۰ روز پشت‌سرهم فعالیت',streak>=60],
  ['perfect_5','💯','روز بی‌نقص','انجام حداقل ۵ برنامه در یک روز',Math.max(0,...Object.values(perfectDays))>=5],
  ['perfect_8','🎯','روز فوق‌العاده','انجام حداقل ۸ برنامه در یک روز',Math.max(0,...Object.values(perfectDays))>=8],
  ['sessions_50','⏱️','استاد زمان','ثبت حداقل ۵۰ جلسه مطالعه',(db.sessions||[]).length>=50],
  ['subjects_5','🧩','تنوع‌طلب','مطالعه حداقل ۵ درس مختلف',new Set((db.sessions||[]).map(x=>x.subject).filter(Boolean)).size>=5],
  ['active_10','📈','روند صعودی','فعالیت در ۱۰ روز مختلف',p.activeDays>=10],
  ['goal_95','🏹','هدف‌زن','رسیدن به ۹۵٪ هدف مطالعه هفتگی',week.study>=(getActiveWeeklyStudyGoal()==null?Infinity:Math.max(1,+getActiveWeeklyStudyGoal()))*.95],
  ['level_10','🌟','سطح ۱۰','رسیدن به سطح ۱۰',p.level>=10],
  ['level_20','💫','سطح ۲۰','رسیدن به سطح ۲۰',p.level>=20],
  ['level_30','👑','سطح ۳۰','رسیدن به سطح ۳۰',p.level>=30],
  ['study_45000','🌌','۷۵۰ ساعت مطالعه','رسیدن به ۷۵۰ ساعت مطالعه',p.study>=45000],
  ['study_60000','☄️','۱۰۰۰ ساعت مطالعه','رسیدن به ۱۰۰۰ ساعت مطالعه',p.study>=60000],
  ['study_90000','🌠','۱۵۰۰ ساعت مطالعه','رسیدن به ۱۵۰۰ ساعت مطالعه',p.study>=90000],
  ['tests_7500','🎖️','۷۵۰۰ تست','ثبت ۷۵۰۰ تست',p.tests>=7500],
  ['tests_10000','🔱','۱۰٬۰۰۰ تست','ثبت ۱۰٬۰۰۰ تست',p.tests>=10000],
  ['tests_20000','🛡️','۲۰٬۰۰۰ تست','ثبت ۲۰٬۰۰۰ تست',p.tests>=20000],
  ['plans_200','🧭','فرمانده برنامه‌ریزی','انجام ۲۰۰ برنامه',p.plans>=200],
  ['plans_500','🏛️','معمار مسیر','انجام ۵۰۰ برنامه',p.plans>=500],
  ['week_active_7','🌿','هفته سبز','فعالیت در هر ۷ روز هفته',week.activeDays>=7],
  ['week_study_150','💠','هدف ۱۵۰ درصدی','رسیدن به ۱۵۰٪ هدف مطالعه هفتگی',week.study>=(getActiveWeeklyStudyGoal()==null?Infinity:Math.max(1,+getActiveWeeklyStudyGoal()))*1.5],
  ['streak_90','🔥','استریک ۹۰ روزه','۹۰ روز پشت‌سرهم فعالیت',streak>=90],
  ['streak_120','🗻','استریک ۱۲۰ روزه','۱۲۰ روز پشت‌سرهم فعالیت',streak>=120],
  ['perfect_10','✨','روز طلایی','انجام حداقل ۱۰ برنامه در یک روز',Math.max(0,...Object.values(perfectDays))>=10],
  ['sessions_100','⏳','صد جلسه تمرکز','ثبت حداقل ۱۰۰ جلسه مطالعه',(db.sessions||[]).length>=100],
  ['sessions_250','⌛','دویست‌وپنجاه جلسه','ثبت حداقل ۲۵۰ جلسه مطالعه',(db.sessions||[]).length>=250],
  ['subjects_8','🧬','استاد چندرشته‌ای','مطالعه حداقل ۸ درس مختلف',new Set((db.sessions||[]).map(x=>x.subject).filter(Boolean)).size>=8],
  ['active_30','🛰️','۳۰ روز فعال','فعالیت در ۳۰ روز مختلف',p.activeDays>=30],
  ['active_60','🌍','۶۰ روز فعال','فعالیت در ۶۰ روز مختلف',p.activeDays>=60],
  ['level_40','♛','سطح ۴۰','رسیدن به سطح ۴۰',p.level>=40],
  ['level_50','☀️','سطح ۵۰','رسیدن به سطح ۵۰',p.level>=50],
  ['study_120000','🏔️','۲۰۰۰ ساعت مطالعه','رسیدن به ۲۰۰۰ ساعت مطالعه',p.study>=120000],
  ['study_180000','🌌','۳۰۰۰ ساعت مطالعه','رسیدن به ۳۰۰۰ ساعت مطالعه',p.study>=180000],
  ['tests_30000','🎯','۳۰٬۰۰۰ تست','ثبت ۳۰٬۰۰۰ تست',p.tests>=30000],
  ['tests_50000','⚔️','۵۰٬۰۰۰ تست','ثبت ۵۰٬۰۰۰ تست',p.tests>=50000],
  ['plans_1000','🏰','۱۰۰۰ برنامه','انجام ۱۰۰۰ برنامه',p.plans>=1000],
  ['streak_180','🔥','استریک ۱۸۰ روزه','۱۸۰ روز پشت‌سرهم فعالیت',streak>=180],
  ['streak_365','🎆','سال کامل','۳۶۵ روز پشت‌سرهم فعالیت',streak>=365],
  ['active_100','💠','۱۰۰ روز فعال','فعالیت در ۱۰۰ روز مختلف',p.activeDays>=100],
  ['active_200','🌐','۲۰۰ روز فعال','فعالیت در ۲۰۰ روز مختلف',p.activeDays>=200],
  ['sessions_500','⏰','۵۰۰ جلسه تمرکز','ثبت حداقل ۵۰۰ جلسه مطالعه',(db.sessions||[]).length>=500],
  ['sessions_1000','🕰️','۱۰۰۰ جلسه تمرکز','ثبت حداقل ۱۰۰۰ جلسه مطالعه',(db.sessions||[]).length>=1000],
  ['subjects_10','🔬','دانشمند چندرشته‌ای','مطالعه حداقل ۱۰ درس مختلف',new Set((db.sessions||[]).map(x=>x.subject).filter(Boolean)).size>=10],
  ['perfect_15','🏅','روز الماسی','انجام حداقل ۱۵ برنامه در یک روز',Math.max(0,...Object.values(perfectDays))>=15],
  ['perfect_20','💎','روز افسانه‌ای','انجام حداقل ۲۰ برنامه در یک روز',Math.max(0,...Object.values(perfectDays))>=20],
  ['week_study_200','🚀','هدف ۲۰۰ درصدی','رسیدن به ۲۰۰٪ هدف مطالعه هفتگی',week.study>=(getActiveWeeklyStudyGoal()==null?Infinity:Math.max(1,+getActiveWeeklyStudyGoal()))*2],
  ['level_60','👑','سطح ۶۰','رسیدن به سطح ۶۰',p.level>=60],
  ['level_75','🪐','سطح ۷۵','رسیدن به سطح ۷۵',p.level>=75],
  ['level_100','🌟','سطح ۱۰۰','رسیدن به سطح ۱۰۰',p.level>=100],
  ['goal_150','🏹','شکارچی هدف','رسیدن به ۱۵۰٪ هدف مطالعه هفتگی',week.study>=(getActiveWeeklyStudyGoal()==null?Infinity:Math.max(1,+getActiveWeeklyStudyGoal()))*1.5]
 ];
 return ach.map(a=>({id:a[0],icon:a[1],title:a[2],desc:a[3],unlocked:!!a[4]}));
}
function medalVisual(a){
 const id=String(a?.id||'');
 const special={
  first_login:'ruby',study_60:'leaf',study_600:'fire',study_1500:'silver',study_3000:'gold',study_6000:'diamond',study_15000:'crown',study_30000:'book',
  tests_100:'paper',tests_500:'target',tests_1000:'rocket',tests_2500:'bolt',tests_5000:'brain',plans_10:'calendar',plans_50:'schedule',plans_100:'master',
  week_active:'calendar',week_study_100:'target',week_both_100:'trophy',week_study_120:'crown',week_complete:'bolt',streak_7:'flame',streak_14:'flame2',streak_30:'rocket',streak_60:'volcano',
  perfect_5:'perfect',perfect_8:'star',sessions_50:'timer',subjects_5:'puzzle',active_10:'trend',goal_95:'arrow',level_10:'star',level_20:'moon',level_30:'royal',
  study_45000:'galaxy',study_60000:'comet',study_90000:'nebula',tests_7500:'medal',tests_10000:'trident',tests_20000:'shield',plans_200:'compass',plans_500:'temple',
  week_active_7:'nature',week_study_150:'aura',streak_90:'inferno',streak_120:'mountain',perfect_10:'sparkle',sessions_100:'hourglass',sessions_250:'chronos',subjects_8:'dna',active_30:'satellite',active_60:'earth',level_40:'queen',level_50:'sun',study_120000:'mountain',study_180000:'galaxy2',tests_30000:'trident2',tests_50000:'shield2',plans_1000:'castle',streak_180:'inferno2',streak_365:'fireworks',active_100:'globe',active_200:'network',sessions_500:'clocktower',sessions_1000:'grandclock',subjects_10:'lab',perfect_15:'diamond2',perfect_20:'crown2',week_study_200:'rocket2',level_60:'king',level_75:'planet',level_100:'cosmos',goal_150:'archer'
 };
 return special[id]||'default';
}
function getFeaturedMedal(){
 const list=getAchievementList();
 const chosen=String(db?.settings?.featuredMedalId||'').trim();
 if(!chosen)return null;
 return list.find(a=>a.id===chosen&&a.unlocked)||null;
}

function persistProgressFast(){
 if(!db)return;
 try{
   normalizeAntiAbuseState(); normalizeProfileData(); ensureDataShape();
   localStorage.setItem(DBKEY,JSON.stringify(db));
   // به‌روزرسانی فوری بخش‌های XP، سطح و مدال منتخب؛ رندر سنگین کل برنامه در فریم بعدی انجام می‌شود.
   renderUserLevel(); renderDashboardIdentity(); renderAchievements();
   if(typeof renderGamification==='function')renderGamification();
   requestAnimationFrame(()=>{try{render()}catch(e){console.error('FocusPlan fast render:',e)}});
 }catch(e){
   console.error('FocusPlan fast persist error:',e);
   try{localStorage.setItem(DBKEY,JSON.stringify(db))}catch(_){}
 }
}
function renderDashboardIdentity(){
 if(!db)return; const p=getUserProgress(); const names=['تازه‌کار','شروع‌کننده','پرتلاش','منظم','متمرکز','پیشرو','رقیب','قهرمان','نخبه','استاد','استاد تمرکز','فرمانده مطالعه','نابغه برنامه‌ریزی','افسانه‌ای','اسطوره','قله‌نشین','فاتح کنکور','ابر قهرمان','جاودانه','افسانه زنده'];
 const name=names[Math.min(names.length-1,p.level-1)];
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
 set('dashLevelName',`سطح ${fa(p.level)} · ${name}`);set('dashLevelXp',fa(p.xp)+' XP');set('dashLevelBadge',fa(p.level));set('dashLevelNext',p.xp>=p.next?'سطح بعدی باز شد!':fa(p.next-p.xp)+' XP تا سطح بعد');const bar=document.getElementById('dashLevelBar');if(bar)bar.style.width=p.percent+'%';
 const m=getFeaturedMedal(); const mi=document.getElementById('dashFeaturedMedalIcon'); const mt=document.getElementById('dashFeaturedMedalTitle'); const md=document.getElementById('dashFeaturedMedalDesc'); const mb=document.querySelector('.dashboard-medal-card>.btn'); if(m){if(mi){mi.innerHTML=medalSVG(medalVisual(m),m.icon);mi.className='dashboard-medal-icon medal-preview dashboard-medal-art medal-'+medalVisual(m)}set('dashFeaturedMedalTitle',m.title);set('dashFeaturedMedalDesc',m.desc);if(mb)mb.textContent='تغییر مدال'}else{if(mi){mi.innerHTML='<span style="font-size:30px">🏆</span>';mi.className='dashboard-medal-icon'}if(mt)mt.textContent='هنوز مدالی انتخاب نشده';if(md)md.textContent='از بخش «دستاوردها» یک مدال بازشده را برای داشبورد انتخاب کن.';if(mb)mb.textContent='انتخاب مدال'}
}
function setFeaturedMedal(id){if(!db)return;const a=getAchievementList().find(x=>x.id===id);if(!a||!a.unlocked){alert('اول این مدال را باز کن. 🔒');return}db.settings=db.settings||{};db.settings.featuredMedalId=id;persistProgressFast();const btn=document.querySelector('.medal-select-btn[data-medal-id="'+id+'"]');if(btn){btn.classList.add('selected');btn.textContent='✓ مدال انتخاب‌شده'}}
function openPerformanceMedals(){const b=document.querySelector('.tabs button[data-tab="achievements"]');if(b)b.click();setTimeout(()=>document.getElementById('v202Achievements')?.scrollIntoView({behavior:'smooth',block:'start'}),120)}

function medalPalette(v){
 const m={
  ruby:['#ff3b6b','#8b123c','#ffd1dc'],leaf:['#7ee787','#16834b','#d8ffd9'],fire:['#ff7a18','#d51f00','#ffe08a'],
  silver:['#f7fbff','#718096','#ffffff'],gold:['#ffe45c','#d88900','#fff4a8'],diamond:['#7cf7ff','#1769aa','#eaffff'],
  crown:['#fff27a','#c48a00','#fffbe0'],book:['#8aa9ff','#3b4fb3','#dce5ff'],paper:['#ffffff','#8793a8','#eaf0f8'],
  target:['#ff4d6d','#8b1e3f','#fff0f3'],rocket:['#ff9f43','#c0392b','#fff0c2'],bolt:['#ffe600','#c58b00','#fffbd0'],
  calendar:['#66d9ff','#1769aa','#e8fbff'],schedule:['#a78bfa','#5b21b6','#eee7ff'],master:['#ff6b9a','#7c1d4d','#ffe1eb'],
  trophy:['#ffd54a','#9a6500','#fff3a8'],flame:['#ff6b22','#b31200','#fff1a8'],flame2:['#ff2d55','#8e0e25','#ffd4dc'],
  volcano:['#ff7b39','#7f1d1d','#ffd2a8'],perfect:['#00e5ff','#075985','#d8fbff'],star:['#ffe66d','#a16207','#fff8c5'],
  timer:['#4ade80','#166534','#dcffe7'],puzzle:['#fb7185','#9f1239','#ffe0e7'],trend:['#34d399','#065f46','#d5fff0'],
  arrow:['#60a5fa','#1e3a8a','#e0efff'],moon:['#c4b5fd','#312e81','#eee9ff'],royal:['#f472b6','#701a75','#ffe1fa'],
  galaxy:['#c084fc','#312e81','#f3e8ff'],comet:['#67e8f9','#155e75','#e0fcff'],nebula:['#f0abfc','#7e22ce','#fff0ff'],
  medal:['#facc15','#a16207','#fff7b0'],trident:['#38bdf8','#075985','#e0f7ff'],shield:['#60a5fa','#1e3a8a','#e4efff'],
  compass:['#fb923c','#7c2d12','#ffedd5'],temple:['#d4a574','#6b4423','#fff0d8'],nature:['#86efac','#166534','#ecffef'],
  aura:['#f9a8d4','#831843','#ffe8f4'],inferno:['#fb7185','#7f1d1d','#ffe1e1'],mountain:['#94a3b8','#334155','#eef2f7'],
  sparkle:['#fde047','#a16207','#fffbd5'],hourglass:['#f59e0b','#78350f','#fff0c2'],chronos:['#a3a3a3','#404040','#fafafa'],
  dna:['#2dd4bf','#115e59','#dcfffa'],satellite:['#94a3b8','#334155','#f1f5f9'],earth:['#38bdf8','#14532d','#dff8ff'],
  queen:['#f0abfc','#701a75','#fff0ff'],sun:['#fbbf24','#b45309','#fff4b0'],galaxy2:['#818cf8','#4c1d95','#eef0ff'],
  trident2:['#22d3ee','#164e63','#ddfbff'],shield2:['#c4b5fd','#4c1d95','#f2eaff'],castle:['#f59e0b','#78350f','#fff0c2'],
  inferno2:['#ff4d00','#7f1d1d','#ffe0b2'],fireworks:['#fb7185','#4338ca','#ffe4f0'],globe:['#38bdf8','#075985','#e0f7ff'],
  network:['#4ade80','#14532d','#e4ffe8'],clocktower:['#fbbf24','#713f12','#fff7d1'],grandclock:['#e5e7eb','#374151','#ffffff'],
  lab:['#22d3ee','#164e63','#e0fbff'],diamond2:['#67e8f9','#0e7490','#e5ffff'],crown2:['#facc15','#854d0e','#fffbd0'],
  rocket2:['#fb7185','#9f1239','#ffe5eb'],king:['#fbbf24','#581c87','#fff0b8'],planet:['#a78bfa','#1e1b4b','#eeeaff'],
  cosmos:['#e879f9','#4c1d95','#fff0ff'],archer:['#34d399','#064e3b','#ddfff0']
 };
 return m[v]||['#60a5fa','#1e40af','#e0efff'];
}
function medalSVG(v,icon){
 const [c1,c2,hi]=medalPalette(v);
 const gid='g'+String(v).replace(/[^a-z0-9]/gi,'')+String(icon).codePointAt(0);
 const ribbon=`<path d="M38 4 L60 22 L82 4 L77 48 L60 36 L43 48 Z" fill="${c2}" stroke="${hi}" stroke-width="3"/><path d="M45 7 L60 19 L75 7" fill="none" stroke="${hi}" stroke-width="2" opacity=".8"/>`;
 const shapes={
  leaf:`<path d="M60 92 C25 82 21 48 56 28 C68 21 82 23 91 31 C90 63 79 83 60 92Z" fill="url(#${gid})" stroke="${hi}" stroke-width="3"/><path d="M35 72 C52 58 66 45 82 31" stroke="${hi}" stroke-width="4" fill="none"/>`,
  flame:`<path d="M60 96 C28 91 20 64 36 43 C43 34 50 29 49 16 C70 30 75 45 69 57 C78 51 82 43 82 36 C101 61 91 91 60 96Z" fill="url(#${gid})" stroke="${hi}" stroke-width="3"/>`,
  crown:`<path d="M24 44 L35 78 L85 78 L96 44 L76 57 L60 30 L44 57 Z" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/><rect x="31" y="77" width="58" height="13" rx="5" fill="${c2}" stroke="${hi}" stroke-width="3"/>`,
  shield:`<path d="M60 23 L92 34 L87 68 C82 85 69 94 60 98 C51 94 38 85 33 68 L28 34 Z" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/><path d="M60 35 V82 M43 52 H77" stroke="${hi}" stroke-width="4" opacity=".9"/>`,
  diamond:`<path d="M25 43 L43 23 L77 23 L95 43 L60 94 Z" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/><path d="M25 43 H95 M43 23 L60 43 L77 23 M60 43 V94" stroke="${hi}" stroke-width="2" opacity=".9"/>`,
  star:`<path d="M60 16 L71 43 L100 44 L77 62 L84 91 L60 75 L36 91 L43 62 L20 44 L49 43 Z" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/>`,
  rocket:`<path d="M60 16 C84 28 91 49 77 69 L60 87 L43 69 C29 49 36 28 60 16Z" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/><path d="M60 87 L51 102 L60 96 L69 102 Z" fill="${c1}"/><circle cx="60" cy="45" r="8" fill="${hi}"/>`,
  book:`<path d="M21 28 Q39 20 58 31 V87 Q39 78 21 86Z M62 31 Q81 20 99 28 V86 Q81 78 62 87Z" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/><path d="M60 31 V87" stroke="${hi}" stroke-width="4"/>`,
  target:`<circle cx="60" cy="60" r="39" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/><circle cx="60" cy="60" r="25" fill="none" stroke="${hi}" stroke-width="5"/><circle cx="60" cy="60" r="9" fill="${hi}"/>`,
  calendar:`<rect x="25" y="27" width="70" height="65" rx="10" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/><path d="M25 45 H95 M40 18 V35 M80 18 V35" stroke="${hi}" stroke-width="6" stroke-linecap="round"/>`,
  puzzle:`<path d="M43 27 H53 C51 17 58 11 66 15 C73 18 73 27 69 31 H83 V45 C93 42 100 49 97 57 C94 64 85 64 81 60 V78 H65 C68 68 61 61 53 64 C46 67 46 76 51 80 H35 V63 C25 67 18 60 21 52 C24 45 33 45 38 49 V34 H43Z" fill="url(#${gid})" stroke="${hi}" stroke-width="3"/>`,
  bolt:`<path d="M67 14 L29 61 H53 L45 101 L91 48 H66 Z" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/>`,
  galaxy:`<circle cx="60" cy="60" r="37" fill="url(#${gid})" stroke="${hi}" stroke-width="3"/><ellipse cx="60" cy="60" rx="52" ry="18" fill="none" stroke="${hi}" stroke-width="3" transform="rotate(-22 60 60)"/><circle cx="37" cy="45" r="4" fill="${hi}"/><circle cx="82" cy="75" r="5" fill="${hi}"/>`,
  castle:`<path d="M25 92 V42 H36 V30 H47 V42 H55 V25 H66 V42 H77 V30 H88 V92Z" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/><path d="M50 92 V68 H70 V92 M55 55 H65" stroke="${hi}" stroke-width="4"/>`,
  globe:`<circle cx="60" cy="60" r="40" fill="url(#${gid})" stroke="${hi}" stroke-width="4"/><ellipse cx="60" cy="60" rx="18" ry="40" fill="none" stroke="${hi}" stroke-width="3"/><path d="M20 60 H100 M27 42 Q60 52 93 42 M27 78 Q60 68 93 78" fill="none" stroke="${hi}" stroke-width="3"/>`
 };
 let key=v;
 if(['ruby','silver','gold','diamond','medal'].includes(v)) key='target';
 if(['fire','flame2','volcano','inferno','inferno2'].includes(v)) key='flame';
 if(['queen','king','royal','crown2'].includes(v)) key='crown';
 if(['shield2','trident','trident2'].includes(v)) key='shield';
 if(['galaxy2','nebula','comet','cosmos','planet'].includes(v)) key='galaxy';
 if(['nature','aura'].includes(v)) key='leaf';
 if(['master','temple'].includes(v)) key='castle';
 if(['paper','schedule','timer','hourglass','chronos','clocktower','grandclock'].includes(v)) key='calendar';
 if(['perfect','sparkle','sun'].includes(v)) key='star';
 if(['rocket2'].includes(v)) key='rocket';
 if(['diamond2'].includes(v)) key='diamond';
 if(['crown','crown2'].includes(v)) key='crown';
 if(['trophy','arrow','trend','archer'].includes(v)) key='shield';
 const body=shapes[key]||shapes.target;
 return `<svg class="real-medal-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".38" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>${ribbon}${body}<circle cx="60" cy="60" r="4" fill="${hi}" opacity=".8"/></svg>`;
}

function renderAchievements(){
 const box=document.getElementById('performanceAchievementGrid');if(!box||!db)return;
 const ach=getAchievementList(); const featured=getFeaturedMedal();
 box.innerHTML=ach.map(a=>{const v=medalVisual(a);return `<div class="achievement medal-card medal-${v} ${a.unlocked?'unlocked':'locked'}" data-medal-style="${v}"><span class="ach-check">${a.unlocked?'✓':'🔒'}</span><div class="medal-art-real">${medalSVG(v,a.icon)}<span class="real-medal-icon">${a.icon}</span></div><b>${a.title}</b><small>${a.desc}</small>${a.unlocked?`<button type="button" class="medal-select-btn ${featured?.id===a.id?'selected':''}" onclick="setFeaturedMedal('${a.id}')" data-medal-id="${a.id}">${featured?.id===a.id?'★ مدال منتخب':'☆ انتخاب به‌عنوان مدال منتخب'}</button>`:''}</div>`}).join('');
 const style=document.getElementById('realMedal207Style');if(style)style.remove();
 const st=document.createElement('style');st.id='realMedal207Style';st.textContent=`.medal-art{display:none!important}.medal-art-real{height:145px;display:grid;place-items:center;position:relative;margin:0 auto 8px;isolation:isolate}.real-medal-svg{width:128px;height:128px;display:block;overflow:visible;filter:drop-shadow(0 12px 16px rgba(0,0,0,.28));transition:transform .28s ease,filter .28s ease}.real-medal-icon{position:absolute;inset:0;display:grid;place-items:center;font-size:30px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55));z-index:3;pointer-events:none}.medal-card:hover .real-medal-svg{transform:translateY(-7px) scale(1.08) rotate(-2deg);filter:drop-shadow(0 18px 24px rgba(0,0,0,.34))}.medal-select-btn.selected{box-shadow:0 0 0 2px rgba(255,215,70,.55),0 8px 22px rgba(255,190,40,.2)}.medal-card.locked .real-medal-svg{filter:grayscale(1) brightness(.55) drop-shadow(0 5px 9px rgba(0,0,0,.2));opacity:.55}.medal-card.locked .real-medal-icon{filter:grayscale(1);opacity:.55}@media(max-width:600px){.medal-art-real{height:125px}.real-medal-svg{width:110px;height:110px}.real-medal-icon{font-size:26px}}`;document.head.appendChild(st);
 const uc=document.getElementById('unlockedMedalCount');if(uc)uc.textContent=fa(ach.filter(a=>a.unlocked).length)+' باز از '+fa(ach.length); renderDashboardIdentity();
}
function getCurrentMonthKey(d=new Date()){
 const x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`;
}
function getCurrentMonthDates(){
 const now=new Date();now.setHours(0,0,0,0);
 const y=now.getFullYear(),m=now.getMonth(),count=new Date(y,m+1,0).getDate();
 return Array.from({length:count},(_,i)=>{const d=new Date(y,m,i+1);return {key:isoLocal(d),label:String(i+1),date:d}});
}
function renderSubjectPerformanceChart(){
 const box=document.getElementById('subjectPerformanceChart');if(!box||!db)return;
 const currentSubjects=subjects();
 if(!currentSubjects.length){box.innerHTML='<div class="subject-performance-chart-empty">هنوز درسی برای نمایش وجود ندارد.</div>';return}
 const monthKey=getCurrentMonthKey(),monthDates=getCurrentMonthDates(),dateSet=new Set(monthDates.map(x=>x.key));
 const stats={};
 currentSubjects.forEach(s=>stats[s]={min:0,tests:0,days:new Set(),daily:{}});
 const add=(subject,min,tests,date)=>{
   const k=String(subject||'').trim();if(!stats[k]||!dateSet.has(date))return;
   const mm=Math.max(0,Number(min)||0),tt=Math.max(0,Number(tests)||0);
   stats[k].min+=mm;stats[k].tests+=tt;
   if(mm>0||tt>0)stats[k].days.add(date);
   if(!stats[k].daily[date])stats[k].daily[date]={min:0,tests:0};
   stats[k].daily[date].min+=mm;stats[k].daily[date].tests+=tt;
 };
 // جلسات ثبت‌شده منبع اصلی آمار واقعی هستند؛ این کار جلوی دوباره‌شماری را می‌گیرد.
 (db.sessions||[]).forEach(x=>add(x.subject,x.min,x.tests,x.date));
 // داده‌های قدیمی/بدون جلسه را فقط وقتی اضافه کن که جلسه مرتبط نداشته باشند.
 (db.testTasks||[]).forEach((x,i)=>{
   if(x.done&&!hasLinkedTestSession(x,i))add(x.subject,x.actualMin||0,x.actualCount||x.count||0,x.date);
 });
 const rows=currentSubjects.map((subject,i)=>({subject,...stats[subject],index:i}));
 rows.sort((a,b)=>b.min-a.min||b.tests-a.tests||a.index-b.index);
 const cards=rows.map((d,i)=>`<button type="button" class="subject-chart-card ${i===0?'selected':''}" onclick="selectSubjectChart(${i})" data-subject-chart-index="${i}"><span class="subject-chart-icon">📚</span><span class="subject-chart-name">${esc(d.subject)}</span><span class="subject-chart-mini">${fa(d.min)} دقیقه • ${fa(d.tests)} تست • ${fa(d.days.size)} روز فعال</span><span class="subject-chart-arrow">›</span></button>`).join('');
 const first=rows[0];
 const monthLabel=new Date().toLocaleDateString('fa-IR',{year:'numeric',month:'long'});
 const chartFor=(d)=>{
   const W=Math.max(760,monthDates.length*28),H=330,L=42,R=18,T=28,B=58,iw=W-L-R,ih=H-T-B;
   const maxMin=Math.max(30,...monthDates.map(day=>d.daily[day.key]?.min||0));
   const x=i=>L+(i+.5)*iw/monthDates.length;
   const y=v=>T+ih-(Math.min(maxMin,v)/maxMin)*ih;
   const grid=[0,.25,.5,.75,1].map(r=>{const yy=T+ih-r*ih,val=Math.round(maxMin*r);return `<line x1="${L}" x2="${W-R}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="currentColor" opacity=".08"/><text x="${L-8}" y="${(yy+4).toFixed(1)}" text-anchor="end" font-size="10" fill="currentColor" opacity=".5">${fa(val)}</text>`}).join('');
   const bars=monthDates.map((day,i)=>{const v=d.daily[day.key]||{min:0,tests:0},bh=v.min?Math.max(4,(v.min/maxMin)*ih):2,bw=Math.min(22,Math.max(10,iw/monthDates.length*.62)),xx=x(i)-bw/2,yy=T+ih-bh;return `<g><rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="5" fill="var(--accent)" opacity="${v.min?'.88':'.13'}"><title>${esc(d.subject)} • ${day.key} • ${fa(v.min)} دقیقه مطالعه • ${fa(v.tests)} تست</title></rect>${v.min?`<text x="${x(i).toFixed(1)}" y="${Math.max(15,yy-6).toFixed(1)}" text-anchor="middle" font-size="9" fill="currentColor">${fa(v.min)}</text>`:''}<text x="${x(i).toFixed(1)}" y="${H-31}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".68">${fa(day.label)}</text>${v.tests?`<text x="${x(i).toFixed(1)}" y="${H-13}" text-anchor="middle" font-size="8" fill="var(--accent2)" font-weight="800">${fa(v.tests)}</text>`:''}</g>`}).join('');
   return `<div class="subject-performance-month-head"><b>${esc(d.subject)}</b><span>${monthLabel} • ${fa(d.min)} دقیقه مطالعه • ${fa(d.tests)} تست • ${fa(d.days.size)} روز فعال</span></div><div class="subject-performance-chart-scroll"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="نمودار ماهانه ${esc(d.subject)}">${grid}${bars}</svg></div><div class="subject-chart-month-foot">هر ستون = مطالعه واقعی همان روز • عدد پایین ستون = تست‌های همان روز • ماه جاری: ${esc(monthKey)}</div>`;
 };
 box.innerHTML=`<div class="subject-chart-month-label">📅 ${monthLabel} <span>• ریست خودکار در شروع هر ماه</span></div><div class="subject-chart-subjects">${cards}</div><div id="subjectChartDetail" class="subject-chart-detail">${chartFor(first)}</div>`;
 window.__fpSubjectChartRows=rows;window.__fpSubjectChartRenderer=chartFor;
}

function selectSubjectChart(index){
 const rows=window.__fpSubjectChartRows||[];const d=rows[index];if(!d)return;
 document.querySelectorAll('.subject-chart-card').forEach((el,i)=>el.classList.toggle('selected',i===index));
 const detail=document.getElementById('subjectChartDetail'),renderer=window.__fpSubjectChartRenderer;
 if(detail&&renderer)detail.innerHTML=renderer(d);
}


function renderSubjectAnalytics(){
 const box=document.getElementById('subjectAnalytics');if(!box||!db)return;
 const currentSubjects=subjects();
 if(!currentSubjects.length){box.innerHTML='<div class="analytics-empty" style="grid-column:1/-1">هنوز درسی برای نمایش وجود ندارد. از بخش افزودن درس، درس جدید اضافه کن. 📚</div>';return}
 // منبع آمار واقعی دقیقاً همان داده‌ای است که «نمودار درس‌ها» استفاده می‌کند.
 // بنابراین هر تغییر در مطالعه/تست/روز فعال در نمودار، اینجا هم بلافاصله منعکس می‌شود.
 renderSubjectPerformanceChart();
 const chartRows=window.__fpSubjectChartRows||[];
 const chartMap={};chartRows.forEach(x=>{chartMap[String(x.subject)]=x});
 const monthDates=getCurrentMonthDates(),monthSet=new Set(monthDates.map(x=>x.key));
 const stats={};
 currentSubjects.forEach(subject=>{
   const src=chartMap[String(subject)]||{min:0,tests:0,days:new Set(),daily:{}};
   stats[subject]={actual:Math.max(0,+src.min||0),tests:Math.max(0,+src.tests||0),days:src.days instanceof Set?src.days:new Set(),sessions:0,planned:0,daily:src.daily||{}};
 });
 // فقط زمان برنامه‌ریزی‌شده از برنامه‌ها می‌آید؛ زمان واقعی/تست از همان منبع نمودار گرفته شده است.
 (db.plans||[]).forEach(x=>{
   if(!monthSet.has(x.date))return;
   const v=stats[String(x.subject||'').trim()];if(!v)return;
   v.planned+=Math.max(0,+x.min||0);
 });
 // تعداد ثبت‌ها برای جزئیات است و با همان منطق بدون دوباره‌شماری محاسبه می‌شود.
 (db.sessions||[]).forEach(x=>{
   if(monthSet.has(x.date)&&stats[String(x.subject||'').trim()]) stats[String(x.subject||'').trim()].sessions++;
 });
 (db.testTasks||[]).forEach((x,i)=>{
   if(monthSet.has(x.date)&&x.done&&!hasLinkedTestSession(x,i)&&stats[String(x.subject||'').trim()]) stats[String(x.subject||'').trim()].sessions++;
 });
 const rows=currentSubjects.map(subject=>[subject,stats[subject]]);
 const totalActual=rows.reduce((a,[,v])=>a+v.actual,0),maxActual=Math.max(1,...rows.map(([,v])=>v.actual));
 const fmtTime=m=>`${fa(Math.floor(m/60))}:${fa(String(Math.round(m%60)).padStart(2,'0'))}`;
 const chartFor=(subject,v)=>{
   const days=monthDates.map(item=>{const k=item.key;const d=v.daily[k]||{min:0,tests:0};let planned=0;
     (db.plans||[]).forEach(x=>{if(x.date===k&&String(x.subject||'')===String(subject)){planned+=Math.max(0,+x.min||0)}});
     return {k,actual:Math.max(0,+d.min||0),planned,tests:Math.max(0,+d.tests||0),label:item.label};
   });
   const max=Math.max(60,...days.map(d=>Math.max(d.actual,d.planned,d.tests*3)));
   const W=760,H=260,L=46,R=16,T=20,B=38,iw=W-L-R,ih=H-T-B;
   const x=i=>L+i*iw/13,y=n=>T+ih-(Math.min(max,n)/max)*ih;
   const actualPts=days.map((d,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(d.actual).toFixed(1)}`).join(' ');
   const plannedPts=days.map((d,i)=>`${i?'L':'M'}${x(i).toFixed(1)} ${y(d.planned).toFixed(1)}`).join(' ');
   const bars=days.map((d,i)=>{const bh=Math.max(2,(d.tests*3/max)*ih);return `<rect x="${(x(i)-7).toFixed(1)}" y="${(T+ih-bh).toFixed(1)}" width="10" height="${bh.toFixed(1)}" rx="4" fill="var(--accent2)" opacity=".68"><title>${d.k} • ${fa(d.tests)} تست</title></rect>`}).join('');
   const dots=days.map((d,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(d.actual).toFixed(1)}" r="4" fill="var(--accent)"><title>${d.k} • مطالعه واقعی: ${fa(d.actual)} دقیقه</title></circle>`).join('');
   const labels=days.map((d,i)=>`<text x="${x(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="10" fill="currentColor" opacity=".62">${fa(d.label)}</text>`).join('');
   const grid=[0,.25,.5,.75,1].map(r=>{const yy=T+ih-r*ih;return `<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="currentColor" opacity=".08"/><text x="${L-8}" y="${yy+4}" text-anchor="end" font-size="9" fill="currentColor" opacity=".45">${fa(Math.round(max*r))}</text>`}).join('');
   return `<div class="subject-chart-panel"><div class="subject-chart-legend"><span>━ مطالعه واقعی</span><span>┄ برنامه‌ریزی‌شده</span><span>▮ تست</span></div><div class="subject-chart-wrap"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="نمودار ماهانه ${esc(subject)}">${grid}<path d="${plannedPts}" fill="none" stroke="currentColor" opacity=".28" stroke-width="2" stroke-dasharray="7 6"/><path d="${actualPts}" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>${bars}${dots}${labels}</svg></div><div class="subject-chart-foot">ماه جاری • خط پیوسته = مطالعه واقعی • خط‌چین = برنامه • ستون = تعداد تست</div></div>`;
 };
 box.innerHTML=rows.map(([subject,v],idx)=>{
   const share=totalActual?Math.round(v.actual/totalActual*100):0;
   const completion=v.planned?Math.min(100,Math.round(v.actual/v.planned*100)):0;
   const avg=v.tests?(v.actual/v.tests):0;
   const sid='subjectChart_'+idx;
   return `<div class="subject-analysis-card"><button type="button" class="subject-analysis-toggle" aria-expanded="false" onclick="toggleSubjectChart('${sid}',this)"><span class="subject-analysis-head"><b>📘 ${esc(subject)}</b><span class="muted">${fa(share)}٪ از مطالعه کل</span></span><span class="subject-analysis-arrow">⌄</span></button><div class="pro-bar"><i style="width:${Math.min(100,Math.round(v.actual/maxActual*100))}%"></i></div><div class="subject-analysis-stats"><div><span>مطالعه واقعی</span><b>${fmtTime(v.actual)}</b></div><div><span>زمان برنامه</span><b>${fmtTime(v.planned)}</b></div><div><span>تست</span><b>${fa(v.tests)}</b></div><div><span>تحقق برنامه</span><b>${v.planned?fa(completion)+'٪':'—'}</b></div></div><div id="${sid}" class="subject-chart-collapsible" hidden><div class="subject-detail-grid"><div><span>روزهای فعال</span><b>${fa(v.days.size)}</b></div><div><span>تعداد ثبت‌ها</span><b>${fa(v.sessions)}</b></div><div><span>میانگین دقیقه برای هر تست</span><b>${v.tests?fa(avg.toFixed(1)):'—'}</b></div><div><span>سهم از کل مطالعه</span><b>${fa(share)}٪</b></div></div>${chartFor(subject,v)}</div></div>`;
 }).join('');
}

function toggleSubjectChart(id,btn){
 const panel=document.getElementById(id);if(!panel)return;
 const open=panel.hidden;panel.hidden=!open;btn.setAttribute('aria-expanded',open?'true':'false');
 const arrow=btn.querySelector('.subject-analysis-arrow');if(arrow)arrow.textContent=open?'⌃':'⌄';
}
function getActivityStreak(){if(!db)return 0;let c=0,d=new Date();d.setHours(0,0,0,0);for(let i=0;i<365;i++){let k=isoLocal(d),a=(db.sessions||[]).some(x=>x.date===k&&(+x.min||0)>0)||(db.plans||[]).some(x=>x.date===k&&x.done);if(!a)break;c++;d.setDate(d.getDate()-1)}return c}
function renderGamification(){if(!db)return;const t=today(),study=(db.sessions||[]).filter(x=>x.date===t).reduce((a,x)=>a+(+x.min||0),0),tests=(db.sessions||[]).filter(x=>x.date===t).reduce((a,x)=>a+(+x.tests||0),0),done=(db.plans||[]).filter(x=>x.date===t&&x.done).length;const m=[['📚','۶۰ دقیقه مطالعه',study>=60,40],['🎯','۲۰ تست',tests>=20,35],['✅','۲ برنامه کامل',done>=2,30]],box=document.getElementById('dailyMissions');if(box)box.innerHTML=m.map(x=>`<div class="mission-item"><div class="mission-main"><span>${x[0]}</span><span>${x[1]}</span></div><span class="mission-xp">${x[2]?'✓ انجام شد':'+'+fa(x[3])+' XP'}</span></div>`).join('');document.getElementById('gameStreak')?.replaceChildren(document.createTextNode(fa(getActivityStreak())));document.getElementById('gameXp')?.replaceChildren(document.createTextNode(fa(m.filter(x=>x[2]).reduce((a,x)=>a+x[3],0))));document.getElementById('gameMissionsDone')?.replaceChildren(document.createTextNode(fa(m.filter(x=>x[2]).length)+'/۳'))}
function renderWeakSubjects(){}
function renderPerformanceTrend(){if(typeof renderPerformanceCenter==='function')renderPerformanceCenter()}
function getTomorrowSuggestionData(){
 const names=subjects(), map={}; (db.sessions||[]).forEach(x=>{const k=String(x.subject||'');if(k)map[k]=(map[k]||0)+(+x.min||0)});
 let seed=+(db.settings.tomorrowSeed||0); const sorted=names.map(s=>({s,m:map[s]||0})).sort((a,b)=>a.m-b.m); if(sorted.length) for(let i=0;i<seed%Math.max(1,sorted.length);i++) sorted.push(sorted.shift());
 const r=sorted.slice(0,Math.min(4,sorted.length)); const each=Math.max(30,Math.round((+db.settings.goal||480)/Math.max(1,r.length)/15)*15); return r.map((x,i)=>({subject:x.s,min:each+(i%2?15:0),topic:'مطالعه پیشنهادی'}));
}
function renderTomorrowPlan(){const box=document.getElementById('tomorrowPlanSuggestion');if(!box||!db)return;const saved=Array.isArray(db.settings?.tomorrowSuggestion)&&db.settings.tomorrowSuggestion.length?db.settings.tomorrowSuggestion:null;const r=saved||getTomorrowSuggestionData();if(!r.length){box.innerHTML='<div class="empty">اول چند درس اضافه کن.</div>';return}box.innerHTML=r.map((x,i)=>`<div class="tomorrow-item tomorrow-edit-item"><select id="tomorrowSubject${i}">${subjects().map(s=>`<option value="${String(s).replaceAll('\"','&quot;')}" ${s===x.subject?'selected':''}>${s}</option>`).join('')}</select><input id="tomorrowMin${i}" type="number" min="15" step="15" value="${Math.max(15,+x.min||30)}"><span>دقیقه</span><input id="tomorrowTopic${i}" value="${String(x.topic||'مطالعه پیشنهادی').replaceAll('\"','&quot;')}"><button class="btn secondary" type="button" onclick="removeTomorrowSuggestion(${i})">حذف</button></div>`).join('')+`<div class="row" style="margin-top:12px"><button class="btn" type="button" onclick="saveTomorrowSuggestion()">💾 ذخیره تغییرات</button><button class="btn secondary" type="button" onclick="addTomorrowPlansToSchedule()">➕ افزودن به برنامه فردا</button></div>`}
function removeTomorrowSuggestion(i){const row=document.getElementById('tomorrowSubject'+i)?.closest('.tomorrow-item');row?.remove()}
function saveTomorrowSuggestion(silent=false){if(!db)return;const rows=[...document.querySelectorAll('#tomorrowPlanSuggestion .tomorrow-edit-item')].map(row=>({subject:row.querySelector('select')?.value?.trim()||'',min:Math.max(15,+row.querySelector('input[type=number]')?.value||30),topic:row.querySelector('input:not([type=number])')?.value?.trim()||'مطالعه پیشنهادی'})).filter(x=>x.subject);db.settings.tomorrowSuggestion=rows;persist();if(!silent)alert('تغییرات پیشنهاد فردا ذخیره شد. ✅')}
function addTomorrowPlansToSchedule(){if(!db)return;saveTomorrowSuggestion(true);const rows=Array.isArray(db.settings.tomorrowSuggestion)?db.settings.tomorrowSuggestion:[];if(!rows.length){alert('اول حداقل یک درس به پیشنهاد فردا اضافه کن.');return}const d=new Date();d.setDate(d.getDate()+1);const date=isoLocal(d);const stamp=Date.now();rows.forEach((x,i)=>db.plans.push({id:`plan_${stamp}_${i}_${Math.random().toString(36).slice(2,7)}`,date,subject:String(x.subject||''),topic:String(x.topic||'مطالعه پیشنهادی'),min:Math.max(15,+x.min||30),done:false,important:false}));db.settings.tomorrowSuggestion=null;persist();alert('پیشنهادهای فردا مستقیم به برنامه فردا اضافه شدند. 📅✅')}
function addManualTomorrowSuggestion(){if(!db)return;const subject=document.getElementById('tomorrowManualSubject')?.value.trim()||'';const min=Math.max(1,+document.getElementById('tomorrowManualMinutes')?.value||0);const topic=document.getElementById('tomorrowManualTopic')?.value.trim()||'مطالعه پیشنهادی';if(!subject||!min){alert('نام درس و مدت زمان را وارد کن.');return}db.settings.tomorrowSuggestion=Array.isArray(db.settings.tomorrowSuggestion)?db.settings.tomorrowSuggestion:[];db.settings.tomorrowSuggestion.push({subject,min:Math.max(15,Math.round(min/15)*15),topic});persist();['tomorrowManualSubject','tomorrowManualMinutes','tomorrowManualTopic'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});renderTomorrowPlan();alert('درس به پیشنهاد برنامه فردا اضافه شد. ✅')}
function refreshTomorrowPlan(){if(!db)return;db.settings.tomorrowSeed=(+(db.settings.tomorrowSeed||0)+1);db.settings.tomorrowSuggestion=null;localStorage.setItem(DBKEY,JSON.stringify(db));renderTomorrowPlan();}

function parseTags(v){return [...new Set(String(v||'').split(/[,،]/).map(x=>x.trim()).filter(Boolean))].slice(0,8)}
function tagsHtml(tags){const a=Array.isArray(tags)?tags:parseTags(tags);return a.length?'<div class="fp-tags">'+a.map(t=>`<span class="fp-tag">#${esc(t)}</span>`).join('')+'</div>':''}
function getDashboardOrder(date){const o=db?.settings?.dashboardPlanOrder?.[date];return Array.isArray(o)?o:[]}
function orderDashboardPlans(list,date){const order=getDashboardOrder(date),rank=new Map(order.map((id,i)=>[String(id),i]));return list.slice().sort((a,b)=>{const ra=rank.has(String(a.id))?rank.get(String(a.id)):999999,rb=rank.has(String(b.id))?rank.get(String(b.id)):999999;return ra-rb})}
function getDashboardTestOrder(date){const o=db?.settings?.dashboardTestOrder?.[date];return Array.isArray(o)?o:[]}
function orderDashboardTests(list,date){const order=getDashboardTestOrder(date),rank=new Map(order.map((id,i)=>[String(id),i]));return list.slice().sort((a,b)=>{const ra=rank.has(String(a.id))?rank.get(String(a.id)):999999,rb=rank.has(String(b.id))?rank.get(String(b.id)):999999;return ra-rb})}
let fpDashboardManualOrder=false,fpDashboardTestManualOrder=false,fpDraggedPlanId=null,fpDraggedTestId=null;
function toggleDashboardTomorrowManualOrder(){fpDashboardManualOrder=!fpDashboardManualOrder;render();}
function toggleDashboardManualOrder(){fpDashboardManualOrder=!fpDashboardManualOrder;const h=document.getElementById('dashboardOrderHint');if(h)h.textContent=fpDashboardManualOrder?'حالت چینش دستی فعال است؛ کارت‌ها را بکش و بین کارت‌ها رها کن. ترتیب خودکار ذخیره می‌شود.':'چینش دستی خاموش شد. ترتیب ذخیره‌شده همچنان باقی می‌ماند.';render();}
function toggleDashboardTestManualOrder(){fpDashboardTestManualOrder=!fpDashboardTestManualOrder;const h=document.getElementById('dashboardTestOrderHint');if(h)h.textContent=fpDashboardTestManualOrder?'حالت چینش دستی تست‌ها فعال است؛ از دکمه‌های ↑ و ↓ یا کشیدن کارت استفاده کن.':'چینش دستی تست‌ها خاموش شد. ترتیب ذخیره‌شده همچنان باقی می‌ماند.';render();}
function moveDashboardTestOrder(id,delta){
 const date=today(), list=(db.testTasks||[]).filter(x=>x.date===date), ids=orderDashboardTests(list,date).map(x=>String(x.id));
 const at=ids.indexOf(String(id)); if(at<0)return; const to=at+delta; if(to<0||to>=ids.length)return;
 const tmp=ids[at];ids[at]=ids[to];ids[to]=tmp; db.settings=db.settings||{}; db.settings.dashboardTestOrder=db.settings.dashboardTestOrder||{}; db.settings.dashboardTestOrder[date]=ids; persist(); render();
}

function bindDashboardPlanDrag(){const box=document.getElementById('subjectCards');if(box&&fpDashboardManualOrder)box.querySelectorAll('.plan-card[data-plan-id]').forEach(card=>{card.draggable=true;card.addEventListener('dragstart',e=>{fpDraggedPlanId=card.dataset.planId;card.classList.add('fp-dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',fpDraggedPlanId)});card.addEventListener('dragend',()=>{card.classList.remove('fp-dragging');box.querySelectorAll('.fp-drag-over').forEach(x=>x.classList.remove('fp-drag-over'));fpDraggedPlanId=null});card.addEventListener('dragover',e=>{if(!fpDraggedPlanId||card.dataset.planId===fpDraggedPlanId)return;e.preventDefault();card.classList.add('fp-drag-over')});card.addEventListener('dragleave',()=>card.classList.remove('fp-drag-over'));card.addEventListener('drop',e=>{e.preventDefault();card.classList.remove('fp-drag-over');if(!fpDraggedPlanId||card.dataset.planId===fpDraggedPlanId)return;const ids=[...box.querySelectorAll('.plan-card[data-plan-id]')].map(x=>x.dataset.planId),from=ids.indexOf(fpDraggedPlanId),to=ids.indexOf(card.dataset.planId);if(from<0||to<0)return;ids.splice(from,1);ids.splice(to,0,fpDraggedPlanId);db.settings=db.settings||{};db.settings.dashboardPlanOrder=db.settings.dashboardPlanOrder||{};const tomorrowDate=isoLocal(new Date(Date.now()+86400000));db.settings.dashboardPlanOrder[tomorrowDate]=ids;persist();render()})});const tbox=document.getElementById('dashboardTests');if(tbox&&fpDashboardTestManualOrder)tbox.querySelectorAll('.plan-card[data-test-id]').forEach(card=>{card.draggable=true;card.addEventListener('dragstart',e=>{fpDraggedTestId=card.dataset.testId;card.classList.add('fp-dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',fpDraggedTestId)});card.addEventListener('dragend',()=>{card.classList.remove('fp-dragging');tbox.querySelectorAll('.fp-drag-over').forEach(x=>x.classList.remove('fp-drag-over'));fpDraggedTestId=null});card.addEventListener('dragover',e=>{if(!fpDraggedTestId||card.dataset.testId===fpDraggedTestId)return;e.preventDefault();card.classList.add('fp-drag-over')});card.addEventListener('dragleave',()=>card.classList.remove('fp-drag-over'));card.addEventListener('drop',e=>{e.preventDefault();card.classList.remove('fp-drag-over');if(!fpDraggedTestId||card.dataset.testId===fpDraggedTestId)return;const ids=[...tbox.querySelectorAll('.plan-card[data-test-id]')].map(x=>x.dataset.testId),from=ids.indexOf(fpDraggedTestId),to=ids.indexOf(card.dataset.testId);if(from<0||to<0)return;ids.splice(from,1);ids.splice(to,0,fpDraggedTestId);db.settings=db.settings||{};db.settings.dashboardTestOrder=db.settings.dashboardTestOrder||{};db.settings.dashboardTestOrder[today()]=ids;persist();render()})})}

function persistSchoolWeeklyTable(data){
  if(!db)return false;
  db.settings=db.settings||{};
  const clean=Array.from({length:4},(_,r)=>Array.from({length:5},(_,c)=>String(data?.[r]?.[c]??'').trim()));
  db.settings.schoolWeeklyTable=clean;
  delete db.settings.schoolWeeklySchedule;
  try{
    // ابتدا در فضای مستقل جدول ذخیره می‌کنیم؛ سپس نسخه اصلی DB را به‌روز می‌کنیم.
    const payload=JSON.stringify(clean);
    localStorage.setItem(SCHOOL_TABLE_BACKUP_KEY,payload);
    localStorage.setItem(SCHOOL_TABLE_STORAGE_KEY,payload);
    localStorage.setItem(DBKEY,JSON.stringify(db));
    return true;
  }catch(e){console.error('FocusPlan school weekly storage error:',e);return false}
}
function ensureSchoolWeeklyTable(){
 if(!db)return [];
 db.settings=db.settings||{};
 // اگر نسخه مستقل وجود دارد، همیشه آن را مرجع اصلی قرار بده تا رفرش داده‌ها را خالی نکند.
 const stored=readStoredSchoolWeeklyTable();
 let cur=stored|| (Array.isArray(db.settings.schoolWeeklyTable)?db.settings.schoolWeeklyTable:null);
 if(!Array.isArray(cur))cur=[];
 const rows=cur.slice(0,4).map(row=>Array.from({length:5},(_,i)=>String(Array.isArray(row)?(row[i]??''):'')).slice(0,5));
 while(rows.length<4)rows.push(Array(5).fill(''));
 db.settings.schoolWeeklyTable=rows;
 delete db.settings.schoolWeeklySchedule;
 return rows;
}
function getSchoolTodayIndex(){const d=new Date().getDay();const i=(d+1)%7;return i<5?i:-1;}
function renderSchoolDashboard(){const box=document.getElementById('schoolDashboardList'),dayBox=document.getElementById('schoolDashboardDay');if(!box||!db)return;const data=ensureSchoolWeeklyTable();const now=new Date();now.setHours(0,0,0,0);now.setDate(now.getDate()+1);const raw=now.getDay();const di=(raw+1)%7;const day=(di>=0&&di<5)?SCHOOL_WEEK_DAYS[di]:null;const rows=day?(data||[]).map((r,i)=>({subject:String(r?.[di]||'').trim(),period:i+1})).filter(x=>x.subject):[];if(dayBox)dayBox.textContent=day?`${day} • برنامه فردای مدرسه`:'فردا برنامه مدرسه ثبت نشده است';box.innerHTML=rows.length?rows.map(x=>`<div class="school-dashboard-item"><span class="school-dashboard-period">زنگ ${fa(x.period)}</span><b>📚 ${esc(x.subject)}</b></div>`).join(''):'<div class="school-dashboard-empty">برای فردا هنوز در جدول برنامه‌ای وارد نشده است.</div>';}
function renderSchoolWeeklyTable(){
 if(!db)return;
 const bodies=[document.getElementById('schoolWeeklyTableBody')].filter(Boolean);
 if(!bodies.length)return;
 const data=ensureSchoolWeeklyTable();
 const html=data.map((row,ri)=>`<tr><td class="fp-school-period-cell">زنگ ${fa(ri+1)}</td>${SCHOOL_WEEK_DAYS.map((day,di)=>{const val=String(row[di]||'').trim();return `<td class="fp-school-editable" role="button" tabindex="0" data-school-table-row="${ri}" data-school-table-day="${di}" aria-label="${esc(day)}، زنگ ${fa(ri+1)}، ${esc(val||'خالی')}" onclick="openSchoolCell(${ri},${di})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openSchoolCell(${ri},${di})}"><div class="fp-school-cell-value ${val?'':'empty'}">${val?esc(val):'＋ برای ثبت درس'}</div></td>`}).join('')}</tr>`).join('');
 bodies.forEach(body=>body.innerHTML=html);
 renderSchoolDashboard();
}
function openSchoolCell(row,day){
 const modal=document.getElementById('schoolCellModal'),input=document.getElementById('schoolCellInput'),hint=document.getElementById('schoolCellModalHint');
 if(!modal||!input)return;
 window.fpSchoolCell={row,day};
 const data=ensureSchoolWeeklyTable(),value=String(data?.[row]?.[day]||'');
 document.getElementById('schoolCellModalTitle').textContent=value?'ویرایش درس':'ثبت درس در جدول';
 if(hint)hint.textContent=`${SCHOOL_WEEK_DAYS[day]} • زنگ ${fa(row+1)}`;
 input.value=value;modal.classList.add('show');modal.setAttribute('aria-hidden','false');
 setTimeout(()=>{input.focus();input.select()},40);
}
function closeSchoolCellModal(){
 const modal=document.getElementById('schoolCellModal');if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true')}window.fpSchoolCell=null;
}
function saveSchoolCell(){
 try{
   if(!window.fpSchoolCell)return;
   if(!db){alert('اطلاعات FocusPlan هنوز آماده نیست. دوباره تلاش کن.');return;}
   db.settings=db.settings||{};
   const {row,day}=window.fpSchoolCell;
   const input=document.getElementById('schoolCellInput');
   const value=String(input?.value||'').trim();
   const data=ensureSchoolWeeklyTable();
   if(!data[row])data[row]=Array(5).fill('');
   data[row][day]=value;
   db.settings.schoolWeeklyTable=data;
   persistSchoolWeeklyTable(data);
   closeSchoolCellModal();
   renderSchoolWeeklyTable();
   renderSchoolDashboard();
 }catch(e){
   console.error('FocusPlan school table save error:',e);
   alert('ذخیره خانه انجام نشد. دوباره امتحان کن.');
 }
}
function readSchoolWeeklyTable(){
 return ensureSchoolWeeklyTable().map(row=>Array.from({length:5},(_,i)=>String(row?.[i]||'').trim()));
}
function saveSchoolWeeklyTable(silent=false){
 if(!db)return;
 db.settings=db.settings||{};
 db.settings.schoolWeeklyTable=readSchoolWeeklyTable();
 persistSchoolWeeklyTable(db.settings.schoolWeeklyTable);
 renderSchoolWeeklyTable();renderSchoolDashboard();
 if(!silent)alert('برنامه هفتگی مدرسه ذخیره شد. 🏫✅');
}
function addSchoolWeeklyTableRow(){
 if(!db)return;
 const data=readSchoolWeeklyTable();data.push(Array(5).fill(''));
 db.settings.schoolWeeklyTable=data;persistSchoolWeeklyTable(data);renderSchoolWeeklyTable();renderSchoolDashboard();
}
function clearSchoolWeeklyTable(){
 if(!db||!confirm('کل برنامه هفتگی مدرسه پاک شود؟'))return;
 db.settings.schoolWeeklyTable=Array.from({length:SCHOOL_TABLE_DEFAULT_ROWS},()=>Array(5).fill(''));
 delete db.settings.schoolWeeklySchedule;
 localStorage.setItem(DBKEY,JSON.stringify(db));renderSchoolWeeklyTable();renderSchoolDashboard();
}

function render(){
 if(!db)return;
 try{ensureDataShape()}catch(e){console.warn('data shape:',e)}
 renderImportantPlans();
 renderPerformanceCenter();const t=today(),mins=db.sessions.filter(x=>x.date===t).reduce((a,x)=>a+x.min,0),tests=(db.sessions.filter(x=>x.date===t).reduce((a,x)=>a+(+x.tests||0),0)+(db.testTasks||[]).filter(x=>x.date===t&&x.done&&!hasLinkedTestSession(x,db.testTasks.indexOf(x))).reduce((a,x)=>a+(+x.actualCount||+x.count||0),0));const done=db.plans.filter(x=>x.date===t).length?Math.round(db.plans.filter(x=>x.date===t&&x.done).length/db.plans.filter(x=>x.date===t).length*100):0;
 dashHours.textContent=fa(Math.floor(mins/60))+':'+fa(String(mins%60).padStart(2,'0'));dashTests.textContent=fa(tests);dashDone.textContent=fa(done)+'٪';dashGoal.textContent=fa(Math.floor(db.settings.goal/60))+' ساعت';goalBar.style.width=Math.min(100,mins/db.settings.goal*100)+'%';goalText.textContent=fa(mins)+' دقیقه از '+fa(db.settings.goal)+' دقیقه';
 const tomorrowDateObj=new Date();tomorrowDateObj.setDate(tomorrowDateObj.getDate()+1);const tomorrowDate=isoLocal(tomorrowDateObj);const tomorrowPlans=orderDashboardPlans(db.plans.filter(x=>x.date===tomorrowDate),tomorrowDate); subjectCards.innerHTML=tomorrowPlans.length?tomorrowPlans.map(x=>{const i=db.plans.indexOf(x),st=getPlanTestStats(x),actual=x.done?(+x.actualMin||0):0;return `<div class="plan-card ${x.done?'plan-done':''}" data-plan-id="${esc(x.id||'')}"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h4 style="margin:0">📘 ${esc(x.subject)}${x.important?'<span class="important-inline">⭐</span>':''}</h4>${fpDashboardManualOrder?'<span class="fp-drag-handle" title="برای جابه‌جایی بکش">⋮⋮</span>':''}</div>${tagsHtml(x.tags)}<div class="plan-meta">${x.topic&&x.topic!=='مطالعه'?esc(x.topic)+' • ':''}${fa(x.min)} دقیقه برنامه</div><div class="plan-meta">📝 ${fa(st.count)} تست${st.minutes?` • ${fa(st.minutes)} دقیقه تست‌زنی`:''}${x.done?` • 📚 ${fa(actual)} دقیقه مطالعه واقعی`:''}</div><button class="plan-check ${x.done?'checked':''}" onclick="togglePlanDone(${i})">${x.done?'✓ انجام شد':'☐ انجام شد'}</button></div>`}).join(''):'<div class="empty" style="grid-column:1/-1">برای فردا هنوز برنامه‌ای ننوشته‌ای. از بخش «برنامه» درس‌هایت را اضافه کن.</div>';
 const dashboardTests=document.getElementById('dashboardTests');const todayTests=orderDashboardTests((db.testTasks||[]).filter(x=>x.date===t),t);if(dashboardTests)dashboardTests.innerHTML=todayTests.length?todayTests.map(x=>{const i=db.testTasks.indexOf(x);return `<div class="plan-card ${x.done?'plan-done':''}" data-test-id="${esc(x.id||'')}"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h4 style="margin:0">📝 ${esc(x.subject)}${x.important?'<span class="important-inline">⭐</span>':''}</h4>${fpDashboardTestManualOrder?'<span class="fp-drag-handle" title="برای جابه‌جایی بکش">⋮⋮</span><span class="fp-order-buttons"><button type="button" class="fp-order-btn" title="بالا" onclick="moveDashboardTestOrder('+JSON.stringify(String(x.id||''))+',-1);event.stopPropagation()">↑</button><button type="button" class="fp-order-btn" title="پایین" onclick="moveDashboardTestOrder('+JSON.stringify(String(x.id||''))+',1);event.stopPropagation()">↓</button></span>':''}</div>${tagsHtml(x.tags)}<div class="plan-meta">${esc(x.topic||'تست')} • ${fa(x.count)} تست</div><button class="plan-check ${x.done?'checked':''}" onclick="toggleTestDone(${i})">${x.done?'✓ انجام شد':'☐ انجام شد'}</button></div>`}).join(''):'<div class="empty" style="grid-column:1/-1">برای امروز هنوز تستی ثبت نکردی. از بخش «میزان تست» اضافه کن.</div>';
 bindDashboardPlanDrag();
 planList.innerHTML=db.plans.map((x,i)=>{const st=getPlanTestStats(x),actual=x.done?(+x.actualMin||0):0;return `<tr><td><span class="schedule-date-pill">${formatScheduleDate(x.date)}</span></td><td><b>📘 ${x.subject}</b>${tagsHtml(x.tags)}</td><td>${esc(x.topic||'مطالعه')}</td><td>${fa(x.min)} دقیقه</td><td>${fa(st.count)} تست${st.minutes?`<br><small class="muted">${fa(st.minutes)} دقیقه تست‌زنی</small>`:''}</td><td>${x.done?fa(actual)+' دقیقه':'—'}</td><td><button class="important-star-btn ${x.important?'':'off'}" title="${x.important?'برداشتن از برنامه‌های مهم':'علامت‌گذاری به‌عنوان مهم'}" onclick="toggleImportantPlan(${i})">⭐</button><button class="btn ${x.done?'':'secondary'}" onclick="togglePlanDone(${i})">${x.done?'✓ انجام شد':'☐ انجام نشده'}</button> <button class="btn secondary" onclick="startEditPlan(${i})">ویرایش</button> <button class="btn danger" onclick="delPlan(${i})">حذف</button></td></tr>`}).join('')||`<tr><td colspan="7" class="empty">هنوز برنامه‌ای ثبت نشده.</td></tr>`;
 const testRows=(db.testTasks||[]).map((x,i)=>({x,i})).sort((a,b)=>String(b.x.date||'').localeCompare(String(a.x.date||''))||Number(a.x.done)-Number(b.x.done)||String(a.x.subject||'').localeCompare(String(b.x.subject||''),'fa')).map(({x,i})=>`<tr class="test-row ${x.done?'test-row-done':''}"><td><span class="schedule-date-pill">${formatScheduleDate(x.date)}</span></td><td><b>📘 ${x.subject}</b>${tagsHtml(x.tags)}</td><td>${esc(x.topic||'تست')}</td><td><span class="test-count-badge">${fa(x.count)} تست</span></td><td>${x.done?`<b class="actual-tests">${fa(x.actualCount||x.count)} تست</b>${x.actualMin?`<small class="muted test-min"> • ${fa(x.actualMin)} دقیقه</small>`:'<small class="muted test-min"> • بدون زمان</small>'}`:'<span class="muted">—</span>'}</td><td><button class="important-star-btn ${x.important?'':'off'}" title="${x.important?'برداشتن از تست‌های مهم':'علامت‌گذاری به‌عنوان تست مهم'}" onclick="toggleImportantTest(${i})">⭐</button><button class="test-status-btn ${x.done?'is-done':'is-pending'}" onclick="toggleTestDone(${i})">${x.done?'✓ انجام شد':'☐ انجام نشده'}</button></td><td><button class="btn secondary test-edit" onclick="startEditTest(${i})">ویرایش</button><button class="btn danger test-delete" onclick="delTestTask(${i})">حذف</button></td></tr>`).join(''); testList.innerHTML=testRows||'<tr><td colspan="7" class="empty">هنوز تستی ثبت نکردی. از فرم بالا اولین تستت را اضافه کن. 🚀</td></tr>';
 let total=db.sessions.reduce((a,x)=>a+x.min,0),tt=db.sessions.reduce((a,x)=>a+(+x.tests||0),0)+(db.testTasks||[]).filter(x=>x.done&&!hasLinkedTestSession(x,db.testTasks.indexOf(x))).reduce((a,x)=>a+(+x.actualCount||+x.count||0),0),days=new Set(db.sessions.map(x=>x.date)).size;totalHours.textContent=fa((total/60).toFixed(1));totalTests.textContent=fa(tt);avgHours.textContent=fa(days?(total/60/days).toFixed(1):0);totalDone.textContent=fa(done)+'٪';
 sessions.innerHTML=db.sessions.slice().reverse().map(x=>`<div class="task"><b>${x.subject}</b> — ${fa(x.min)} دقیقه — ${fa(x.tests)} تست — ${fa(x.percent)}٪ <span class="muted">${formatScheduleDate(x.date)}</span></div>`).join('')||'<div class="empty">هنوز جلسه‌ای ثبت نشده.</div>';
 renderWeek();

 renderSchoolWeeklyTable();
 renderProDashboard();
 renderUserLevel();
 renderDashboardIdentity();

 renderWeakSubjects();
 renderPerformanceTrend();
 renderTomorrowPlan();
 renderSubjectPerformanceChart();
 renderSubjectAnalytics();
 updatePdfWeekCountdown();
}
function getWeekDates(){const start=getCurrentWeekStartDate();return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return isoLocal(d)})}
let activeWeekKey=getCurrentWeekKey();
let activeChartMonthKey=getCurrentMonthKey();
function getNextWeekStart(){const d=new Date();d.setHours(0,0,0,0);const day=d.getDay();const daysUntilSaturday=(6-day+7)%7;d.setDate(d.getDate()+daysUntilSaturday);if(day===6 && (Date.now()-d.getTime())>=0){d.setDate(d.getDate()+7)}return d;}
function formatCountdown(ms){const total=Math.max(0,Math.floor(ms/1000));const days=Math.floor(total/86400);const hours=Math.floor(total%86400/3600);const mins=Math.floor(total%3600/60);const secs=total%60;const f=n=>String(n).padStart(2,'0');return `${days>0?days+' روز و ':''}${f(hours)}:${f(mins)}:${f(secs)}`;}
function updatePdfWeekCountdown(){
 const value=document.getElementById('pdfCountdownValue'),target=document.getElementById('pdfCountdownTarget');if(!value)return;
 const now=new Date(),next=getNextWeekStart(),remaining=next-now;
 if(remaining<=0){value.textContent='در حال شروع هفته جدید...';return;}
 value.textContent=formatCountdown(remaining);
 if(target)target.textContent=`ریست خودکار در ${next.toLocaleDateString('fa-IR')} ساعت ۰۰:۰۰`;
}
function weekDatesFromKey(weekStartKey){const start=new Date(weekStartKey+'T12:00:00');return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return isoLocal(d)})}
function archiveWeekExists(weekStartKey){return Array.isArray(db?.pdfArchives)&&(db.pdfArchives.some(x=>x.weekStart===weekStartKey));}
function buildPdfArchive(weekStartKey){
 if(!db||!weekStartKey||weekStartKey===getCurrentWeekKey()||archiveWeekExists(weekStartKey))return false;
 const previous= document.getElementById('weeklyReportPreview')?.innerHTML||'';
 try{
   renderWeeklyReport(weekStartKey);
   const sheet=document.getElementById('pdfSheet');
   if(!sheet)return false;
   db.pdfArchives=Array.isArray(db.pdfArchives)?db.pdfArchives:[];
   db.pdfArchives.push({weekStart:weekStartKey,createdAt:Date.now(),html:sheet.outerHTML});
   db.pdfArchives.sort((a,b)=>String(b.weekStart).localeCompare(String(a.weekStart)));
   localStorage.setItem(DBKEY,JSON.stringify(db));
   return true;
 }finally{
   if(previous){const box=document.getElementById('weeklyReportPreview');if(box)box.innerHTML=previous;} else renderWeeklyReport();
 }
}
function clearFinishedWeeksActiveData(){
 if(!db)return false;
 const current=getCurrentWeekKey();
 const beforePlans=(db.plans||[]).length, beforeTasks=(db.tasks||[]).length, beforeTests=(db.testTasks||[]).length;
 // با شروع هفته جدید، برنامه‌ها و رکوردهای تست هفته‌های قبلی از بخش‌های فعال پاک می‌شوند.
 // جلسات مطالعه عمداً نگه داشته می‌شوند تا آمار و گزارش‌های تاریخی آسیب نبینند.
 db.plans=(db.plans||[]).filter(x=>!x?.date||x.date>=current);
 db.tasks=(db.tasks||[]).filter(x=>!x?.date||x.date>=current);
 db.testTasks=(db.testTasks||[]).filter(x=>!x?.date||x.date>=current);
 return beforePlans!==db.plans.length||beforeTasks!==db.tasks.length||beforeTests!==db.testTasks.length;
}
function ensurePdfArchives(){
 if(!db)return;
 db.pdfArchives=Array.isArray(db.pdfArchives)?db.pdfArchives:[];
 const current=getCurrentWeekKey();
 const dates=[];
 [...(db.plans||[]),...(db.sessions||[]),...(db.testTasks||[])].forEach(x=>{if(x?.date&&x.date<current)dates.push(x.date)});
 const weekKeys=[...new Set(dates.map(d=>{const dt=new Date(d+'T12:00:00');dt.setDate(dt.getDate()-((dt.getDay()+1)%7));return isoLocal(dt)}))].sort();
 let changed=false;
 weekKeys.forEach(k=>{if(!archiveWeekExists(k)){if(buildPdfArchive(k))changed=true;}});
 if(clearFinishedWeeksActiveData())changed=true;
 if(changed)localStorage.setItem(DBKEY,JSON.stringify(db));
 renderPdfArchives();
}
function rolloverWeeklyPDFIfNeeded(){
 if(!db)return;const key=getCurrentWeekKey();
 if(key!==activeWeekKey){
   const oldKey=activeWeekKey;
   // اول گزارش هفته قبل ذخیره می‌شود، سپس برنامه‌ها و تست‌های آن هفته پاک می‌شوند.
   buildPdfArchive(oldKey);
   clearFinishedWeeksActiveData();
   activeWeekKey=key;
   localStorage.setItem(DBKEY,JSON.stringify(db));
   renderWeek();renderWeeklyReport();renderPdfArchives();updatePdfWeekCountdown();
 }
}
setInterval(rolloverWeeklyPDFIfNeeded,15000);
setInterval(rolloverMonthlySubjectChartsIfNeeded,15000);
setInterval(updatePdfWeekCountdown,1000);

function getPersianYearMonthLabel(monthKey){
 const [gy,gm]=String(monthKey).split('-').map(Number);
 if(!Number.isFinite(gy)||!Number.isFinite(gm))return String(monthKey);
 // تاریخ ذخیره‌شده میلادی است؛ فقط نمایش آرشیو به تقویم شمسی تبدیل می‌شود.
 const d=new Date(gy,gm-1,15);
 const parts=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{year:'numeric',month:'long'}).formatToParts(d);
 const year=parts.find(x=>x.type==='year')?.value||'';
 const month=parts.find(x=>x.type==='month')?.value||'';
 return month&&year?`${month} ${year}`:d.toLocaleDateString('fa-IR-u-ca-persian',{year:'numeric',month:'long'});
}
function getMonthLabelFromKey(monthKey){return getPersianYearMonthLabel(monthKey)}
function monthDatesFromKey(monthKey){
 const [y,m]=String(monthKey).split('-').map(Number),count=new Date(y,m,0).getDate();
 return Array.from({length:count},(_,i)=>{const d=new Date(y,m-1,i+1);return {key:isoLocal(d),label:String(i+1)}});
}
function chartMonthKeyFromDate(date){return String(date||'').slice(0,7)}
function getSubjectChartArchiveMonths(){
 const current=getCurrentMonthKey(),set=new Set();
 (db?.sessions||[]).forEach(x=>{const k=chartMonthKeyFromDate(x.date);if(k&&k<current)set.add(k)});
 (db?.testTasks||[]).forEach(x=>{const k=chartMonthKeyFromDate(x.date);if(k&&k<current)set.add(k)});
 (db?.subjectChartArchives||[]).forEach(x=>{if(x?.month&&x.month<current)set.add(x.month)});
 return [...set].sort();
}
function buildSubjectChartArchive(monthKey){
 if(!db||!monthKey||monthKey===getCurrentMonthKey())return false;
 db.subjectChartArchives=Array.isArray(db.subjectChartArchives)?db.subjectChartArchives:[];
 if(db.subjectChartArchives.some(x=>x.month===monthKey))return false;
 const dates=monthDatesFromKey(monthKey),dateSet=new Set(dates.map(x=>x.key));
 const names=new Set(subjects());
 (db.sessions||[]).forEach(x=>{if(dateSet.has(x.date)&&x.subject)names.add(String(x.subject).trim())});
 (db.testTasks||[]).forEach(x=>{if(dateSet.has(x.date)&&x.subject)names.add(String(x.subject).trim())});
 const stats={};[...names].filter(Boolean).forEach(subject=>{stats[subject]={min:0,tests:0,days:new Set(),daily:{}}});
 const add=(subject,min,tests,date)=>{const k=String(subject||'').trim();if(!stats[k]||!dateSet.has(date))return;const mm=Math.max(0,Number(min)||0),tt=Math.max(0,Number(tests)||0);stats[k].min+=mm;stats[k].tests+=tt;if(mm>0||tt>0)stats[k].days.add(date);if(!stats[k].daily[date])stats[k].daily[date]={min:0,tests:0};stats[k].daily[date].min+=mm;stats[k].daily[date].tests+=tt};
 (db.sessions||[]).forEach(x=>add(x.subject,x.min,x.tests,x.date));
 (db.testTasks||[]).forEach((x,i)=>{if(x.done&&!hasLinkedTestSession(x,i))add(x.subject,x.actualMin||0,x.actualCount||x.count||0,x.date)});
 const subjectsData=Object.entries(stats).map(([subject,v])=>({subject,min:v.min,tests:v.tests,activeDays:v.days.size,daily:dates.map(d=>({date:d.key,label:d.label,min:v.daily[d.key]?.min||0,tests:v.daily[d.key]?.tests||0}))})).sort((a,b)=>b.min-a.min||b.tests-a.tests||a.subject.localeCompare(b.subject,'fa'));
 db.subjectChartArchives.push({month:monthKey,createdAt:Date.now(),subjects:subjectsData});
 db.subjectChartArchives.sort((a,b)=>String(b.month).localeCompare(String(a.month)));
 return true;
}
function ensureSubjectChartArchives(){
 if(!db)return;
 db.subjectChartArchives=Array.isArray(db.subjectChartArchives)?db.subjectChartArchives:[];
 let changed=false;
 // مهاجرت آرشیوهای قدیمی که کلید ماه ناقص/غلط داشته‌اند.
 const migrated=[];
 db.subjectChartArchives.forEach(a=>{
   if(!a||typeof a!=='object')return;
   let key=String(a.month||'');
   if(!/^\d{4}-\d{2}$/.test(key)){
     const t=Number(a.createdAt||0);
     if(t){const d=new Date(t);if(!Number.isNaN(d.getTime())) key=getCurrentMonthKey(d)}
   }
   if(!/^\d{4}-\d{2}$/.test(key))return;
   const copy={...a,month:key};
   const existing=migrated.findIndex(x=>x.month===key);
   if(existing<0)migrated.push(copy);
   else if((copy.subjects||[]).length>(migrated[existing].subjects||[]).length)migrated[existing]=copy;
   if(String(a.month||'')!==key)changed=true;
 });
 if(migrated.length!==db.subjectChartArchives.length){changed=true;db.subjectChartArchives=migrated;}

 getSubjectChartArchiveMonths().forEach(k=>{if(buildSubjectChartArchive(k))changed=true});
 if(changed)localStorage.setItem(DBKEY,JSON.stringify(db));
 renderChartArchives();
}
function rolloverMonthlySubjectChartsIfNeeded(){
 if(!db)return;const key=getCurrentMonthKey();
 if(key!==activeChartMonthKey){const old=activeChartMonthKey;buildSubjectChartArchive(old);activeChartMonthKey=key;localStorage.setItem(DBKEY,JSON.stringify(db));renderSubjectPerformanceChart();renderSubjectAnalytics();renderChartArchives();}
}
function chartArchiveSvg(subjectData){
 const days=subjectData.daily||[],W=Math.max(700,days.length*25),H=250,L=40,R=14,T=20,B=46,iw=W-L-R,ih=H-T-B,maxMin=Math.max(30,...days.map(d=>+d.min||0));
 const x=i=>L+(i+.5)*iw/days.length,y=v=>T+ih-(Math.min(maxMin,v)/maxMin)*ih;
 const grid=[0,.25,.5,.75,1].map(r=>{const yy=T+ih-r*ih,val=Math.round(maxMin*r);return `<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="currentColor" opacity=".08"/><text x="${L-7}" y="${yy+4}" text-anchor="end" font-size="9" fill="currentColor" opacity=".5">${fa(val)}</text>`}).join('');
 const bars=days.map((d,i)=>{const v=+d.min||0,bh=v?Math.max(4,v/maxMin*ih):2,bw=Math.min(21,Math.max(9,iw/days.length*.62)),xx=x(i)-bw/2,yy=T+ih-bh;return `<g><rect x="${xx.toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="5" fill="var(--accent)" opacity="${v?'.88':'.12'}"><title>${esc(subjectData.subject)} • روز ${fa(d.label)} • ${fa(v)} دقیقه • ${fa(d.tests)} تست</title></rect>${v?`<text x="${x(i).toFixed(1)}" y="${Math.max(14,yy-5)}" text-anchor="middle" font-size="8" fill="currentColor">${fa(v)}</text>`:''}<text x="${x(i).toFixed(1)}" y="${H-27}" text-anchor="middle" font-size="9" fill="currentColor" opacity=".68">${fa(d.label)}</text>${d.tests?`<text x="${x(i).toFixed(1)}" y="${H-10}" text-anchor="middle" font-size="8" fill="var(--accent2)" font-weight="800">${fa(d.tests)}</text>`:''}</g>`}).join('');
 return `<div class="chart-archive-chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="نمودار آرشیوی ${esc(subjectData.subject)}">${grid}${bars}</svg></div>`;
}
function renderChartArchives(){
 const box=document.getElementById('chartArchiveList');if(!box||!db)return;const list=(db.subjectChartArchives||[]).slice().sort((a,b)=>String(b.month).localeCompare(String(a.month)));
 if(!list.length){box.innerHTML='<div class="chart-archive-empty">هنوز ماهی برای آرشیو شدن وجود ندارد. با پایان اولین ماه، نمودارهای همان ماه اینجا ذخیره می‌شوند. 📊</div>';return;}
 box.innerHTML=list.map((a,i)=>`<article class="chart-archive-month"><div class="chart-archive-head"><div class="chart-archive-title"><div class="chart-archive-icon">📊</div><div><h3>نمودارهای ${getMonthLabelFromKey(a.month)}</h3><p>${fa((a.subjects||[]).length)} درس • آرشیو ماهانه</p></div></div><div class="chart-archive-actions"><button class="btn secondary" type="button" onclick="toggleChartArchive(${i})">👀 ${document.getElementById('chartArchiveBody_'+i)?'بستن':'مشاهده'}</button><button class="btn danger" type="button" onclick="deleteChartArchive(${i})">🗑️ حذف</button></div></div><div id="chartArchiveBody_${i}" class="chart-archive-subjects" style="display:none">${(a.subjects||[]).map(d=>`<div class="chart-archive-subject"><div class="chart-archive-subject-head"><b>📚 ${esc(d.subject)}</b><span>${fa(d.min)} دقیقه • ${fa(d.tests)} تست • ${fa(d.activeDays)} روز فعال</span></div>${chartArchiveSvg(d)}</div>`).join('')}</div></article>`).join('');
}
function toggleChartArchive(i){const a=(db?.subjectChartArchives||[]).slice().sort((x,y)=>String(y.month).localeCompare(String(x.month)))[i];if(!a)return;renderChartArchives();const body=document.getElementById('chartArchiveBody_'+i);if(body){body.style.display='block';}}
function deleteChartArchive(i){const list=(db?.subjectChartArchives||[]).slice().sort((a,b)=>String(b.month).localeCompare(String(a.month)));const a=list[i];if(!a)return;if(!confirm(`آرشیو نمودارهای ${getMonthLabelFromKey(a.month)} حذف شود؟`))return;const idx=db.subjectChartArchives.findIndex(x=>x.month===a.month);if(idx>=0)db.subjectChartArchives.splice(idx,1);localStorage.setItem(DBKEY,JSON.stringify(db));renderChartArchives();}
function switchArchivePanel(which){document.querySelectorAll('.archive-switch').forEach((b,i)=>b.classList.toggle('active',(which==='pdf'&&i===0)||(which==='charts'&&i===1)));document.getElementById('pdfArchivePanel')?.classList.toggle('active',which==='pdf');document.getElementById('chartArchivePanel')?.classList.toggle('active',which==='charts');if(which==='charts')ensureSubjectChartArchives();}
function formatArchiveWeek(weekStartKey){const ds=weekDatesFromKey(weekStartKey);const st=new Date(ds[0]+'T12:00:00'),en=new Date(ds[6]+'T12:00:00');return `شنبه ${st.toLocaleDateString('fa-IR')} تا جمعه ${en.toLocaleDateString('fa-IR')}`;}
function renderPdfArchives(){
 const box=document.getElementById('pdfArchiveList');if(!box||!db)return;
 const list=Array.isArray(db.pdfArchives)?db.pdfArchives:[];
 if(!list.length){box.innerHTML='<div class="archive-empty">هنوز هیچ هفته‌ای به پایان نرسیده یا آرشیوی ساخته نشده است. 📄</div>';return;}
 box.innerHTML=list.map((a,i)=>`<article class="archive-week"><div class="archive-week-head"><div class="archive-week-title"><div class="archive-week-icon">📄</div><div><h3>گزارش هفته ${fa(list.length-i)}</h3><p>${formatArchiveWeek(a.weekStart)}</p></div></div><div class="archive-actions"><button class="btn secondary" type="button" onclick="viewPdfArchive(${i})">👀 مشاهده</button><button class="btn" type="button" onclick="downloadPdfArchive(${i})">⬇️ دانلود PDF</button><button class="btn danger" type="button" onclick="deletePdfArchive(${i})">🗑️ حذف</button></div></div><div id="pdfArchivePreview_${i}" class="archive-preview" style="display:none"></div></article>`).join('');
}
function viewPdfArchive(i){const a=(db?.pdfArchives||[])[i];if(!a)return;const box=document.getElementById(`pdfArchivePreview_${i}`);if(!box)return;if(box.style.display==='none'){box.innerHTML=a.html;box.style.display='block';}else{box.style.display='none';box.innerHTML='';}}
async function downloadPdfArchive(i){const a=(db?.pdfArchives||[])[i];if(!a)return;if(typeof html2pdf==='undefined'){const w=window.open('','_blank');if(!w){alert('مرورگر اجازه باز کردن پنجره را نداد.');return;}w.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>FocusPlan Weekly Report</title>
<style id="focusplan-splash-v54-readable">
/* v54: clean readable title + real determinate loading bar */
#startupSplash .splash-title{position:relative!important;display:flex!important;justify-content:center!important;align-items:center!important;gap:12px!important;font-family:Arial,Helvetica,sans-serif!important;font-size:42px!important;font-weight:800!important;letter-spacing:1px!important;line-height:1.05!important;filter:none!important;text-shadow:none!important;background:transparent!important;box-shadow:none!important}
#startupSplash .splash-title::before{display:none!important;content:none!important}
#startupSplash .splash-title span,#startupSplash .splash-title em{display:inline-block!important;position:relative!important;background:none!important;background-image:none!important;background-size:auto!important;-webkit-background-clip:border-box!important;background-clip:border-box!important;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;text-shadow:0 2px 10px rgba(0,0,0,.35)!important;filter:none!important;animation:titleSimpleIn .65s ease-out both!important}
#startupSplash .splash-title em{color:#7ddcff!important;-webkit-text-fill-color:#7ddcff!important;animation-delay:.12s!important}
#startupSplash .splash-title span:after,#startupSplash .splash-title em:after{display:none!important;content:none!important}
#startupSplash .splash-loader{position:relative!important;width:260px!important;height:8px!important;margin:28px auto 0!important;border-radius:999px!important;background:rgba(255,255,255,.13)!important;overflow:hidden!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 4px 18px rgba(0,0,0,.22)!important}
#startupSplash .splash-loader span{display:block!important;width:0!important;height:100%!important;max-width:100%!important;border-radius:inherit!important;background:linear-gradient(90deg,#5edcff,#7182ff,#a86cff)!important;box-shadow:0 0 14px rgba(113,130,255,.7)!important;transform:none!important;animation:none!important;transition:width .08s linear!important}
#startupSplash .splash-loading-text{width:260px!important;margin:10px auto 0!important;color:#d4dcf2!important;opacity:1!important;font-family:Arial,Tahoma,sans-serif!important;font-size:12px!important}
#startupSplash .splash-loading-text b{color:#ffffff!important;font-size:12px!important}
#startupSplash .splash-status{color:#9eacd0!important}
@keyframes titleSimpleIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:520px){#startupSplash .splash-title{font-size:35px!important;gap:8px!important}#startupSplash .splash-loader,#startupSplash .splash-loading-text{width:210px!important}}
</style>
</head><body>${a.html}<script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script>
document.addEventListener('DOMContentLoaded',()=>{const e=document.getElementById('copyRepeatSourceDate');if(e&&!e.value)e.value=today()},{once:true});
<style id="fp-v202-level-achievements-link-css">
.fp-v202-level-panel,.fp-v202-featured-panel{padding:18px;border:1px solid var(--border);border-radius:20px;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 10%,var(--card2)),color-mix(in srgb,var(--accent2) 8%,var(--card2)));margin-bottom:16px;box-shadow:0 10px 28px color-mix(in srgb,var(--accent) 7%,transparent)}
.fp-v202-level-top,.fp-v202-featured-panel{display:flex;align-items:center;justify-content:space-between;gap:16px}.fp-v202-level-top h3,.fp-v202-featured-panel h4{margin:4px 0}.fp-v202-level-badge{width:68px;height:68px;border-radius:22px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:24px;font-weight:1000;box-shadow:0 10px 26px color-mix(in srgb,var(--accent) 22%,transparent)}
.fp-v202-featured-panel{justify-content:flex-start}.fp-v202-featured-icon{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:19px;font-weight:1000;flex:none}.medal-select-btn{margin-top:10px;width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:12px;background:var(--card2);color:var(--text);cursor:pointer;font:inherit;font-size:11px;font-weight:800}.medal-select-btn.selected{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 14%,transparent)}
@media(max-width:600px){.fp-v202-level-top,.fp-v202-featured-panel{align-items:flex-start}.fp-v202-level-badge{width:56px;height:56px;border-radius:18px}.fp-v202-featured-panel{flex-direction:row}}
</style>
<style id="fp-v202-card-spacing-fix">
/* V202 spacing refinement: keep every new card comfortably separated. */
.fp-v202-wrap{display:flex;flex-direction:column;gap:18px!important;}
.fp-v202-wrap>.card{margin:0!important;}
.fp-v202-grid{gap:16px!important;}
.fp-v202-ach-grid{gap:16px!important;}
.fp-v202-subject-grid{gap:16px!important;}
.fp-v202-form{gap:14px!important;}
.fp-v202-detail-grid{gap:12px!important;}
.fp-v202-notes-list{gap:12px!important;}
.fp-v202-note-item{margin:0!important;}
.fp-v202-actions{gap:10px!important;}
@media(max-width:600px){.fp-v202-wrap{gap:14px!important;}.fp-v202-grid,.fp-v202-ach-grid,.fp-v202-subject-grid{gap:14px!important;}}
</style>

<style id="fp-v205-medal-unique-appearance">
/* ===== v205: هر مدال ظاهر اختصاصی خودش را دارد ===== */
.medal-card{--m1:#7182ff;--m2:#a855f7;--ms:rgba(113,130,255,.22);padding:16px!important;background:linear-gradient(145deg,color-mix(in srgb,var(--m1) 10%,var(--card2)),color-mix(in srgb,var(--m2) 7%,var(--card2)))!important;border-color:color-mix(in srgb,var(--m1) 35%,var(--border))!important}
.medal-art{width:92px;height:92px;margin:2px auto 8px;position:relative;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 35% 28%,#fff8,var(--m1) 22%,var(--m2) 62%,#101526 100%);border:4px solid color-mix(in srgb,var(--m1) 65%,#fff);box-shadow:0 10px 30px var(--ms),inset 0 2px 10px #fff7,inset 0 -8px 18px #0005;transform:translateZ(0);transition:.25s}
.medal-art .ach-icon{font-size:39px!important;line-height:1;filter:drop-shadow(0 3px 4px #0006);z-index:3}
.medal-ring{position:absolute;border:2px solid color-mix(in srgb,var(--m1) 70%,#fff);border-radius:50%;opacity:.55}.medal-ring-a{inset:-9px}.medal-ring-b{inset:-15px;border-style:dashed;opacity:.28}.medal-shine{position:absolute;inset:7px;border-radius:50%;background:linear-gradient(125deg,#fff7,transparent 28%,transparent 70%,#fff2);pointer-events:none}
.medal-card:hover .medal-art{transform:translateY(-4px) rotate(-2deg) scale(1.04);box-shadow:0 16px 36px var(--ms),inset 0 2px 10px #fff8,inset 0 -8px 18px #0005}
.medal-card.unlocked .medal-art{animation:medalFloat205 3.8s ease-in-out infinite}
.medal-card.selected .medal-art{animation:medalPulse205 1.8s ease-in-out infinite}
@keyframes medalFloat205{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes medalPulse205{0%,100%{box-shadow:0 10px 30px var(--ms),inset 0 2px 10px #fff7,inset 0 -8px 18px #0005}50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--m1) 12%,transparent),0 18px 45px var(--ms),inset 0 2px 10px #fff8}}
.medal-ruby{--m1:#ff4d6d;--m2:#9b1c3b;--ms:rgba(255,77,109,.28)} .medal-leaf{--m1:#34d399;--m2:#047857;--ms:rgba(52,211,153,.25)} .medal-fire{--m1:#ff7a18;--m2:#d62828;--ms:rgba(255,122,24,.28)}
.medal-silver{--m1:#d7e1ee;--m2:#64748b;--ms:rgba(148,163,184,.3)} .medal-gold{--m1:#ffd166;--m2:#b7791f;--ms:rgba(255,209,102,.3)} .medal-diamond{--m1:#67e8f9;--m2:#2563eb;--ms:rgba(103,232,249,.3)}
.medal-crown,.medal-royal,.medal-queen{--m1:#f0abfc;--m2:#7e22ce;--ms:rgba(192,132,252,.32)} .medal-book{--m1:#fb7185;--m2:#7c3aed;--ms:rgba(251,113,133,.25)}
.medal-paper{--m1:#f8fafc;--m2:#64748b;--ms:rgba(203,213,225,.3)} .medal-target{--m1:#fb7185;--m2:#dc2626;--ms:rgba(248,113,113,.28)} .medal-rocket{--m1:#38bdf8;--m2:#4338ca;--ms:rgba(56,189,248,.28)}
.medal-bolt,.medal-inferno{--m1:#facc15;--m2:#ea580c;--ms:rgba(250,204,21,.3)} .medal-brain{--m1:#c084fc;--m2:#6d28d9;--ms:rgba(192,132,252,.3)} .medal-calendar,.medal-schedule{--m1:#60a5fa;--m2:#1d4ed8;--ms:rgba(96,165,250,.28)}
.medal-master,.medal-compass{--m1:#22d3ee;--m2:#0f766e;--ms:rgba(34,211,238,.28)} .medal-trophy,.medal-temple{--m1:#fbbf24;--m2:#92400e;--ms:rgba(251,191,36,.3)} .medal-flame,.medal-flame2{--m1:#fb923c;--m2:#be123c;--ms:rgba(251,146,60,.3)}
.medal-volcano{--m1:#fb7185;--m2:#7f1d1d;--ms:rgba(251,113,133,.3)} .medal-perfect,.medal-sparkle{--m1:#fde68a;--m2:#f59e0b;--ms:rgba(253,230,138,.32)} .medal-star,.medal-moon{--m1:#a5b4fc;--m2:#4338ca;--ms:rgba(165,180,252,.3)}
.medal-timer,.medal-hourglass,.medal-chronos{--m1:#94a3b8;--m2:#334155;--ms:rgba(148,163,184,.3)} .medal-puzzle,.medal-dna{--m1:#2dd4bf;--m2:#0e7490;--ms:rgba(45,212,191,.28)} .medal-trend,.medal-arrow{--m1:#4ade80;--m2:#15803d;--ms:rgba(74,222,128,.28)}
.medal-galaxy,.medal-nebula{--m1:#c4b5fd;--m2:#312e81;--ms:rgba(196,181,253,.35)} .medal-comet,.medal-satellite{--m1:#7dd3fc;--m2:#0369a1;--ms:rgba(125,211,252,.3)} .medal-medal{--m1:#fcd34d;--m2:#a16207;--ms:rgba(252,211,77,.3)} .medal-trident,.medal-shield{--m1:#93c5fd;--m2:#1e3a8a;--ms:rgba(147,197,253,.3)}
.medal-nature{--m1:#86efac;--m2:#166534;--ms:rgba(134,239,172,.28)} .medal-aura{--m1:#f9a8d4;--m2:#be185d;--ms:rgba(249,168,212,.3)} .medal-mountain{--m1:#cbd5e1;--m2:#475569;--ms:rgba(203,213,225,.3)} .medal-earth{--m1:#4ade80;--m2:#1d4ed8;--ms:rgba(74,222,128,.3)} .medal-sun{--m1:#fde047;--m2:#ea580c;--ms:rgba(253,224,71,.32)}
.medal-card.locked .medal-art{filter:grayscale(.8) brightness(.7);animation:none;opacity:.72}.medal-card.locked .medal-ring-b{display:none}
@media(max-width:600px){.medal-art{width:82px;height:82px}.medal-art .ach-icon{font-size:34px!important}.achievement-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}}
/* v206: real unique medal silhouettes */
.medal-art{overflow:visible!important}
.medal-card .medal-ring-a,.medal-card .medal-ring-b{pointer-events:none}
.medal-card.medal-ruby .medal-art{border-radius:24% 24% 42% 42%;transform:rotate(0deg);background:linear-gradient(145deg,#ff6b8a,#8f1239 70%);}
.medal-card.medal-leaf .medal-art{border-radius:65% 35% 65% 35%;transform:rotate(-45deg);}
.medal-card.medal-leaf .ach-icon{transform:rotate(45deg)}
.medal-card.medal-fire .medal-art,.medal-card.medal-flame .medal-art,.medal-card.medal-flame2 .medal-art,.medal-card.medal-inferno .medal-art,.medal-card.medal-inferno2 .medal-art{border-radius:50% 50% 55% 55%;clip-path:polygon(50% 0%,63% 22%,82% 13%,77% 42%,100% 58%,78% 68%,70% 100%,50% 82%,30% 100%,22% 68%,0 58%,23% 42%,18% 13%,37% 22%);}
.medal-card.medal-silver .medal-art,.medal-card.medal-paper .medal-art,.medal-card.medal-mountain .medal-art{border-radius:18%;clip-path:polygon(25% 0,75% 0,100% 25%,100% 75%,75% 100%,25% 100%,0 75%,0 25%)}
.medal-card.medal-gold .medal-art,.medal-card.medal-perfect .medal-art,.medal-card.medal-perfect2 .medal-art,.medal-card.medal-sparkle .medal-art,.medal-card.medal-sun .medal-art{clip-path:polygon(50% 0,60% 19%,79% 7%,77% 29%,100% 25%,86% 45%,100% 62%,77% 65%,79% 93%,59% 80%,50% 100%,41% 80%,21% 93%,23% 65%,0 62%,14% 45%,0 25%,23% 29%,21% 7%,40% 19%);}
.medal-card.medal-diamond .medal-art,.medal-card.medal-diamond2 .medal-art{border-radius:12%;clip-path:polygon(50% 0,92% 28%,74% 88%,50% 100%,26% 88%,8% 28%);}
.medal-card.medal-crown .medal-art,.medal-card.medal-crown2 .medal-art,.medal-card.medal-royal .medal-art,.medal-card.medal-queen .medal-art,.medal-card.medal-king .medal-art{border-radius:18px;clip-path:polygon(5% 20%,28% 42%,50% 5%,72% 42%,95% 20%,87% 88%,13% 88%);}
.medal-card.medal-book .medal-art,.medal-card.medal-lab .medal-art{border-radius:10px;clip-path:polygon(8% 5%,48% 10%,50% 95%,10% 88%,8% 5%,52% 10%,92% 5%,90% 88%,50% 95%,52% 10%)}
.medal-card.medal-target .medal-art,.medal-card.medal-bolt .medal-art,.medal-card.medal-trident .medal-art,.medal-card.medal-trident2 .medal-art,.medal-card.medal-shield .medal-art,.medal-card.medal-shield2 .medal-art{border-radius:50%;}
.medal-card.medal-target .medal-art:before{content:"";position:absolute;inset:13px;border:5px solid #fff8;border-radius:50%;box-shadow:inset 0 0 0 5px var(--m2);}
.medal-card.medal-rocket .medal-art,.medal-card.medal-rocket2 .medal-art,.medal-card.medal-comet .medal-art{border-radius:48% 52% 35% 35%;transform:rotate(-18deg);}
.medal-card.medal-rocket .ach-icon,.medal-card.medal-rocket2 .ach-icon,.medal-card.medal-comet .ach-icon{transform:rotate(18deg)}
.medal-card.medal-brain .medal-art,.medal-card.medal-dna .medal-art,.medal-card.medal-puzzle .medal-art{border-radius:30%;}
.medal-card.medal-calendar .medal-art,.medal-card.medal-schedule .medal-art,.medal-card.medal-timer .medal-art,.medal-card.medal-hourglass .medal-art,.medal-card.medal-chronos .medal-art,.medal-card.medal-clocktower .medal-art,.medal-card.medal-grandclock .medal-art{border-radius:22px;}
.medal-card.medal-star .medal-art,.medal-card.medal-moon .medal-art,.medal-card.medal-aura .medal-art,.medal-card.medal-cosmos .medal-art{border-radius:50%;box-shadow:0 0 28px var(--ms),inset 0 0 20px #fff5;}
.medal-card.medal-galaxy .medal-art,.medal-card.medal-galaxy2 .medal-art,.medal-card.medal-nebula .medal-art{border-radius:50%;background:radial-gradient(circle,#fff,var(--m1) 12%,var(--m2) 48%,#090b22 100%);box-shadow:0 0 34px var(--ms),0 0 70px color-mix(in srgb,var(--m2) 25%,transparent);}
.medal-card.medal-earth .medal-art,.medal-card.medal-globe .medal-art,.medal-card.medal-network .medal-art{border-radius:50%;background:radial-gradient(circle at 35% 30%,#8effc1,var(--m1) 30%,var(--m2) 78%);}
.medal-card.medal-castle .medal-art,.medal-card.medal-temple .medal-art{border-radius:12px;clip-path:polygon(0 28%,18% 28%,18% 10%,32% 10%,32% 28%,50% 28%,50% 5%,64% 5%,64% 28%,82% 28%,82% 10%,96% 10%,96% 100%,0 100%);}
.medal-card.medal-fireworks .medal-art{border-radius:50%;clip-path:polygon(50% 0,56% 35%,76% 8%,66% 40%,100% 30%,69% 50%,100% 70%,66% 60%,76% 92%,56% 65%,50% 100%,44% 65%,24% 92%,34% 60%,0 70%,31% 50%,0 30%,34% 40%,24% 8%,44% 35%);}
.medal-card.medal-planet .medal-art{border-radius:50%;box-shadow:0 0 30px var(--ms),inset 0 -12px 20px #0006}.medal-card.medal-planet .medal-ring-a{transform:rotate(-18deg) scaleX(1.35);border-style:solid}.medal-card.medal-archer .medal-art{border-radius:50%;box-shadow:0 0 0 8px color-mix(in srgb,var(--m1) 20%,transparent),0 12px 30px var(--ms)}
.medal-card.unlocked .medal-art{animation:medalFloat206 4s ease-in-out infinite}.medal-card.selected .medal-art{animation:medalSelected206 1.5s ease-in-out infinite}
@keyframes medalFloat206{0%,100%{translate:0 0}50%{translate:0 -5px}}
@keyframes medalSelected206{0%,100%{scale:1;filter:drop-shadow(0 0 0 transparent)}50%{scale:1.07;filter:drop-shadow(0 0 14px var(--ms))}}
</style>

<style id="fp-v208-real-medals">
.fp-v202-medal-real{height:150px!important;display:grid!important;place-items:center!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;overflow:visible!important;position:relative!important}
.fp-v202-medal-real .real-medal-svg{width:132px;height:132px;display:block;overflow:visible;filter:drop-shadow(0 12px 18px rgba(0,0,0,.30));transition:transform .28s ease,filter .28s ease}
.fp-v202-ach:hover .fp-v202-medal-real .real-medal-svg{transform:translateY(-5px) scale(1.06);filter:drop-shadow(0 17px 22px rgba(0,0,0,.34))}
.fp-v202-ach.locked .fp-v202-medal-real .real-medal-svg{filter:grayscale(.85) saturate(.45) opacity(.48) drop-shadow(0 8px 12px rgba(0,0,0,.18))}
.fp-v202-featured-icon.featured-medal-art{width:110px!important;height:110px!important;background:transparent!important;border:0!important;border-radius:0!important;display:grid!important;place-items:center!important;overflow:visible!important;box-shadow:none!important}
.fp-v202-featured-icon .real-medal-svg{width:104px;height:104px;filter:drop-shadow(0 10px 16px rgba(0,0,0,.28))}
.dashboard-medal-art{display:grid!important;place-items:center!important;width:92px!important;height:92px!important;background:transparent!important;border:0!important;overflow:visible!important;box-shadow:none!important}
.dashboard-medal-art .real-medal-svg{width:92px;height:92px;filter:drop-shadow(0 9px 14px rgba(0,0,0,.28));animation:fpV208MedalFloat 3.2s ease-in-out infinite}
@keyframes fpV208MedalFloat{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-4px) rotate(1deg)}}
</style>
</body></html>`);w.document.close();return;}const stamp=Date.now();const host=document.createElement('div');host.style.cssText='position:fixed;left:-100000px;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none;';host.innerHTML=a.html;document.body.appendChild(host);const source=host.firstElementChild;if(!source){host.remove();return;}try{await html2pdf().set({margin:5,filename:`FocusPlan-Weekly-Report-${a.weekStart}.pdf`,image:{type:'jpeg',quality:.98},html2canvas:{scale:2,useCORS:true,backgroundColor:'#fff',logging:false},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(source).save();}finally{host.remove();}}
function deletePdfArchive(i){const a=(db?.pdfArchives||[])[i];if(!a)return;if(!confirm(`آرشیو هفته ${formatArchiveWeek(a.weekStart)} حذف شود؟`))return;db.pdfArchives.splice(i,1);localStorage.setItem(DBKEY,JSON.stringify(db));renderPdfArchives();}
function pdfSubjectColor(subject){
 const colors={
  'زیست':'#39A96B','شیمی':'#F59E0B','فیزیک':'#4F7CFF','ریاضی':'#E85D75','ادبیات فارسی':'#9B59B6','عربی':'#16A085','دینی':'#D35400','زبان انگلیسی':'#00A8CC','هندسه':'#8E44AD','گسسته':'#2E86AB','حسابان':'#C0392B','ریاضی و آمار':'#E67E22','اقتصاد':'#27AE60','جامعه‌شناسی':'#2980B9','روان‌شناسی':'#AF7AC5','تاریخ':'#795548','جغرافیا':'#1ABC9C','فلسفه':'#34495E','منطق':'#7F8C8D','مطالعه':'#5B6EE1'
 };
 if(colors[subject])return colors[subject];
 let h=0;for(let i=0;i<String(subject||'').length;i++)h=(h*31+String(subject).charCodeAt(i))%360;
 return `hsl(${h} 65% 55%)`;
}
function pdfPieGradient(entries,total){
 if(!total)return '#edf0f6';
 let cursor=0;
 return `conic-gradient(${entries.map(([sub,m])=>{const start=cursor;cursor+=m/total*100;return `${pdfSubjectColor(sub)} ${start}% ${cursor}%`;}).join(',')})`;
}
function pdfDonutSvg(entries,total){
 const cx=60,cy=60,r=46,stroke=18,circ=2*Math.PI*r;
 if(!total)return `<svg class=\"pdf-donut-svg\" viewBox=\"0 0 120 120\" width=\"92\" height=\"92\" xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"60\" cy=\"60\" r=\"46\" fill=\"none\" stroke=\"#edf0f6\" stroke-width=\"18\"/><circle cx=\"60\" cy=\"60\" r=\"27\" fill=\"#fff\"/></svg>`;
 let offset=0;
 const circles=entries.map(([sub,m])=>{const len=Math.max(0,m/total*circ-1.2);const out=`<circle cx=\"${cx}\" cy=\"${cy}\" r=\"${r}\" fill=\"none\" stroke=\"${pdfSubjectColor(sub)}\" stroke-width=\"${stroke}\" stroke-dasharray=\"${len} ${circ-len}\" stroke-dashoffset=\"${-offset}\"/>`;offset+=m/total*circ;return out;}).join('');
 return `<svg class=\"pdf-donut-svg\" viewBox=\"0 0 120 120\" width=\"92\" height=\"92\" xmlns=\"http://www.w3.org/2000/svg\"><g transform=\"rotate(-90 60 60)\">${circles}</g><circle cx=\"60\" cy=\"60\" r=\"27\" fill=\"#fff\"/></svg>`;
}
function pdfStreamTheme(stream){const s=String(stream||'').trim();if(db?.educationStage==='middle1'||s==='متوسطه اول')return {cls:'stream-middle-school',icon:'🏫',label:'متوسطه اول',sub:'هفتم • هشتم • نهم'};if(s.includes('تجربی'))return {cls:'stream-experimental',icon:'🧬',label:'رشته تجربی',sub:'زیست • شیمی • فیزیک • ریاضی'};if(s.includes('ریاضی'))return {cls:'stream-math',icon:'📐',label:'رشته ریاضی',sub:'ریاضی • فیزیک • هندسه • حسابان'};if(s.includes('انسانی'))return {cls:'stream-humanities',icon:'📚',label:'رشته انسانی',sub:'ادبیات • فلسفه • جامعه‌شناسی • اقتصاد'};return {cls:'stream-math',icon:'🎓',label:s||'رشته تحصیلی',sub:'برنامه‌ریزی و مطالعه هفتگی'};}
function renderWeeklyReport(weekStartKey=null){
 const box=document.getElementById('weeklyReportPreview');
 if(!box||!db)return;
 const names=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه']; const reportStartKey=weekStartKey||getCurrentWeekKey(); const reportStart=new Date(reportStartKey+'T12:00:00'); const dates=Array.from({length:7},(_,i)=>{const d=new Date(reportStart);d.setDate(reportStart.getDate()+i);return isoLocal(d)}); const range=document.getElementById('pdfRange'); if(range){const st=new Date(dates[0]+'T12:00:00'), enDate=new Date(dates[6]+'T12:00:00'); range.textContent=`${reportStartKey===getCurrentWeekKey()?'هفته جاری':'آرشیو هفته'} • شنبه ${st.toLocaleDateString('fa-IR')} تا جمعه ${enDate.toLocaleDateString('fa-IR')}`;}
 const plans=db.plans||[], sessions=db.sessions||[], testTasks=db.testTasks||[];
 const weekPlans=plans.filter(x=>dates.includes(x.date)), weekSessions=sessions.filter(x=>dates.includes(x.date));
 const totalMin=weekSessions.reduce((a,x)=>a+(+x.min||0),0), totalTests=weekSessions.reduce((a,x)=>a+(+x.tests||0),0)+testTasks.filter(x=>dates.includes(x.date)&&x.done&&!hasLinkedTestSession(x,testTasks.indexOf(x),weekSessions)).reduce((a,x)=>a+(+x.actualCount||0),0), donePlans=weekPlans.filter(x=>x.done).length;
 const en=n=>String(n??0).replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/,/g,'');
 const hours=(m)=>`${en(Math.floor(m/60))}:${String(m%60).padStart(2,'0')}`;
 const daySections=dates.map((date,i)=>{
   const ps=plans.filter(x=>x.date===date), ss=sessions.filter(x=>x.date===date), tt=testTasks.filter(x=>x.date===date);
   const dayMin=ss.reduce((a,x)=>a+(+x.min||0),0), dayTests=ss.reduce((a,x)=>a+(+x.tests||0),0)+tt.filter(x=>x.done&&!hasLinkedTestSession(x,(db.testTasks||[]).indexOf(x),ss)).reduce((a,x)=>a+(+x.actualCount||+x.count||0),0);
   const bySub={}; ss.forEach(x=>{const k=x.subject||'مطالعه';bySub[k]=(bySub[k]||0)+Math.max(0,+x.min||0)});
   const entries=Object.entries(bySub).sort((a,b)=>b[1]-a[1]);
   const pieTotal=entries.reduce((a,x)=>a+x[1],0);
   const legend=entries.length?entries.map(([sub,m])=>`<span class="pdf-legend-item"><i style="background:${pdfSubjectColor(sub)}"></i><b>${esc(sub)}</b><em>${en(Math.round(m/pieTotal*100))}%</em></span>`).join(''):'<span class="pdf-muted">مطالعه‌ای ثبت نشده</span>';
   const rows=ps.length?ps.map(x=>{
     const linked=ss.filter(s=>s.planId===x.id);
     const actualMin=linked.length?linked.reduce((a,s)=>a+(+s.min||0),0):Math.max(0,+x.actualMin||0);
     const actualTests=linked.reduce((a,s)=>a+(+s.tests||0),0);
     return `<div class="pdf-plan-row"><span class="pdf-check ${x.done?'done':''}">${x.done?'✓':'○'}</span><span class="pdf-plan-subject"><b>${x.subject}</b></span><span class="pdf-topic"><small>مبحث:</small> ${esc(x.topic||'مطالعه')}</span><span class="pdf-min">${en(x.min||0)} min</span><span class="pdf-plan-extra"><span class="pdf-status ${x.done?'is-done':''}">${x.done?'✓ انجام شده':'○ انجام نشده'}</span><span>خوانده‌شده: <b>${en(actualMin)} min</b></span></span></div>`;
   }).join(''):'<div class="pdf-empty">برای این روز برنامه‌ای ثبت نشده.</div>';
   const completedTests=tt.filter(x=>x.done);
   const testByTopic={}; completedTests.forEach(x=>{const sub=x.subject||'سایر';const topic=x.topic||'تست';const key=sub+'\u0000'+topic;const marker=testTaskKey(x),legacy=legacyTestTaskKey(x,tt.indexOf(x));const linked=ss.filter(s=>s.testTaskId===marker||s.testTaskId===legacy);const actual=linked.reduce((a,s)=>a+(+s.tests||0),0);const minutes=linked.reduce((a,s)=>a+(+s.min||0),0);const count=actual||+x.actualCount||0;testByTopic[key]=testByTopic[key]||{count:0,minutes:0};testByTopic[key].count+=count;testByTopic[key].minutes+=minutes||(+x.actualMin||0)});
   const testRows=Object.entries(testByTopic).length?Object.entries(testByTopic).map(([key,data])=>{const [sub,topic]=key.split('\u0000');const count=data.count,minutes=data.minutes;return `<div class="pdf-test-row"><span class="pdf-check done">✓</span><span class="pdf-test-info"><b>${esc(sub)}</b><small>مبحث: ${topic}</small></span><span><b>${en(count)}</b> تست${minutes>0?` • ${en(minutes)} دقیقه`:''}</span></div>`}).join(''):'<div class="pdf-empty">برای این روز تستی ثبت نشده.</div>';
   const doneCount=ps.filter(x=>x.done).length;
   return `<section class="pdf-day"><div class="pdf-day-head"><span>${names[i]}</span><span>${date}</span></div><div class="pdf-day-body"><div class="pdf-day-chart"><div class="pdf-donut-wrap">${pdfDonutSvg(entries,pieTotal)}<div class="pdf-donut-center"><b>${hours(dayMin)}</b><small>مطالعه</small></div></div><div class="pdf-legend">${legend}</div></div><div class="pdf-plan-list">${rows}</div><div class="pdf-test-section"><div class="pdf-test-title"><b>میزان تست روزانه</b><span>${en(dayTests)} تست</span></div>${testRows}</div></div></section>`;
 });
 const dayHtml=daySections.join('');
 const subjectTotals={};
 subjects().forEach(sub=>subjectTotals[sub]=0);
 weekSessions.forEach(x=>{const min=Number(x.min);if(!Number.isFinite(min)||min<=0)return;const sub=x.subject||'مطالعه';subjectTotals[sub]=(subjectTotals[sub]||0)+Math.min(1440,min)});
 const maxSub=Math.max(1,...Object.values(subjectTotals));
 const subjectRows=Object.entries(subjectTotals).map(([sub,m])=>`<tr><td><b>${esc(sub)}</b></td><td class="pdf-ltr">${hours(m)}</td><td><div class="pdf-mini-bar"><i style="width:${Math.min(100,m/maxSub*100)}%"></i></div></td></tr>`).join('');
 const dayPages=daySections.map(day=>`<div class="pdf-day-page"><div class="pdf-days" style="display:block;width:100%">${day}</div></div>`);
 const theme=pdfStreamTheme(db.stream); box.innerHTML=`<div id="pdfSheet" data-report-version="2026-09-14-v79" class="pdf-sheet ${theme.cls}"><div class="pdf-day-page pdf-cover-page"><div style="width:100%"><div class="pdf-hero"><div><div class="pdf-kicker">FOCUSPLAN • ${theme.icon} ${theme.label}</div><h1>گزارش هفتگی مطالعه</h1><p class="pdf-student-meta"><b>دانش‌آموز:</b> ${esc(db.profile?.name||"—")} &nbsp;•&nbsp; <b>کلاس:</b> ${esc(db.profile?.className||"—")} &nbsp;•&nbsp; <b>مدرسه:</b> ${esc(db.profile?.schoolName||"—")} &nbsp;•&nbsp; ${db.educationStage==='middle1'?'':`<b>رشته:</b> ${db.stream||"—"} &nbsp;•&nbsp; `}<b>پایه:</b> ${db.grade||"—"}</p><p>${theme.sub} • برنامه، مطالعه واقعی و تست</p></div><div class="pdf-badge">${db.educationStage==='middle1'?'متوسطه اول':(db.stream||'')} • ${db.grade||''}</div></div><div class="pdf-stats" style="grid-template-columns:repeat(3,1fr)"><div><b>${hours(totalMin)}</b><span>زمان مطالعه</span></div><div><b>${en(totalTests)}</b><span>تست</span></div><div><b>${en(donePlans)} / ${en(weekPlans.length)}</b><span>برنامه انجام‌شده</span></div></div><h3 class="pdf-section-title">گزارش روزانه</h3><p style="line-height:2;color:#68738a">هر روز در صفحه‌ای جداگانه نمایش داده می‌شود.</p></div></div>${dayPages.join('')}<div class="pdf-day-page"><div style="width:100%"><h3 class="pdf-section-title">میزان مطالعه به تفکیک درس</h3><table class="pdf-subject-table"><thead><tr><th>درس</th><th>زمان مطالعه در هفته</th><th>مقایسه</th></tr></thead><tbody>${subjectRows}</tbody></table><div class="pdf-foot">FocusPlan • گزارش هفتگی</div></div></div></div>`;
}
function resetCurrentPdf(){
  if(!db)return;
  const week=getCurrentWeekKey();
  const ok=confirm('با ریست PDF، اطلاعات این هفته از گزارش PDF و برنامه‌ها و تست‌های هفته جاری پاک می‌شوند. آرشیو هفته‌های قبل دست‌نخورده باقی می‌ماند. ادامه می‌دهی؟');
  if(!ok)return;
  db.plans=(db.plans||[]).filter(x=>!x?.date||x.date<week);
  db.testTasks=(db.testTasks||[]).filter(x=>!x?.date||x.date<week);
  db.tasks=(db.tasks||[]).filter(x=>!x?.date||x.date<week);
  db.sessions=(db.sessions||[]).filter(x=>!x?.date||x.date<week);
  persist();
  renderWeeklyReport();
  renderWeek();
  renderPdfArchives();
  updatePdfWeekCountdown();
  alert('گزارش PDF هفته جاری با موفقیت ریست شد. آرشیوهای قبلی باقی ماندند.');
}
async function downloadWeeklyPDF(){
  renderWeeklyReport();
  const source=document.getElementById('pdfSheet');
  if(!source){alert('گزارش PDF ساخته نشد.');return}
  if(typeof html2pdf==='undefined'){alert('دانلود مستقیم PDF در این حالت در دسترس نیست؛ پنجره چاپ باز می‌شود و از گزینه Save as PDF ذخیره کن.');printWeeklyPDF();return}
  const stamp=Date.now();
  let host=null;
  try{
    // Always build a fresh, isolated copy from the exact current preview.
    // Remove any old export clone before creating a new one, and force a unique
    // canvas/export root so html2pdf cannot reuse a previous report.
    document.querySelectorAll('[id^=pdfExportTemp_],[id^=pdfSheetExport_]').forEach(el=>el.remove());
    host=document.createElement('div');
    host.id='pdfExportTemp_'+stamp;
    host.style.cssText='position:fixed;left:-100000px;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none;';
    const clone=source.cloneNode(true);
    clone.id='pdfSheetExport_'+stamp;
    clone.classList.add('pdf-export-fixed');
    clone.setAttribute('data-report-version','2026-09-13-'+stamp);
    clone.setAttribute('data-export-source','weeklyReportPreview-current');
    // The export must be the same rendered report currently shown in the preview.
    clone.style.display='block';
    clone.style.visibility='visible';
    // IMPORTANT: the app may be in dark mode. The PDF is paper and must ALWAYS
    // use the exact light/paper palette, independent of body.dark-mode rules.
    const exportStyle=document.createElement('style');
    exportStyle.textContent=`
      .pdf-export-fixed,.pdf-export-fixed *{color-scheme:light!important;box-sizing:border-box!important;text-shadow:none!important}
      .pdf-export-fixed{background:#fff!important;color:#172033!important}
      .pdf-export-fixed .pdf-hero h1,.pdf-export-fixed .pdf-kicker,.pdf-export-fixed .pdf-section-title,.pdf-export-fixed .pdf-stats b,.pdf-export-fixed .pdf-badge,.pdf-export-fixed .pdf-day-head,.pdf-export-fixed .pdf-day-head span,.pdf-export-fixed .pdf-day-head strong,.pdf-export-fixed .pdf-subject-table th,.pdf-export-fixed .pdf-subject-table td b,.pdf-export-fixed .pdf-plan-subject,.pdf-export-fixed .pdf-plan-subject b,.pdf-export-fixed .pdf-test-title b{color:var(--pdf-main)!important;-webkit-text-fill-color:var(--pdf-main)!important}
      .pdf-export-fixed .pdf-hero p,.pdf-export-fixed .pdf-student-meta,.pdf-export-fixed .pdf-student-meta b,.pdf-export-fixed .pdf-stats span,.pdf-export-fixed .pdf-topic,.pdf-export-fixed .pdf-plan-extra,.pdf-export-fixed .pdf-test-info small,.pdf-export-fixed .pdf-day-summary,.pdf-export-fixed .pdf-muted,.pdf-export-fixed .pdf-empty,.pdf-export-fixed .pdf-foot,.pdf-export-fixed .pdf-donut-center small,.pdf-export-fixed .pdf-legend-item em{color:#68738a!important;-webkit-text-fill-color:#68738a!important}
      .pdf-export-fixed .pdf-topic{color:#4e5b73!important;-webkit-text-fill-color:#4e5b73!important}
      .pdf-export-fixed .pdf-min{color:#58647b!important;-webkit-text-fill-color:#58647b!important}
      .pdf-export-fixed .pdf-check.done{color:#159c71!important;-webkit-text-fill-color:#159c71!important}
      .pdf-export-fixed .pdf-test-row>span:last-child{color:#3146b7!important;-webkit-text-fill-color:#3146b7!important}
      .pdf-export-fixed .pdf-day,.pdf-export-fixed .pdf-stats>div,.pdf-export-fixed .pdf-subject-table{background:#fff!important}
      .pdf-export-fixed .pdf-hero{background:linear-gradient(135deg,var(--pdf-soft),#fff)!important}
      .pdf-export-fixed .pdf-day-head,.pdf-export-fixed .pdf-subject-table th{background:var(--pdf-soft)!important}
      .pdf-export-fixed .pdf-day-summary{background:#fafbff!important}
    `;
    host.appendChild(exportStyle);
    host.appendChild(clone);
    document.body.appendChild(host);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    await html2pdf().set({
      margin:5,
      filename:`FocusPlan-Weekly-Report-${stamp}.pdf`,
      image:{type:'jpeg',quality:.98},
      html2canvas:{scale:2,useCORS:true,backgroundColor:'#fff',logging:false},
      jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
      pagebreak:{mode:['css','legacy']}
    }).from(clone).save();
  }catch(e){
    console.error(e);
    alert('دانلود مستقیم PDF با مشکل روبه‌رو شد؛ پنجره چاپ برای ذخیره به صورت PDF باز می‌شود.');
    printWeeklyPDF();
  }finally{
    if(host)host.remove();
  }
}
function printWeeklyPDF(){renderWeeklyReport();const target=document.getElementById('pdfSheet');if(!target)return;const w=window.open('','_blank');if(!w){alert('مرورگر اجازه باز کردن پنجره چاپ را نداد.');return}const styles=`body{font-family:Tahoma,Arial,sans-serif;background:#fff;color:#172033;padding:14px}.pdf-sheet{--pdf-main:#3146b7;--pdf-soft:#f1f4ff;--pdf-border:#dfe3ee;--pdf-accent:#6677df;max-width:900px;margin:auto}.pdf-sheet.stream-experimental{--pdf-main:#087f5b;--pdf-soft:#e9f8f2;--pdf-border:#cfeade;--pdf-accent:#20a879}.pdf-sheet.stream-math{--pdf-main:#3658c8;--pdf-soft:#edf1ff;--pdf-border:#d7def8;--pdf-accent:#637ee8}.pdf-sheet.stream-humanities{--pdf-main:#a24b28;--pdf-soft:#fff1e9;--pdf-border:#f0d8cb;--pdf-accent:#d87945}.pdf-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:18px;border:1px solid var(--pdf-border);border-radius:18px;background:var(--pdf-soft)}.pdf-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.pdf-stats>div{border:1px solid #dfe3ee;border-radius:12px;padding:9px;text-align:center}.pdf-stats b,.pdf-stats span{display:block}.pdf-days{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pdf-day-body{padding:10px}.pdf-day-chart{display:flex;align-items:center;gap:12px;padding:8px 4px 12px;border-bottom:1px solid #edf0f6}.pdf-donut-wrap{width:92px;height:92px;position:relative;display:grid;place-items:center;flex:none}.pdf-donut-svg{display:block;width:92px;height:92px}.pdf-donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}.pdf-donut-center b{font-size:11px;direction:ltr}.pdf-donut-center small{font-size:8px;color:#68738a}.pdf-donut{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;flex:none;box-shadow:0 5px 16px #3146b71a;transition:transform .25s ease}.pdf-donut:hover{transform:scale(1.04)}.pdf-donut>div{width:58px;height:58px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}.pdf-donut b{font-size:11px;direction:ltr}.pdf-donut small{font-size:8px;color:#68738a}.pdf-legend{display:flex;flex-wrap:wrap;gap:5px 9px;align-content:center}.pdf-legend-item{display:flex;align-items:center;gap:4px;font-size:9px}.pdf-legend-item i{width:7px;height:7px;border-radius:50%;display:inline-block}.pdf-legend-item em{font-style:normal;color:#68738a;direction:ltr}.pdf-test-section{margin-top:8px;padding-top:8px;border-top:1px solid #edf0f6}.pdf-test-title{display:flex;justify-content:space-between;align-items:center;color:var(--pdf-main);font-size:11px;margin-bottom:3px}.pdf-test-title span{direction:ltr;font-size:10px}.pdf-status{font-weight:800;color:#8a94a7}.pdf-status.is-done{color:#159c71}.pdf-test-row{display:grid;grid-template-columns:26px 1fr auto;gap:7px;align-items:center;padding:7px 0;border-bottom:1px solid #edf0f6;font-size:10px}.pdf-test-row:last-child{border-bottom:0}.pdf-test-row>span:last-child{direction:ltr;white-space:nowrap;color:#3146b7;font-weight:800}.pdf-plan-list{margin-top:4px}.pdf-empty{padding:18px;text-align:center;color:#68738a;font-size:10px}.pdf-plan-subject{min-width:0}.pdf-plan-subject b{font-weight:900}.pdf-muted{color:#68738a;font-size:9px}.pdf-day{border:1px solid #dfe3ee;border-radius:14px;overflow:hidden;break-inside:avoid;min-height:230px}.pdf-day-head{display:flex;justify-content:space-between;background:var(--pdf-soft);padding:10px;font-weight:900;color:var(--pdf-main)}.pdf-plan-row{display:grid;grid-template-columns:26px 1.05fr 1.5fr 74px;gap:7px;align-items:center;padding:9px;border-bottom:1px solid #edf0f6;font-size:11px}.pdf-plan-extra{grid-column:2/-1;display:flex;gap:12px;flex-wrap:wrap;color:#68738a;font-size:10px}.pdf-plan-extra b{color:var(--pdf-main)}.pdf-check.done{color:#159c71}.pdf-min{white-space:nowrap;text-align:left;direction:ltr}.pdf-day-summary{display:flex;justify-content:space-between;padding:8px 10px;background:#fafbff;font-size:10px}.pdf-subject-table{width:100%;border-collapse:collapse}.pdf-subject-table th,.pdf-subject-table td{padding:8px;border:1px solid #dfe3ee}.pdf-subject-table th{background:var(--pdf-soft);color:var(--pdf-main)}.pdf-mini-bar{height:7px;background:#edf0f6;border-radius:99px;overflow:hidden}.pdf-mini-bar i{display:block;height:100%;background:var(--pdf-accent)}.pdf-foot{text-align:center;margin-top:20px;color:#68738a;font-size:10px}.pdf-day-page{break-after:page;page-break-after:always;min-height:277mm;box-sizing:border-box}.pdf-day-page:last-child{break-after:auto;page-break-after:auto}.pdf-cover-page{display:block}.pdf-days{display:block!important}.pdf-day{min-height:0;break-inside:avoid;page-break-inside:avoid}.pdf-plan-row{grid-template-columns:28px minmax(80px,1fr) minmax(120px,1.7fr) 82px}.pdf-sheet,.pdf-sheet *{font-family:Tahoma,Arial,"DejaVu Sans",sans-serif;unicode-bidi:plaintext}.pdf-sheet{direction:rtl;overflow-wrap:anywhere}@media print{body{padding:0}}`;w.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>FocusPlan Weekly Report</title><style>${styles}</style>
<style id="modern-ui-v2-dark">
/* FocusPlan — clean modern UI */
:root{--bg:#f4f7fb;--bg2:#eef2f7;--card:#ffffff;--card2:#f8fafc;--text:#172033;--muted:#6b778c;--accent:#4f63d9;--accent2:#7357d8;--good:#159a70;--danger:#e05268;--border:#e4e9f0;--shadow:0 8px 28px rgba(26,39,67,.08)}
body{background:var(--bg);background-image:radial-gradient(circle at 90% 0,#dfe6ff 0,transparent 28%),radial-gradient(circle at 0 40%,#eaf7f4 0,transparent 24%);color:var(--text);font-family:Tahoma,Arial,sans-serif}
body:before,body:after{display:none!important}
.app{position:relative;z-index:1;max-width:1100px;margin:auto}
.app-header-simple{min-height:76px;background:rgba(255,255,255,.92);border:0;border-bottom:1px solid var(--border);box-shadow:0 2px 12px rgba(30,45,70,.04);backdrop-filter:blur(12px)}
.header-brand{font-size:20px!important;font-weight:900;color:#18223a!important}
.header-action{background:#f5f7fb;color:#25314a;border:1px solid var(--border);border-radius:12px;box-shadow:none}
.header-action:hover{background:#edf1f7;transform:translateY(-50%)}
main{padding:22px 18px 35px}
.hero{padding:26px 28px!important;border-radius:22px!important;background:#fff!important;border:1px solid var(--border)!important;box-shadow:var(--shadow)!important;margin-bottom:16px!important}
.hero h1{margin:0 0 7px;font-size:27px;color:#18223a}.hero p{margin:0;color:var(--muted)}
.tabs{display:grid!important;grid-template-columns:repeat(6,1fr);gap:8px!important;padding:6px!important;background:#e9edf4;border-radius:15px!important;margin:0 0 22px!important;box-shadow:none!important}
.tabs .btn{border-radius:11px!important;padding:11px 8px!important;background:transparent!important;color:#59667d!important;box-shadow:none!important;font-weight:700;border:0!important}
.tabs .btn:hover{transform:none!important;background:#fff!important;color:#273552!important}
.tabs .btn.active{background:#fff!important;color:var(--accent)!important;box-shadow:0 3px 10px rgba(30,45,70,.09)!important}
.section{animation:cleanIn .28s ease}.section>h2{font-size:21px;margin:0 0 15px;color:#1b2740}.section>h2:first-letter{font-size:1em}
.grid{gap:12px!important}.card{background:var(--card)!important;border:1px solid var(--border)!important;border-radius:17px!important;box-shadow:var(--shadow)!important;color:var(--text)}
.card.stat{padding:20px!important;min-height:112px;display:flex;flex-direction:column;justify-content:center}.card.stat b{font-size:27px;margin-top:7px;color:#202c47}
.muted,.notice{color:var(--muted)!important}
input,select{background:#f8fafc!important;color:#1d2940!important;border:1px solid #dce3ed!important;border-radius:11px!important;padding:12px!important}
input:focus,select:focus{background:#fff!important;border-color:#8190df!important;box-shadow:0 0 0 3px rgba(79,99,217,.10)!important}
.btn{border-radius:11px!important;padding:11px 16px!important;background:var(--accent)!important;box-shadow:0 5px 14px rgba(79,99,217,.18)!important;font-weight:700}.btn:hover{transform:translateY(-1px)!important;box-shadow:0 7px 17px rgba(79,99,217,.22)!important}.btn.secondary{background:#edf1f6!important;color:#34425d!important;box-shadow:none!important}.btn.danger{background:#e05268!important;color:#fff!important}
.form{gap:9px!important}.row{gap:9px!important}
.streams{gap:10px!important}.stream{background:#fff!important;border:1px solid var(--border)!important;border-radius:14px!important;color:var(--text);box-shadow:none}.stream:hover,.stream.active{background:#f3f5ff!important;border-color:#9aa7e8!important;transform:none}
.logo{border-radius:18px!important;box-shadow:0 10px 25px rgba(79,99,217,.22)!important}.logo-title{background:linear-gradient(90deg,#3349b7,#7558cf)!important;-webkit-background-clip:text!important}
.auth-box{background:#fff!important;border:1px solid var(--border)!important;border-radius:24px!important;box-shadow:0 16px 45px rgba(30,45,70,.10)!important}
.settings-grid{gap:12px!important}
.theme-row{background:#f7f9fc!important;border:1px solid var(--border)!important;border-radius:14px!important;padding:14px!important}
.theme-btn{border:1px solid var(--border)!important;background:#fff!important;color:#44516a!important;border-radius:10px!important;padding:9px 12px!important}.theme-btn.active{background:#edf1ff!important;border-color:#9aa7e8!important;color:#4054c4!important}
.support-fab{width:54px!important;height:54px!important;right:17px!important;bottom:17px!important;box-shadow:0 8px 22px rgba(30,45,70,.18)!important}
/* Lists and generated program/test cards */
[id$="List"],#plansList,#testTasksList{display:grid;gap:10px}
[id$="List"]>*,#plansList>*,#testTasksList>*{border-radius:14px!important;border:1px solid var(--border)!important;background:#fff!important;box-shadow:0 4px 14px rgba(30,45,70,.05)!important}
.weekly-report{background:#fff!important}
@keyframes cleanIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(max-width:720px){main{padding:14px 11px 28px}.hero{padding:21px 18px!important}.hero h1{font-size:23px}.tabs{grid-template-columns:repeat(3,1fr)!important;gap:6px!important}.tabs .btn{font-size:12px;padding:10px 5px!important}.grid{grid-template-columns:1fr 1fr!important}.card.stat{min-height:98px;padding:15px!important}.card.stat b{font-size:22px}.app-header-simple{min-height:64px}.header-brand{font-size:18px!important}}
@media(max-width:430px){.grid{grid-template-columns:1fr!important}.tabs{grid-template-columns:repeat(2,1fr)!important}.tabs .btn{font-size:13px}}
/* Dark mode remains clean, not neon */
body.dark-mode{--bg:#101521;--bg2:#151b29;--card:#181f2d;--card2:#202838;--text:#eef2f8;--muted:#9aa6ba;--border:#2a3446;background:#101521;background-image:radial-gradient(circle at 90% 0,#202b52 0,transparent 30%)}
body.dark-mode .app-header-simple{background:rgba(18,24,36,.94);border-color:#283245}.dark-mode .header-brand{color:#eef2f8!important}.dark-mode .header-action{background:#202838;color:#e8edf6;border-color:#303b50}.dark-mode .hero,.dark-mode .card,.dark-mode [id$="List"]>*,.dark-mode #plansList>*,.dark-mode #testTasksList>*{background:#181f2d!important;border-color:#2a3446!important}.dark-mode .hero h1,.dark-mode .card.stat b{color:#eef2f8}.dark-mode input,.dark-mode select{background:#121925!important;color:#eef2f8!important;border-color:#303b50!important}.dark-mode .tabs{background:#1b2230!important}.dark-mode .tabs .btn{color:#aab5c8!important}.dark-mode .tabs .btn.active{background:#283249!important;color:#aebcff!important}.dark-mode .btn.secondary{background:#252e3e!important;color:#d8dfeb!important}.dark-mode .theme-row{background:#1d2635!important;border-color:#303b50!important}.dark-mode .theme-btn{background:#18202d!important;color:#d8dfeb!important;border-color:#303b50!important}
<style id="focusplan-stream-motifs-motion-v19-dup">
/* Slow, smooth rotation/spiral motion for each رشته background motif. */
body.stream-tajrobi::before, body.stream-riazi::before, body.stream-ensani::before{
  animation: fpStreamMotifDrift 28s ease-in-out infinite alternate !important;
  transform-origin: 50% 50%;
  will-change: transform, background-position;
}
body.stream-tajrobi::after, body.stream-riazi::after, body.stream-ensani::after{
  animation: fpStreamMotifOrbit 42s linear infinite !important;
  transform-origin: 50% 50%;
  will-change: transform;
}
@keyframes fpStreamMotifDrift{
  0%{transform:translate3d(-1.2%,-.7%,0) rotate(-1deg) scale(1);background-position:0 0,0 0,0 0,0 0;}
  50%{transform:translate3d(.5%,1%,0) rotate(1deg) scale(1.018);background-position:22px 14px,-18px 20px,16px -12px,28px 18px;}
  100%{transform:translate3d(1.2%,-.5%,0) rotate(2deg) scale(1.025);background-position:45px 28px,-38px 38px,32px -25px,55px 35px;}
}
@keyframes fpStreamMotifOrbit{
  from{transform:rotate(0deg) translate3d(0,0,0);}
  to{transform:rotate(360deg) translate3d(0,0,0);}
}
@media(prefers-reduced-motion:reduce){
  body.stream-tajrobi::before,body.stream-riazi::before,body.stream-ensani::before,
  body.stream-tajrobi::after,body.stream-riazi::after,body.stream-ensani::after{animation:none!important;}
}
</style>
</style>

<style id="focusplan-splash-v54-readable">
/* v54: clean readable title + real determinate loading bar */
#startupSplash .splash-title{position:relative!important;display:flex!important;justify-content:center!important;align-items:center!important;gap:12px!important;font-family:Arial,Helvetica,sans-serif!important;font-size:42px!important;font-weight:800!important;letter-spacing:1px!important;line-height:1.05!important;filter:none!important;text-shadow:none!important;background:transparent!important;box-shadow:none!important}
#startupSplash .splash-title::before{display:none!important;content:none!important}
#startupSplash .splash-title span,#startupSplash .splash-title em{display:inline-block!important;position:relative!important;background:none!important;background-image:none!important;background-size:auto!important;-webkit-background-clip:border-box!important;background-clip:border-box!important;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;text-shadow:0 2px 10px rgba(0,0,0,.35)!important;filter:none!important;animation:titleSimpleIn .65s ease-out both!important}
#startupSplash .splash-title em{color:#7ddcff!important;-webkit-text-fill-color:#7ddcff!important;animation-delay:.12s!important}
#startupSplash .splash-title span:after,#startupSplash .splash-title em:after{display:none!important;content:none!important}
#startupSplash .splash-loader{position:relative!important;width:260px!important;height:8px!important;margin:28px auto 0!important;border-radius:999px!important;background:rgba(255,255,255,.13)!important;overflow:hidden!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),0 4px 18px rgba(0,0,0,.22)!important}
#startupSplash .splash-loader span{display:block!important;width:0!important;height:100%!important;max-width:100%!important;border-radius:inherit!important;background:linear-gradient(90deg,#5edcff,#7182ff,#a86cff)!important;box-shadow:0 0 14px rgba(113,130,255,.7)!important;transform:none!important;animation:none!important;transition:width .08s linear!important}
#startupSplash .splash-loading-text{width:260px!important;margin:10px auto 0!important;color:#d4dcf2!important;opacity:1!important;font-family:Arial,Tahoma,sans-serif!important;font-size:12px!important}
#startupSplash .splash-loading-text b{color:#ffffff!important;font-size:12px!important}
#startupSplash .splash-status{color:#9eacd0!important}
@keyframes titleSimpleIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:520px){#startupSplash .splash-title{font-size:35px!important;gap:8px!important}#startupSplash .splash-loader,#startupSplash .splash-loading-text{width:210px!important}}
</style>
<style id="subject-chart-monthly-final">
.subject-chart-month-label{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px;padding:10px 13px;border-radius:13px;background:color-mix(in srgb,var(--accent) 8%,var(--card2));border:1px solid color-mix(in srgb,var(--accent) 18%,var(--border));font-weight:900;color:var(--accent)}
.subject-chart-month-label span{font-size:11px;color:var(--muted);font-weight:700}
.subject-performance-month-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:14px 0 10px;padding:12px 14px;border-radius:14px;background:var(--card2);border:1px solid var(--border)}
.subject-performance-month-head b{font-size:17px}.subject-performance-month-head span{font-size:11px;color:var(--muted)}
.subject-performance-chart-scroll{overflow-x:auto;overflow-y:hidden;padding-bottom:5px}.subject-performance-chart-scroll svg{display:block;min-width:760px;width:100%;height:330px}
.subject-chart-month-foot{margin-top:7px;text-align:center;font-size:11px;color:var(--muted)}
@media(max-width:600px){.subject-chart-month-label,.subject-performance-month-head{align-items:flex-start;flex-direction:column}.subject-performance-chart-scroll svg{min-width:700px}}
</style>

<style id="fp-calendar-buttons-v3">
.fp-cal-grid{gap:10px!important}
.fp-cal-day{min-height:104px!important;padding:12px 10px!important;border-radius:18px!important;transition:transform .22s ease,box-shadow .22s ease,background .22s ease!important;position:relative;overflow:hidden}
.fp-cal-day:not(.empty){cursor:pointer}
.fp-cal-day:not(.empty):hover{transform:translateY(-4px) scale(1.015);box-shadow:0 12px 28px rgba(80,70,180,.18)!important}
.fp-cal-num{font-size:22px!important;font-weight:900!important;line-height:1.2!important;min-width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:11px;background:rgba(255,255,255,.72);box-shadow:0 3px 10px rgba(0,0,0,.08);margin-bottom:7px}
.fp-cal-min,.fp-cal-test{font-size:12px!important;font-weight:800!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fp-cal-badges{margin-top:5px}.fp-cal-badge{font-size:10px!important;font-weight:900!important;padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.72);display:inline-block}
.fp-cal-day.today{outline:3px solid rgba(108,92,231,.55)!important;outline-offset:-3px;animation:fpCalToday 2.4s ease-in-out infinite}
.fp-cal-day.selected{transform:translateY(-3px) scale(1.02)!important;box-shadow:0 14px 32px rgba(80,70,180,.25)!important;outline:3px solid rgba(108,92,231,.8)!important;outline-offset:-3px}
.fp-cal-day.selected .fp-cal-num{background:rgba(255,255,255,.95);transform:scale(1.06);transition:transform .2s ease}
@keyframes fpCalToday{0%,100%{box-shadow:0 0 0 0 rgba(108,92,231,.12)}50%{box-shadow:0 0 0 7px rgba(108,92,231,.06)}}
@media(max-width:700px){.fp-cal-grid{gap:6px!important}.fp-cal-day{min-height:88px!important;padding:8px 6px!important;border-radius:14px!important}.fp-cal-num{font-size:18px!important;min-width:29px;height:29px;margin-bottom:5px}.fp-cal-min,.fp-cal-test{font-size:9px!important}.fp-cal-badge{font-size:8px!important;padding:2px 5px}}
</style>

<style id="focusplan-v110-light-glass-structural">
/* v110: تمام پنل‌های واقعی در حالت روشن، هم‌سطح ظاهر شیشه‌ای مرکز عملکرد */
body:not(.dark-mode) .section > .card,
body:not(.dark-mode) .section > .grid > .card,
body:not(.dark-mode) .section > .dashboard-identity-grid > .card,
body:not(.dark-mode) .section > .settings-shell > .settings-section-card,
body:not(.dark-mode) .section > .settings-shell > .settings-intro,
body:not(.dark-mode) .section .weekly-report,
body:not(.dark-mode) .section .archive-panel,
body:not(.dark-mode) .section .settings-section-card,
body:not(.dark-mode) .section .tomorrow-suggestion,
body:not(.dark-mode) .section .tomorrow-manual-add,
body:not(.dark-mode) .section .subject-analysis,
body:not(.dark-mode) .section .notice,
body:not(.dark-mode) .section .bg-card-choice,
body:not(.dark-mode) .section .premium-background-section,
body:not(.dark-mode) .section .fp-cal-details,
body:not(.dark-mode) .section .fp-compare-panel,
body:not(.dark-mode) .section .fp-weekly-command-center {
  background:linear-gradient(145deg,rgba(255,255,255,.70),rgba(255,255,255,.34)) !important;
  border:1px solid rgba(255,255,255,.84) !important;
  box-shadow:0 14px 38px rgba(80,100,140,.12),inset 0 1px 0 rgba(255,255,255,.92) !important;
  backdrop-filter:blur(18px) saturate(145%) !important;
  -webkit-backdrop-filter:blur(18px) saturate(145%) !important;
}
/* لایه‌های داخلی هم شفاف بمانند تا پنل اصلی واقعاً شیشه‌ای دیده شود */
body:not(.dark-mode) .section .card .card,
body:not(.dark-mode) .section .card .panel,
body:not(.dark-mode) .section .card .box,
body:not(.dark-mode) .section .settings-section-card .form,
body:not(.dark-mode) .section .archive-panel > *,
body:not(.dark-mode) .section .weekly-report > * {
  background:rgba(255,255,255,.20) !important;
}
/* نوار تب‌ها و هدر همان شیشه‌ی روشن مرکز عملکرد را حفظ کنند */
body:not(.dark-mode) .tabs,
body:not(.dark-mode) .app-header-simple,
body:not(.dark-mode) .hero {
  background:linear-gradient(145deg,rgba(255,255,255,.64),rgba(255,255,255,.30)) !important;
  border:1px solid rgba(255,255,255,.80) !important;
  box-shadow:0 14px 38px rgba(80,100,140,.11),inset 0 1px 0 rgba(255,255,255,.90) !important;
  backdrop-filter:blur(18px) saturate(145%) !important;
  -webkit-backdrop-filter:blur(18px) saturate(145%) !important;
}
</style>
</head><body>${target.outerHTML}<script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script>
<style id="focusplan-final-fixes-v8">
/* ===== QA v8: clearly visible scene lines + unmistakable schedule dates ===== */
body::before{
  opacity:1!important;
  background:
    repeating-linear-gradient(118deg,transparent 0 34px,var(--fp-line-strong,rgba(90,110,255,.20)) 35px 36px,transparent 37px 82px),
    repeating-linear-gradient(28deg,transparent 0 78px,var(--fp-line-soft,rgba(255,255,255,.13)) 79px 80px,transparent 81px 150px),
    radial-gradient(circle at 18% 22%,transparent 0 76px,rgba(255,255,255,.22) 78px 80px,transparent 82px),
    radial-gradient(circle at 82% 68%,transparent 0 108px,rgba(255,255,255,.16) 110px 112px,transparent 114px),
    radial-gradient(circle at 58% 40%,transparent 0 168px,var(--fp-ring,rgba(100,120,255,.18)) 170px 173px,transparent 175px)!important;
  background-size:190px 190px,260px 260px,100% 100%,100% 100%,100% 100%!important;
  mix-blend-mode:screen!important;
  animation:fpSceneLines 28s ease-in-out infinite alternate!important;
  mask-image:none!important;
  pointer-events:none!important;
}
body.stream-tajrobi{--fp-line-strong:rgba(0,220,185,.22);--fp-line-soft:rgba(70,255,225,.13)}
body.stream-riazi{--fp-line-strong:rgba(155,105,255,.22);--fp-line-soft:rgba(255,85,180,.13)}
body.stream-ensani{--fp-line-strong:rgba(255,175,60,.22);--fp-line-soft:rgba(255,110,125,.13)}
@keyframes fpSceneLines{0%{transform:translate3d(-1.5%,-1%,0) rotate(-.6deg) scale(1)}50%{transform:translate3d(1%,1.5%,0) rotate(.5deg) scale(1.025)}100%{transform:translate3d(2%,-1%,0) rotate(-.35deg) scale(1.04)}}
.schedule-date-pill{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:7px 10px!important;border-radius:10px!important;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 12%,var(--card2)),var(--card2))!important;border:1px solid color-mix(in srgb,var(--accent) 28%,var(--border))!important;color:var(--text)!important;font-weight:900!important;white-space:nowrap!important;line-height:1.35!important;box-shadow:0 4px 12px rgba(35,50,85,.07)!important}
.dark-mode .schedule-date-pill{background:linear-gradient(135deg,#202c43,#182235)!important;border-color:#354663!important;color:#eaf0fa!important}
#plan table tbody td:first-child,.test-table tbody td:first-child{min-width:150px!important}
@media(max-width:720px){
  #plan table tbody td:first-child,.test-table tbody td:first-child{min-width:0!important}
  #plan table tbody td:first-child,.test-table tbody td:first-child{font-size:12px!important;color:var(--text)!important}
  .schedule-date-pill{font-size:11px!important;padding:6px 9px!important}
}
</style>

<style id="focusplan-timer-cinematic-v9">
/* ===== FocusPlan visual refresh v9: visible lines everywhere + cinematic timer ===== */
body{--fp-line-strong:rgba(91,108,255,.30)!important;--fp-line-soft:rgba(91,108,255,.16)!important;--fp-ring:rgba(91,108,255,.22)!important;}
body.stream-tajrobi{--fp-line-strong:rgba(0,235,190,.34)!important;--fp-line-soft:rgba(72,255,224,.20)!important;--fp-ring:rgba(0,230,195,.26)!important}
body.stream-riazi{--fp-line-strong:rgba(170,105,255,.34)!important;--fp-line-soft:rgba(255,82,190,.19)!important;--fp-ring:rgba(155,100,255,.27)!important}
body.stream-ensani{--fp-line-strong:rgba(255,174,52,.36)!important;--fp-line-soft:rgba(255,100,125,.20)!important;--fp-ring:rgba(255,175,55,.27)!important}
body::before{z-index:0!important;opacity:1!important;background:
 repeating-linear-gradient(118deg,transparent 0 30px,var(--fp-line-strong) 31px 33px,transparent 34px 78px),
 repeating-linear-gradient(28deg,transparent 0 66px,var(--fp-line-soft) 67px 69px,transparent 70px 132px),
 repeating-linear-gradient(90deg,transparent 0 118px,var(--fp-line-soft) 119px 120px,transparent 121px 240px),
 radial-gradient(circle at 14% 24%,transparent 0 72px,var(--fp-ring) 74px 77px,transparent 79px),
 radial-gradient(circle at 82% 70%,transparent 0 106px,var(--fp-ring) 108px 111px,transparent 113px)!important;
 background-size:180px 180px,250px 250px,320px 320px,100% 100%,100% 100%!important;
 mix-blend-mode:screen!important;animation:fpSceneLinesFast 22s ease-in-out infinite alternate!important}
body::after{z-index:0!important;opacity:.9!important}
@keyframes fpSceneLinesFast{0%{transform:translate3d(-2%,-1%,0) rotate(-.7deg) scale(1)}50%{transform:translate3d(1.5%,1%,0) rotate(.45deg) scale(1.025)}100%{transform:translate3d(3%,-1.5%,0) rotate(-.3deg) scale(1.05)}}
.app,.auth,.app-header-simple,main,.section{position:relative;z-index:1}
.card,.hero{position:relative;overflow:hidden}
.card::after,.hero::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.34;background:repeating-linear-gradient(118deg,transparent 0 52px,var(--fp-line-soft) 53px 54px,transparent 55px 116px);background-size:260px 260px;animation:fpCardLines 30s linear infinite;z-index:0}
.card>* , .hero>*{position:relative;z-index:1}
@keyframes fpCardLines{from{background-position:0 0}to{background-position:260px 120px}}
<style id="focusplan-timer-wave-goal-v66">
.timer-ring{overflow:visible!important}.timer-wave-progress{fill:none;stroke:url(#timerGradient);stroke-width:5;stroke-linecap:round;opacity:.72;filter:url(#timerWaveFilter);transform-origin:120px 120px;transform:rotate(-90deg);transition:opacity .3s ease}.timer-ring-progress{will-change:stroke-dashoffset;transition:none!important}.timer-wave-progress{will-change:stroke-dashoffset}.timer-ring-progress{transform:rotate(-90deg);transform-origin:120px 120px;transition:none!important}.timer-wrap:has(#timerWaveProgress){--waveGlow:color-mix(in srgb,var(--accent) 45%,transparent)}.timer-wrap:has(#timerWaveProgress) .timer-glow{box-shadow:0 0 65px var(--waveGlow),0 0 120px color-mix(in srgb,var(--accent2) 18%,transparent)}.weekly-goal-target-show.is-visible{display:block!important}.weekly-goal-target-show{margin-top:16px;padding:16px 15px;border-radius:17px;border:1px solid color-mix(in srgb,var(--accent) 24%,var(--border));background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 8%,var(--card2)),color-mix(in srgb,var(--accent2) 7%,var(--card2)));font-size:12px;line-height:1.8;direction:rtl}.weekly-goal-summary-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px;padding-bottom:11px;border-bottom:1px solid var(--border)}.weekly-goal-summary-head>span{font-weight:900;color:var(--text);font-size:13px;line-height:1.7;white-space:nowrap}.weekly-goal-summary-head small{color:var(--muted);font-size:10px;line-height:1.9;text-align:left;max-width:58%}.weekly-goal-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.weekly-goal-summary-grid>div{padding:12px 13px;border-radius:14px;background:#ffffff08;border:1px solid var(--border);min-width:0}.weekly-goal-summary-grid span{display:block;color:var(--muted);font-size:10px;line-height:1.8;margin-bottom:3px}.weekly-goal-summary-grid b{display:block;margin-top:0;font-size:16px;line-height:1.7;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:520px){.weekly-goal-target-show{padding:14px 12px}.weekly-goal-summary-head{flex-direction:column;gap:7px;margin-bottom:12px}.weekly-goal-summary-head>span{white-space:normal}.weekly-goal-summary-head small{max-width:none;text-align:right}.weekly-goal-summary-grid{grid-template-columns:1fr;gap:9px}.weekly-goal-summary-grid>div{padding:11px 12px}.weekly-goal-summary-grid b{font-size:15px}}
</style>
.timer-card-pro{min-height:650px!important;background:linear-gradient(145deg,color-mix(in srgb,var(--card) 94%,var(--accent) 6%),var(--card2))!important;border:1px solid color-mix(in srgb,var(--accent) 28%,var(--border))!important;box-shadow:0 20px 55px rgba(35,50,85,.13),0 0 45px color-mix(in srgb,var(--accent) 12%,transparent)!important;border-radius:26px!important}
.timer-scene-lines{position:absolute!important;inset:-20%!important;z-index:0!important;opacity:.55;background:repeating-linear-gradient(118deg,transparent 0 38px,color-mix(in srgb,var(--accent) 28%,transparent) 39px 41px,transparent 42px 96px),repeating-linear-gradient(28deg,transparent 0 92px,color-mix(in srgb,var(--accent2) 18%,transparent) 93px 95px,transparent 96px 160px);background-size:210px 210px,300px 300px;animation:timerSceneMove 15s linear infinite;pointer-events:none;transform:rotate(-4deg)}
.timer-scene-lines:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 48%,transparent 0 150px,color-mix(in srgb,var(--accent) 9%,transparent) 152px 154px,transparent 156px)}
@keyframes timerSceneMove{0%{transform:translate3d(-3%,-2%,0) rotate(-4deg)}50%{transform:translate3d(2%,2%,0) rotate(-1deg)}100%{transform:translate3d(4%,-1%,0) rotate(-4deg)}}
.timer-topline{position:relative;z-index:3;display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:9px 12px;border:1px solid color-mix(in srgb,var(--accent) 22%,var(--border));border-radius:12px;background:color-mix(in srgb,var(--card2) 88%,var(--accent) 12%);font-size:10px;letter-spacing:2px;color:var(--muted)}
.timer-topline b{color:var(--accent);font-size:10px;letter-spacing:1px}
.timer-inputs-pro{position:relative;z-index:3;margin-bottom:4px!important}.timer-inputs-pro label{font-weight:800}.timer-inputs-pro input{border-color:color-mix(in srgb,var(--accent) 20%,var(--border))!important}
.timer-wrap{width:min(350px,82vw)!important;margin:22px auto 12px!important;isolation:isolate;filter:drop-shadow(0 18px 34px color-mix(in srgb,var(--accent) 16%,transparent))}
.timer-grid{position:absolute;inset:11%;border-radius:50%;background:repeating-linear-gradient(0deg,transparent 0 16px,color-mix(in srgb,var(--accent) 10%,transparent) 17px 18px),repeating-linear-gradient(90deg,transparent 0 16px,color-mix(in srgb,var(--accent2) 8%,transparent) 17px 18px);mask-image:radial-gradient(circle,transparent 0 38%,#000 42%,#000 57%,transparent 61%);animation:timerGridPulse 5s ease-in-out infinite;z-index:0}
@keyframes timerGridPulse{0%,100%{opacity:.45;transform:scale(.97)}50%{opacity:.9;transform:scale(1.03)}}
.timer-glow{position:absolute;width:68%;height:68%;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--accent) 20%,transparent) 0%,transparent 66%);filter:blur(10px);animation:timerGlow 3.8s ease-in-out infinite;z-index:0}
@keyframes timerGlow{0%,100%{transform:scale(.88);opacity:.55}50%{transform:scale(1.06);opacity:1}}
.timer-orbit{position:absolute;border:1px solid color-mix(in srgb,var(--accent) 34%,transparent);border-radius:50%;z-index:0;pointer-events:none}
.orbit-one{inset:4%;animation:orbitSpin 14s linear infinite}.orbit-two{inset:8%;border-color:color-mix(in srgb,var(--accent2) 30%,transparent);animation:orbitSpinReverse 19s linear infinite}.orbit-three{inset:15%;border-style:dashed;border-color:color-mix(in srgb,var(--accent) 24%,transparent);animation:orbitSpin 26s linear infinite}
.orbit-one:after,.orbit-two:after,.orbit-three:after{content:"";position:absolute;width:7px;height:7px;border-radius:50%;top:50%;left:-3px;background:var(--accent);box-shadow:0 0 12px var(--accent),0 0 24px var(--accent)}
.orbit-two:after{background:var(--accent2);box-shadow:0 0 12px var(--accent2),0 0 24px var(--accent2);left:auto;right:-3px}
@keyframes orbitSpin{to{transform:rotate(360deg)}}@keyframes orbitSpinReverse{to{transform:rotate(-360deg)}}
.timer-spark{position:absolute;width:5px;height:5px;border-radius:50%;background:#fff;box-shadow:0 0 10px var(--accent),0 0 20px var(--accent);z-index:2}.spark-a{top:14%;right:19%;animation:sparkFloat 3.2s ease-in-out infinite}.spark-b{bottom:19%;left:15%;animation:sparkFloat 4.5s ease-in-out infinite .6s}.spark-c{top:26%;left:12%;animation:sparkFloat 3.8s ease-in-out infinite 1.2s}@keyframes sparkFloat{0%,100%{transform:translate(0,0) scale(.7);opacity:.4}50%{transform:translate(8px,-14px) scale(1.5);opacity:1}}
.timer-ring{position:relative;z-index:3}.timer-ring-bg{stroke:color-mix(in srgb,var(--text) 10%,transparent)!important;stroke-width:9!important}.timer-ring-progress{stroke-width:10!important;filter:drop-shadow(0 0 7px color-mix(in srgb,var(--accent) 55%,transparent));transition:none!important}
.timer-center{z-index:4}.timer-kicker{font-size:9px;letter-spacing:3px;font-weight:900;color:var(--muted);margin-bottom:2px}.timer{font-size:64px!important;text-shadow:0 0 18px color-mix(in srgb,var(--accent) 28%,transparent)}.timer-status{font-weight:800;color:var(--accent)!important}.timer-label-pro{margin-top:7px;padding:5px 12px;border-radius:999px;background:color-mix(in srgb,var(--accent) 10%,var(--card2));border:1px solid color-mix(in srgb,var(--accent) 22%,var(--border));font-size:11px;font-weight:900;color:var(--text)}
.timer-actions-pro{position:relative;z-index:4}.timer-actions-pro .btn{min-width:112px!important;border-radius:12px!important;font-weight:900!important}.timer-actions-pro .btn:first-child{box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 22%,transparent)}
.timer-tip-pro{position:relative;z-index:3;display:flex;align-items:center;gap:10px;text-align:right;margin:18px auto 0;max-width:560px;padding:12px 14px;border-radius:14px;border:1px solid color-mix(in srgb,var(--accent) 18%,var(--border));background:color-mix(in srgb,var(--card2) 92%,var(--accent) 8%)}.timer-tip-pro>span{font-size:22px}.timer-tip-pro b{display:block;font-size:12px;color:var(--text)}.timer-tip-pro small{display:block;margin-top:3px;color:var(--muted);font-size:10px;line-height:1.7}
@media(max-width:520px){.timer-card-pro{min-height:610px!important;padding:14px!important}.timer-topline{font-size:8px}.timer-wrap{width:min(320px,88vw)!important}.timer{font-size:52px!important}.timer-actions-pro{display:grid!important;grid-template-columns:1fr 1fr;width:100%}.timer-actions-pro .btn{min-width:0!important}.timer-tip-pro{text-align:right}}
body.dark-mode .timer-card-pro{box-shadow:0 20px 60px rgba(0,0,0,.34),0 0 55px color-mix(in srgb,var(--accent) 14%,transparent)!important}
</style>

<style id="focusplan-pdf-week-countdown-v1">
.pdf-week-countdown{margin:14px auto 16px;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border:1px solid color-mix(in srgb,var(--accent) 22%,var(--border));border-radius:16px;background:color-mix(in srgb,var(--card2) 92%,var(--accent) 8%);box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 8%,transparent)}
.pdf-week-countdown span{font-weight:900;color:var(--text)}
.pdf-week-countdown b{font-size:18px;color:var(--accent);direction:ltr;min-width:110px}
.pdf-week-countdown small{color:var(--muted);font-size:11px}
body:not(.dark-mode) .pdf-week-countdown{background:linear-gradient(145deg,#fff,#f3f6fb);border-color:#dce4f0}
</style>
<style id="focusplan-pdf-motion-v10">
/* ===== PDF Studio UI + unmistakably animated stream backgrounds ===== */
#pdf>h2{position:relative;display:flex;align-items:center;gap:10px;margin-bottom:14px;font-weight:950;letter-spacing:-.3px}
#pdf>h2:before{content:'PDF';display:inline-grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-size:11px;letter-spacing:1px;box-shadow:0 10px 24px color-mix(in srgb,var(--accent) 24%,transparent),0 0 0 5px color-mix(in srgb,var(--accent) 7%,transparent)}
#pdf>.card:first-of-type{position:relative;overflow:hidden;padding:24px!important;border:1px solid color-mix(in srgb,var(--accent) 22%,var(--border))!important;border-radius:24px!important;background:linear-gradient(145deg,color-mix(in srgb,var(--card) 96%,var(--accent) 4%),var(--card2))!important;box-shadow:0 16px 40px rgba(35,50,85,.10),0 0 35px color-mix(in srgb,var(--accent) 7%,transparent)!important}
#pdf>.card:first-of-type:before{content:'';position:absolute;inset:-45%;background:repeating-linear-gradient(118deg,transparent 0 34px,color-mix(in srgb,var(--accent) 12%,transparent) 35px 37px,transparent 38px 86px);background-size:220px 220px;animation:pdfPanelLines 12s linear infinite;pointer-events:none;opacity:.7}
#pdf>.card:first-of-type>*{position:relative;z-index:1}
#pdf>.card:first-of-type h3{font-size:22px;margin:2px 0 8px;color:var(--text)}
#pdf>.card:first-of-type .muted{max-width:720px;margin:0 auto 18px;line-height:2;color:var(--muted)}
#pdf>.card:first-of-type .row{gap:10px}
#pdf>.card:first-of-type .btn{min-height:46px;border-radius:14px;font-weight:900;box-shadow:0 8px 20px rgba(35,50,85,.10)}
#pdf>.card:first-of-type .notice{display:inline-flex;align-items:center;justify-content:center;gap:7px;margin:16px auto 0!important;padding:9px 13px;border-radius:12px;background:color-mix(in srgb,var(--accent) 7%,var(--card2));border:1px solid color-mix(in srgb,var(--accent) 16%,var(--border));color:var(--muted)!important}
#weeklyReportPreview{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 18%,var(--border))!important;border-radius:24px!important;background:linear-gradient(145deg,color-mix(in srgb,var(--card) 97%,var(--accent) 3%),var(--card2))!important;box-shadow:0 14px 38px rgba(35,50,85,.09)!important;padding:14px!important}
#weeklyReportPreview:before{content:'پیش‌نمایش گزارش';position:sticky;top:0;z-index:8;display:flex;align-items:center;justify-content:center;height:38px;margin:-14px -14px 14px;padding:0 12px;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 12%,var(--card2)),color-mix(in srgb,var(--accent2) 10%,var(--card2)),color-mix(in srgb,var(--accent) 12%,var(--card2)));border-bottom:1px solid color-mix(in srgb,var(--accent) 16%,var(--border));color:var(--text);font-size:12px;font-weight:950;letter-spacing:.2px}
@keyframes pdfPanelLines{from{background-position:0 0;transform:rotate(-2deg) translate3d(-2%,0,0)}50%{background-position:220px 110px;transform:rotate(1deg) translate3d(1%,1%,0)}to{background-position:440px 220px;transform:rotate(-1deg) translate3d(3%,-1%,0)}}

/* Make the stream scene move in an obvious way instead of only slowly drifting. */
body::before{
  background:
    repeating-linear-gradient(118deg,transparent 0 24px,var(--fp-line-strong) 25px 29px,transparent 30px 72px),
    repeating-linear-gradient(28deg,transparent 0 54px,var(--fp-line-soft) 55px 58px,transparent 59px 118px),
    repeating-linear-gradient(90deg,transparent 0 96px,var(--fp-line-soft) 97px 99px,transparent 100px 198px),
    radial-gradient(circle at 14% 24%,transparent 0 68px,var(--fp-ring) 70px 75px,transparent 77px),
    radial-gradient(circle at 82% 70%,transparent 0 102px,var(--fp-ring) 104px 109px,transparent 111px)!important;
  background-size:170px 170px,230px 230px,300px 300px,100% 100%,100% 100%!important;
  background-position:0 0,0 0,0 0,0 0,0 0!important;
  mix-blend-mode:normal!important;
  animation:fpSceneLinesVisible 10s linear infinite!important;
  transform:none!important;
}
body:not(.dark-mode){--fp-line-strong:rgba(35,83,115,.27)!important;--fp-line-soft:rgba(45,112,135,.16)!important;--fp-ring:rgba(40,120,145,.20)!important}
body.dark-mode{--fp-line-strong:var(--fp-line-strong)!important}
@keyframes fpSceneLinesVisible{
  0%{background-position:0 0,0 0,0 0,0 0,0 0}
  25%{background-position:42px -28px,-34px 30px,26px 0,0 0,0 0}
  50%{background-position:84px -56px,-68px 60px,52px 0,0 0,0 0}
  75%{background-position:126px -84px,-102px 90px,78px 0,0 0,0 0}
  100%{background-position:168px -112px,-136px 120px,104px 0,0 0,0 0}
}
/* A second moving line field inside the main cards, so motion remains visible on white panels too. */
.card::after,.hero::after{opacity:.48!important;background:repeating-linear-gradient(118deg,transparent 0 42px,var(--fp-line-soft) 43px 46px,transparent 47px 92px),repeating-linear-gradient(28deg,transparent 0 78px,color-mix(in srgb,var(--fp-line-strong) 60%,transparent) 79px 81px,transparent 82px 150px)!important;background-size:210px 210px,280px 280px!important;animation:fpCardLinesVisible 7s linear infinite!important}
@keyframes fpCardLinesVisible{from{background-position:0 0,0 0}to{background-position:210px 140px,-280px 180px}}

@media(max-width:720px){
 #pdf>.card:first-of-type{padding:19px!important;border-radius:20px!important}
 #pdf>.card:first-of-type h3{font-size:19px}
 #pdf>.card:first-of-type .row{display:grid!important;grid-template-columns:1fr!important}
 #pdf>.card:first-of-type .btn{width:100%}
 #weeklyReportPreview{border-radius:20px!important}
}
</style>
<style id="focusplan-final-polish-v11">
/* PDF preview is intentionally theme-independent: keep its paper, text and preview colors unchanged in light/dark app mode. */
#weeklyReportPreview, #weeklyReportPreview .pdf-sheet, #weeklyReportPreview .pdf-sheet *{
  color-scheme:light!important;
}
#weeklyReportPreview .pdf-sheet{
  background:#fff!important;
  color:#172033!important;
  -webkit-text-fill-color:#172033!important;
}
#weeklyReportPreview .pdf-sheet *{
  color-scheme:light!important;
  text-shadow:none!important;
}
#weeklyReportPreview .pdf-sheet h1,
#weeklyReportPreview .pdf-sheet h2,
#weeklyReportPreview .pdf-sheet h3,
#weeklyReportPreview .pdf-sheet b,
#weeklyReportPreview .pdf-sheet strong{
  text-shadow:none!important;
}
/* PDF: keep the familiar previous preview; only the control card gets the new studio treatment. */
#weeklyReportPreview{
  position:relative!important;
  overflow:visible!important;
  border:0!important;
  border-radius:0!important;
  background:transparent!important;
  box-shadow:none!important;
  padding:0!important;
}
#weeklyReportPreview:before{content:none!important;display:none!important}
#weeklyReportPreview .pdf-sheet{margin-top:0!important}

/* Slow, cinematic motion for the PDF panel. */
#pdf>.card:first-of-type:before{
  opacity:.32!important;
  animation:pdfPanelLinesSlow 24s linear infinite!important;
}
@keyframes pdfPanelLinesSlow{
  from{background-position:0 0;transform:rotate(-1deg) translate3d(-1%,0,0)}
  50%{background-position:110px 55px;transform:rotate(.5deg) translate3d(.5%,.5%,0)}
  to{background-position:220px 110px;transform:rotate(-.5deg) translate3d(1%,-.5%,0)}
}

/* Same visual language across every section: moving lines + large soft rings. */
main{position:relative!important;isolation:isolate}
main:before{
  content:'';position:fixed;inset:-18%;pointer-events:none;z-index:-1;opacity:.24;
  background:
    radial-gradient(circle at 12% 18%,transparent 0 92px,var(--fp-ring) 94px 98px,transparent 100px),
    radial-gradient(circle at 86% 74%,transparent 0 135px,var(--fp-ring) 137px 141px,transparent 143px),
    radial-gradient(circle at 52% 42%,transparent 0 210px,color-mix(in srgb,var(--fp-ring) 45%,transparent) 212px 214px,transparent 216px);
  background-size:100% 100%;
  animation:fpGlobalRingsSlow 34s ease-in-out infinite alternate;
}
main:after{
  content:'';position:fixed;inset:-12%;pointer-events:none;z-index:-1;opacity:.16;
  background:
    repeating-linear-gradient(118deg,transparent 0 76px,var(--fp-line-soft) 77px 79px,transparent 80px 170px),
    repeating-linear-gradient(28deg,transparent 0 118px,color-mix(in srgb,var(--fp-line-strong) 55%,transparent) 119px 121px,transparent 122px 250px);
  background-size:260px 260px,360px 360px;
  animation:fpGlobalLinesSlow 26s linear infinite;
}
@keyframes fpGlobalRingsSlow{
  0%{transform:translate3d(-2%,-1%,0) scale(.98) rotate(-1deg)}
  50%{transform:translate3d(1%,1%,0) scale(1.015) rotate(.5deg)}
  100%{transform:translate3d(2%,-1%,0) scale(1.03) rotate(1deg)}
}
@keyframes fpGlobalLinesSlow{
  from{background-position:0 0,0 0}
  to{background-position:260px 150px,-360px 210px}
}

/* Give major cards their own subtle orbit/ring layer without the frosted-glass look. */
.card:not(.timer-card-pro):not(.weekly-report){isolation:isolate}
.card:not(.timer-card-pro):not(.weekly-report)::before{
  content:'';position:absolute;inset:-28%;pointer-events:none;z-index:0;opacity:.10;
  background:
    radial-gradient(circle at 18% 24%,transparent 0 72px,var(--fp-ring) 74px 77px,transparent 79px),
    radial-gradient(circle at 84% 76%,transparent 0 98px,var(--fp-ring) 100px 103px,transparent 105px);
  animation:fpCardRingsSlow 30s ease-in-out infinite alternate;
}
.card:not(.timer-card-pro):not(.weekly-report)>*{position:relative;z-index:1}
@keyframes fpCardRingsSlow{
  0%{transform:translate3d(-2%,-1%,0) rotate(-1deg)}
  100%{transform:translate3d(2%,1%,0) rotate(1deg)}
}

/* Keep the moving line layer visible, but calmer than before. */
.card:not(.timer-card-pro):not(.weekly-report)::after,.hero::after{
  opacity:.18!important;
  animation:fpCardLinesCalm 18s linear infinite!important;
}
@keyframes fpCardLinesCalm{from{background-position:0 0,0 0}to{background-position:210px 140px,-280px 180px}}
</style>

<style id="focusplan-timer-program-test-v13">
/* ===== Timer: fully themed per stream, vivid but clean ===== */
.timer-card-pro{position:relative!important;overflow:hidden!important;isolation:isolate!important;min-height:640px!important;background:linear-gradient(145deg,color-mix(in srgb,var(--card) 88%,var(--accent) 12%),color-mix(in srgb,var(--card2) 86%,var(--accent2) 14%))!important;border:1px solid color-mix(in srgb,var(--accent) 42%,var(--border))!important;box-shadow:0 24px 65px rgba(25,35,70,.15),0 0 70px color-mix(in srgb,var(--accent) 15%,transparent),inset 0 1px 0 color-mix(in srgb,#fff 28%,transparent)!important}
.timer-card-pro:before{content:"";position:absolute;inset:-35%;z-index:-1;background:radial-gradient(circle at 50% 44%,color-mix(in srgb,var(--accent) 24%,transparent) 0 9%,transparent 27%),radial-gradient(circle at 15% 85%,color-mix(in srgb,var(--accent2) 18%,transparent),transparent 28%);animation:fpTimerAura 12s ease-in-out infinite alternate;pointer-events:none}
.timer-card-pro:after{content:"";position:absolute;inset:-50%;z-index:-1;background:repeating-linear-gradient(122deg,transparent 0 52px,color-mix(in srgb,var(--accent) 12%,transparent) 53px 55px,transparent 56px 120px);background-size:250px 250px;animation:fpTimerLines 20s linear infinite;pointer-events:none;opacity:.8}
@keyframes fpTimerAura{from{transform:translate(-4%,-2%) scale(.96)}to{transform:translate(4%,3%) scale(1.04)}}
@keyframes fpTimerLines{from{background-position:0 0}to{background-position:250px -180px}}
.timer-topline{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 13%,var(--card2)),color-mix(in srgb,var(--accent2) 10%,var(--card2)))!important;border-color:color-mix(in srgb,var(--accent) 34%,var(--border))!important;box-shadow:0 8px 24px color-mix(in srgb,var(--accent) 10%,transparent)!important}
.timer-topline b{animation:fpLivePulse 1.8s ease-in-out infinite}
@keyframes fpLivePulse{50%{opacity:.48;transform:scale(.96)}}
.timer-wrap{filter:drop-shadow(0 22px 42px color-mix(in srgb,var(--accent) 24%,transparent))!important}
.timer-orbit{border-color:color-mix(in srgb,var(--accent) 48%,transparent)!important;box-shadow:0 0 18px color-mix(in srgb,var(--accent) 20%,transparent)!important}
.timer-orbit.orbit-two{border-color:color-mix(in srgb,var(--accent2) 42%,transparent)!important}
.timer-orbit.orbit-three{border-color:color-mix(in srgb,var(--accent) 25%,transparent)!important}
.timer-glow{background:radial-gradient(circle,color-mix(in srgb,var(--accent) 27%,transparent),transparent 66%)!important;animation:fpTimerGlow 4s ease-in-out infinite alternate}
@keyframes fpTimerGlow{from{opacity:.5;transform:scale(.94)}to{opacity:.95;transform:scale(1.08)}}
.timer-grid{opacity:.5!important;background:repeating-linear-gradient(0deg,transparent 0 15px,color-mix(in srgb,var(--accent) 14%,transparent) 16px 17px),repeating-linear-gradient(90deg,transparent 0 15px,color-mix(in srgb,var(--accent2) 10%,transparent) 16px 17px)!important}
.timer-center{background:radial-gradient(circle,color-mix(in srgb,var(--card) 91%,transparent),color-mix(in srgb,var(--card) 72%,transparent) 70%,transparent 100%)!important}
.timer{color:var(--text)!important;text-shadow:0 0 18px color-mix(in srgb,var(--accent) 34%,transparent),0 3px 18px rgba(0,0,0,.14)!important}
.timer-kicker{color:var(--accent)!important;letter-spacing:3px!important}
.timer-label-pro{color:var(--accent2)!important;font-weight:900!important}
.timer-status{color:var(--muted)!important}
.timer-ring-progress{filter:drop-shadow(0 0 8px color-mix(in srgb,var(--accent) 60%,transparent))!important}
.timer-spark{background:var(--accent)!important;box-shadow:0 0 14px var(--accent)!important}
.timer-spark.spark-b{background:var(--accent2)!important;box-shadow:0 0 14px var(--accent2)!important}
.timer-tip-pro{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 10%,var(--card2)),color-mix(in srgb,var(--accent2) 8%,var(--card2)))!important;border-color:color-mix(in srgb,var(--accent) 22%,var(--border))!important;box-shadow:0 10px 25px color-mix(in srgb,var(--accent) 8%,transparent)!important}
.timer-tip-pro>span{color:var(--accent)!important;text-shadow:0 0 12px color-mix(in srgb,var(--accent) 65%,transparent)!important}
/* Distinct personality per stream */
body.stream-tajrobi .timer-card-pro{--timer-hue:var(--accent)}
body.stream-riazi .timer-card-pro{--timer-hue:var(--accent)}
body.stream-ensani .timer-card-pro{--timer-hue:var(--accent)}

/* ===== Light mode: program/test controls must visually belong to the light UI ===== */
body:not(.dark-mode){color-scheme:light!important}
body:not(.dark-mode) input,body:not(.dark-mode) select,body:not(.dark-mode) textarea{color:#1d2940!important;background:#fff!important;border-color:#d6deeb!important;box-shadow:0 2px 8px rgba(45,65,100,.05)!important}
body:not(.dark-mode) select{color-scheme:light!important;appearance:auto!important}
body:not(.dark-mode) select option{background:#fff!important;color:#1d2940!important}
body:not(.dark-mode) input[type="date"]{color-scheme:light!important}
body:not(.dark-mode) input[type="date"]::-webkit-calendar-picker-indicator{opacity:.72!important;filter:none!important}
body:not(.dark-mode) .form label{color:#34425b!important}
body:not(.dark-mode) .form input:focus,body:not(.dark-mode) .form select:focus,body:not(.dark-mode) .form textarea:focus{border-color:color-mix(in srgb,var(--accent) 55%,#d6deeb)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 10%,transparent),0 5px 16px rgba(45,65,100,.07)!important}

/* Light-mode popup/select/date containers: make the trigger area match the page */
body:not(.dark-mode) .test-manager-card .form,
body:not(.dark-mode) #plan .form{background:linear-gradient(145deg,#ffffff,#f7f9fd)!important;border:1px solid #e1e7f0!important;border-radius:18px!important;padding:14px!important;box-shadow:0 8px 25px rgba(38,55,90,.06)!important}
body:not(.dark-mode) .test-manager-card .form label,
body:not(.dark-mode) #plan .form label{font-weight:850!important}

/* ===== Tests table = exact visual language of Program table ===== */
.test-list-wrap{border:1px solid var(--border)!important;border-radius:18px!important;background:var(--card)!important;box-shadow:0 10px 28px rgba(35,50,85,.07)!important}
#plan table,.test-table{border-collapse:separate!important;border-spacing:0!important;overflow:hidden!important;border-radius:16px!important}
#plan table thead th,.test-table thead th{height:48px!important;font-size:12px!important;letter-spacing:.1px!important}
#plan table tbody tr,.test-table tbody tr{transition:transform .16s ease,background .16s ease,box-shadow .16s ease!important}
#plan table tbody tr:hover,.test-table tbody tr:hover{transform:translateY(-1px)!important;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 15%,transparent)!important}
.test-table tbody td{font-size:12px!important}
.test-table .schedule-date-pill{min-width:128px;text-align:center!important;font-weight:800!important}
.test-count-badge{min-width:72px;text-align:center!important;background:color-mix(in srgb,var(--accent) 10%,var(--card))!important;border:1px solid color-mix(in srgb,var(--accent) 16%,var(--border))!important;color:var(--text)!important}
.test-status-btn{min-width:104px!important;white-space:nowrap!important}
body:not(.dark-mode) .test-status-btn.is-pending{background:#f4f7fb!important;color:#33425a!important;border-color:#d6deeb!important}
body:not(.dark-mode) .test-status-btn.is-done{background:#eafaf4!important;color:#137c5a!important;border-color:#b8e8d5!important}
body:not(.dark-mode) .actual-tests{color:#137c5a!important}
body:not(.dark-mode) .test-min{color:#65728a!important}
body:not(.dark-mode) .test-row-done{background:#f0fbf7!important}

/* Mobile: both tables become the same clean stacked-card rhythm */
@media(max-width:760px){
  #plan .table-wrap,.test-list-wrap{overflow:visible!important;border:0!important;background:transparent!important;box-shadow:none!important}
  #plan table,.test-table{min-width:0!important;width:100%!important;display:block!important}
  #plan table thead,.test-table thead{display:none!important}
  #plan table tbody,.test-table tbody{display:grid!important;gap:11px!important}
  #plan table tbody tr,.test-table tbody tr{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px 10px!important;padding:13px!important;border:1px solid var(--border)!important;border-radius:17px!important;background:var(--card)!important;box-shadow:0 7px 18px rgba(35,50,85,.06)!important}
  #plan table tbody td,.test-table tbody td{display:flex!important;align-items:center!important;min-width:0!important;padding:3px 0!important;border:0!important;background:transparent!important}
  #plan table tbody td:nth-child(1),.test-table tbody td:nth-child(1){grid-column:1/-1}
  #plan table tbody td:nth-child(7),.test-table tbody td:nth-child(7){grid-column:1/-1;justify-content:flex-end;gap:6px}
  .test-table tbody td:nth-child(5){justify-content:flex-start}
  .test-table .schedule-date-pill{min-width:0!important}
}
</style>


<style id="focusplan-light-popup-fix-v15">
/* ===== Light-mode native date/select popups ===== */
html:has(body:not(.dark-mode)), body:not(.dark-mode){
  color-scheme:light!important;
}
body:not(.dark-mode) .form select,
body:not(.dark-mode) select,
body:not(.dark-mode) .form input[type="date"],
body:not(.dark-mode) input[type="date"]{
  color:#172238!important;
  -webkit-text-fill-color:#172238!important;
  background-color:#ffffff!important;
  border-color:#cfd9e8!important;
  color-scheme:light!important;
}
body:not(.dark-mode) select{
  appearance:auto!important;
  -webkit-appearance:auto!important;
  forced-color-adjust:none!important;
}
body:not(.dark-mode) select option,
body:not(.dark-mode) select optgroup{
  background:#ffffff!important;
  color:#172238!important;
  -webkit-text-fill-color:#172238!important;
}
body:not(.dark-mode) select option:checked,
body:not(.dark-mode) select option:hover{
  background:#eef4ff!important;
  color:#172238!important;
}
body:not(.dark-mode) input[type="date"]::-webkit-datetime-edit,
body:not(.dark-mode) input[type="date"]::-webkit-datetime-edit-fields-wrapper,
body:not(.dark-mode) input[type="date"]::-webkit-datetime-edit-text,
body:not(.dark-mode) input[type="date"]::-webkit-datetime-edit-month-field,
body:not(.dark-mode) input[type="date"]::-webkit-datetime-edit-day-field,
body:not(.dark-mode) input[type="date"]::-webkit-datetime-edit-year-field{
  color:#172238!important;
  -webkit-text-fill-color:#172238!important;
  opacity:1!important;
}
body:not(.dark-mode) input[type="date"]::-webkit-calendar-picker-indicator{
  opacity:.82!important;
  filter:none!important;
}
/* Keep dark mode explicitly dark so the two native controls never mix themes. */
html:has(body.dark-mode), body.dark-mode{color-scheme:dark!important}
body.dark-mode select,
body.dark-mode select option,
body.dark-mode select optgroup,
body.dark-mode input[type="date"]{
  color-scheme:dark!important;
}

/* Program + test form panels: make the light popup/field area visually belong to the page. */
body:not(.dark-mode) #plan .card,
body:not(.dark-mode) #tests .card,
body:not(.dark-mode) #plan .form,
body:not(.dark-mode) #tests .form{
  color:#172238!important;
}
body:not(.dark-mode) #plan label,
body:not(.dark-mode) #tests label{
  color:#33415a!important;
}
</style>


</body></html>`);w.document.close()}

function copyRepeatDatePlus(dateStr,days){const d=new Date(dateStr+'T12:00:00');d.setDate(d.getDate()+days);return isoLocal(d)}
function copyPlanRecord(p,date){return {id:`plan_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,date,subject:String(p.subject||''),topic:String(p.topic||'مطالعه'),min:Math.max(1,Math.min(1440,+p.min||45)),done:false,important:!!p.important}}
function getCopySourceDate(){return document.getElementById('copyRepeatSourceDate')?.value||today()}
function copyProgramToTomorrow(){if(!db)return;const source=getCopySourceDate(),target=copyRepeatDatePlus(source,1),plans=(db.plans||[]).filter(x=>x.date===source);if(!plans.length){alert('برای این روز برنامه‌ای ثبت نشده است.');return}const exists=(db.plans||[]).filter(x=>x.date===target);if(exists.length&&!confirm(`فردا از قبل ${fa(exists.length)} برنامه دارد. برنامه‌های جدید هم اضافه شوند؟`))return;plans.forEach(p=>db.plans.push(copyPlanRecord(p,target)));persist();alert(`برنامه‌های ${formatScheduleDate(source)} برای فردا کپی شدند. 📋✅`)}
function repeatProgramForward(){if(!db)return;const source=getCopySourceDate(),days=Math.max(2,+document.getElementById('copyRepeatDays')?.value||7),plans=(db.plans||[]).filter(x=>x.date===source);if(!plans.length){alert('برای این روز برنامه‌ای ثبت نشده است.');return}const targets=Array.from({length:days},(_,i)=>copyRepeatDatePlus(source,i+1)),existing=targets.reduce((n,d)=>n+(db.plans||[]).filter(x=>x.date===d).length,0);if(existing&&!confirm(`در روزهای مقصد مجموعاً ${fa(existing)} برنامه از قبل وجود دارد. برنامه‌های تکرارشده هم اضافه شوند؟`))return;targets.forEach(date=>plans.forEach(p=>db.plans.push(copyPlanRecord(p,date))));persist();alert(`برنامه‌ها برای ${fa(days)} روز آینده تکرار شدند. 🔁✅`)}
let fpEditingPlanIndex=null;
let fpEditingTestIndex=null;
function startEditPlan(i){
 const p=db?.plans?.[i]; if(!p)return;
 fpEditingPlanIndex=i; fpEditingTestIndex=null;
 const d=document.getElementById('pDate'),sub=document.getElementById('pSubject'),topic=document.getElementById('pTopic'),min=document.getElementById('pMinutes'),imp=document.getElementById('pImportant');
 if(d)d.value=p.date||today(); if(sub)sub.value=p.subject||''; if(topic)topic.value=p.topic||''; if(min)min.value=p.min||''; if(imp)imp.checked=!!p.important;
 const btn=document.querySelector('#plan .form button[onclick="addPlan()"]'); if(btn){btn.textContent='ذخیره ویرایش';btn.classList.add('edit-active');}
 let cancel=document.getElementById('cancelPlanEdit'); if(!cancel){cancel=document.createElement('button');cancel.id='cancelPlanEdit';cancel.type='button';cancel.className='btn secondary';cancel.textContent='انصراف';cancel.onclick=cancelPlanEdit;btn?.parentNode?.appendChild(cancel)}
 cancel.style.display='inline-flex';
 document.getElementById('pDate')?.scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelPlanEdit(){fpEditingPlanIndex=null;const btn=document.querySelector('#plan .form button[onclick="addPlan()"]');if(btn){btn.textContent='افزودن برنامه';btn.classList.remove('edit-active')}const c=document.getElementById('cancelPlanEdit');if(c)c.style.display='none';document.getElementById('pTopic').value='';document.getElementById('pMinutes').value='';if(document.getElementById('pTags'))document.getElementById('pTags').value='';if(document.getElementById('pImportant'))document.getElementById('pImportant').checked=false}
function startEditTest(i){
 const t=db?.testTasks?.[i]; if(!t)return;
 fpEditingTestIndex=i; fpEditingPlanIndex=null;
 const topic=document.getElementById('testTopic'),sub=document.getElementById('testSubject'),count=document.getElementById('testCount'),date=document.getElementById('testDate'),imp=document.getElementById('tImportant');
 if(topic)topic.value=t.topic||''; if(sub)sub.value=t.subject||''; if(count)count.value=t.count||''; if(date)date.value=t.date||today(); if(imp)imp.checked=!!t.important;
 const btn=document.querySelector('#plan .test-manager-card .form button[onclick="addTestTask()"]'); if(btn){btn.textContent='ذخیره ویرایش';btn.classList.add('edit-active');}
 let cancel=document.getElementById('cancelTestEdit'); if(!cancel){cancel=document.createElement('button');cancel.id='cancelTestEdit';cancel.type='button';cancel.className='btn secondary';cancel.textContent='انصراف';cancel.onclick=cancelTestEdit;btn?.parentNode?.appendChild(cancel)}
 cancel.style.display='inline-flex';
 document.getElementById('testTopic')?.scrollIntoView({behavior:'smooth',block:'center'});
}
function cancelTestEdit(){fpEditingTestIndex=null;const btn=document.querySelector('#plan .test-manager-card .form button[onclick="addTestTask()"]');if(btn){btn.textContent='➕ افزودن تست';btn.classList.remove('edit-active')}const c=document.getElementById('cancelTestEdit');if(c)c.style.display='none';document.getElementById('testTopic').value='';document.getElementById('testCount').value='';if(document.getElementById('tTags'))document.getElementById('tTags').value='';if(document.getElementById('tImportant'))document.getElementById('tImportant').checked=false}
function addPlan(){if(!db)return;const date=document.getElementById('pDate')?.value||today(),subject=document.getElementById('pSubject')?.value?.trim()||'',topic=document.getElementById('pTopic')?.value?.trim()||'مطالعه',min=Math.min(1440,Math.max(1,Math.round(+document.getElementById('pMinutes')?.value||0))),important=!!document.getElementById('pImportant')?.checked,tags=parseTags(document.getElementById('pTags')?.value||'');if(!subject){alert('لطفاً یک درس انتخاب کن.');return}if(!min){alert('مدت برنامه را وارد کن.');return}if(fpEditingPlanIndex!==null){const p=db.plans[fpEditingPlanIndex];if(!p){cancelPlanEdit();return}const oldDate=p.date,oldSubject=p.subject;const id=p.id||(p.id=`plan_${Date.now()}_${Math.random().toString(36).slice(2,7)}`);p.date=date;p.subject=subject;p.topic=topic;p.min=min;p.important=important;p.tags=tags;/* ویرایش نباید ارتباط برنامه با مطالعه واقعی را از بین ببرد؛ رکورد مطالعه با همان شناسه برنامه به‌روزرسانی می‌شود. */(db.sessions||[]).forEach(sess=>{if(sess.planId===id||(!sess.planId&&sess.source==='plan'&&sess.date===oldDate&&sess.subject===oldSubject)){sess.planId=id;sess.date=date;sess.subject=subject;sess.min=+p.actualMin||+sess.min||0;sess.source='plan';sess.actual=true}});persist();cancelPlanEdit();alert('برنامه با موفقیت ویرایش شد. ✏️');return}db.plans.push({id:`plan_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,date,subject,topic,min,done:false,important,tags});document.getElementById('pTopic').value='';document.getElementById('pMinutes').value='';if(document.getElementById('pImportant'))document.getElementById('pImportant').checked=false;persist();alert('برنامه با موفقیت اضافه شد. 📚') }
function toggleImportantPlan(i){const p=db?.plans?.[i];if(!p)return;p.important=!p.important;persist()}
function toggleImportantTest(i){const t=db?.testTasks?.[i];if(!t)return;t.important=!t.important;persist()}
function renderImportantPlans(){const box=document.getElementById('importantPlansList');if(!box||!db)return;const plans=(db.plans||[]).map((p,i)=>({...p,_i:i,_type:'plan'})).filter(x=>x.important);const tests=(db.testTasks||[]).map((t,i)=>({...t,_i:i,_type:'test'})).filter(x=>x.important);const rows=[...plans,...tests].sort((a,b)=>String(a.date).localeCompare(String(b.date)));if(!rows.length){box.innerHTML='<div class="empty">هنوز برنامه یا تست مهمی مشخص نکرده‌ای. از خود همان مورد ⭐ را فعال کن.</div>';return}box.innerHTML=rows.map(x=>x._type==='plan'?`<div class="important-plan-item"><div><b>⭐ ${x.subject}</b><span>${formatScheduleDate(x.date)} • ${esc(x.topic||'مطالعه')} • ${fa(x.min)} دقیقه</span></div><button class="btn secondary" type="button" onclick="toggleImportantPlan(${x._i})">حذف از مهم‌ها</button></div>`:`<div class="important-plan-item"><div><b>⭐ ${x.subject} <small>تست</small></b><span>${formatScheduleDate(x.date)} • ${esc(x.topic||'تست')} • ${fa(x.count)} تست</span></div><button class="btn secondary" type="button" onclick="toggleImportantTest(${x._i})">حذف از مهم‌ها</button></div>`).join('')}
function openCompletionModal(type,index){const modal=document.getElementById('completionModal'),fields=document.getElementById('completionFields');if(!modal||!fields)return;const isPlan=type==='plan',item=isPlan?db.plans[index]:db.testTasks[index];if(!item)return;const plannedMinutes=Math.max(1,+item.min||0),maxActualMinutes=Math.max(plannedMinutes,Math.round(plannedMinutes*2));const plannedTests=Math.max(1,+item.count||1),maxActualTests=Math.max(plannedTests,Math.round(plannedTests*2));document.getElementById('completionIcon').textContent=isPlan?'📚':'📝';document.getElementById('completionTitle').textContent=isPlan?'زمان واقعی مطالعه را ثبت کن':'نتیجه واقعی تست را ثبت کن';document.getElementById('completionDesc').innerHTML=isPlan?`برای «<b>${esc(item.subject)}</b> — ${item.topic||'مطالعه'}» واقعاً چند دقیقه یا چند ساعت مطالعه کردی؟`:`برای «<b>${esc(item.subject)}</b> — ${item.topic||'تست'}» چند تست زدی و چند دقیقه برای تست‌زنی وقت گذاشتی؟`;fields.innerHTML=isPlan?`<div class="completion-grid"><label>ساعت<input id="actualHours" type="number" min="0" step="1" value="0"></label><label>دقیقه<input id="actualMinutes" type="number" min="0" max="59" step="1" value="0"></label></div><div class="completion-note">این زمان، «مطالعه واقعی» است و در آمار و PDF ثبت می‌شود؛ زمان برنامه فقط پیش‌بینی باقی می‌ماند.<br><b>سقف مجاز: ${fa(maxActualMinutes)} دقیقه (حداکثر ۲ برابر برنامه)</b></div>`:`<div class="completion-grid"><label>تعداد تست واقعی<input id="actualTests" type="number" min="1" step="1" value="${+item.count||1}"></label><label>دقیقه تست‌زنی<input id="actualTestMinutes" type="number" min="0" step="1" value="0"></label></div><div class="completion-note">زمان تست‌زنی هم به زمان مطالعه واقعی اضافه می‌شود.<br><b>سقف تست: ${fa(maxActualTests)} تست و ${fa(maxActualMinutes)} دقیقه (حداکثر ۲ برابر برنامه)</b></div>`;document.getElementById('completionConfirm').onclick=()=>confirmCompletion(type,index);modal.classList.add('show')}
function closeCompletionModal(){document.getElementById('completionModal')?.classList.remove('show')}
function confirmCompletion(type,index){if(type==='plan'){const p=db.plans[index];if(!p)return;const h=Math.max(0,+document.getElementById('actualHours').value||0),m=Math.max(0,+document.getElementById('actualMinutes').value||0),total=h*60+m;const maxAllowed=Math.max(1,Math.round((+p.min||0)*2));if(total<=0){alert('حداقل ۱ دقیقه زمان مطالعه وارد کن.');return}if(total>maxAllowed){alert(`برای این برنامه سقف ثبت مطالعه واقعی ${fa(maxAllowed)} دقیقه است (حداکثر ۲ برابر زمان پیش‌بینی‌شده).`);return}const id=p.id||(p.id=`plan_${Date.now()}_${Math.random().toString(36).slice(2,7)}`);db.sessions=db.sessions.filter(s=>s.planId!==id);db.sessions.push({id:`session_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,planId:id,date:p.date,subject:p.subject,min:total,tests:0,percent:100,source:'plan',actual:true});p.done=true;p.actualMin=total}else{const t=db.testTasks?.[index];if(!t)return;const count=Math.max(1,+document.getElementById('actualTests').value||0),minutes=Math.max(0,+document.getElementById('actualTestMinutes').value||0),maxCount=Math.max(1,Math.round((+t.count||1)*2)),maxMinutes=Math.max(1,Math.round((+t.min||0)*2));if(count>maxCount){alert(`حداکثر تست قابل ثبت برای این برنامه ${fa(maxCount)} تست است.`);return}if((+t.min||0)>0&&minutes>maxMinutes){alert(`حداکثر زمان تست‌زنی ${fa(maxMinutes)} دقیقه است.`);return}ensureTestTaskIds();const key=testTaskKey(t),legacy=legacyTestTaskKey(t,index);db.sessions=db.sessions.filter(s=>s.testTaskId!==key&&s.testTaskId!==legacy);db.sessions.push({id:`session_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,testTaskId:key,date:t.date,subject:t.subject,min:minutes,tests:count,percent:0,source:'test',actual:true});t.done=true;t.actualCount=count;t.actualMin=minutes}closeCompletionModal();persistProgressFast()}
function togglePlanDone(i){const p=db.plans?.[i];if(!p)return;if(p.done){const id=p.id;db.sessions=(db.sessions||[]).filter(s=>s.planId!==id);p.done=false;delete p.actualMin;delete p.xpUndoCooldownUntil;delete p.xpLockUntil;p.xpToggleCount=0;persistProgressFast();return}openCompletionModal('plan',i)}
function delPlan(i){
 const p=db.plans?.[i]; if(!p)return;
 const id=p.id, date=p.date, subject=p.subject, actual=+p.actualMin||0;
 /* حذف کامل اطلاعات برنامه؛ علاوه بر لینک جدید، رکوردهای قدیمیِ نسخه‌های قبل را هم پاک می‌کنیم. */
 db.sessions=(db.sessions||[]).filter(s=>{
   if(s.planId===id) return false;
   if(s.source==='plan' && s.date===date && s.subject===subject) return false;
   /* نسخه‌های قدیمی planId نداشتند؛ فقط وقتی زمان ثبت‌شده با زمان واقعی همین برنامه یکی است حذفشان کن. */
   if(!s.planId && actual>0 && s.date===date && s.subject===subject && (+s.min||0)===actual && (s.actual===true || s.source==='plan')) return false;
   return true;
 });
 db.plans.splice(i,1); persist();
}function addTestTask(){if(!db)return;const topic=document.getElementById('testTopic')?.value.trim()||'تست',subject=document.getElementById('testSubject')?.value?.trim()||'',count=Math.min(10000,Math.max(1,Math.floor(+(document.getElementById('testCount')?.value||0)))),date=document.getElementById('testDate')?.value||today(),important=!!document.getElementById('tImportant')?.checked,tags=parseTags(document.getElementById('tTags')?.value||'');if(!subject){alert('لطفاً یک درس انتخاب کن.');return}if(!count){alert('تعداد تست را وارد کن.');return}db.testTasks=db.testTasks||[];if(fpEditingTestIndex!==null){const t=db.testTasks[fpEditingTestIndex];if(!t){cancelTestEdit();return}const oldDate=t.date,oldSubject=t.subject;ensureTestTaskIds();const id=t.id||(t.id=`testTask_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);t.topic=topic;t.subject=subject;t.count=count;t.date=date;t.important=important;t.tags=tags;/* ویرایش تست هم باید لینک مطالعه/تست واقعی قبلی را حفظ کند. */(db.sessions||[]).forEach(sess=>{if(sess.testTaskId===id||(!sess.testTaskId&&sess.source==='test'&&sess.date===oldDate&&sess.subject===oldSubject)){sess.testTaskId=id;sess.date=date;sess.subject=subject;sess.source='test';sess.actual=true}});persist();cancelTestEdit();alert('تست با موفقیت ویرایش شد. ✏️');return}db.testTasks.push({id:`testTask_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,topic,subject,count,date,done:false,important,tags});document.getElementById('testTopic').value='';document.getElementById('testCount').value='';if(document.getElementById('tImportant'))document.getElementById('tImportant').checked=false;persist();alert('مورد تست با موفقیت اضافه شد. 📝')}
function toggleTestDone(i){const t=db.testTasks?.[i];if(!t)return;ensureTestTaskIds();if(t.done){const key=testTaskKey(t),legacy=legacyTestTaskKey(t,i);db.sessions=(db.sessions||[]).filter(s=>s.testTaskId!==key&&s.testTaskId!==legacy);t.done=false;delete t.actualCount;delete t.actualMin;delete t.xpUndoCooldownUntil;delete t.xpLockUntil;t.xpToggleCount=0;persistProgressFast();return}openCompletionModal('test',i)}
function delTestTask(i){const t=db.testTasks?.[i];if(!t)return;ensureTestTaskIds();const key=testTaskKey(t),legacy=legacyTestTaskKey(t,i);db.sessions=(db.sessions||[]).filter(s=>s.testTaskId!==key&&s.testTaskId!==legacy&&!(s.source==='test'&&s.date===t.date&&s.subject===t.subject&&s.actual===true));db.testTasks.splice(i,1);persist()}
function addTask(){if(!taskText.value)return;db.tasks.push({text:taskText.value,subject:taskSubject.value,min:+taskTime.value||45,done:false});taskText.value='';taskTime.value='';persist()}
function toggleTask(i){db.tasks[i].done=!db.tasks[i].done;persist()}function delTask(i){db.tasks.splice(i,1);persist()}
function clearAll(){if(!db)return;if(!confirm('تمام اطلاعات FocusPlan شامل برنامه‌ها، تست‌ها، زمان‌های مطالعه و آرشیو PDF و نمودارها حذف شوند؟ این کار قابل برگشت نیست.'))return;localStorage.removeItem(DBKEY);localStorage.removeItem(TIMERKEY);location.reload()}
function resetToday(){if(!db)return;const t=today();if(!confirm('مطالعه‌های ثبت‌شده و تست‌های امروز ریست شوند؟ برنامه‌های امروز حذف نمی‌شوند.'))return;db.sessions=db.sessions.filter(x=>x.date!==t);db.tasks=db.tasks.map(x=>x.date===t?({...x,done:false}):x);db.testTasks=(db.testTasks||[]).map(x=>x.date===t?({...x,done:false}):x);db.plans=db.plans.map(x=>x.date===t?({...x,done:false,actualMin:undefined}):x);db.testTasks=(db.testTasks||[]).map(x=>x.date===t?({...x,done:false,actualCount:undefined,actualMin:undefined}):x);persist();alert('امروز از نو شروع شد! برنامه‌های امروز سر جای خودشان هستند. 🔄')}
function resetAllPrograms(){if(!db)return;const modal=document.getElementById('resetProgramsModal'),input=document.getElementById('resetProgramDate');if(!modal||!input)return;input.value=today();updateResetPreview();modal.classList.add('show')}
function closeResetPrograms(){const modal=document.getElementById('resetProgramsModal');if(modal)modal.classList.remove('show')}
function updateResetPreview(){if(!db)return;const date=document.getElementById('resetProgramDate')?.value||today(),plans=(db.plans||[]).filter(x=>x.date===date),tests=(db.testTasks||[]).filter(x=>x.date===date),el=document.getElementById('resetPreview');if(!el)return;el.innerHTML=`این روز <b>${plans.length}</b> برنامه و <b>${tests.length}</b> مورد تست دارد.`}
function confirmResetPrograms(){if(!db)return;const date=document.getElementById('resetProgramDate')?.value||today(),plans=(db.plans||[]).filter(x=>x.date===date),testsForDate=(db.testTasks||[]).filter(x=>x.date===date),planIds=new Set(plans.map(x=>x.id).filter(Boolean));ensureTestTaskIds();const testKeys=new Set(testsForDate.flatMap(x=>[testTaskKey(x),legacyTestTaskKey(x,(db.testTasks||[]).indexOf(x))]));if(!plans.length&&!((db.testTasks||[]).some(x=>x.date===date))){alert('برای این روز برنامه یا تستی ثبت نشده است.');return}if(!confirm(`برنامه‌ها و موارد مربوط به ${date} حذف شوند؟ این کار قابل برگشت نیست.`))return;db.plans=(db.plans||[]).filter(x=>x.date!==date);db.testTasks=(db.testTasks||[]).filter(x=>x.date!==date);db.sessions=(db.sessions||[]).filter(x=>!(x.date===date&&(x.source==='plan'||x.source==='test'||(x.planId&&planIds.has(x.planId))||testKeys.has(x.testTaskId))));persist();closeResetPrograms();alert(`برنامه‌های روز ${date} حذف شدند. 🗑️`)}
function addSession(){const min=Math.min(1440,Math.max(0,+sMinutes.value||0)),tests=Math.min(10000,Math.max(0,+sTests.value||0));if(!min&&!tests)return;db.sessions.push({date:today(),subject:sSubject.value,min,tests,percent:Math.min(100,Math.max(0,+sPercent.value||0)),manual:true});sMinutes.value=sTests.value=sPercent.value='';persist()}
function addStudyTime(m){db.sessions.push({date:today(),subject:'مطالعه',min:m,tests:0,percent:0});persist()}
function saveSettings(){if(!db)return;normalizeProfileData();ensureDataShape();persist();refreshProfileUI();alert('تنظیمات و اطلاعات ذخیره‌شده به‌روز شدند. ✅')}
function saveDashboardGoal(){db.settings.goal=Math.max(1,+dashGoalInput.value||480);persist()}
function getReminders(){db.settings=db.settings||{};db.settings.reminders=Array.isArray(db.settings.reminders)?db.settings.reminders:[];return db.settings.reminders}
function requestReminderPermission(){if(!('Notification' in window)){alert('این مرورگر اعلان‌های وب را پشتیبانی نمی‌کند.');return}Notification.requestPermission().then(r=>{if(r==='granted'){alert('اعلان‌ها فعال شدند.');registerReminderSW()}else alert('اجازه اعلان داده نشد. از تنظیمات مرورگر اجازه اعلان FocusPlan را فعال کن.')})}
async function registerReminderSW(){try{if(!('serviceWorker' in navigator)||location.protocol==='file:')return null;const reg=await navigator.serviceWorker.register('./sw.js');return reg}catch(e){console.warn('Reminder service worker registration failed',e);return null}}
function reminderDateTime(r){return new Date(`${r.date}T${r.time}:00`)}
function formatReminderDate(r){const d=reminderDateTime(r);return d.toLocaleDateString('fa-IR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+' • '+d.toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})}
function renderReminders(){const box=document.getElementById('reminderList');if(!box||!db)return;const list=getReminders().slice().sort((a,b)=>reminderDateTime(a)-reminderDateTime(b));if(!list.length){box.innerHTML='<div class="reminder-empty">هنوز هیچ یادآوری‌ای کوک نشده است.</div>';return}box.innerHTML=list.map(r=>`<div class="reminder-item"><div class="reminder-main"><div class="reminder-bell">🔔</div><div class="reminder-meta"><b>${esc(r.subject||'مطالعه')}</b><span>${formatReminderDate(r)} • ${fa(r.duration||45)} دقیقه</span></div></div><div class="reminder-actions"><button class="btn secondary" type="button" onclick="editReminder(${JSON.stringify(String(r.id))})">✏️ ویرایش</button><button class="btn danger" type="button" onclick="deleteReminder(${JSON.stringify(String(r.id))})">🗑️ حذف</button></div></div>`).join('')}
function clearReminderForm(){['reminderSubject','reminderDate','reminderTime','reminderDuration','editingReminderId'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});const d=new Date(Date.now()+60000);const date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const time=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');document.getElementById('reminderDate').value=date;document.getElementById('reminderTime').value=time;document.getElementById('reminderDuration').value=45}
function saveReminder(){if(!db)return;const subject=(document.getElementById('reminderSubject')?.value||'').trim()||'مطالعه';const date=document.getElementById('reminderDate')?.value||'';const time=document.getElementById('reminderTime')?.value||'';const duration=Math.max(1,+document.getElementById('reminderDuration')?.value||45);if(!date||!time){alert('تاریخ و ساعت دقیق را وارد کن.');return}const when=new Date(`${date}T${time}:00`);if(Number.isNaN(when.getTime())||when.getTime()<=Date.now()){alert('تاریخ و ساعت یادآور باید در آینده باشد.');return}const list=getReminders();const editId=document.getElementById('editingReminderId')?.value||'';if(editId){const r=list.find(x=>String(x.id)===String(editId));if(r){Object.assign(r,{subject,date,time,duration,notified:false})}}else list.push({id:'r_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),subject,date,time,duration,notified:false,createdAt:Date.now()});persist();clearReminderForm();renderReminders();registerReminderSW();syncRemindersToSW()}
function editReminder(id){const r=getReminders().find(x=>String(x.id)===String(id));if(!r)return;document.getElementById('reminderSubject').value=r.subject||'';document.getElementById('reminderDate').value=r.date||'';document.getElementById('reminderTime').value=r.time||'';document.getElementById('reminderDuration').value=r.duration||45;document.getElementById('editingReminderId').value=r.id;document.getElementById('reminderSubject').focus()}
function deleteReminder(id){const list=getReminders();const i=list.findIndex(x=>String(x.id)===String(id));if(i<0)return;if(!confirm('این یادآور حذف شود؟'))return;list.splice(i,1);persist();renderReminders();syncRemindersToSW()}
async function syncRemindersToSW(){try{const reg=await registerReminderSW();if(reg?.active){reg.active.postMessage({type:'FP_SYNC_REMINDERS',reminders:getReminders().filter(r=>!r.notified)})}}catch(e){}}
function checkDueReminders(){if(!db)return;const list=getReminders(),now=Date.now();let changed=false;list.forEach(r=>{if(r.notified)return;const t=reminderDateTime(r).getTime();if(t<=now&&t>now-120000){r.notified=true;changed=true;sendReminderNotification(r)}});if(changed){localStorage.setItem(DBKEY,JSON.stringify(db));renderReminders();syncRemindersToSW()}}
async function sendReminderNotification(r){const title='وقت مطالعه رسید 📚';const body=`${r.subject||'مطالعه'} • ${fa(r.duration||45)} دقیقه`;try{if('Notification' in window&&Notification.permission==='granted'){const reg=await navigator.serviceWorker?.ready; if(reg?.showNotification)await reg.showNotification(title,{body,tag:'fp-reminder-'+r.id,icon:'icon.svg',badge:'icon.svg',data:{url:'./index.html'}});else new Notification(title,{body})}}catch(e){try{if('Notification' in window&&Notification.permission==='granted')new Notification(title,{body})}catch(_) {}}}
function initSmartReminders(){if(!db)return;renderReminders();clearReminderForm();registerReminderSW();syncRemindersToSW();checkDueReminders();setInterval(checkDueReminders,15000)}

function saveActiveTimer(){localStorage.setItem(TIMERKEY,JSON.stringify({remaining:timer,total:timerTotal,running:timerRunning,startedAt:timerStartedAt,name:db?.settings?.timerName||'مطالعه'}))}function clearActiveTimer(){localStorage.removeItem(TIMERKEY)}function goToTimer(){const b=document.querySelector('.tabs button[data-tab="timer"]');if(b)b.click()}function stopTimerFrame(){if(timerFrame){cancelAnimationFrame(timerFrame);timerFrame=null}}function restoreActiveTimer(){try{const x=JSON.parse(localStorage.getItem(TIMERKEY)||'null');if(!x)return;timer=Math.max(0,+x.remaining||0);timerTotal=Math.max(1,+x.total||1);timerRunning=!!x.running;timerStartedAt=x.startedAt||null;if(db?.settings)db.settings.timerName=x.name||db.settings.timerName||'مطالعه';if(timerRunning&&timerStartedAt){timer=Math.max(0,timer-(Date.now()-timerStartedAt)/1000);if(timer<=0){timerRunning=false;clearActiveTimer();setTimeout(finishTimer,0)}else{timerStartedAt=Date.now()-Math.max(0,timerTotal-timer)*1000;startTimer()}}showTimer()}catch(e){clearActiveTimer()}}function setTimerFromInputs(){pauseTimer();clearActiveTimer();const m=Math.max(1,+timerMinutes.value||45),n=(timerName.value||'مطالعه').trim()||'مطالعه';db.settings.timerMin=m;db.settings.timerName=n;timer=m*60;timerTotal=timer;timerRunning=false;timerStartedAt=null;timerLabel.textContent=n;persist();showTimer()}function startTimer(){if(timer<=0||timerFrame)return;timerRunning=true;timerStartedAt=Date.now()-Math.max(0,timerTotal-timer)*1000;saveActiveTimer();showTimer();const tick=()=>{if(!timerRunning){timerFrame=null;return}const elapsed=(Date.now()-timerStartedAt)/1000;timer=Math.max(0,timerTotal-elapsed);showTimer();if(timer<=0){timerFrame=null;finishTimer();return}if(Math.floor(elapsed)%5===0)saveActiveTimer();timerFrame=requestAnimationFrame(tick)};timerFrame=requestAnimationFrame(tick)}function pauseTimer(){stopTimerFrame();if(timerRunning){timerRunning=false;timerStartedAt=null;saveActiveTimer()}showTimer()}function resetTimer(){pauseTimer();clearActiveTimer();closeTimerVerification();timer=(db?.settings?.timerMin||45)*60;timerTotal=timer;timerRunning=false;timerStartedAt=null;showTimer()}function finishTimer(){stopTimerFrame();clearInterval(interval);interval=null;timer=0;timerRunning=false;timerStartedAt=null;clearActiveTimer();showTimer();if(navigator.vibrate)navigator.vibrate([500,250,500,250,900]);openTimerVerification()}function showTimer(){const sec=Math.max(0,timer);const whole=Math.floor(sec);clock.textContent=String(Math.floor(whole/60)).padStart(2,'0')+':'+String(whole%60).padStart(2,'0');const progress=timerTotal?Math.max(0,Math.min(1,sec/timerTotal)):0;const r=102,c=2*Math.PI*r,p=document.getElementById('timerProgress');if(p){p.style.strokeDasharray=c;p.style.strokeDashoffset=c*(1-progress)}const wp=document.getElementById('timerWaveProgress');if(wp){wp.style.strokeDasharray=c;p&& (wp.style.strokeDashoffset=c*(1-progress));wp.style.opacity=progress>0?'.78':'0'}const mp=document.getElementById('miniProgress'),mr=15,mc=2*Math.PI*mr;if(mp){mp.style.strokeDasharray=mc;mp.style.strokeDashoffset=mc*(1-progress)}const mt=document.getElementById('miniTime');if(mt)mt.textContent=clock.textContent;const mn=document.getElementById('miniName');if(mn)mn.textContent=db?.settings?.timerName||'مطالعه';const st=document.getElementById('timerStatus');if(st)st.textContent=timerRunning?'در حال مطالعه ⏳':(timer<=0?'زمان تمام شد! ⏰':'متوقف');const ft=document.getElementById('floatingTimer');if(ft)ft.classList.toggle('show',timerRunning)}
function openTimerVerification(){pendingTimerMinutes=Math.max(1,Math.round(timerTotal/60));verifySeconds=60;const modal=document.getElementById('timerVerify');const sec=document.getElementById('verifySeconds');if(!modal||!sec)return;sec.textContent=fa(verifySeconds);modal.classList.add('show');clearInterval(verifyInterval);verifyInterval=setInterval(()=>{verifySeconds--;sec.textContent=fa(Math.max(0,verifySeconds));if(verifySeconds<=0){closeTimerVerification()}},1000)}
function closeTimerVerification(){clearInterval(verifyInterval);verifyInterval=null;const modal=document.getElementById('timerVerify');if(modal)modal.classList.remove('show');verifySeconds=0;pendingTimerMinutes=0}
function openTimerSubjectModal(){const modal=document.getElementById('timerSubjectModal'),sel=document.getElementById('timerSubjectSelect');if(!modal||!sel||!db)return;const list=subjects();sel.innerHTML=list.length?list.map(x=>`<option value="${String(x).replaceAll('"','&quot;')}">${x}</option>`).join(''):'<option value="">درسی وجود ندارد</option>';sel.disabled=!list.length;modal.classList.add('show')}
function closeTimerSubjectModal(){document.getElementById('timerSubjectModal')?.classList.remove('show');pendingTimerMinutes=0}
function confirmTimerStudy(didStudy){if(!pendingTimerMinutes)return;if(!didStudy){closeTimerVerification();render();return}clearInterval(verifyInterval);verifyInterval=null;const modal=document.getElementById('timerVerify');if(modal)modal.classList.remove('show');verifySeconds=0;openTimerSubjectModal()}
function saveTimerStudySubject(){if(!pendingTimerMinutes||!db)return;const m=pendingTimerMinutes,sel=document.getElementById('timerSubjectSelect'),subject=sel?.value||'';if(!subject){alert('لطفاً یک درس انتخاب کن.');return}db.sessions=db.sessions||[];db.sessions.push({id:`session_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,date:today(),subject,min:m,tests:0,percent:0,source:'timer',actual:true});closeTimerSubjectModal();persist();alert(`آفرین! ${m} دقیقه مطالعه برای «${subject}» ثبت شد. در PDF هم برای همین درس نمایش داده می‌شود. ✅`)}

function selectStage(stage){
 selectedStage=stage; selectedStream=null;
 const stagePanel=document.getElementById('stagePanel'), registerPanel=document.getElementById('registerPanel'), streamField=document.getElementById('streamField'), gradeEl=document.getElementById('grade'), sub=document.getElementById('authSub');
 if(stagePanel)stagePanel.classList.add('hidden'); if(registerPanel)registerPanel.classList.remove('hidden');
 if(gradeEl)gradeEl.innerHTML=stage==='middle1'?'<option value="هفتم">هفتم</option><option value="هشتم">هشتم</option><option value="نهم">نهم</option>':'<option value="دهم">دهم</option><option value="یازدهم">یازدهم</option><option value="دوازدهم">دوازدهم</option>';
 if(streamField)streamField.classList.toggle('hidden',stage==='middle1');
 if(sub)sub.innerHTML=stage==='middle1'?'ثبت‌نام متوسطه اول<br>مشخصاتت را به ترتیب وارد کن.':'ثبت‌نام متوسطه دوم<br>مشخصاتت را به ترتیب وارد کن.';
 document.querySelectorAll('#registerPanel .stream').forEach(x=>x.classList.remove('active'));
}
function backToStageSelection(){selectedStage=null;selectedStream=null;document.getElementById('stagePanel')?.classList.remove('hidden');document.getElementById('registerPanel')?.classList.add('hidden');const sub=document.getElementById('authSub');if(sub)sub.innerHTML='برنامه‌ریز هوشمند مطالعه و مدرسه<br>ابتدا مقطع تحصیلی‌ات را انتخاب کن.';}
document.querySelectorAll('.stage-choice').forEach(x=>x.onclick=()=>selectStage(x.dataset.stage));
document.querySelectorAll('#registerPanel .stream').forEach(x=>x.onclick=()=>{document.querySelectorAll('#registerPanel .stream').forEach(y=>y.classList.remove('active'));x.classList.add('active');selectedStream=x.dataset.stream});
function startNewLogin(){
  const shouldDelete=confirm('آیا می‌خواهی برنامه‌ها، تست‌ها، آمار و درس‌های دلخواه قبلی حذف شوند و از صفر شروع کنی؟\n\n«لغو» = اطلاعات قبلی باقی می‌ماند و فقط مشخصاتت عوض می‌شود.');
  newLoginDeleteData=shouldDelete;
  // ورود با اطلاعات جدید همیشه از انتخاب مقطع شروع می‌شود.
  showAuthForSetup();
  const stagePanel=document.getElementById('stagePanel');
  const registerPanel=document.getElementById('registerPanel');
  if(stagePanel)stagePanel.classList.remove('hidden');
  if(registerPanel)registerPanel.classList.add('hidden');
  const title=document.querySelector('.auth-box .logo-title'), sub=document.querySelector('.auth-sub');
  if(title)title.textContent='ورود با اطلاعات جدید';
  if(sub)sub.innerHTML=shouldDelete?'اطلاعات قبلی برنامه‌ریزی حذف می‌شود و می‌توانی مشخصات جدیدت را وارد کنی.':'برنامه‌ها و اطلاعات قبلی حفظ می‌شوند و فقط مشخصات دانش‌آموز تغییر می‌کند.';
}

function showAuthForSetup(){
 auth.classList.remove('hidden');app.classList.add('hidden');
 const grid=document.querySelector('.auth-grid'), login=document.getElementById('loginPanel');
 if(login)login.classList.add('hidden'); if(grid)grid.classList.remove('hidden');
 const title=document.querySelector('.auth-box .logo-title'); if(title)title.textContent='FocusPlan';
 const nameInput=document.getElementById('fullName'); if(nameInput)nameInput.value=''; const classInput=document.getElementById('className'); if(classInput)classInput.value='';
 selectedStream=null; selectedStage=null; document.querySelectorAll('.stream').forEach(x=>x.classList.remove('active'));
 const schoolInput=document.getElementById('schoolName'); if(schoolInput)schoolInput.value='';
 const stagePanel=document.getElementById('stagePanel'), registerPanel=document.getElementById('registerPanel'); if(stagePanel)stagePanel.classList.remove('hidden'); if(registerPanel)registerPanel.classList.add('hidden');
 const sub=document.getElementById('authSub'); if(sub)sub.innerHTML='برنامه‌ریز هوشمند مطالعه و مدرسه<br>ابتدا مقطع تحصیلی‌ات را انتخاب کن.';
 if(document.getElementById('grade'))grade.innerHTML='';
}
function showAuthForLogin(){
 auth.classList.remove('hidden');app.classList.add('hidden');
 const grid=document.querySelector('.auth-grid'), login=document.getElementById('loginPanel');
 if(grid)grid.classList.add('hidden'); if(login)login.classList.remove('hidden');
 const title=document.querySelector('.auth-box .logo-title'); if(title)title.textContent='FocusPlan';
 const profile=db?.profile||{};
 const setText=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val||'-'};
 setText('loginName',profile.name);setText('loginClass',profile.className);setText('loginSchool',profile.schoolName);setText('loginStage',db?.educationStage==='middle1'?'متوسطه اول':'متوسطه دوم');setText('loginStream',db?.educationStage==='middle1'?'—':db?.stream);setText('loginGrade',db?.grade||'دهم');
}
function loginWithSavedProfile(){ if(!db?.profile?.name || !db?.grade || !db?.educationStage){showAuthForSetup();return} showApp(); }
restoreTheme();
if(db && localStorage.getItem(SETUPKEY)==='1'){showAuthForLogin()}else{showAuthForSetup()}

function calculatePercent(){
  const total=Math.max(0,parseInt(document.getElementById('pctTotal')?.value)||0);
  const correct=Math.max(0,parseInt(document.getElementById('pctCorrect')?.value)||0);
  const wrong=Math.max(0,parseInt(document.getElementById('pctWrong')?.value)||0);
  const blankEl=document.getElementById('pctBlank'), noNegEl=document.getElementById('pctResultNoNegative'), negEl=document.getElementById('pctResultNegative'), errorEl=document.getElementById('pctError');
  if(!blankEl||!noNegEl||!negEl)return;
  if(total<=0){blankEl.textContent='۰';noNegEl.textContent='۰٪';negEl.textContent='۰٪';if(errorEl){errorEl.textContent='لطفاً تعداد کل سؤالات را وارد کن.';errorEl.style.display='block'}return}
  if(correct+wrong>total){blankEl.textContent='—';noNegEl.textContent='—';negEl.textContent='—';if(errorEl){errorEl.textContent='تعداد درست و غلط نمی‌تواند بیشتر از تعداد کل سؤالات باشد.';errorEl.style.display='block'}return}
  const blank=total-correct-wrong;
  const noNegative=(correct/total)*100;
  const negative=((correct*3-wrong)/(total*3))*100;
  blankEl.textContent=fa(blank);
  noNegEl.textContent=fa(Number(noNegative.toFixed(2)))+'٪';
  negEl.textContent=fa(Number(Math.max(0,negative).toFixed(2)))+'٪';
  if(errorEl)errorEl.style.display='none';
}
function updatePercentCalculator(){ return; }

(()=>{
 const splash=document.getElementById('startupSplash');
 const bar=splash?.querySelector('.splash-loader span');
 const pct=splash?.querySelector('.splash-loading-text b');
 if(!splash)return;
 const status=splash.querySelector('.splash-status');
 const messages=['در حال آماده‌سازی برنامه','در حال بارگذاری رابط کاربری','در حال آماده‌سازی تایمر و برنامه‌ها','تقریباً آماده است','FocusPlan آماده شد ✨'];
 const started=performance.now(),duration=5000;
 const tick=now=>{
   const raw=Math.min(1,(now-started)/duration); const smooth=raw<0.86 ? (1-Math.pow(1-raw,1.65)) : raw; const p=Math.min(100,smooth*100);
   if(bar)bar.style.width=p.toFixed(2)+'%';
   if(pct)pct.textContent=Math.round(p)+'%';
   if(status){const idx=Math.min(messages.length-1,Math.floor(p/25));status.textContent=messages[idx]}
   if(p<100)requestAnimationFrame(tick);
 };
 requestAnimationFrame(tick);
 setTimeout(()=>splash.classList.add('hide'),5200);
})();
let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.getElementById('installAppBtn');if(b)b.textContent='📱 نصب FocusPlan روی صفحه اصلی'});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;const b=document.getElementById('installAppBtn');const h=document.getElementById('installHint');if(b)b.textContent='✅ FocusPlan به صفحه اصلی اضافه شد';if(h)h.textContent='حالا می‌توانی FocusPlan را مستقیماً از صفحه اصلی باز کنی.'});
async function installFocusPlan(){
 if(deferredInstallPrompt){try{await deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice}catch(e){}deferredInstallPrompt=null;return}
 const standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
 if(standalone){alert('FocusPlan همین حالا به‌صورت برنامه روی گوشی اجرا می‌شود.');return}
 alert('برای افزودن FocusPlan به صفحه اصلی، از منوی مرورگر گزینه «Add to Home screen» یا «افزودن به صفحه اصلی» را انتخاب کن. اگر این گزینه را نمی‌بینی، صفحه را با Chrome و در حالت آنلاین باز کن.');
}

document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.section').forEach(x=>x.classList.remove('active','fp-enter'));b.classList.add('active');const sec=document.getElementById(b.dataset.tab);if(sec){sec.classList.add('active');requestAnimationFrame(()=>{sec.classList.add('fp-enter')});}if(b.dataset.tab==='pdf'&&db)renderWeeklyReport();if(b.dataset.tab==='archives'&&db){ensureSubjectChartArchives();renderPdfArchives();renderChartArchives();}if(b.dataset.tab==='performance'&&db){renderPerformanceCenter();renderSubjectPerformanceChart();renderSubjectAnalytics()}if(b.dataset.tab==='moreFeatures'&&db){fpRenderCalendar();fpRenderComparison()}});
// ===== FocusPlan: Professional performance comparison (isolated add-on) =====
let fpComparePeriod=7;
function fpCompareKeys(endOffset,days){
 const end=new Date(); end.setHours(0,0,0,0); end.setDate(end.getDate()-endOffset);
 const out=[]; for(let i=days-1;i>=0;i--){const d=new Date(end);d.setDate(end.getDate()-i);out.push(isoLocal(d));} return out;
}
function fpCompareMetrics(offset,days){
 const keys=fpCompareKeys(offset,days), set=new Set(keys);
 const sessions=(db.sessions||[]).filter(x=>set.has(x.date));
 const plans=(db.plans||[]).filter(x=>set.has(x.date));
 const tests=(db.testTasks||[]).filter(x=>set.has(x.date));
 const study=sessions.reduce((a,x)=>a+(+x.min||0),0);
 const sessionTests=sessions.reduce((a,x)=>a+(+x.tests||0),0);
 const taskTests=tests.filter(x=>x.done && !hasLinkedTestSession(x,(db.testTasks||[]).indexOf(x))).reduce((a,x)=>a+(+x.actualCount||+x.count||0),0);
 const plannedTests=tests.reduce((a,x)=>a+(+x.count||0),0);
 const done=plans.filter(x=>x.done).length, planned=plans.length;
 const active=new Set([...sessions.map(x=>x.date),...plans.filter(x=>x.done).map(x=>x.date)]).size;
 return {study,tests:sessionTests+taskTests,plannedTests,done,planned,active,avg:study/days,completion:planned?done/planned*100:0,keys};
}
function fpComparePct(cur,prev){if(!prev)return 0;if(prev===0)return cur>0?100:0;return Math.round((cur-prev)/Math.abs(prev)*100)}
function fpCompareFmtMin(min){min=Math.max(0,Math.round(min));return fa(Math.floor(min/60))+':'+fa(String(min%60).padStart(2,'0'))}
function fpCompareDelta(cur,prev,unit='٪'){
 const p=fpComparePct(cur,prev); if(p>0)return `<span class="delta">▲ ${fa(p)}${unit}</span>`;
 if(p<0)return `<span class="delta">▼ ${fa(Math.abs(p))}${unit}</span>`;
 return `<span class="delta">● بدون تغییر</span>`;
}
function fpCompareMetricHtml(label,cur,prev,formatter,lowerIsBetter=false){
 const p=fpComparePct(cur,prev), cls=p===0?'flat':((p>0&&!lowerIsBetter)||(p<0&&lowerIsBetter)?'up':'down');
 return `<div class="fp-compare-metric ${cls}"><span class="label">${label}</span><span class="value">${formatter(cur)}</span>${fpCompareDelta(cur,prev)}</div>`;
}
function fpCompareSetPeriod(days){fpComparePeriod=days;document.getElementById('fpCompare7Btn')?.classList.toggle('active',days===7);document.getElementById('fpCompare30Btn')?.classList.toggle('active',days===30);fpRenderComparison()}
function fpRenderComparison(){
 if(!db)return;
 const cur=fpCompareMetrics(0,fpComparePeriod),prev=fpCompareMetrics(fpComparePeriod,fpComparePeriod);
 const summary=document.getElementById('fpCompareSummary'),metrics=document.getElementById('fpCompareMetrics');
 if(!summary||!metrics)return;
 const studyPct=fpComparePct(cur.study,prev.study),testPct=fpComparePct(cur.tests,prev.tests),compPct=fpComparePct(cur.completion,prev.completion);
 const mood=studyPct>10?'🔥 روندت رو به رشد است!':studyPct<-10?'💪 این دوره جای بهتر شدن دارد.':'⚖️ عملکردت تقریباً پایدار است.';
 summary.innerHTML=`${mood}<small>${fa(fpComparePeriod)} روز اخیر در مقایسه با ${fa(fpComparePeriod)} روز قبل • مطالعه واقعی ${studyPct>=0?'+':''}${fa(studyPct)}٪ • تست ${testPct>=0?'+':''}${fa(testPct)}٪ • انجام برنامه ${compPct>=0?'+':''}${fa(compPct)}٪</small>`;
 metrics.innerHTML=fpCompareMetricHtml('مطالعه واقعی',cur.study,prev.study,fpCompareFmtMin)
 +fpCompareMetricHtml('تعداد تست',cur.tests,prev.tests,n=>fa(n)+' تست')
 +fpCompareMetricHtml('انجام برنامه',cur.completion,prev.completion,n=>fa(Math.round(n))+'٪')
 +fpCompareMetricHtml('روزهای فعال',cur.active,prev.active,n=>fa(n)+' روز');
 const chart=document.getElementById('fpCompareStudyChart');
 if(chart){
   const max=Math.max(1,...cur.keys.map(k=>(db.sessions||[]).filter(x=>x.date===k).reduce((a,x)=>a+(+x.min||0),0)),...prev.keys.map(k=>(db.sessions||[]).filter(x=>x.date===k).reduce((a,x)=>a+(+x.min||0),0)));
   const samples=[];
   for(let i=0;i<Math.min(fpComparePeriod,14);i++){
     const ci=cur.keys.length-1-Math.round(i*(cur.keys.length-1)/Math.max(1,Math.min(fpComparePeriod,14)-1));
     const pi=prev.keys.length-1-Math.round(i*(prev.keys.length-1)/Math.max(1,Math.min(fpComparePeriod,14)-1));
     const ck=cur.keys[Math.max(0,ci)],pk=prev.keys[Math.max(0,pi)];
     const cv=(db.sessions||[]).filter(x=>x.date===ck).reduce((a,x)=>a+(+x.min||0),0),pv=(db.sessions||[]).filter(x=>x.date===pk).reduce((a,x)=>a+(+x.min||0),0);
     const label=new Date(ck+'T12:00:00').getDate(); samples.push({label,cv,pv});
   }
   samples.reverse();
   chart.innerHTML=samples.map(x=>`<div class="fp-compare-bar-row"><b>${fa(x.label)}</b><div class="fp-compare-bar-track"><i class="fp-compare-bar-prev" style="width:${Math.round(x.pv/max*100)}%"></i><i class="fp-compare-bar-cur" style="--fpw:${Math.round(x.cv/max*100)}%;width:${Math.round(x.cv/max*100)}%"></i></div><span class="fp-compare-bar-val">${fpCompareFmtMin(x.cv)}</span></div>`).join('')+`<div class="muted" style="font-size:.72rem;margin-top:5px">خط خاکستری: دوره قبل • نوار رنگی: دوره فعلی</div>`;
 }
 const subjectBox=document.getElementById('fpCompareSubjects');
 if(subjectBox){
   const map=new Map();
   const add=(period,subject,min)=>{if(!subject)return;const o=map.get(subject)||{cur:0,prev:0};o[period]+=min;map.set(subject,o)};
   (db.sessions||[]).forEach(x=>{if(cur.keys.includes(x.date))add('cur',x.subject,+x.min||0);else if(prev.keys.includes(x.date))add('prev',x.subject,+x.min||0)});
   const rows=[...map.entries()].filter(([,v])=>v.cur||v.prev).sort((a,b)=>(b[1].cur-b[1].prev)-(a[1].cur-a[1].prev)).slice(0,12);
   if(!rows.length){subjectBox.innerHTML='<div class="fp-compare-empty">هنوز داده کافی برای مقایسه درس‌ها وجود ندارد.</div>'}
   else {const mx=Math.max(1,...rows.map(([,v])=>Math.max(v.cur,v.prev)));subjectBox.innerHTML=rows.map(([name,v])=>{const pct=fpComparePct(v.cur,v.prev);return `<div class="fp-compare-subject"><span class="fp-compare-subject-name" title="${esc(name)}">${esc(name)}</span><div class="fp-compare-subject-track"><i class="fp-compare-subject-fill" style="width:${Math.round(v.cur/mx*100)}%"></i></div><span class="fp-compare-subject-delta" style="color:${pct>0?'#059669':pct<0?'#dc2626':'inherit'}">${pct>0?'▲ ':pct<0?'▼ ':'● '}${fa(Math.abs(pct))}٪</span></div>`}).join('')}
 }
}

// ===== FocusPlan: More Features calendar (isolated add-on) =====
let fpCalCursor=new Date();
fpCalCursor.setDate(1);
let fpCalSelected='';
function fpCalDateKey(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function fpCalFa(n){try{return typeof fa==='function'?fa(String(n)):String(n)}catch(e){return String(n)}}
function fpCalMove(delta){fpCalCursor.setMonth(fpCalCursor.getMonth()+delta);fpCalSelected='';fpRenderCalendar()}
function fpCalStats(key){
 if(!db)return {min:0,tests:0,plans:0,done:0};
 const sessions=(db.sessions||[]).filter(x=>x.date===key);
 const plans=(db.plans||[]).filter(x=>x.date===key);
 const tests=(db.testTasks||[]).filter(x=>x.date===key);
 const min=sessions.reduce((a,x)=>a+(+x.min||0),0);
 const sessionTests=sessions.reduce((a,x)=>a+(+x.tests||0),0);
 const completedTests=tests.filter(x=>x.done).reduce((a,x)=>a+(+x.actualCount||+x.count||0),0);
 return {min,tests:sessionTests+completedTests,plans:plans.length,done:plans.filter(x=>x.done).length};
}
function fpCalLevel(st){
 if(!st.min&&!st.tests&&!st.done)return 0;
 const score=st.min+st.tests*2+st.done*10;
 return score>=150?3:score>=45?2:1;
}
function fpRenderCalendar(){
 const grid=document.getElementById('fpCalendarGrid'),title=document.getElementById('fpCalTitle');
 if(!grid||!db)return;
 const y=fpCalCursor.getFullYear(),m=fpCalCursor.getMonth();
 if(title)title.textContent=fpCalCursor.toLocaleDateString('fa-IR',{year:'numeric',month:'long'});
 const weekdays=['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
 let html=weekdays.map(x=>`<div class="fp-cal-weekday">${x}</div>`).join('');
 const first=new Date(y,m,1);
 const start=(first.getDay()+1)%7;
 const days=new Date(y,m+1,0).getDate();
 for(let i=0;i<start;i++)html+='<div class="fp-cal-day empty"></div>';
 const now=today();
 for(let d=1;d<=days;d++){
   const key=fpCalDateKey(y,m,d),st=fpCalStats(key),level=fpCalLevel(st);
   const cls=`fp-cal-day fp-cal-level-${level}${key===now?' today':''}${key===fpCalSelected?' selected':''}`;
   html+=`<div class="${cls}" onclick="fpCalSelect('${key}')"><div class="fp-cal-top"><div class="fp-cal-num">${fpCalFa(d)}</div></div><div class="fp-cal-metrics">${st.min?`<div class="fp-cal-chip study">⏱️ ${fpCalFa(Math.floor(st.min/60))}:${fpCalFa(String(st.min%60).padStart(2,'0'))}</div>`:''}${st.tests?`<div class="fp-cal-chip tests">📝 ${fpCalFa(st.tests)} تست</div>`:''}${st.done?`<div class="fp-cal-chip done">✓ ${fpCalFa(st.done)} انجام</div>`:''}</div></div>`;
 }
 grid.innerHTML=html;
 if(fpCalSelected)fpCalShowDetails(fpCalSelected);
 else if(now.startsWith(`${y}-${String(m+1).padStart(2,'0')}`))fpCalShowDetails(now);
 else{const d=document.getElementById('fpCalDetails');if(d)d.textContent='یک روز را انتخاب کن تا جزئیاتش نمایش داده شود.'}
}
function fpCalSelect(key){fpCalSelected=key;fpRenderCalendar()}
function fpCalShowDetails(key){
 const d=document.getElementById('fpCalDetails');if(!d)return;
 const st=fpCalStats(key),dt=new Date(key+'T12:00:00');
 const label=dt.toLocaleDateString('fa-IR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
 const plans=(db.plans||[]).filter(x=>x.date===key),sessions=(db.sessions||[]).filter(x=>x.date===key),tests=(db.testTasks||[]).filter(x=>x.date===key);
 const subjectsDone=[...new Set(plans.filter(x=>x.done).map(x=>x.subject).filter(Boolean))];
 const sessionSubjects=[...new Set(sessions.map(x=>x.subject).filter(Boolean))];
 const allSubjects=[...new Set([...subjectsDone,...sessionSubjects])];
 const planned=plans.reduce((a,x)=>a+(+x.min||+x.minutes||0),0),actual=sessions.reduce((a,x)=>a+(+x.min||0),0);
 const plannedTests=tests.reduce((a,x)=>a+(+x.count||0),0),doneTests=tests.filter(x=>x.done).reduce((a,x)=>a+(+x.actualCount||+x.count||0),0);
 const timeTxt=fpCalFa(Math.floor(actual/60))+':'+fpCalFa(String(actual%60).padStart(2,'0'));
 d.innerHTML='<div class="fp-detail-title">'+label+'</div><div class="fp-detail-list">'
 +'<div class="fp-detail-row"><span>⏱️ مطالعه واقعی</span><b>'+timeTxt+'</b></div>'
 +'<div class="fp-detail-row"><span>📋 برنامه‌ها</span><b>'+fpCalFa(st.done)+' از '+fpCalFa(st.plans)+' انجام شده</b></div>'
 +'<div class="fp-detail-row"><span>📝 تست ثبت‌شده</span><b>'+fpCalFa(st.tests)+'</b></div>'
 +(planned?'<div class="fp-detail-row"><span>🎯 زمان برنامه‌ریزی‌شده</span><b>'+fpCalFa(planned)+' دقیقه</b></div>':'')
 +(plannedTests?'<div class="fp-detail-row"><span>📚 تست برنامه‌ریزی‌شده</span><b>'+fpCalFa(plannedTests)+' · انجام‌شده '+fpCalFa(doneTests)+'</b></div>':'')
 +(allSubjects.length?'<div class="fp-detail-row"><span>📖 درس‌های فعال</span><b>'+allSubjects.join('، ')+'</b></div>':'')
 +'</div>';
}
initSmartReminders();
restoreActiveTimer();
showTimer();
restoreTheme();

function currentStreamKey(){return db?.educationStage==='middle1'?('middle-'+(db?.grade||'هفتم')):(db?.stream||'تجربی')}
function setBackgroundVariant(v){
 const n=Math.min(10,Math.max(1,Number(v)||1));
 for(let i=1;i<=20;i++) document.body.classList.remove('fp-premium-bg-'+i);
 for(let i=1;i<=10;i++) document.body.classList.remove('fp-bg-'+i);
 document.body.classList.add('fp-bg-'+n); localStorage.setItem('focusPlanBackground_'+currentStreamKey(),String(n)); localStorage.setItem('focusPlanBackgroundMode_'+currentStreamKey(),'normal');
 for(let i=1;i<=10;i++){const b=document.getElementById('bg'+i+'Btn');b?.classList.toggle('active',i===n);b?.classList.remove('locked');}
 for(let i=1;i<=20;i++) document.getElementById('premiumBg'+i+'Btn')?.classList.remove('active');
 const selected=document.getElementById('backgroundSelectedLabel');if(selected)selected.textContent=String(n).padStart(2,'0');
 const names={'تجربی':['آزمایشگاه فیروزه‌ای','جنگل زمردی','کهکشان آبی','مرجان علمی','طلوع سبز','سلول بنفش','اقیانوس دانش','شفق نعنایی','انرژی زرد','زیست آینده'],'ریاضی':['هندسه نیلی','شب بنفش','شبکه آبی','فرمول صورتی','طیف نارنجی','مدار فیروزه‌ای','ماتریس سبز','اعداد قرمز','فضای طلایی','کوانتوم چندرنگ'],'انسانی':['کتابخانه کهربایی','میراث لاجوردی','تمدن ارغوانی','مطالعه زیتونی','تاریخ مسی','تالار یاقوتی','نقشه فیروزه‌ای','فرهنگ رزگلد','آرشیو طلایی','افق رنگارنگ'],'middle-هفتم':['مدرسه فیروزه‌ای','خطوط سبز','ستاره‌های آبی','مدار بنفش','دفتر نارنجی','کلاس صورتی','سیاره طلایی','موج نعنایی','راه قرمز','آسمان رنگی'],'middle-هشتم':['آزمایش آبی','موج فیروزه‌ای','کهکشان بنفش','شبکه سبز','دفتر زرد','آزمایشگاه صورتی','مدار نارنجی','خطوط قرمز','فضای طلایی','ستاره رنگی'],'middle-نهم':['انرژی بنفش','خطوط آبی','مسیر سبز','نئون قرمز','دفتر نارنجی','آینده فیروزه‌ای','شبکه صورتی','موج طلایی','مدار ارغوانی','افق رنگی']};
 const hint=document.getElementById('backgroundHint');if(hint)hint.textContent=`${names[currentStreamKey()]?.[n-1]||'پس‌زمینه اختصاصی'} • قابل انتخاب برای همه کاربران`;
}

function setPremiumBackground(v){
 const n=Math.min(20,Math.max(1,Number(v)||1));
 for(let i=1;i<=10;i++) document.body.classList.remove('fp-bg-'+i);
 for(let i=1;i<=20;i++) document.body.classList.remove('fp-premium-bg-'+i);
 document.body.classList.add('fp-premium-bg-'+n);
 localStorage.setItem('focusPlanPremiumBackground_'+currentStreamKey(),String(n));
 localStorage.setItem('focusPlanBackgroundMode_'+currentStreamKey(),'premium');
 for(let i=1;i<=10;i++) document.getElementById('bg'+i+'Btn')?.classList.remove('active');
 for(let i=1;i<=20;i++) document.getElementById('premiumBg'+i+'Btn')?.classList.toggle('active',i===n);
 const selected=document.getElementById('backgroundSelectedLabel');if(selected)selected.textContent='P'+String(n).padStart(2,'0');
 const hint=document.getElementById('backgroundHint');if(hint)hint.textContent='پس‌زمینه پرمیوم '+n+' • نسخه روشن و تاریک هماهنگ با حالت نمایش';
}

function restoreStreamBackground(){
 const key=currentStreamKey();
 if(localStorage.getItem('focusPlanBackgroundMode_'+key)==='premium'){const p=Number(localStorage.getItem('focusPlanPremiumBackground_'+key));if(p>=1&&p<=20){setPremiumBackground(p);return}}
 const saved=Number(localStorage.getItem('focusPlanBackground_'+key));
 const n=saved>=1&&saved<=10?saved:1;setBackgroundVariant(n)
}

function setTheme(theme){
 const dark=theme==='dark';document.body.classList.toggle('dark-mode',dark);localStorage.setItem('focusPlanTheme',dark?'dark':'light');document.getElementById('darkThemeBtn')?.classList.toggle('active',dark);document.getElementById('lightThemeBtn')?.classList.toggle('active',!dark);
 restoreStreamBackground();
}
function restoreTheme(){if(!db){document.body.classList.remove('dark-mode');return}setTheme(localStorage.getItem('focusPlanTheme')||'light')}
