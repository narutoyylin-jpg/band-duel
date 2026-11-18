const motion={panels:['lobby','waiting','versus','role','mode','coinScreen','lockScreen','game','closed'],visible:new Set(),pending:false,ghosts:new Set(),verdictSeen:false,verdictAcknowledged:false,verdictTimer:null,draft:null};
const reducedMotion=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function beforeMotionRender(){return motion.panels.filter(id=>motion.visible.has(id)).map(id=>{const el=$(id),rect=el.getBoundingClientRect();return {id,rect,clone:el.cloneNode(true)};});}
function afterMotionRender(previous){
  const current=new Set(motion.panels.filter(id=>!$(id).hidden));
  if(!reducedMotion()){
    for(const {id,rect,clone} of previous)if(!current.has(id)&&id!=='lobby'&&rect.width&&rect.height){
      clone.removeAttribute('id');clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));clone.inert=true;clone.setAttribute('aria-hidden','true');
      Object.assign(clone.style,{position:'fixed',inset:'auto',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',zIndex:'23',pointerEvents:'none',background:'#000'});clone.hidden=false;document.body.append(clone);motion.ghosts.add(clone);
      const a=clone.animate([{opacity:1},{opacity:0}],{duration:220,easing:'ease-out'});a.onfinish=a.oncancel=()=>{clone.remove();motion.ghosts.delete(clone);};
    }
    for(const id of current)if(!motion.visible.has(id)){
      const el=$(id);el.animate([{opacity:0,transform:id==='mode'?'translateY(16px)':'none'},{opacity:1,transform:'none'}],{duration:id==='mode'?480:320,easing:'cubic-bezier(.2,.7,.2,1)'});
    }
  }
  if(current.has('game')&&['revealed','finished'].includes(ui.data?.stage)&&motion.stage==='plan')soundEffect('reveal');
  motion.stage=ui.data?.stage;motion.visible=current;renderSound();
}
async function tapAction(button,action,role=false){
  if(motion.pending||button?.disabled)return;motion.pending=true;
  if(role){button.classList.add('role-chosen');soundEffect('role');}
  else button?.classList.add('tap-feedback');
  try{if(!reducedMotion())await new Promise(r=>setTimeout(r,role?380:150));return await action();}
  finally{motion.pending=false;button?.classList.remove('tap-feedback','role-chosen');}
}
function closeAnimatedDialog(dialog){
  if(!dialog.open||dialog.classList.contains('dialog-leaving'))return;
  if(reducedMotion()){dialog.close();return;}dialog.classList.add('dialog-leaving');setTimeout(()=>{dialog.close();dialog.classList.remove('dialog-leaving');},180);
}
function stopDraftMotion(){motion.draft?.task?.cancel();motion.draft=null;}
function renderDraftGraph(d,showDraft){
  const target=showDraft?privateBoard(d):d.board,key=d.code+':'+d.round;
  if(!motion.draft||motion.draft.key!==key){stopDraftMotion();motion.draft={key,current:{...d.board},target:{...d.board},points:null,frame:null,task:null};}
  const m=motion.draft;
  const paint=(trial,tween)=>{$('playGraph').innerHTML=playBandSVG(d.board,{controlled:d.controlled,can:editable(),trial,tween,activeField:ui.plan.kind==='hold'?null:ui.plan.kind==='attack'?otherBand(d.controlled):d.controlled,round:d.round});};
  if(target.ec===m.target.ec&&target.ev===m.target.ev){paint(m.current,m.frame);return;}
  m.task?.cancel();const from={...m.current},to={...target},startPoints=m.points;m.target=to;
  if(reducedMotion()){m.current=to;m.frame=null;paint(to,null);return;}
  movementSound();m.task=tweenBands(from,to,(board,progress)=>{
    if(motion.draft!==m||ui.data?.stage!=='plan')return;
    m.current=board;m.frame={from,to,progress,startPoints};
    const y=e=>30+(2.2-e)*66;m.points={};
    for(const carrier of ['e','h']){const a=startPoints?.[carrier]||particlePositions(from,carrier,y),b=particlePositions(to,carrier,y);m.points[carrier]=a.map((p,i)=>({x:p.x+(b[i].x-p.x)*progress,y:p.y+(b[i].y-p.y)*progress}));}
    paint(board,m.frame);
  },300);
  m.task.promise.then(ok=>{if(ok&&motion.draft===m){m.current=to;m.frame=null;m.task=null;paint(to,null);}});
}
function verdictText(){return victoryOutcome()==='you'?tx('勝利','VICTORY'):victoryOutcome()==='opponent'?tx('對手獲勝','OPPONENT VICTORY'):tx('平手','DRAW');}
function updateVerdict(){renderVictory();}
function presentVerdict(){if(ui.data?.stage==='finished'&&ui.replayStep===3&&!ui.replayPlaying)showVictory();}
function acknowledgeVerdict(){if($('verdictConfirm').disabled)return;motion.verdictAcknowledged=true;victoryState.acknowledged=victoryKey();closeAnimatedDialog($('verdict'));if(ui.kind==='team')renderTeam();else renderGame(ui.data);}
function resetMotion(){stopDraftMotion();clearTimeout(motion.verdictTimer);motion.verdictTimer=null;motion.verdictSeen=false;motion.verdictAcknowledged=false;$('verdict').close();quietSound();for(const clone of motion.ghosts)clone.remove();motion.ghosts.clear();}
