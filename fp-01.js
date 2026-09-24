
(function(){
  const input=document.getElementById('schoolCellInput');
  const modal=document.getElementById('schoolCellModal');
  if(input) input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();saveSchoolCell();}});
  if(modal) modal.addEventListener('click',function(e){if(e.target===modal)closeSchoolCellModal();});
})();
