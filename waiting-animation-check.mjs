import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {carrierModel,makeTerminalDuel,terminalVerdict,duelActionInfo} from './duel-core.mjs';

const frames=new Map(),timers=new Map(),nodes=new Map(),painted=[];let id=0,now=0;
const node=name=>{if(!nodes.has(name))nodes.set(name,{hidden:false,textContent:'',innerHTML:'',attrs:{},setAttribute(k,v){this.attrs[k]=v;}});return nodes.get(name);};
const ui={data:{code:'ABC234',stage:'lobby',board:{ec:6,ev:5},goal:{type:'Type II'}},plan:{kind:'hold'},queue:null};
const original=structuredClone(ui),document={hidden:false,modal:false,querySelector(){return this.modal?{}:null;}};
const context=vm.createContext({ui,document,siteLanguage:'cn',carrierModel,translated:x=>x,
  tx:(cn,en)=>context.siteLanguage==='en'?en:cn,$:node,reducedMotion:()=>false,
  particlePositions:(board,c,y)=>[{x:board.ec,y:y(board.ev)}],
  bandSVG:(board,options)=>{painted.push(structuredClone({board,options}));return JSON.stringify({board,options});},
  setTimeout:(fn,ms)=>{timers.set(++id,{fn,due:now+ms});return id;},clearTimeout:id=>timers.delete(id),
  requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)
});
vm.runInContext(fs.readFileSync('phone-animation.js','utf8')+'\n'+fs.readFileSync('phone-waiting-animation.js','utf8'),context);
const run=code=>vm.runInContext(code,context),flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const tick=async ms=>{now+=ms;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(now));for(const [key,timer] of [...timers])if(timer.due<=now){timers.delete(key);timer.fn();}await flush();};
const activeTasks=()=>frames.size+timers.size;

run("syncWaitingAnimation();waitingMotion.bag=['electrons'];skipWaitingLesson()");
assert.equal(activeTasks(),1);
const generation=run('waitingMotion.generation');for(let i=0;i<10;i++)run('syncWaitingAnimation()');
assert.equal(run('waitingMotion.generation'),generation,'polling must not restart the lesson');assert.equal(activeTasks(),1);
await tick(4200);await tick(0);await tick(950);
assert(run('waitingMotion.board.ec')<0&&run('waitingMotion.board.ec')>-2,'bands should move continuously');
context.siteLanguage='en';run('syncWaitingAnimation()');assert.match(node('waitingLessonCaption').textContent,/Lower B/);assert.equal(run('waitingMotion.generation'),generation);
const frozen=node('waitingLessonGraph').innerHTML;run('pauseWaitingLesson()');await flush();assert.equal(activeTasks(),0);await tick(10000);assert.equal(node('waitingLessonGraph').innerHTML,frozen,'pause must freeze the current frame');
run('pauseWaitingLesson()');await flush();assert.equal(frames.size,1);await tick(0);await tick(1900);assert.equal(run('waitingMotion.board.ec'),-2);assert.equal(timers.size,1);
document.hidden=true;run('syncWaitingAnimation()');await flush();assert.equal(activeTasks(),0);
document.hidden=false;run('syncWaitingAnimation()');assert.equal(activeTasks(),1);assert.equal(run('waitingMotion.lesson.id'),'electrons');
document.modal=true;run('syncWaitingAnimation()');await flush();assert.equal(activeTasks(),0);
document.modal=false;run('syncWaitingAnimation()');assert.equal(activeTasks(),1);
run('skipWaitingLesson()');await flush();assert.notEqual(run('waitingMotion.lesson.id'),'electrons');assert.equal(activeTasks(),1);
assert.deepEqual(ui,original,'lessons must leave the real board, mission and private plan untouched');
ui.queue={credentials:{code:'ABC234'}};ui.data={stage:'role',code:'COMPUT'};run('syncWaitingAnimation()');await flush();assert.equal(activeTasks(),0);assert.equal(run('waitingMotion.key'),null);
ui.queue=null;ui.data=structuredClone(original.data);run('syncWaitingAnimation()');assert.equal(activeTasks(),1);
ui.data.stage='role';run('syncWaitingAnimation()');await flush();const paintsAtMatch=painted.length;await tick(50000);assert.equal(activeTasks(),0);assert.equal(painted.length,paintsAtMatch,'no old animation may paint over a matched game');
ui.data.stage='lobby';ui.data.code='DEF234';run('syncWaitingAnimation()');assert.equal(run('waitingMotion.key'),'DEF234');ui.data=null;run('syncWaitingAnimation()');await flush();assert.equal(activeTasks(),0);

run('waitingMotion.bag=[];waitingMotion.lastId=null');let previous=null;
for(let cycle=0;cycle<20;cycle++){const seen=new Set();for(let i=0;i<9;i++){const next=run('nextWaitingLesson(()=>0.5).id');assert.notEqual(next,previous);assert(!seen.has(next));seen.add(next);previous=next;}assert.equal(seen.size,9);}
const lessons=run('waitingLessons');
const verdict=(type,other,board)=>terminalVerdict(makeTerminalDuel('ec',{player:{type,eSide:null,hSide:null},cpu:{type:other,eSide:null,hSide:null}}),{board});
assert.equal(verdict('Type I','Type II',lessons.find(x=>x.id==='different').steps[2].board).winner,'cpu');
for(const [id,type,winner] of [['same-I','Type I','player'],['same-II','Type II','cpu']]){
  const example=lessons.find(x=>x.id===id);assert.equal(verdict(type,type,example.steps[1].board).winner,winner);assert.equal(verdict(type,type,example.steps[2].board).winner,'draw');
}
assert.equal(verdict('邊界排列','Type I',lessons.find(x=>x.id==='boundary').steps[2].board).winner,'player');
assert.equal(verdict('邊界排列','Type II',lessons.find(x=>x.id==='interference').steps[2].board).winner,'cpu');
const budgetGame=makeTerminalDuel('ec');budgetGame.round=2;assert.equal(duelActionInfo(budgetGame,'player',{kind:'own',direction:-1,amount:2}).cost,2);assert.equal(duelActionInfo(budgetGame,'player',{kind:'attack',direction:-1,amount:2}).cost,4);
assert(!fs.readFileSync('phone-layout.html','utf8').includes('id="waitingTutorial"'));
console.log('Passed: waiting autoplay survives polling/language changes, pause/resume, tab/dialog suspension, CPU handoff, matching/cancel cleanup, random rotation and accurate verdict/point examples.');
