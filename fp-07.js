
(function(){
  function initFocusPlanGlobalSearch(){
    var input=document.getElementById('fpGlobalSearch');
    var results=document.getElementById('fpSearchResults');
    var clear=document.getElementById('fpSearchClear');
    if(!input||!results||input.dataset.ready)return;
    input.dataset.ready='1';
    var items=[];
    function clean(t){return (t||'').replace(/\s+/g,' ').trim();}
    function sectionName(sec){
      if(!sec)return 'FocusPlan';
      var h=sec.querySelector('h1,h2,h3');
      return clean(h?h.textContent:'بخش برنامه');
    }
    function buildIndex(){
      items=[];
      document.querySelectorAll('.section').forEach(function(sec){
        var name=sectionName(sec);
        var nodes=sec.querySelectorAll('h1,h2,h3,h4,button,label,.card,.settings-item,.feature-card');
        nodes.forEach(function(el){
          var title=clean(el.textContent);
          if(!title||title.length<2)return;
          if(el.closest('#fpSearchResults')||el.closest('.fp-global-search'))return;
          if(title.length>180) title=title.slice(0,180)+'…';
          items.push({el:el,title:title,section:name,sec:sec});
        });
      });
      document.querySelectorAll('.focusplan-tabs button[data-tab]').forEach(function(btn){
        var title=clean(btn.textContent); if(title)items.push({el:btn,title:title,section:'بخش اصلی',tab:btn.getAttribute('data-tab')});
      });
    }
    function openItem(item){
      var tab=item.tab || (item.sec&&item.sec.id);
      if(tab){
        var tabBtn=document.querySelector('.focusplan-tabs button[data-tab="'+CSS.escape(tab)+'"]');
        if(tabBtn){tabBtn.click();}
      } else if(item.sec){
        var tabBtn=document.querySelector('.focusplan-tabs button[data-tab="'+CSS.escape(item.sec.id)+'"]');
        if(tabBtn)tabBtn.click();
      }
      results.hidden=true;
      input.blur();
      if(item.el && item.el!==document.body){
        setTimeout(function(){try{item.el.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){item.el.scrollIntoView();}},80);
      }
    }
    function render(q){
      q=clean(q).toLocaleLowerCase('fa-IR');
      clear.style.display=q?'block':'none';
      if(!q){results.hidden=true;results.innerHTML='';return;}
      buildIndex();
      var seen=new Set(), found=[];
      items.forEach(function(item){
        var hay=(item.title+' '+item.section).toLocaleLowerCase('fa-IR');
        if(hay.indexOf(q)<0)return;
        var key=item.title+'|'+item.section;
        if(seen.has(key))return; seen.add(key); found.push(item);
      });
      found=found.slice(0,14);
      if(!found.length){results.innerHTML='<div class="fp-search-empty">چیزی با این عبارت پیدا نشد.</div>';results.hidden=false;return;}
      results.innerHTML=found.map(function(_,i){return '<button type="button" class="fp-search-result" data-search-index="'+i+'"><span>⌕</span><span style="min-width:0;flex:1"><div class="fp-search-result-title">'+found[i].title.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})+'</div><div class="fp-search-result-section">'+found[i].section.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})+'</div></span></button>';}).join('');
      results.querySelectorAll('.fp-search-result').forEach(function(btn){btn.addEventListener('click',function(){openItem(found[Number(btn.dataset.searchIndex)]);});});
      results.hidden=false;
    }
    input.addEventListener('input',function(){render(input.value);});
    input.addEventListener('focus',function(){if(clean(input.value))render(input.value);});
    clear.addEventListener('click',function(){input.value='';render('');input.focus();});
    document.addEventListener('click',function(e){if(!e.target.closest('.fp-global-search'))results.hidden=true;});
    input.addEventListener('keydown',function(e){if(e.key==='Escape'){input.value='';render('');input.blur();}});
    setTimeout(buildIndex,400);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initFocusPlanGlobalSearch,{once:true});else initFocusPlanGlobalSearch();
})();
