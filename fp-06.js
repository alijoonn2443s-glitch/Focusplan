
(function(){
  'use strict';
  const KEY='focusPlanV2';
  const fa=n=>String(Math.round(Number(n)||0)).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
  const minToText=m=>{m=Math.max(0,Math.round(Number(m)||0));const h=Math.floor(m/60),x=m%60;return h?fa(h)+'ساعت '+fa(x)+'دقیقه':fa(x)+'دقیقه'};
  function readDB(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}}
  function dateKey(d){const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')}
  function dayDiff(a,b){return Math.floor((new Date(a+'T12:00:00')-new Date(b+'T12:00:00'))/86400000)}
  function collect(db){
    const now=new Date(), today=dateKey(now), subjects={}; let current=0, previous=0, testsCurrent=0, planned=0, done=0, activeDays=0;
    const sessions=Array.isArray(db&&db.sessions)?db.sessions:[];
    sessions.forEach(s=>{const dk=s.date||s.day||s.dateKey;if(!dk)return;const delta=dayDiff(today,dk);const mins=Number(s.minutes||s.actualMinutes||s.duration||0)||0;const sub=s.subject||s.name||'نامشخص';if(delta>=0&&delta<7){current+=mins;if(mins>0)activeDays++;}else if(delta>=7&&delta<14)previous+=mins;if(delta>=0&&delta<7){subjects[sub]=(subjects[sub]||0)+mins;}});
    const testTasks=Array.isArray(db&&db.testTasks)?db.testTasks:[];testTasks.forEach(t=>{const dk=t.date||t.day||t.dateKey;if(!dk)return;const delta=dayDiff(today,dk);const n=Number(t.count||t.tests||t.number||0)||0;if(delta>=0&&delta<7)testsCurrent+=n;});
    const plans=Array.isArray(db&&db.plans)?db.plans:[]; plans.forEach(p=>{const dk=p.date||p.day||p.dateKey;if(!dk)return;const delta=dayDiff(today,dk);if(delta>=0&&delta<7){planned+=Number(p.minutes||p.duration||p.studyMinutes||0)||0;if(p.done||p.completed)done++;}});
    const goal=Number(db&&db.settings&&db.settings.goal)||0; const goalMin=goal<20?goal*60:goal; const goalPct=goalMin>0?Math.min(100,current/goalMin*100):0; const deltaPct=previous>0?((current-previous)/previous*100):0; const score=Math.round(Math.min(100,goalPct*.45+Math.min(100,Math.max(0,deltaPct+50))*0.2+Math.min(100,activeDays/7*100)*.2+Math.min(100,testsCurrent/100*100)*.15));
    return {current,previous,testsCurrent,planned,done,activeDays,goalMin,goalPct,deltaPct,score,subjects};
  }
  function insert(){
    const sec=document.getElementById('performance'); if(!sec||document.getElementById('fpPerformancePro'))return false;
    const h=sec.querySelector('h2'); if(!h)return false;
    const el=document.createElement('div');el.id='fpPerformancePro';el.className='fp-pro-card';el.innerHTML=`<div class="fp-pro-glow"></div><div class="fp-pro-head"><div><span class="fp-pro-kicker">Performance Pro</span><h3>🚀 مرکز عملکرد حرفه‌ای</h3><p class="muted">یک نمای سریع و هوشمند از وضعیت مطالعه و تست این هفته.</p></div><div class="fp-pro-score" id="fpProScore">۰٪</div></div><div class="fp-pro-grid"><div class="fp-pro-metric"><span>مطالعه این هفته</span><b id="fpProStudy">۰ دقیقه</b></div><div class="fp-pro-metric"><span>هدف هفتگی</span><b id="fpProGoal">۰٪</b><div class="fp-pro-bar"><i id="fpProGoalBar"></i></div></div><div class="fp-pro-metric"><span>تست‌های این هفته</span><b id="fpProTests">۰</b></div><div class="fp-pro-metric"><span>روزهای فعال</span><b id="fpProDays">۰ از ۷</b></div></div><div class="fp-pro-insight" id="fpProInsight">در حال تحلیل عملکرد…</div><div class="fp-pro-subjects" id="fpProSubjects"><div class="fp-pro-empty">هنوز داده کافی برای تحلیل درس‌ها ثبت نشده است.</div></div>`;
    h.insertAdjacentElement('afterend',el);return true;
  }
  function render(){
    const sec=document.getElementById('performance');if(!sec)return;
    const db=readDB();if(!db)return; if(!document.getElementById('fpPerformancePro'))insert();
    const x=collect(db); const q=id=>document.getElementById(id);
    if(q('fpProScore'))q('fpProScore').textContent=fa(x.score)+'٪';
    if(q('fpProStudy'))q('fpProStudy').textContent=minToText(x.current);
    if(q('fpProGoal'))q('fpProGoal').textContent=fa(x.goalPct)+'٪';
    if(q('fpProGoalBar'))q('fpProGoalBar').style.width=Math.min(100,x.goalPct)+'%';
    if(q('fpProTests'))q('fpProTests').textContent=fa(x.testsCurrent);
    if(q('fpProDays'))q('fpProDays').textContent=fa(x.activeDays)+' از ۷';
    let insight=''; if(x.current===0) insight='هنوز مطالعه‌ای برای این هفته ثبت نشده؛ اولین جلسه را شروع کن تا تحلیل دقیق‌تر شود.'; else if(x.goalPct>=100) insight='🎯 هدف هفتگی مطالعه‌ات را کامل کرده‌ای؛ اگر انرژی داری می‌توانی برای تثبیت مطالب یک جلسه مرور اضافه کنی.'; else if(x.previous>0&&x.current>x.previous) insight='📈 روند مطالعه‌ات نسبت به ۷ روز قبل بهتر شده؛ همین ریتم را حفظ کن.'; else if(x.previous>0&&x.current<x.previous) insight='💡 فعالیت این هفته از هفته قبل کمتر است؛ یک جلسه کوتاه و قابل انجام برای امروز می‌تواند روند را برگرداند.'; else insight='🧠 داده‌های این هفته در حال جمع شدن‌اند؛ با ثبت مطالعه و تست، تحلیل دقیق‌تر می‌شود.'; if(q('fpProInsight'))q('fpProInsight').textContent=insight;
    const box=q('fpProSubjects');if(box){const arr=Object.entries(x.subjects).sort((a,b)=>b[1]-a[1]);if(!arr.length)box.innerHTML='<div class="fp-pro-empty">هنوز زمان مطالعه‌ای به تفکیک درس ثبت نشده است.</div>';else{const max=arr[0][1]||1;box.innerHTML=arr.slice(0,8).map(([s,m])=>`<div class="fp-pro-subject"><div class="fp-pro-subject-top"><b>${String(s).replace(/[<>]/g,'')}</b><span>${minToText(m)}</span></div><div class="fp-pro-subject-bar"><i style="width:${Math.min(100,m/max*100)}%"></i></div></div>`).join('')}}
  }
  function boot(){if(!insert())setTimeout(boot,500);render();setInterval(render,5000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
