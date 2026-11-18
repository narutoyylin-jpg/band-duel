const mixBoard=(a,b,t)=>({ec:a.ec+(b.ec-a.ec)*t,ev:a.ev+(b.ev-a.ev)*t});
const visualType=r=>translated(r.type);
function tweenBands(from,to,paint,duration=1100){
  let raf,start,done=false,resolve;const promise=new Promise(r=>resolve=r);
  const finish=ok=>{if(done)return;done=true;cancelAnimationFrame(raf);resolve(ok);};
  const frame=now=>{if(done)return;start??=now;const t=Math.min(1,(now-start)/duration),smooth=t*t*(3-2*t);paint(mixBoard(from,to,smooth),smooth);if(t===1)finish(true);else raf=requestAnimationFrame(frame);};
  raf=requestAnimationFrame(frame);return {promise,cancel:()=>finish(false)};
}
function resultBoards(last){
  const own=applyDuelAction({...last.startBoard},last.yourAction);
  return [last.startBoard,own,last.board];
}
function stopReplay(keepFrame=false){ui.replayGeneration=(ui.replayGeneration||0)+1;ui.replayTask?.cancel();ui.replayTask=null;ui.replayPlaying=false;if(!keepFrame)ui.replayFrame=null;}
async function playReplay(singleStep=null){
  if(!['revealed','finished'].includes(ui.data?.stage))return;
  stopReplay();const generation=ui.replayGeneration,last=ui.data.history.at(-1),boards=resultBoards(last);
  ui.replayPlaying=true;const steps=singleStep===null?[1,2]:[singleStep];
  for(const step of steps){
    if(generation!==ui.replayGeneration)return;ui.replayStep=step;
    const from=boards[step-1],to=boards[step],movement=step===1?'you':'opponent';
    ui.replayFrame={board:{...from},from,to,movement,progress:0};movementSound();renderGame(ui.data);
    ui.replayTask=tweenBands(from,to,(board,progress)=>{if(generation!==ui.replayGeneration)return;ui.replayFrame={board,from,to,movement,progress};paintReplayFrame();},reducedMotion()?1:600);
    if(!await ui.replayTask.promise)return;
    ui.replayTask=tweenBands(to,to,()=>{},220);if(!await ui.replayTask.promise)return;
  }
  if(generation!==ui.replayGeneration)return;ui.replayPlaying=false;ui.replayFrame=null;ui.replayTask=null;if(singleStep===null)ui.replayStep=3;renderGame(ui.data);
}
function paintReplayFrame(){
  const frame=ui.replayFrame;if(!frame||!ui.data)return;
  graph(frame.board,false,frame.from,frame.movement,{from:frame.from,to:frame.to,progress:frame.progress});
  renderSkillCast(frame.movement==='you'?ui.data.history.at(-1).yourAction:ui.data.history.at(-1).opponentAction);const r=carrierModel(frame.board.ec*.02,frame.board.ev*.02);$('resultType').textContent=tx('此步結果：','Step result: ')+visualType(r);
}
function selectReplay(step){
  if(![0,1,2,3].includes(step)||!['revealed','finished'].includes(ui.data?.stage))throw Error('請在 Result 選擇回放步驟。');
  stopReplay();ui.replayStep=step;if(step===1||step===2)playReplay(step);else renderGame(ui.data);return readPhone();
}
