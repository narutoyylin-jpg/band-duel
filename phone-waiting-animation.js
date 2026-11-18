// Waiting lessons only paint illustrative boards; they never submit a move.
const waitingLessons=[
  {id:'electrons',kind:'rule',title:['電子喜歡較低的導帶','Electrons favor the lower conduction band'],steps:[
    {board:{ec:0,ev:2},text:['導帶等高時，電子在 A、B 各占 50%。','Level conduction bands split electrons 50/50 between A and B.']},
    {board:{ec:-2,ev:2},text:['把 B 的導帶降低，藍色電子會往 B 移動。','Lower B’s conduction band: the blue electrons move toward B.']},
    {board:{ec:-4,ev:2},text:['位差越大，電子越集中；看圖上的比例就能比較。','A larger offset concentrates more electrons. Compare the shares on the graph.']}
  ]},
  {id:'holes',kind:'rule',title:['電洞喜歡較高的價帶','Holes favor the higher valence band'],steps:[
    {board:{ec:-2,ev:0},text:['價帶等高時，電洞在 A、B 各占 50%。','Level valence bands split holes 50/50 between A and B.']},
    {board:{ec:-2,ev:2},text:['把 B 的價帶提高，空心電洞會往 B 移動。','Raise B’s valence band: the hollow holes move toward B.']},
    {board:{ec:-2,ev:4},text:['電子看導帶、電洞看價帶；兩條能帶決定最後排列。','Electrons follow conduction; holes follow valence. Both bands determine the alignment.']}
  ]},
  {id:'types',kind:'rule',title:['Type I 與 Type II 怎麼分？','How do Type I and Type II differ?'],steps:[
    {board:{ec:-2,ev:2},text:['Type I：電子和電洞偏向同一個材料；A 或 B 都可以。','Type I: electrons and holes favor the same material. A or B both count.']},
    {board:{ec:-2,ev:-2},text:['Type II：電子和電洞偏向不同材料。','Type II: electrons and holes favor different materials.']},
    {board:{ec:2,ev:-2},text:['這裡又是 Type I，這次兩種載子都偏向 A。','This is Type I again, with both carriers now favoring A.']}
  ]},
  {id:'different',kind:'rule',title:['不同任務：看最後的排列','Different missions: the final alignment decides'],meta:['你：Type I　／　對手：Type II','You: Type I / Opponent: Type II'],steps:[
    {board:{ec:2,ev:2},text:['假設這是最後一回合。現在是 Type II，符合對手的任務。','Imagine the final round. Type II currently matches your opponent’s mission.']},
    {board:{ec:-2,ev:2},movement:'you',text:['你的動作把排列改成 Type I；但還要看對手的改動。','Your move creates Type I, but your opponent’s move still matters.']},
    {board:{ec:-2,ev:-2},movement:'opponent',text:['合併兩人的動作後是 Type II，因此對手獲勝。途中達成不算。','Both moves leave Type II, so your opponent wins. A temporary match does not count.']}
  ]},
  {id:'same-I',kind:'rule',title:['都要 Type I：比各自載子的比例','Both want Type I: compare your carrier shares'],controlled:'ec',meta:['你：Type I　／　對手：Type I','You: Type I / Opponent: Type I'],steps:[
    {board:{ec:-2,ev:2},text:['共同任務先達成，再比較各自控制的載子。你是電子，對手是電洞。','First achieve the shared mission. You control electrons; your opponent controls holes.']},
    {board:{ec:-4,ev:2},text:['若最後停在這裡，電子的集中比例更高，你獲勝。','If this is the final board, electrons are more concentrated: you win.']},
    {board:{ec:-4,ev:4},text:['若最後變成這樣，兩方比例相同才是平手。達成先後不影響判定。','If this is the final board, equal shares mean a draw. Who reached the Type first does not decide it.']}
  ]},
  {id:'same-II',kind:'rule',title:['都要 Type II：一樣比較比例','Both want Type II: the same share comparison'],controlled:'ec',meta:['你：Type II　／　對手：Type II','You: Type II / Opponent: Type II'],steps:[
    {board:{ec:-2,ev:-2},text:['Type II 達成後，仍是比你控制的載子和對手控制的載子。','After achieving Type II, compare your controlled carrier with your opponent’s.']},
    {board:{ec:-2,ev:-4},text:['若最後停在這裡，對手的電洞更集中，因此對手獲勝。','If this is the final board, your opponent’s holes are more concentrated: they win.']},
    {board:{ec:-4,ev:-4},text:['若兩方比例相同，平手；最後不是 Type II，也沒人達成任務。','Equal shares mean a draw. A final alignment other than Type II also leaves neither mission achieved.']}
  ]},
  {id:'points',kind:'tip',title:['點數要留給後面的回合','Save points for later rounds'],controlled:'ec',steps:[
    {board:{ec:1,ev:1},meta:['剩餘 12 點 · 5 回合','12 points left · 5 rounds'],text:['5 回合每人 12 點；12 回合每人 30 點。這是整局可用的總量。','Each player gets 12 points for 5 rounds or 30 for 12. This budget lasts the whole match.']},
    {board:{ec:-1,ev:1},meta:['改自己 2 步 · 花 2 點 · 剩 10 點','Own band: 2 steps / cost 2 / 10 left'],movement:'you',text:['修改自身能帶每步 1 點；這次移動 2 步，花掉 2 點。','Changing your band costs 1 point per step. This two-step move spends 2 points.']},
    {board:{ec:-1,ev:-1},meta:['干擾 2 步 · 花 4 點 · 剩 6 點','Interference: 2 steps / cost 4 / 6 left'],movement:'you',text:['第二回合起能干擾對手，每步 2 點。保留不動則不花點數。','From round 2, interference costs 2 points per step. Holding costs no points.']}
  ]},
  {id:'boundary',kind:'rule',title:['Shuffle 也可能抽到邊界任務','Shuffle can assign a Boundary mission'],meta:['你：邊界排列　／　對手：Type I','You: Boundary / Opponent: Type I'],steps:[
    {board:{ec:2,ev:2},text:['邊界任務：最後電子或電洞，其中任一種在 A、B 各 50% 就達成。','Boundary: on the final board, either electrons or holes must split 50/50 between A and B.']},
    {board:{ec:0,ev:2},movement:'you',text:['把導帶調成等高，電子各 50%；電洞不用也各 50%。','Level the conduction bands: electrons split 50/50. Holes do not have to split evenly too.']},
    {board:{ec:0,ev:2},text:['若這是合併動作後的最終能帶，你就達成邊界任務。','If this is the final board after both moves, you achieve the Boundary mission.']}
  ]},
  {id:'interference',kind:'tip',title:['留意對手能把你的改動推回來','Your opponent can undo your move'],meta:['你：邊界排列　／　對手：Type II','You: Boundary / Opponent: Type II'],steps:[
    {board:{ec:2,ev:2},text:['不要只看自己的預測；兩人的改動會一起影響公開能帶。','Look beyond your private preview. Both players’ moves affect the public bands.']},
    {board:{ec:0,ev:2},movement:'you',text:['你把電子調成各 50%，暫時達成邊界。','Your move splits electrons 50/50, briefly creating a boundary.']},
    {board:{ec:2,ev:2},movement:'opponent',text:['對手把導帶推回去，邊界消失。最後一回合也要預留應對的點數。','Your opponent pushes the band back and removes the boundary. Save points to respond in later rounds.']}
  ]}
];
const waitingTeamLessons=[
 {id:'team-single',kind:'tip',controlled:'ec',title:['點選一條能帶，提交一個動作','Choose one band, submit one move'],steps:[
  {board:{ec:0,ev:0},text:['2v2 每人有自己的點數池。5 回合各 12 點，12 回合各 30 點。','Each player has their own points: 12 for five rounds, 30 for twelve.']},
  {board:{ec:2,ev:0},text:['點導帶後用滑桿調整。本職能帶每格 1 點，另一條每格 2 點。','Tap a band, then use the slider. Your role’s band costs 1 point per step; the other costs 2.']},
  {board:{ec:0,ev:1},text:['切到價帶會清除先前的導帶計畫，每回合只提交最後選定的一條。','Switching to valence clears the conduction plan. Submit only the last selected band.']}
 ]},
 {id:'team-hidden',kind:'tip',title:['觀察對手，也要替隊友留空間','Watch the opponent and leave room for your teammate'],steps:[
  {board:{ec:1,ev:1},text:['你看得到同角色對手的即時動作，直到四人鎖定前都能觀察。','Watch the live moves of the opponent with your role until all four lock.']},
  {board:{ec:-1,ev:1},text:['隊友的計畫不會出現在預覽裡，別把兩人的點數當成共用。','Your teammate’s plan is hidden from the preview. Your point pools are independent.']},
  {board:{ec:-1,ev:-1},text:['揭曉時四人依序播放，最後仍以合併後的能帶判定。','All four moves replay in order. The combined final board decides the result.']}
 ]},
 {id:'team-same',kind:'rule',title:['同任務時，比隊伍的平均比例','Same mission: compare the team’s mean share'],steps:[
  {board:{ec:2,ev:-2},text:['若兩隊都是 Type I 且任務達成，比較各隊自己材料中的電子與電洞平均比例。','If both teams achieve Type I, compare their mean electron and hole shares in their own material.']},
  {board:{ec:-2,ev:2},text:['這裡兩種載子都偏向 B，B 隊的平均比例較高。','Both carriers favor B here, so Team B has the higher mean share.']},
  {board:{ec:0,ev:0},text:['只有平均比例相等才平手。任務不同時，最後達成自己任務的隊伍獲勝。','Equal means are a draw. With different missions, the team meeting its final mission wins.']}
 ]}
];
const waitingMotion={generation:0,task:null,key:null,lesson:null,step:0,board:null,tween:null,bag:[],lastId:null,paused:false,active:false};
function nextWaitingLesson(random=Math.random){
  const lessons=ui.kind==='team'?[...waitingLessons.filter(x=>['electrons','holes','types','points'].includes(x.id)),...waitingTeamLessons]:waitingLessons;
  if(waitingMotion.bag.some(id=>!lessons.some(x=>x.id===id)))waitingMotion.bag=[];
  if(!waitingMotion.bag.length){
    const bag=lessons.map(x=>x.id);for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
    if(bag.at(-1)===waitingMotion.lastId)[bag[0],bag[bag.length-1]]=[bag.at(-1),bag[0]];
    waitingMotion.bag=bag;
  }
  const id=waitingMotion.bag.pop();waitingMotion.lastId=id;return lessons.find(x=>x.id===id);
}
function waitingAnimationVisible(){return ['lobby','queue'].includes(ui.data?.stage)&&!ui.queue&&!document.hidden&&!$('waiting').hidden&&!document.querySelector('dialog[open]');}
function stopWaitingAnimation(reset=true){
  waitingMotion.generation++;waitingMotion.task?.cancel();waitingMotion.task=null;waitingMotion.active=false;
  if(reset){waitingMotion.key=null;waitingMotion.lesson=null;waitingMotion.paused=false;waitingMotion.board=null;waitingMotion.tween=null;}
}
function paintWaitingLesson(){
  const lesson=waitingMotion.lesson;if(!lesson)return;const step=lesson.steps[waitingMotion.step],board=waitingMotion.board||step.board;
  $('waitingLessonTag').textContent=lesson.kind==='tip'?tx('小策略 · 隨機輪播','Strategy tip · random rotation'):tx('規則動畫 · 隨機輪播','Animated rules · random rotation');
  $('waitingLessonTitle').textContent=tx(...lesson.title);$('waitingLessonCaption').textContent=tx(...step.text);
  $('waitingLessonMeta').textContent=step.meta?tx(...step.meta):lesson.meta?tx(...lesson.meta):visualType(carrierModel(board.ec*.02,board.ev*.02));
  $('waitingLessonStep').textContent=tx('示範 ','Demo ')+(waitingMotion.step+1)+' / '+lesson.steps.length;
  $('waitingLessonProgress').innerHTML=lesson.steps.map((_,i)=>'<i class="'+(i===waitingMotion.step?'current':i<waitingMotion.step?'done':'')+'"></i>').join('');
  $('waitingLessonPause').textContent=waitingMotion.paused?'▶':'Ⅱ';$('waitingLessonPause').setAttribute('aria-label',waitingMotion.paused?tx('繼續播放','Resume animation'):tx('暫停動畫','Pause animation'));$('waitingLessonPause').setAttribute('aria-pressed',String(waitingMotion.paused));
  $('waitingLessonNext').textContent=tx('換一則','Next tip');
  $('waitingLessonGraph').setAttribute('aria-label',tx(...lesson.title));paintWaitingGraph();
}
function paintWaitingGraph(){
  const lesson=waitingMotion.lesson;if(!lesson)return;const step=lesson.steps[waitingMotion.step],board=waitingMotion.board||step.board,tween=waitingMotion.tween;
  $('waitingLessonGraph').innerHTML=bandSVG(board,{controlled:lesson.controlled||null,tween,previous:tween?.from,movement:step.movement||null});
  if(!step.meta&&!lesson.meta)$('waitingLessonMeta').textContent=visualType(carrierModel(board.ec*.02,board.ev*.02));
}
function waitingLessonDelay(ms){
  let timer,resolve;const promise=new Promise(r=>{resolve=r;timer=setTimeout(()=>resolve(true),ms);});return {promise,cancel:()=>{clearTimeout(timer);resolve(false);}};
}
function waitingVisiblePoints(){
  const tween=waitingMotion.tween;if(!tween)return undefined;const y=e=>30+(2.2-e)*66,points={};
  for(const carrier of ['e','h']){const start=tween.startPoints?.[carrier]||particlePositions(tween.from,carrier,y),end=particlePositions(tween.to,carrier,y);points[carrier]=start.map((point,i)=>({x:point.x+(end[i].x-point.x)*tween.progress,y:point.y+(end[i].y-point.y)*tween.progress}));}return points;
}
async function playWaitingLessons(generation){
  while(generation===waitingMotion.generation&&waitingAnimationVisible()&&!waitingMotion.paused){
    const lesson=waitingMotion.lesson;
    for(let i=waitingMotion.step;i<lesson.steps.length;i++){
      if(generation!==waitingMotion.generation)return;
      const from=waitingMotion.board||lesson.steps[i].board,to=lesson.steps[i].board,startPoints=waitingVisiblePoints();waitingMotion.step=i;waitingMotion.tween=null;paintWaitingLesson();
      if(from.ec!==to.ec||from.ev!==to.ev){
        waitingMotion.task=tweenBands(from,to,(board,progress)=>{if(generation!==waitingMotion.generation)return;waitingMotion.board=board;waitingMotion.tween={from,to,progress,startPoints};paintWaitingGraph();},reducedMotion()?1:1900);
        if(!await waitingMotion.task.promise)return;
      }
      if(generation!==waitingMotion.generation)return;waitingMotion.board={...to};waitingMotion.tween=null;paintWaitingGraph();
      waitingMotion.task=waitingLessonDelay(i===0?4200:4800);if(!await waitingMotion.task.promise)return;
      if(generation!==waitingMotion.generation)return;
      if(!waitingAnimationVisible()){stopWaitingAnimation(false);return;}
    }
    waitingMotion.lesson=nextWaitingLesson();waitingMotion.step=0;waitingMotion.board={...waitingMotion.lesson.steps[0].board};
  }
  if(generation===waitingMotion.generation){waitingMotion.active=false;waitingMotion.task=null;}
}
function syncWaitingAnimation(){
  if(!['lobby','queue'].includes(ui.data?.stage)||ui.queue){if(waitingMotion.key)stopWaitingAnimation();return;}
  if(!waitingAnimationVisible()){if(waitingMotion.active)stopWaitingAnimation(false);return;}
  const key=ui.data.code;if(waitingMotion.key!==key){stopWaitingAnimation();waitingMotion.key=key;waitingMotion.lesson=nextWaitingLesson();waitingMotion.step=0;waitingMotion.board={...waitingMotion.lesson.steps[0].board};}
  paintWaitingLesson();if(waitingMotion.paused||waitingMotion.active)return;waitingMotion.active=true;playWaitingLessons(waitingMotion.generation);
}
function pauseWaitingLesson(){const paused=!waitingMotion.paused;stopWaitingAnimation(false);waitingMotion.paused=paused;syncWaitingAnimation();}
function skipWaitingLesson(){stopWaitingAnimation(false);waitingMotion.lesson=nextWaitingLesson();waitingMotion.step=0;waitingMotion.board={...waitingMotion.lesson.steps[0].board};waitingMotion.tween=null;syncWaitingAnimation();}
function initWaitingLessons(){
  $('waitingLessonPause').addEventListener('click',pauseWaitingLesson);$('waitingLessonNext').addEventListener('click',skipWaitingLesson);
  // Native dialogs open outside the room render loop. Suspend the inline lesson there too.
  const observer=new MutationObserver(syncWaitingAnimation);document.querySelectorAll('dialog').forEach(dialog=>observer.observe(dialog,{attributes:true,attributeFilter:['open']}));
}
