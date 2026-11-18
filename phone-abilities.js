const abilityUi={mode:'classic',key:null,selected:null,readOnly:false,ids:[],team:false,done:new Set()};
const characterName=id=>{const c=DUEL_CHARACTERS.find(x=>x.id===id);return c?tx(c.skill,c.skillEn):tx('無技能','No ability');};
function renderAbilityRules(){
 for(const b of document.querySelectorAll('[data-ability-mode]')){b.setAttribute('aria-pressed',String(b.dataset.abilityMode===abilityUi.mode));b.textContent=b.dataset.abilityMode==='skills'?tx('技能模式','Skill mode'):tx('經典模式','Classic');b.disabled=ui.busy||!!ui.data;}
 for(const el of document.querySelectorAll('[data-ability-label]'))el.textContent=tx('休閒／練習規則 · 牌位固定無技能','Casual / practice rules · Ranked has no abilities');
}
function skillDemoMarkup(id){
 const skill=DUEL_CHARACTERS.find(s=>s.id===id);if(!skill)return '';
 return '<div class="skill-demo" data-demo="'+id+'"><svg viewBox="0 0 300 100" role="img" aria-label="'+htmlText(tx(skill.skill,skill.skillEn)+' · '+tx(skill.description,skill.descriptionEn))+'"><path d="M20 30H140V38H280" fill="none" stroke="#71aaff" stroke-width="3"/><path d="M20 77H140V69H280" fill="none" stroke="#ff9199" stroke-width="3"/><g class="demo-own"><circle cx="215" cy="29" r="6" fill="#71aaff"/><path d="M180 30H270" stroke="#a8d3ff" stroke-width="4"/></g><g class="demo-other"><circle cx="215" cy="79" r="6" fill="none" stroke="#ff9199" stroke-width="2"/><path d="M180 77H270" stroke="#ffc0c5" stroke-width="4"/></g><text x="20" y="17" fill="#a8c9f7" font-size="11">'+tx('本職能帶','Primary band')+'</text><text x="20" y="96" fill="#ffacb6" font-size="11">'+tx('另一條能帶','Other band')+'</text><text class="demo-refund" x="195" y="57" fill="#ffd875" font-size="24">+2</text></svg><p>'+htmlText(tx(skill.description,skill.descriptionEn))+'</p></div>';
}
function skillDraftKey(d){return (d.matchId||d.code)+':'+(ui.cpuCoinId||'')+':'+(d.yourSlot||'solo');}
function openSkillDraft(d,readOnly=false,ids=null){
 abilityUi.key=skillDraftKey(d);abilityUi.team=ui.kind==='team';abilityUi.readOnly=readOnly;abilityUi.ids=ids||d.skills.offers;abilityUi.selected=abilityUi.ids.includes(d.skills?.yours)?d.skills.yours:abilityUi.ids.includes(ui.character)?ui.character:abilityUi.ids[0];renderSkillDraft();if(!$('skillDraft').open)$('skillDraft').showModal();
}
function renderSkillDraft(){
 $('skillDraftTitle').textContent=abilityUi.readOnly?tx('技能動畫說明','Ability demonstration'):tx('本場技能 · 隨機三選一','Match ability · choose 1 of 3');$('skillDraftHint').textContent=abilityUi.readOnly?tx('點選技能重看動畫。','Select an ability to replay its demo.'):tx('所有技能免費。選好後公開給對手，每場只能使用一次，第二回合起可用。','Every ability is free. Your choice is public, usable once per match from round 2.');
 $('skillDraftCards').innerHTML=abilityUi.ids.map(id=>{const s=DUEL_CHARACTERS.find(x=>x.id===id);return '<button type="button" data-draft-skill="'+id+'" aria-pressed="'+(id===abilityUi.selected)+'"><b>'+s.icon+'</b><strong>'+htmlText(tx(s.skill,s.skillEn))+'</strong></button>';}).join('');$('skillDraftDemo').innerHTML=skillDemoMarkup(abilityUi.selected);$('skillDraftConfirm').textContent=abilityUi.readOnly?tx('關閉','Close'):tx('選擇 ','Choose ')+characterName(abilityUi.selected);$('skillDraftConfirm').disabled=ui.busy;
}
function ensureSkillDraft(d){
 if(!d.skills?.enabled||!d.skills.offers?.length||d.yourReady)return;const key=skillDraftKey(d);if(abilityUi.done.has(key)||$('skillDraft').open)return;if(ui.kind==='team'&&d.skills.yours)return;
 queueMicrotask(()=>{if(ui.data===d&&!$('skillDraft').open)openSkillDraft(d);});
}
function renderCharacterSelection(d){
 $('characterPicker').hidden=d.stage!=='role'||!d.skills?.enabled;if($('characterPicker').hidden)return;
 if(!d.skills.offers.includes(ui.character))ui.character=d.skills.yours||d.skills.offers[0];$('characterTitle').textContent=tx('本場技能：','Match ability: ')+characterName(d.skills.yours||ui.character);$('characterChoices').innerHTML='<button type="button" data-skill-review>'+tx(d.yourReady?'查看技能':'重選／查看動畫',d.yourReady?'View ability':'Choose / view demo')+'</button>';ensureSkillDraft(d);
}
function renderSkillControls(d){
 const c=DUEL_CHARACTERS.find(x=>x.id===d.skills?.yours),box=$('skillControls');box.hidden=!d.skills?.enabled||!c||d.stage!=='plan';if(box.hidden)return;
 const active=ui.plan.skill===c.id,used=d.skills.yourUsed,can=editable()&&d.round>1&&!used;
 $('skillUse').disabled=!can;$('skillUse').setAttribute('aria-pressed',String(active));$('skillUse').textContent=c.icon+' '+tx(c.skill,c.skillEn)+(used?tx(' · 已使用',' · Used'):active?tx(' · 本次啟用',' · Active'):tx(' · 每場一次',' · Once per match'));
 $('skillHelp').textContent=d.round===1?tx('第二回合起可使用技能。','Abilities unlock in round 2.'):tx(c.description,c.descriptionEn);
 $('splitDirections').hidden=!active||c.id==='charge';if(active&&c.id!=='charge')$('splitDirections').innerHTML=(c.id==='split'?['own','other']:['own']).map(who=>'<div><span>'+tx(who==='other'||c.id==='jam'?'另一條能帶':'本職能帶',who==='other'||c.id==='jam'?'Other band':'Primary band')+'</span>'+[-1,1].map(dir=>{const p={...ui.plan,[who==='own'?'direction':'splitDirection']:dir};let valid=true;try{duelActionInfo(gameForPlan(),'player',p);}catch{valid=false;}return '<button type="button" data-split-who="'+who+'" data-split-dir="'+dir+'" aria-pressed="'+((who==='own'?ui.plan.direction:ui.plan.splitDirection)===dir)+'" '+(!can||!valid?'disabled':'')+'>'+signed(dir*(c.id==='pulse'?.04:.02))+'</button>';}).join('')+'</div>').join('');
 if(active){$('offset').disabled=true;$('minus').disabled=true;$('plus').disabled=true;$('hold').hidden=true;try{const a=duelActionInfo(gameForPlan(),'player',ui.plan);$('cost').textContent=actionText(a)+tx(' · 剩 ',' · Left ')+Math.min(d.startingPoints||12,d.yourBudget-a.cost+(a.refund||0));}catch{}}
 $('opponentAbility').textContent=tx('對手技能：','Opponent: ')+characterName(d.skills.opponent)+(d.skills.opponentUsed?tx(' · 已使用',' · Used'):tx(' · 可用 · 看動畫',' · Available · demo'));
}
function toggleSkill(){
 if(!editable())return;if(ui.plan.skill){chooseBand(ui.data.controlled);return;}const options=duelActions(gameForPlan(),'player').filter(a=>a.skill),option=options.find(a=>a.direction===ui.plan.direction)||options[0];if(!option){ui.error=tx('目前點數或能帶位置無法使用這項技能。','Your current points or band position cannot use this ability.');render();return;}ui.plan={...option};ui.error='';render();
}
function renderTeamSkillSelection(d){
 $('teamSkillPicker').hidden=!d.skills?.enabled||d.stage!=='lobby';if($('teamSkillPicker').hidden)return;$('teamSkillPicker').innerHTML='<button type="button" data-team-skill-review>'+tx('本場技能：','Match ability: ')+characterName(d.skills.yours)+' · '+tx(d.yourReady?'查看動畫':'三選一／查看動畫',d.yourReady?'View demo':'Choose / view demo')+'</button>';ensureSkillDraft(d);
}
function renderTeamSkillControls(d){
 const c=DUEL_CHARACTERS.find(s=>s.id===d.skills?.yours);$('teamSkillControls').hidden=!d.skills?.enabled||!c;if(!c||!d.skills.enabled)return;const active=teamUi.plan.skill===c.id;
 $('teamSkillUse').textContent=c.icon+' '+tx(c.skill,c.skillEn)+(d.skills.yourUsed?tx(' · 已使用',' · Used'):active?tx(' · 本次啟用',' · Active'):tx(' · 每場一次',' · Once per match'));$('teamSkillUse').disabled=!teamCanEdit()||d.round<2||d.skills.yourUsed;$('teamSkillUse').setAttribute('aria-pressed',String(active));$('teamSkillsInfo').textContent=tx('查看四人技能與動畫','View all abilities / demos');
 const options=teamSkillActions(teamGameForSkill(d),d.yourSlot);$('teamSkillDirections').hidden=!active||c.id==='charge';$('teamSkillDirections').innerHTML=active?options.map((a,i)=>'<button type="button" data-team-skill-option="'+i+'" aria-pressed="'+(JSON.stringify(a)===JSON.stringify(teamUi.plan))+'">'+bandLabel('ec')+' '+signed(a.ec*.02)+' / '+bandLabel('ev')+' '+signed(a.ev*.02)+'</button>').join(''):'';
 if(active){$('teamMoveRange').disabled=true;$('teamMinus').disabled=true;$('teamPlus').disabled=true;}
}
function teamGameForSkill(d=ui.data){return {rulesVersion:d.rulesVersion,abilityMode:d.skills?.enabled?'skills':'classic',round:d.round,roundLimit:d.roundLimit,board:d.board,budgets:{[d.yourSlot]:d.yourBudget},characters:{[d.yourSlot]:d.skills?.yours},skillUsed:{[d.yourSlot]:d.skills?.yourUsed}};}
function teamPlanInfo(d=ui.data){try{return teamActionInfo(teamGameForSkill(d),d.yourSlot,teamUi.plan);}catch{return {cost:0,refund:0};}}
function renderSkillCast(action){const el=$('skillCastBanner'),skill=DUEL_CHARACTERS.find(s=>s.id===action?.skill);el.hidden=!skill;if(!skill){el.dataset.skill='';return;}const key=ui.kind+':'+ui.data.round+':'+(ui.kind==='team'?teamUi.replayStep:ui.replayStep)+':'+skill.id;if(el.dataset.cast===key)return;el.dataset.cast=key;el.dataset.skill=skill.id;el.innerHTML='<span>'+skill.icon+'</span><strong>'+characterName(skill.id)+'</strong><small>'+tx('技能發動','ABILITY ACTIVATED')+'</small>';}
function initSkills(){
 document.addEventListener('click',e=>{const b=e.target.closest('[data-ability-mode]');if(!b||b.disabled)return;abilityUi.mode=b.dataset.abilityMode;renderAbilityRules();if($('practiceEntry').open)renderPracticeEntry();if($('roomCreate').open)renderRoomCreate();refreshQueue();});
 $('characterChoices').addEventListener('click',()=>openSkillDraft(ui.data,!!ui.data.yourReady,ui.data.yourReady?[ui.data.skills.yours]:null));
 $('skillDraftCards').addEventListener('click',e=>{const b=e.target.closest('[data-draft-skill]');if(b){abilityUi.selected=b.dataset.draftSkill;renderSkillDraft();}});
 $('skillDraftConfirm').addEventListener('click',async()=>{if(abilityUi.readOnly){$('skillDraft').close();return;}const key=abilityUi.key;abilityUi.done.add(key);if(abilityUi.team){await teamCommand('skill',{skill:abilityUi.selected});if(ui.data.skills.yours!==abilityUi.selected){abilityUi.done.delete(key);return;}}else ui.character=abilityUi.selected;$('skillDraft').close();render();});
 $('skillDraft').addEventListener('cancel',e=>{if(!abilityUi.readOnly)e.preventDefault();});$('skillUse').addEventListener('click',toggleSkill);
 $('opponentAbility').addEventListener('click',()=>{if(ui.data.skills?.opponent)openSkillDraft(ui.data,true,[ui.data.skills.opponent]);});
 $('splitDirections').addEventListener('click',e=>{const b=e.target.closest('[data-split-who]');if(!b||b.disabled||!editable()||!ui.plan.skill)return;ui.plan[b.dataset.splitWho==='own'?'direction':'splitDirection']=Number(b.dataset.splitDir);render();});
 $('teamSkillPicker').addEventListener('click',()=>openSkillDraft(ui.data,ui.data.yourReady,ui.data.yourReady?[ui.data.skills.yours]:null));
 $('teamSkillUse').addEventListener('click',()=>{if(!teamCanEdit())return;const list=teamSkillActions(teamGameForSkill(),ui.data.yourSlot);if(teamUi.plan.skill)teamUi.plan={ec:0,ev:0};else if(list.length)teamUi.plan=list[0];else{ui.error=tx('目前點數或能帶位置無法使用這項技能。','Your current points or band position cannot use this ability.');render();return;}renderTeam();queueTeamDraft();});
 $('teamSkillDirections').addEventListener('click',e=>{const b=e.target.closest('[data-team-skill-option]');if(b&&teamCanEdit()){teamUi.plan=teamSkillActions(teamGameForSkill(),ui.data.yourSlot)[Number(b.dataset.teamSkillOption)];renderTeam();queueTeamDraft();}});
 $('teamSkillsInfo').addEventListener('click',()=>openSkillDraft(ui.data,true,[...new Set(ui.data.players.map(p=>p.skill).filter(Boolean))]));document.addEventListener('band-language',()=>{renderAbilityRules();if($('skillDraft').open)renderSkillDraft();});renderAbilityRules();
}
