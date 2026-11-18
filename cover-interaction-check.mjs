import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const frames=new Map(),nodes=new Map();let now=0,id=0,reduce=false;
const makeNode=name=>({name,attrs:{},events:{},children:[],capture:null,setAttribute(k,v){this.attrs[k]=String(v);},addEventListener(k,fn){this.events[k]=fn;},classList:{add(){},remove(){}},focus(){this.events.focus?.();},setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;},append(el){this.children.push(el);}});
const node=name=>{if(!nodes.has(name))nodes.set(name,makeNode(name));return nodes.get(name);};
for(const [id,segments] of [['coverEcPath',[[15,25],[103,25],[103,48],[185,48]]],['coverEvPath',[[15,76],[92,76],[92,57],[185,57]]]]){
  const path=node(id),lengths=segments.slice(1).map((p,i)=>Math.hypot(p[0]-segments[i][0],p[1]-segments[i][1])),total=lengths.reduce((a,b)=>a+b,0);path.getTotalLength=()=>total;
  path.getPointAtLength=l=>{l=Math.max(0,Math.min(total,l));for(let i=0;i<lengths.length;i++){if(l<=lengths[i]||i===lengths.length-1){const t=l/lengths[i];return {x:segments[i][0]+(segments[i+1][0]-segments[i][0])*t,y:segments[i][1]+(segments[i+1][1]-segments[i][1])*t};}l-=lengths[i];}};
}
node('coverLogo').getScreenCTM=()=>({inverse:()=>({})});node('coverLogo').createSVGPoint=()=>({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}});
const ui={data:null},document={hidden:false,modal:false,querySelector(){return this.modal;},createElementNS:()=>makeNode('circle')};
const ctx=vm.createContext({ui,document,$:node,tx:(cn,en)=>en,reducedMotion:()=>reduce,performance:{now:()=>now},requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
vm.runInContext(fs.readFileSync('phone-cover.js','utf8'),ctx);const run=code=>vm.runInContext(code,ctx),tick=ms=>{now+=ms;const next=[...frames.values()];frames.clear();next.forEach(fn=>fn(now));};
run('initCoverInteraction();updateCoverMotion()');assert.equal(frames.size,1);run('updateCoverMotion()');assert.equal(frames.size,1,'only one animation loop');
const event=(extra={})=>({button:0,pointerId:7,clientX:103,clientY:40,preventDefault(){},...extra});
const electron=node('coverElectron'),hole=node('coverHole');electron.events.pointerdown(event());electron.events.pointermove(event({clientX:180,clientY:48}));const dragged=+electron.attrs.cx;assert(Math.abs(dragged-180)<.1);tick(1600);assert.equal(+electron.attrs.cx,dragged,'autoplay cannot fight a held pointer');
const holeBefore=hole.attrs.cx;electron.events.pointerup(event());tick(2000);assert.equal(+electron.attrs.cx,dragged,'release keeps a brief hold');tick(1600);assert.notEqual(+electron.attrs.cx,dragged,'autoplay resumes smoothly after release');assert.notEqual(hole.attrs.cx,holeBefore,'the other carrier continues its own movement');
for(const [key,want] of [['Home',0],['ArrowRight',3],['End',100],['ArrowLeft',98]]){electron.events.keydown(event({key}));assert.equal(+electron.attrs['aria-valuenow'],want);}
electron.events.pointerdown(event());electron.events.pointercancel(event());assert.equal(run('coverMotion.drag'),null);assert.equal(electron.capture,null);
document.hidden=true;run('updateCoverMotion()');assert.equal(frames.size,0);document.hidden=false;run('updateCoverMotion()');assert.equal(frames.size,1);document.modal=true;run('updateCoverMotion()');assert.equal(frames.size,0);document.modal=false;
reduce=true;run('updateCoverMotion()');assert.equal(frames.size,0);hole.events.keydown(event({key:'Home'}));assert.equal(hole.attrs['aria-valuenow'],'0','manual control works with reduced motion');
for(const id of ['coverEcPath','coverEvPath'])for(const [x,y] of [[-100,-100],[1000,1000],[103,40],[92,66]]){const p=run(`nearestCoverPosition($('${id}'),${x},${y})`);assert(p>=0&&p<=1);}
assert.equal(ui.data,null);console.log('Passed: independent logo dragging, path corners/bounds, hold/release/autoplay, keyboard controls, pointer cancel, hidden/modal cleanup and reduced-motion controls.');
