const coverMotion={raf:null,particles:null,background:null,running:false,drag:null};
function coverParticles(){return coverMotion.particles??=[{id:'electron',path:$('coverEcPath'),dot:$('coverElectron'),p:.24},{id:'hole',path:$('coverEvPath'),dot:$('coverHole'),p:.7}];}
function paintCoverParticle(p){const point=p.path.getPointAtLength(p.p*p.path.getTotalLength());p.dot.setAttribute('cx',point.x);p.dot.setAttribute('cy',point.y);p.dot.setAttribute('aria-valuenow',String(Math.round(p.p*100)));}
function nextCoverTarget(p,now){p.from=p.p;p.to=.07+Math.random()*.86;p.start=now;p.duration=1200+Math.random()*2100;p.pause=160+Math.random()*850;}
function endCoverDrag(){const drag=coverMotion.drag;if(!drag)return;coverMotion.drag=null;drag.particle.dragging=false;drag.particle.focused=false;drag.particle.holdUntil=performance.now()+2600;nextCoverTarget(drag.particle,drag.particle.holdUntil);drag.particle.dot.classList.remove('dragging');if(drag.particle.dot.hasPointerCapture(drag.pointer))drag.particle.dot.releasePointerCapture(drag.pointer);}
function stopCoverMotion(){endCoverDrag();cancelAnimationFrame(coverMotion.raf);coverMotion.raf=null;coverMotion.running=false;}
function nearestCoverPosition(path,x,y){
  const total=path.getTotalLength();let best=0,distance=Infinity;
  for(let i=0;i<=180;i++){const p=i/180,point=path.getPointAtLength(p*total),d=(point.x-x)**2+(point.y-y)**2;if(d<distance){best=p;distance=d;}}
  let low=Math.max(0,best-1/180),high=Math.min(1,best+1/180);
  const dist=p=>{const point=path.getPointAtLength(p*total);return (point.x-x)**2+(point.y-y)**2;};
  for(let i=0;i<12;i++){const a=low+(high-low)/3,b=high-(high-low)/3;if(dist(a)<dist(b))high=b;else low=a;}return Math.max(0,Math.min(1,(low+high)/2));
}
function dragCoverParticle(p,event){const svg=$('coverLogo'),matrix=svg.getScreenCTM();if(!matrix)return;const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const local=point.matrixTransform(matrix.inverse());p.p=nearestCoverPosition(p.path,local.x,local.y);paintCoverParticle(p);}
function renderCoverInteraction(){
  $('coverLogo').setAttribute('role','group');$('coverLogo').setAttribute('aria-label',tx('Band Duel 互動標誌','Band Duel interactive logo'));
  $('coverDragHint').textContent=tx('拖曳電子或電洞，沿能帶移動','Drag the electron or hole along its band');
  for(const p of coverParticles()){p.dot.setAttribute('role','slider');p.dot.setAttribute('tabindex','0');p.dot.setAttribute('aria-label',p.id==='electron'?tx('電子位置','Electron position'):tx('電洞位置','Hole position'));p.dot.setAttribute('aria-valuemin','0');p.dot.setAttribute('aria-valuemax','100');p.dot.setAttribute('aria-valuenow',String(Math.round(p.p*100)));p.dot.setAttribute('aria-describedby','coverDragHint');}
}
function initCoverInteraction(){
  renderCoverInteraction();for(const p of coverParticles()){
    p.dot.addEventListener('pointerdown',e=>{if(ui.data||e.button!==0||coverMotion.drag)return;e.preventDefault();p.dot.focus({preventScroll:true});p.dot.setPointerCapture(e.pointerId);p.dragging=true;p.dot.classList.add('dragging');coverMotion.drag={pointer:e.pointerId,particle:p};dragCoverParticle(p,e);});
    p.dot.addEventListener('pointermove',e=>{if(coverMotion.drag?.pointer===e.pointerId&&coverMotion.drag.particle===p)dragCoverParticle(p,e);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])p.dot.addEventListener(event,e=>{if(coverMotion.drag?.pointer===e.pointerId)endCoverDrag();});
    p.dot.addEventListener('keydown',e=>{if(ui.data||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();p.p=e.key==='Home'?0:e.key==='End'?1:Math.max(0,Math.min(1,p.p+(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*(e.shiftKey ? .1 : .025)));p.holdUntil=performance.now()+2600;nextCoverTarget(p,p.holdUntil);paintCoverParticle(p);});
    p.dot.addEventListener('focus',()=>{p.focused=true;});p.dot.addEventListener('blur',()=>{p.focused=false;p.holdUntil=performance.now()+1400;nextCoverTarget(p,p.holdUntil);});
  }
}
function updateCoverMotion(){
  const active=!document.hidden&&!document.querySelector('dialog[open]')&&!reducedMotion();if(!active){stopCoverMotion();return;}if(coverMotion.running)return;
  coverMotion.running=true;coverParticles().forEach(p=>nextCoverTarget(p,Math.max(performance.now(),p.holdUntil||0)));
  if(!coverMotion.background){const root=$('atmosphereParticles');coverMotion.background=Array.from({length:36},(_,i)=>{const el=document.createElementNS('http://www.w3.org/2000/svg','circle'),hole=i%2,r=2+Math.random()*3;el.setAttribute('r',r);el.setAttribute('fill',hole?'none':'#71aaff');el.setAttribute('stroke',hole?'#ff9199':'#71aaff');el.setAttribute('stroke-width','1.1');el.setAttribute('opacity',String(.4+Math.random()*.5));root.append(el);return {el,x:Math.random()*1000,y:Math.random()*1000,vx:5+Math.random()*13,vy:(Math.random()-.5)*7,phase:Math.random()*Math.PI*2};});}
  let previous=performance.now();const frame=now=>{if(!coverMotion.running)return;const dt=Math.min(.05,(now-previous)/1000);previous=now;
   if(!ui.data)for(const p of coverMotion.particles){if(p.dragging||p.focused||now<(p.holdUntil||0))continue;const t=Math.max(0,Math.min(1,(now-p.start)/p.duration));p.p=p.from+(p.to-p.from)*(t*t*(3-2*t));paintCoverParticle(p);if(now>p.start+p.duration+p.pause)nextCoverTarget(p,now);}
   for(const p of coverMotion.background){p.x=(p.x+p.vx*dt+1000)%1000;p.y=(p.y+p.vy*dt+1000)%1000;p.el.setAttribute('cx',p.x);p.el.setAttribute('cy',p.y+Math.sin(now/3300+p.phase)*12);}coverMotion.raf=requestAnimationFrame(frame);};coverMotion.raf=requestAnimationFrame(frame);
}
