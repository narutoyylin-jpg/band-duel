const practiceUi={format:'1v1'};
function practiceModeLabel(mode){return ({types:'Type I vs Type II',together:'Type I vs Type I',separate:'Type II vs Type II',shuffle:'Shuffle'})[mode]||'Shuffle';}
function openPracticeEntry(){if(ui.data||ui.busy)return;practiceUi.format=teamMatchUi.format;renderPracticeEntry();$('practiceEntry').showModal();}
function renderPracticeEntry(){renderAbilityRules();
 $('practiceTitle').textContent=tx('練習模式','Practice');$('practiceClose').textContent=tx('關閉','Close');$('practiceIntro').textContent=tx('與電腦練習。可選 Type I／Type II 指定組合，或用 Shuffle 熟悉正式規則。','Practice with CPUs. Choose a fixed Type I / Type II pairing, or Shuffle to learn the official rules.');
 for(const b of document.querySelectorAll('[data-practice-format]'))b.setAttribute('aria-pressed',String(b.dataset.practiceFormat===practiceUi.format));
 $('practiceStart').textContent=practiceUi.format==='2v2'?tx('開始 2v2 練習','Start 2v2 practice'):tx('開始 1v1 練習','Start 1v1 practice');
}
async function startPracticeEntry(){
 if(ui.busy||ui.data)return;$('practiceEntry').close();if(practiceUi.format==='2v2')await connectTeam('computer','',{abilityMode:abilityUi.mode});else await practice();
}
function initPracticeEntry(){
 $('practiceClose').addEventListener('click',()=>closeAnimatedDialog($('practiceEntry')));$('practiceEntry').addEventListener('cancel',e=>{e.preventDefault();closeAnimatedDialog($('practiceEntry'));});
 for(const b of document.querySelectorAll('[data-practice-format]'))b.addEventListener('click',()=>{practiceUi.format=b.dataset.practiceFormat;renderPracticeEntry();});$('practiceStart').addEventListener('click',startPracticeEntry);
 document.addEventListener('band-language',()=>{if($('practiceEntry').open)renderPracticeEntry();});
}
function renderTeamPracticeModes(d){
 $('teamPracticeModes').hidden=!d.computer;if(!d.computer)return;
 $('teamPracticeModeTitle').textContent=tx('練習組合','Practice pairing');$('teamPracticeModeButtons').innerHTML=['types','together','separate','shuffle'].map(mode=>'<button type="button" data-team-practice-mode="'+mode+'" aria-pressed="'+(d.mode===mode)+'" '+(ui.busy?'disabled':'')+'>'+practiceModeLabel(mode)+'</button>').join('');
}
