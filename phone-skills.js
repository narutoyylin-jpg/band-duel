const characterName=id=>{const c=DUEL_CHARACTERS.find(x=>x.id===id);return c?tx(c.name,c.en):tx('無技能','No ability');};
function renderCharacterSelection(d){
 const box=$('characterChoices');$('characterPicker').hidden=d.stage!=='role';if($('characterPicker').hidden)return;
 const selected=d.yourReady?d.skills?.yours:ui.character;
 $('characterTitle').textContent=tx('先選角色技能，再點選你的陣營','Choose an ability, then choose your band');
 box.innerHTML=DUEL_CHARACTERS.map(c=>'<button type="button" data-character="'+c.id+'" aria-pressed="'+(selected===c.id)+'" '+(ui.busy||d.yourReady?'disabled':'')+'><span class="character-icon">'+c.icon+'</span><strong>'+tx(c.name,c.en)+'</strong><small>'+tx(c.description,c.descriptionEn)+'</small></button>').join('');
 $('characterTitle').hidden=false;
}
function renderSkillControls(d){
 const c=DUEL_CHARACTERS.find(x=>x.id===d.skills?.yours),box=$('skillControls');box.hidden=!c||d.stage!=='plan';if(box.hidden)return;
 const active=ui.plan.skill===c.id,used=d.skills.yourUsed,can=editable()&&d.round>1&&!used;
 $('skillUse').disabled=!can;$('skillUse').setAttribute('aria-pressed',String(active));$('skillUse').textContent=c.icon+' '+tx(c.skill,c.skillEn)+(used?tx(' · 已使用',' · Used'):active?tx(' · 本次啟用',' · Active'):tx(' · 每場一次',' · Once per match'));
 $('skillHelp').textContent=d.round===1?tx('第二回合起可使用技能。','Abilities unlock in round 2.'):used?tx('本場技能已使用。對手：','Ability used this match. Opponent: ')+characterName(d.skills.opponent):tx(c.description,c.descriptionEn);
 $('splitDirections').hidden=!active||c.id!=='split';
 if(active&&c.id==='split'){
  $('splitDirections').innerHTML=['own','other'].map(who=>'<div><span>'+tx(who==='own'?'你的能帶':'對手能帶',who==='own'?'Your band':'Opponent band')+'</span>'+[-1,1].map(dir=>{
   const p={...ui.plan,[who==='own'?'direction':'splitDirection']:dir};let valid=true;try{duelActionInfo(gameForPlan(),'player',p);}catch{valid=false;}
   return '<button type="button" data-split-who="'+who+'" data-split-dir="'+dir+'" aria-pressed="'+((who==='own'?ui.plan.direction:ui.plan.splitDirection)===dir)+'" '+(!can||!valid?'disabled':'')+'>'+signed(dir*.02)+'</button>';
  }).join('')+'</div>').join('');
 }
 if(active){$('offset').disabled=true;$('minus').disabled=true;$('plus').disabled=true;$('hold').hidden=true;try{const a=duelActionInfo(gameForPlan(),'player',ui.plan);$('cost').textContent=actionText(a)+tx(' · 剩 ',' · Left ')+Math.min(d.startingPoints||12,d.yourBudget-a.cost+(a.refund||0));}catch{}}
 $('opponentAbility').textContent=tx('對手角色：','Opponent: ')+characterName(d.skills.opponent)+(d.skills.opponentUsed?tx(' · 已使用',' · Used'):tx(' · 技能可用',' · Ability available'));
}
function toggleSkill(){
 if(!editable())return;
 if(ui.plan.skill){chooseBand(ui.data.controlled);return;}
 const skill=ui.data.skills?.yours,options=duelActions(gameForPlan(),'player').filter(a=>a.skill===skill),option=options.find(a=>a.direction===ui.plan.direction)||options[0];
 if(!option){ui.error=skill==='split'?tx('分流需要 3 點，且兩條能帶都要有可移動的空間。','Split needs 3 points and room to move both bands.'):tx('點數已滿或技能尚不可用。','Points are full or the ability is unavailable.');render();return;}
 ui.plan={...option};ui.error='';render();
}
function initSkills(){
 try{const saved=localStorage.getItem('band-character');if(validDuelCharacter(saved))ui.character=saved;}catch{}
 $('characterChoices').addEventListener('click',e=>{const b=e.target.closest('[data-character]');if(!b||b.disabled)return;ui.character=b.dataset.character;try{localStorage.setItem('band-character',ui.character);}catch{}renderCharacterSelection(ui.data);});
 $('skillUse').addEventListener('click',toggleSkill);
 $('splitDirections').addEventListener('click',e=>{const b=e.target.closest('[data-split-who]');if(!b||b.disabled||!editable()||ui.plan.skill!=='split')return;ui.plan[b.dataset.splitWho==='own'?'direction':'splitDirection']=Number(b.dataset.splitDir);render();});
}
