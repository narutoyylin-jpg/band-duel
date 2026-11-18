(() => {
  'use strict';
  const data=window.BandStoryData, scenes=data.scenes;
  const $=id=>document.getElementById(id), all=selector=>[...document.querySelectorAll(selector)];
  const svg=$('bandDiagram'), geometry=$('diagramGeometry');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const PLAYBACK_RATE=2;
  const ui={
    cn:{contents:'章節',details:'原理與模型',model:'模型假設',close:'關閉',home:'回到開場',previous:'上一幕',next:'下一幕',start:'開始探索',restart:'回到開場',play:'播放動畫',pause:'暫停動畫',replay:'重播動畫',electron:'電子',hole:'電洞',confine:'侷限在薄層',separate:'分居兩側',together:'Type I · 同側',apart:'Type II · 分開',conduction:'導帶位差 ΔEc',valence:'價帶位差 ΔEv',temperature:'溫度',boundary:'邊界排列',energy:'E ↑',position:'位置 x →',cb:'導帶',vb:'價帶',gap:'能隙：無可用能態',gain:'吸收能量',barrier:'能障',thin:'薄層 B',interface:'接面',vacancy:'空位',filled:'已填入',newVacancy:'新空位',eMove:'電子 B → A',hMove:'電洞 A → B',efNote:'若此處有能態，f = 50%',efAbove:'E > EF：f < 50%',efBelow:'E < EF：f > 50%',equilibrium:'熱平衡 · T > 0 K',description:'縱軸是電子能量，橫軸是材料位置。藍色是導帶底，橘色是價帶頂；淡色區代表允許能帶。實心圓是電子，空心圓是電洞。載子數、能量和薄層厚度均為示意。',eShare:'電子：',hShare:'電洞：',equal:'兩側相同',favors:'偏向 ',sources:['異質接面與能帶位差','載子濃度與費米能階','能帶與佔據機率']},
    en:{contents:'Chapters',details:'Details',model:'Model assumptions',close:'Close',home:'Back to the opening',previous:'Previous scene',next:'Next',start:'Explore',restart:'Start again',play:'Play animation',pause:'Pause animation',replay:'Replay animation',electron:'Electron',hole:'Hole',confine:'Confine in a layer',separate:'Separate across sides',together:'Type I · together',apart:'Type II · separate',conduction:'Conduction offset ΔEc',valence:'Valence offset ΔEv',temperature:'Temperature',boundary:'Edge alignment',energy:'E ↑',position:'Position x →',cb:'Conduction band',vb:'Valence band',gap:'Gap: no available states',gain:'Gain energy',barrier:'Barrier',thin:'B layer',interface:'Interface',vacancy:'Vacancy',filled:'Filled',newVacancy:'New vacancy',eMove:'Electron B → A',hMove:'Hole A → B',efNote:'If a state exists here: f = 50%',efAbove:'E > EF: f < 50%',efBelow:'E < EF: f > 50%',equilibrium:'Equilibrium · T > 0 K',description:'Vertical position is electron energy; horizontal position is material position. Blue marks the conduction edge and orange the valence edge. Shading shows allowed bands. Solid circles are electrons and hollow circles are holes. Counts, energies and layer thickness are schematic.',eShare:'Electrons: ',hShare:'holes: ',equal:'equal on both sides',favors:'favor ',sources:['Heterojunction band offsets','Carrier statistics and EF','Bands and occupation']}
  };
  let locale='cn',saved=null;
  try{locale=localStorage.getItem('bandlab.language')==='en'?'en':'cn';saved=JSON.parse(localStorage.getItem('bandlab.story.v1')||'null');}catch{}
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
  const params={c:-.08,v:.08,temperature:300};
  if(saved?.params){for(const [key,a,b] of [['c',-.1,.1],['v',-.1,.1],['temperature',200,500]])if(Number.isFinite(saved.params[key]))params[key]=clamp(saved.params[key],a,b);}
  const state={index:0,elapsed:0,running:false,manual:null,params};
  const display={mode:0,c:params.c,v:params.v,temperature:params.temperature};
  let width=0,height=0,raf=0,last=0,morph=null,resumeAfterDialog=false,sceneTransition=null;
  let lastFrame=new Map(),phase=0,lastApplicationScene='',lastApplication=-1;
  const t=key=>ui[locale][key],scene=()=>scenes[state.index],content=()=>scene()[locale];
  const persist=()=>{try{localStorage.setItem('bandlab.story.v1',JSON.stringify({params}));localStorage.setItem('bandlab.language',locale);}catch{}};
  const signed=n=>(Math.abs(n)<.00001?'0.00':(n>0?'+':'−')+Math.abs(n).toFixed(2))+' eV';
  function node(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));if(text!==undefined)el.textContent=text;return el;}
  let drawing=null;
  function add(tag,attrs,text){const item={tag,attrs:{...attrs},text};drawing.push(item);return item;}
  function label(x,y,text,cls='',anchor='middle',opacity=1){return add('text',{x,y,class:cls,'text-anchor':anchor,opacity},text);}
  function path(d,cls,opacity=1){return add('path',{d,class:cls,opacity});}
  function circle(x,y,hole=false,opacity=1,r=7,key){return add('circle',{cx:x,cy:y,r,class:hole?'hole':'electron',opacity,...(key?{'data-key':key}:{})});}
  const layers={},nodes=new Map();
  for(const name of ['shade','line','carrier','overlay','label']){layers[name]=node('g',{'data-layer':name});geometry.appendChild(layers[name]);}
  function bandPoints(d){
    const points=[];let x=0,y=0;
    for(const command of d.matchAll(/([MHVL])([^MHVL]*)/g)){
      const numbers=command[2].match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)?.map(Number)||[];
      if(command[1]==='M'||command[1]==='L'){x=numbers[0];y=numbers[1];}else if(command[1]==='H')x=numbers[0];else y=numbers[0];points.push([x,y]);
    }
    if(points.length===2){const [l,a]=points[0],[r]=points[1],m=(l+r)/2;return [[l,a],[m,a],[m,a],[r,a],[r,a],[r,a]];}
    if(points.length===4)return [points[0],points[1],points[2],points[3],points[3],points[3]];
    return points;
  }
  const pointsPath=points=>points.map(([x,y],index)=>(index?'L':'M')+x.toFixed(3)+' '+y.toFixed(3)).join('');
  function frameModel(items){
    const model=new Map(),counts=new Map();
    for(const item of items){
      if(item.tag==='rect'&&/^url\(#(?:conduction|valence)Tint\)$/.test(item.attrs.fill||''))continue;
      const cls=item.attrs.class||'',base=item.attrs['data-key']||(cls==='conduction'?'bandConduction':cls==='valence'?'bandValence':item.tag==='circle'?'background-'+cls:item.tag+':'+cls+':'+(item.text||''));
      const count=counts.get(base)||0;counts.set(base,count+1);
      const key=item.attrs['data-key']||base==='bandConduction'||base==='bandValence'?base:base+':'+count;
      const entry={...item,attrs:{...item.attrs},key};delete entry.attrs['data-key'];
      if(key==='bandConduction'||key==='bandValence'){entry.points=bandPoints(item.attrs.d);entry.attrs.d=pointsPath(entry.points);entry.attrs.id=key;}
      if(key==='carrierElectron0'||key==='carrierHole0')entry.attrs.id=key;
      model.set(key,entry);
    }
    const g=layout();
    for(const [band,fill] of [['bandConduction','conductionTint'],['bandValence','valenceTint']]){
      const points=model.get(band)?.points;if(!points||points.length!==6)continue;
      for(let i=0;i<3;i++){const left=points[i*2][0],right=points[i*2+1][0],edge=points[i*2][1],cb=band==='bandConduction';const key='shade-'+band+'-'+i;model.set(key,{key,tag:'rect',attrs:{x:left,y:cb?g.top+3:edge,width:Math.max(0,right-left),height:Math.max(0,cb?edge-g.top-3:g.bottom-edge),fill:'url(#'+fill+')'},layer:'shade'});}
    }
    for(const [key,hole] of [['carrierElectron0',false],['carrierHole0',true]])if(!model.has(key))model.set(key,{key,tag:'circle',attrs:{id:key,cx:g.m,cy:hole?g.vA+g.offset:g.cA-g.offset,r:7,class:hole?'hole':'electron',opacity:0}});
    return model;
  }
  function interpolateItem(from,to,q){
    if(!from)from={...to,attrs:{...to.attrs,opacity:0}};
    if(!to)to={...from,attrs:{...from.attrs,opacity:0}};
    const attrs={...to.attrs},points=from.points&&to.points?to.points.map((point,i)=>point.map((value,j)=>mix(from.points[i][j],value,q))):null;
    for(const name of ['x','y','cx','cy','x1','x2','y1','y2','width','height','r','rx','ry','opacity']){
      const a=from.attrs[name]??(name==='opacity'?1:undefined),b=to.attrs[name]??(name==='opacity'?1:undefined);
      if(a!==undefined&&b!==undefined&&Number.isFinite(Number(a))&&Number.isFinite(Number(b)))attrs[name]=mix(Number(a),Number(b),q);
    }
    if(points)attrs.d=pointsPath(points);
    else if(from.attrs.d&&to.attrs.d&&from.attrs.d!==to.attrs.d){
      const a=from.attrs.d.match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)?.map(Number)||[],b=to.attrs.d.match(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi)?.map(Number)||[];
      if(a.length===b.length&&from.attrs.d.replace(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi,'#')===to.attrs.d.replace(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi,'#')){let i=0;attrs.d=to.attrs.d.replace(/[-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?/gi,()=>mix(a[i],b[i++],q).toFixed(3));}
      else{attrs.d=q<.5?from.attrs.d:to.attrs.d;attrs.opacity=(attrs.opacity??1)*Math.abs(q*2-1);}
    }
    return {...to,attrs,...(points?{points}:{})};
  }
  function commitDrawing(items){
    const target=frameModel(items),output=new Map();
    if(sceneTransition){
      const q=smooth(sceneTransition.elapsed/sceneTransition.duration),keys=new Set([...sceneTransition.source.keys(),...target.keys()]);
      for(const key of keys)output.set(key,interpolateItem(sceneTransition.source.get(key),target.get(key),q));
    }else for(const [key,item] of target)output.set(key,item);
    for(const [key,item] of output){
      let el=nodes.get(key);if(!el){el=node(item.tag);nodes.set(key,el);const layer=item.layer||(item.tag==='text'?'label':item.tag==='circle'?'carrier':item.tag==='rect'?'overlay':'line');layers[layer].appendChild(el);}
      for(const [name,value] of Object.entries(item.attrs))el.setAttribute(name,String(value));
      el.setAttribute('opacity',String(item.attrs.opacity??1));
      el.style.visibility=Number(item.attrs.opacity??1)<.003?'hidden':'visible';if(item.text!==undefined&&el.textContent!==item.text)el.textContent=item.text;
    }
    for(const [key,el] of nodes)if(!output.has(key)){el.setAttribute('opacity','0');el.style.visibility='hidden';}
    lastFrame=output;
  }
  function beginTransition(source,duration=1800,keepCopy=false){sceneTransition=source.size&&!motion.matches?{source,elapsed:0,duration,keepCopy}:null;}
  function updateNarration(currentPhase){
    phase=currentPhase;
    const reveal=motion.matches?2:sceneTransition&&!sceneTransition.keepCopy?(sceneTransition.elapsed/sceneTransition.duration<.30?-1:0):currentPhase;
    for(const el of document.querySelectorAll('[data-reveal-step]'))el.dataset.revealed=String(Number(el.dataset.revealStep)<=reveal);
  }
  function arrow(x1,y1,x2,y2,cls=''){const angle=Math.atan2(y2-y1,x2-x1),a=5;path(`M${x1} ${y1}L${x2} ${y2}M${x2-a*Math.cos(angle-.5)} ${y2-a*Math.sin(angle-.5)}L${x2} ${y2}L${x2-a*Math.cos(angle+.5)} ${y2-a*Math.sin(angle+.5)}`,'arrow '+cls);}
  function layout(){
    const compact=height<220,l=width<600?30:52,r=width-(width<600?14:32),top=compact?25:37,bottom=height-(compact?23:32),ph=Math.max(60,bottom-top);
    return {l,r,top,bottom,ph,m:(l+r)/2,a:(3*l+r)/4,b:(l+3*r)/4,cA:top+ph*.28,vA:top+ph*.70,scale:ph*1.45,compact,offset:compact?10:15};
  }
  function shade(l,r,c,v,g){if(r-l<.1)return;add('rect',{x:l,y:g.top+3,width:r-l,height:Math.max(0,c-g.top-3),fill:'url(#conductionTint)'});add('rect',{x:l,y:v,width:r-l,height:Math.max(0,g.bottom-v),fill:'url(#valenceTint)'});}
  function axes(g){
    path(`M${g.l-15} ${g.bottom+2}V${g.top+4}m-3 5 3-5 3 5`,'axis');
    path(`M${g.l} ${g.bottom+9}H${g.r}m-5-3 5 3-5 3`,'axis');
    label(g.l-20,12,t('energy'),'small-label','start');label(g.r,height-2,width<400?'x →':t('position'),'small-label','end');
  }
  function edgeLabels(g){label(g.l-6,g.cA+3,'Ec','small-label','end');label(g.l-6,g.vA+3,'Ev','small-label','end');}
  function fermiTag(g,y,opacity=1){add('rect',{x:g.l+3,y:y-8,width:25,height:16,rx:4,fill:'var(--bg)',opacity});label(g.l+7,y+4,'EF','small-label','start',opacity);}
  function fermi(g,opacity=1){const y=(g.cA+g.vA)/2;path(`M${g.l} ${y}H${g.r}`,'fermi',opacity);fermiTag(g,y,opacity);return y;}
  function base(c,v,options={}){
    const g=layout(),gap=options.gap||0,x1=g.m-gap/2,x2=g.m+gap/2,cB=g.cA-c*g.scale,vB=g.vA-v*g.scale;
    shade(g.l,x1,g.cA,g.vA,g);shade(x2,g.r,cB,vB,g);axes(g);
    label(g.a,g.top-9,'A','material-name');label(g.b,g.top-9,'B','material-name');
    if(gap<1)path(`M${g.m} ${g.top+6}V${g.bottom}`,'interface');
    path(`M${g.l} ${g.cA}H${x1}${gap>0?`M${x2} ${cB}`:`V${cB}`}H${g.r}`,'conduction',options.dimConduction ? .25 : 1);
    path(`M${g.l} ${g.vA}H${x1}${gap>0?`M${x2} ${vB}`:`V${vB}`}H${g.r}`,'valence');edgeLabels(g);
    return {...g,cB,vB};
  }
  function homogeneous(){const g=layout();shade(g.l,g.r,g.cA,g.vA,g);axes(g);path(`M${g.l} ${g.cA}H${g.r}`,'conduction');path(`M${g.l} ${g.vA}H${g.r}`,'valence');edgeLabels(g);return g;}
  function layered(blend=0){
    const g=layout(),x1=mix(g.l+(g.r-g.l)*.34,g.m,blend),x2=mix(g.l+(g.r-g.l)*.66,g.r,blend),cB=g.cA+g.ph*.13,vB=g.vA+g.ph*mix(-.13,.13,blend),cR=mix(g.cA,cB,blend),vR=mix(g.vA,vB,blend);
    shade(g.l,x1,g.cA,g.vA,g);shade(x1,x2,cB,vB,g);shade(x2,g.r,cR,vR,g);axes(g);
    path(`M${g.l} ${g.cA}H${x1}V${cB}H${x2}V${cR}H${g.r}`,'conduction');path(`M${g.l} ${g.vA}H${x1}V${vB}H${x2}V${vR}H${g.r}`,'valence');
    path(`M${x1} ${g.top+6}V${g.bottom}`,'interface');if(blend<.98)path(`M${x2} ${g.top+6}V${g.bottom}`,'interface',1-blend);
    label((g.l+x1)/2,g.top-9,'A','material-name');label((x1+x2)/2,g.top-9,blend<.5?t('thin'):'B','material-name');if(blend<.7)label((x2+g.r)/2,g.top-9,'A','material-name', 'middle',1-blend);
    edgeLabels(g);return {...g,x1,x2,cB,vB,center:(x1+x2)/2};
  }
  function offsetBracket(x,y1,y2,name){path(`M${x-3} ${y1}H${x+3}M${x} ${y1}V${y2}M${x-3} ${y2}H${x+3}`,'offset-marker');label(x+9,(y1+y2)/2+3,name,'small-label','start');}
  function setInsight(value){if($('sceneInsight').textContent!==value)$('sceneInsight').textContent=value;}
  function setPressed(selector,value){all(selector).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.outcome===value||button.dataset.alignment===value)));}
  function render(){
    if(width<1||height<1)return;
    const id=scene().id,p=scene().duration?clamp(state.elapsed/scene().duration):1;
    drawing=[];
    let phase=0,mode=0,c=state.params.c,v=state.params.v,temp=state.params.temperature;
    if(morph){const q=smooth(morph.elapsed/morph.duration);if(morph.kind==='mode')mode=mix(morph.from,morph.to,q);else{c=mix(morph.from.c,params.c,q);v=mix(morph.from.v,params.v,q);temp=mix(morph.from.temperature,params.temperature,q);}if(q>=1)morph=null;}
    if(id==='overview'){
      if(!morph||morph.kind!=='mode')mode=state.manual!==null?state.manual:motion.matches?0:smooth((p-.28)/.5);
      display.mode=mode;const g=layered(mode),ex=g.center,hx=mix(g.center,(g.l+g.x1)/2,mode),hy=mix(g.vB,g.vA,mode)+g.offset;
      for(const dx of [0,-13,13]){circle(ex+dx,g.cB-g.offset,false,1,g.compact?4:6,dx===0?'carrierElectron0':undefined);circle(hx+dx,hy,true,1,g.compact?4:6,dx===0?'carrierHole0':undefined);}
      label(ex,g.cB-g.offset-15,t('electron'),'small-label electron-text');
      label(hx,Math.min(g.bottom-3,hy+19),t('hole'),'small-label hole-text');
      const fy=(g.cA+g.vA)/2;label(g.r-4,fy,mode<.45?'Type I · A / B / A':'Type II · A / B','small-label','end');
      phase=mode<.03?0:mode<.97?1:2;setPressed('[data-outcome]',mode<.5?'confine':'separate');
    }else if(id==='bands'){
      const g=homogeneous(),q=smooth((p-.18)/.52),x=mix(g.l,g.r,.46),y=mix(g.vA+g.offset,g.cA-g.offset,q),radius=g.compact?5:7;
      label(g.r-3,g.cA-10,t('cb'),'band-label','end');label(g.r-3,Math.min(g.bottom-4,g.vA+g.ph*.19),t('vb'),'band-label','end');
      for(const pos of [.12,.27,.69,.86])circle(mix(g.l,g.r,pos),g.vA+g.offset,false,1,radius);
      circle(x,g.vA+g.offset,true,q,radius,'carrierHole0');circle(x,y,false,1,radius,'carrierElectron0');
      if(q>.01&&q<.99){arrow(x-20,g.vA-3,x-20,g.cA+7,'electron-arrow');label(x-25,(g.cA+g.vA)/2,t('gain'),'small-label electron-text','end');}
      if(q>.98){label(x,g.cA-g.offset-13,t('electron'),'small-label electron-text');if(g.compact)label(x+13,g.vA+g.offset+3,t('hole'),'small-label hole-text','start');else label(x,g.vA+g.offset+19,t('hole'),'small-label hole-text');}
      label(g.r-3,(g.cA+g.vA)/2+3,t('gap'),'small-label','end');phase=p<.18?0:p<.73?1:2;
    }else if(id==='fermi'){
      const g=homogeneous(),reveal=smooth((p-.18)/.28),fy=(g.cA+g.vA)/2;
      label(g.r-3,g.top-9,t('equilibrium'),'small-label','end');label(g.l+7,g.cA-10,t('cb'),'band-label','start');label(g.l+7,g.bottom-3,t('vb'),'band-label','start');
      for(const pos of [.2,.4,.6,.8])circle(mix(g.l,g.r,pos),g.vA+g.offset,false,1,g.compact?4:6,pos===.2?'carrierElectron0':undefined);
      if(reveal>0){path(`M${g.l} ${fy}H${mix(g.l,g.r,reveal)}`,'fermi');if(reveal>.95)fermiTag(g,fy);}
      if(p>.45){label(g.r-3,g.cA-10,t('efAbove'),'small-label','end');label(g.r-3,g.bottom-3,t('efBelow'),'small-label','end');}
      if(p>.74)label(g.l+7,fy+17,t('efNote'),'small-label','start');phase=p<.18?0:p<.74?1:2;
    }else if(id==='offsets'){
      const g=base(-.08,.06);if(p>.28)fermi(g);
      if(p>.30)offsetBracket(g.m+9,g.cA,g.cB,'ΔEc');if(p>.62)offsetBracket(g.m+9,g.vA,g.vB,'ΔEv');phase=p<.3?0:p<.62?1:2;
    }else if(id==='electrons'){
      const g=base(-.08,.06),q=smooth((p-.18)/.5),x=mix(g.a,g.b,q),energy=smooth((q-.50)/.25),y=mix(g.cA,g.cB,energy)-g.offset;
      circle(x,y,false,1,g.compact?5:8,'carrierElectron0');label(x,y-14,t('electron'),'small-label electron-text');
      if(q>.05)arrow(g.a+7,(g.cA+g.vA)/2,g.b-7,(g.cA+g.vA)/2,'electron-arrow');phase=p<.18?0:p<.72?1:2;
    }else if(id==='holes'){
      const g=base(-.08,.08,{dimConduction:true}),q=smooth((p-.2)/.48),x=mix(g.b,g.a,q),energy=smooth((q-.25)/.25),y=mix(g.vB,g.vA,energy)+g.offset,change=smooth((q-.83)/.17),rad=g.compact?5:8;
      circle(g.a,g.vA+g.offset,true,1-change,rad);circle(g.b,g.vB+g.offset,true,change,rad,'carrierHole0');circle(x,y,false,1,rad,'carrierElectron0');
      const labelY=Math.min(g.bottom-2,g.vA+g.offset+20);label(g.a,labelY,q<.98?t('vacancy'):t('filled'),'small-label');label(g.b,g.vB+g.offset+20,q<.98?t('electron'):t('newVacancy'),q<.98?'small-label electron-text':'small-label hole-text');
      if(q>.08){arrow(g.b-4,(g.cA+g.vB)/2,g.a+4,(g.cA+g.vB)/2,'electron-arrow');}
      phase=p<.2?0:p<.72?1:2;
    }else if(id==='types'){
      if(!morph||morph.kind!=='mode')mode=state.manual!==null?state.manual:smooth((p-.3)/.45);
      display.mode=mode;const g=base(-.08,mix(.08,-.08,mode)),hx=mix(g.b,g.a,mode),hy=mix(g.vB,g.vA,mode)+g.offset;
      circle(g.b,g.cB-g.offset,false,1,g.compact?5:8,'carrierElectron0');label(g.b,g.cB-g.offset-15,t('electron'),'small-label electron-text');circle(hx,hy,true,1,g.compact?5:8,'carrierHole0');
      label(hx,Math.min(g.bottom-2,hy+20),t('hole'),'small-label hole-text');label(g.a,(g.cA+g.vA)/2+3,mode<.5?'Type I':'Type II','callout');
      phase=mode<.03?0:mode<.97?1:2;setPressed('[data-alignment]',mode<.5?'I':'II');
    }else if(id==='well'){
      const g=layered(0),q=smooth((p-.18)/.5),a=(g.l+g.x1)/2,b=(g.x2+g.r)/2,ex=mix(a,g.center,q),hx=mix(b,g.center,q),ey=mix(g.cA,g.cB,smooth((q-.52)/.4))-g.offset,hy=mix(g.vA,g.vB,smooth((q-.52)/.4))+g.offset;
      circle(ex,ey,false,1,g.compact?5:8,'carrierElectron0');circle(hx,hy,true,1,g.compact?5:8,'carrierHole0');
      label(g.center,g.cB-g.offset-14,t('electron'),'small-label electron-text', 'middle',q);label(g.center,Math.min(g.bottom-2,g.vB+g.offset+20),t('hole'),'small-label hole-text','middle',q);
      label(a,(g.cA+g.vA)/2+3,t('barrier'),'small-label');label(b,(g.cA+g.vA)/2+3,t('barrier'),'small-label');phase=p<.18?0:p<.73?1:2;
    }else if(id==='emission'||id==='separation'){
      const applications=content().applications||[],active=state.manual!==null?state.manual:Math.min(applications.length-1,Math.floor(p*applications.length));
      if(lastApplicationScene===id&&lastApplication!==active&&!sceneTransition&&!motion.matches)beginTransition(new Map(lastFrame),500,true);
      lastApplicationScene=id;lastApplication=active;
      drawing.push(...window.BandApplicationArt.draw({applications,active,width,height,locale,progress:p}));
      all('[data-application]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.application)===active)));
      phase=active;
    }else if(id==='experiment'){
      display.c=c;display.v=v;display.temperature=temp;const g=base(c,v);fermi(g);const kT=8.617333262e-5*temp,eB=1/(1+Math.exp(c/kT)),hB=1/(1+Math.exp(-v/kT));
      const population=(side,cY,vY,eShare,hShare)=>{const left=side==='a'?g.l:g.m,right=side==='a'?g.m:g.r,step=(right-left)*.13,start=left+(right-left)*.24;for(let i=0;i<10;i++){const row=Math.floor(i/5),x=start+(i%5)*step,dy=g.offset+row*(g.compact?7:11);circle(x,cY-dy,false,clamp(eShare*10-i),g.compact?3.4:4.6,i===0&&side===(eB>=.5?'b':'a')?'carrierElectron0':undefined);circle(x,vY+dy,true,clamp(hShare*10-i),g.compact?3.4:4.6,i===0&&side===(hB>=.5?'b':'a')?'carrierHole0':undefined);}};
      population('a',g.cA,g.vA,1-eB,1-hB);population('b',g.cB,g.vB,eB,hB);updateShares(eB,hB,c,v,temp);phase=2;
      const e=Math.abs(c)<.00001?t('equal'):t('favors')+(c<0?'B':'A'),h=Math.abs(v)<.00001?t('equal'):t('favors')+(v>0?'B':'A');setInsight(t('eShare')+e+(locale==='cn'?'；':' · ')+t('hShare')+h);
    }
    if(id!=='experiment'&&(!sceneTransition||sceneTransition.elapsed/sceneTransition.duration>.65))setInsight(content().applications?.length?(width>=760&&height>=220?'':content().applications[phase].use):content().beats[phase]);
    updateNarration(id==='emission'||id==='separation'?2:phase);commitDrawing(drawing);
    const percent=scene().duration?Math.round(p*100):100;$('timelineFill').style.width=percent+'%';document.querySelector('.timeline').setAttribute('aria-valuenow',String(percent));
    const done=state.elapsed>=scene().duration||id==='experiment';$('playButton').setAttribute('aria-label',t(state.running?'pause':done?'replay':'play'));$('playButton').disabled=(id==='experiment'&&!sceneTransition)||motion.matches;
    $('playIcon').setAttribute('d',state.running?'M9 6v12M15 6v12':done?'M18 8a7 7 0 1 0 1 7M18 3v5h-5':'M9 5l10 7-10 7Z');
  }
  function updateShares(eB,hB,c,v,temp){
    for(const [kind,b] of [['electron',eB],['hole',hB]]){document.querySelector(`[data-share="${kind}-a"]`).textContent='A '+((1-b)*100).toFixed(1)+'%';document.querySelector(`[data-share="${kind}-b"]`).textContent='B '+(b*100).toFixed(1)+'%';$(kind+'ShareA').style.width=((1-b)*100)+'%';$(kind+'ShareB').style.width=(b*100)+'%';}
    $('conductionValue').textContent=signed(c);$('valenceValue').textContent=signed(v);$('temperatureValue').textContent=Math.round(temp)+' K';
    $('alignmentReadout').textContent=Math.abs(c)<.00001||Math.abs(v)<.00001?t('boundary'):c*v<0?'Type I':'Type II';
    all('[data-preset]').forEach(button=>{const match=button.dataset.preset==='I'?Math.abs(c+.08)<.00001&&Math.abs(v-.08)<.00001:button.dataset.preset==='II'?Math.abs(c+.08)<.00001&&Math.abs(v+.08)<.00001:Math.abs(c)<.00001&&Math.abs(v)<.00001;button.setAttribute('aria-pressed',String(match));});
  }
  function tick(now){
    const delta=last?Math.min(80,now-last)*PLAYBACK_RATE:0;last=now;
    if(state.running){
      if(sceneTransition){sceneTransition.elapsed=Math.min(sceneTransition.duration,sceneTransition.elapsed+delta);if(sceneTransition.elapsed>=sceneTransition.duration)sceneTransition=null;}
      else{state.elapsed=Math.min(scene().duration,state.elapsed+delta);if(state.elapsed>=scene().duration)state.running=false;}
    }
    if(morph&&!morph.paused)morph.elapsed=Math.min(morph.duration,morph.elapsed+delta);
    render();if(state.running||(morph&&!morph.paused))raf=requestAnimationFrame(tick);else{raf=0;last=0;}
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(tick);}
  function play(){if(motion.matches)return;if(morph?.paused){morph.paused=false;last=0;schedule();return;}if(!scene().duration&&!sceneTransition)return;if(!sceneTransition&&state.elapsed>=scene().duration){replay();return;}state.running=true;last=0;render();schedule();}
  function pause(){state.running=false;if(morph)morph.paused=true;last=0;render();}
  function replay(){goTo(state.index,{replay:true});}
  function paragraphs(target,values){target.replaceChildren(...values.map(value=>{const p=document.createElement('p');p.textContent=value;return p;}));}
  function updateDetails(){
    $('detailsHeading').textContent=content().name;paragraphs($('chapterDetails'),content().detail);paragraphs($('modelCopy'),data.model[locale]);$('modelHeading').textContent=t('model');
    const application=scene().id==='emission'||scene().id==='separation',related=data.sources.filter(source=>source.scenes?.includes(scene().id));
    $('modelDetails').hidden=application;
    $('sourceLinks').replaceChildren(...(application&&related.length?related:data.sources).map(source=>{const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=locale==='cn'?(source.cn||source.label):source.label;return a;}));
  }
  function renderCopy(){
    $('sceneHeadline').replaceChildren(...content().headline.map((value,index)=>{const span=document.createElement('span');span.className='headline-line';span.textContent=value;span.dataset.revealStep=index;span.dataset.revealed='false';return span;}));
    const chunks=content().lede.match(/[^。；.!?]+[。；.!?]?\s*/g)||[content().lede];
    $('sceneLede').replaceChildren(...chunks.map((value,index)=>{const span=document.createElement('span');span.textContent=value;span.dataset.revealStep=chunks.length===1?2:Math.min(2,1+index);span.dataset.revealed='false';return span;}));
    $('diagramTitle').textContent=content().name;$('diagramDescription').textContent=content().applications?.length?content().applications.map(application=>application.name+'：'+application.use).join(' '):t('description');
    $('chapterNumber').textContent=String(state.index+1).padStart(2,'0')+' / '+String(scenes.length).padStart(2,'0');$('chapterName').textContent=content().name;
    $('previousButton').disabled=state.index===0;$('nextButton').querySelector('span').textContent=t(state.index===0?'start':state.index===scenes.length-1?'restart':'next');
    $('outcomeControls').hidden=scene().id!=='overview';$('alignmentControls').hidden=scene().id!=='types';$('experimentControls').hidden=scene().id!=='experiment';$('shareReadout').hidden=scene().id!=='experiment';
    const applications=content().applications||[];$('applicationControls').hidden=!applications.length;
    $('applicationControls').setAttribute('aria-label',locale==='cn'?'選擇應用':'Choose an application');
    $('applicationControls').replaceChildren(...applications.map((application,index)=>{const button=document.createElement('button');button.type='button';button.dataset.application=index;button.textContent=application.name;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{const source=new Map(lastFrame);state.manual=index;state.elapsed=scene().duration;morph=null;beginTransition(source,600,true);state.running=!!sceneTransition;render();if(state.running)schedule();});return button;}));
    $('detailsButton').textContent=applications.length?(locale==='cn'?'用途與來源':'Uses & sources'):t('details');
    all('[data-story-scene]').forEach(button=>{const index=Number(button.dataset.storyScene),entry=scenes[index][locale];button.setAttribute('aria-label',String(index+1).padStart(2,'0')+' · '+entry.name);if(button.closest('#chapterList'))button.querySelector('.chapter-list-name').textContent=entry.name;if(index===state.index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
    updateDetails();measure();
  }
  function goTo(id,{instant=false,replay=false}={}){
    const index=typeof id==='number'?id:scenes.findIndex(entry=>entry.id===id);if(index<0||index>=scenes.length)return;
    const source=new Map(lastFrame);
    state.index=index;state.elapsed=motion.matches?scene().duration:0;state.running=!!scene().duration&&!motion.matches;state.manual=null;morph=null;last=0;
    if(instant||motion.matches)sceneTransition=null;else beginTransition(source,replay?1300:1800);
    if(sceneTransition)state.running=true;
    $('storyStage').dataset.scene=scene().id;$('storyStage').classList.remove('scene-enter');renderCopy();render();if(state.running)schedule();
    try{history.replaceState(null,'','#'+scene().id);}catch{}
  }
  function setLocale(value){
    const nextLocale=value==='en'?'en':'cn';
    if(sceneTransition&&nextLocale!==locale){
      const translations=new Map(Object.keys(ui[locale]).filter(key=>typeof ui[locale][key]==='string').map(key=>[ui[locale][key],ui[nextLocale][key]]));
      translations.set(locale==='cn'?'光子':'Photon',nextLocale==='cn'?'光子':'Photon');
      translations.set(locale==='cn'?'電場與電極收集':'Field + contacts',nextLocale==='cn'?'電場與電極收集':'Field + contacts');
      sceneTransition.source=new Map([...sceneTransition.source].map(([key,item])=>{if(item.tag!=='text'||!translations.has(item.text))return [key,item];const text=translations.get(item.text),translatedKey=key.replace(':'+item.text+':',':'+text+':');return [translatedKey,{...item,key:translatedKey,text}];}));
    }
    locale=value==='en'?'en':'cn';document.documentElement.lang=locale==='cn'?'zh-Hant':'en';$('contentsButton').textContent=t('contents');$('contentsHeading').textContent=t('contents');$('detailsButton').textContent=t('details');$('homeButton').setAttribute('aria-label',t('home'));$('languageButton').textContent=locale==='cn'?'EN':'中文';$('languageButton').setAttribute('aria-label',locale==='cn'?'Switch to English':'切換為繁體中文');
    $('previousButton').setAttribute('aria-label',t('previous'));all('[data-close]').forEach(button=>button.setAttribute('aria-label',t('close')));all('[data-label]').forEach(el=>el.textContent=t(el.dataset.label));all('[data-outcome]').forEach(button=>button.textContent=t(button.dataset.outcome));all('[data-alignment]').forEach(button=>button.textContent=t(button.dataset.alignment==='I'?'together':'apart'));
    for(const [id,key] of [['conductionOffset','conduction'],['valenceOffset','valence'],['temperature','temperature']])$(id).setAttribute('aria-label',t(key));
    $('chapterPosition').setAttribute('aria-label',t('contents'));document.querySelector('.chapter-dots').setAttribute('aria-label',t('contents'));document.querySelector('.timeline').setAttribute('aria-label',locale==='cn'?'本幕動畫進度':'Scene animation progress');document.querySelector('.top-actions').setAttribute('aria-label',locale==='cn'?'頁面功能':'Page controls');$('outcomeControls').setAttribute('aria-label',locale==='cn'?'比較侷限與分離':'Compare confinement and separation');$('alignmentControls').setAttribute('aria-label',locale==='cn'?'比較能帶排列':'Compare band alignments');
    renderCopy();render();persist();
  }
  function measure(){const rect=svg.getBoundingClientRect(),w=Math.floor(rect.width),h=Math.floor(rect.height);if(w>0&&h>0&&(w!==width||h!==height)){width=w;height=h;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);render();}}
  function chooseMode(mode){const source=new Map(lastFrame);state.manual=mode;state.elapsed=scene().duration;morph=null;beginTransition(source,1900,true);state.running=!!sceneTransition;render();if(state.running)schedule();}
  function changeParameters(){const from={c:display.c,v:display.v,temperature:display.temperature};params.c=Number($('conductionOffset').value);params.v=Number($('valenceOffset').value);params.temperature=Number($('temperature').value);state.running=false;if(sceneTransition){const source=new Map(lastFrame);beginTransition(source,500,true);state.running=!!sceneTransition;morph=null;}else if(motion.matches)morph=null;else morph={kind:'parameters',from,elapsed:0,duration:380,paused:false};render();if(state.running||morph)schedule();persist();}
  function openDialog(dialog){resumeAfterDialog=state.running||!!(morph&&!morph.paused);pause();updateDetails();dialog.showModal();}
  for(const dialog of [$('contentsDialog'),$('detailsDialog')]){dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});dialog.addEventListener('close',()=>{if(resumeAfterDialog){resumeAfterDialog=false;play();}});}
  scenes.forEach((entry,index)=>{
    const dot=document.createElement('button');dot.type='button';dot.dataset.storyScene=index;dot.title=entry[locale].name;$('chapterDots').appendChild(dot);
    const button=document.createElement('button');button.type='button';button.dataset.storyScene=index;const number=document.createElement('span');number.textContent=String(index+1).padStart(2,'0');const name=document.createElement('span');name.className='chapter-list-name';button.append(number,name);$('chapterList').appendChild(button);
    for(const element of [dot,button])element.addEventListener('click',()=>{if($('contentsDialog').open){resumeAfterDialog=false;$('contentsDialog').close();}goTo(index);});
  });
  $('homeButton').addEventListener('click',()=>goTo(0));$('contentsButton').addEventListener('click',()=>openDialog($('contentsDialog')));$('chapterPosition').addEventListener('click',()=>openDialog($('contentsDialog')));$('detailsButton').addEventListener('click',()=>openDialog($('detailsDialog')));$('languageButton').addEventListener('click',()=>setLocale(locale==='cn'?'en':'cn'));$('previousButton').addEventListener('click',()=>goTo(state.index-1));$('nextButton').addEventListener('click',()=>goTo(state.index===scenes.length-1?0:state.index+1));$('playButton').addEventListener('click',()=>state.running?pause():play());
  all('[data-outcome]').forEach(button=>button.addEventListener('click',()=>chooseMode(button.dataset.outcome==='confine'?0:1)));all('[data-alignment]').forEach(button=>button.addEventListener('click',()=>chooseMode(button.dataset.alignment==='I'?0:1)));
  for(const id of ['conductionOffset','valenceOffset','temperature'])$(id).addEventListener('input',changeParameters);
  all('[data-preset]').forEach(button=>button.addEventListener('click',()=>{const preset=button.dataset.preset;const [c,v]=preset==='I'?[-.08,.08]:preset==='II'?[-.08,-.08]:[0,0];$('conductionOffset').value=c;$('valenceOffset').value=v;changeParameters();}));
  document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]')||event.target.closest('input,button,a,summary,textarea,select'))return;if(event.key==='ArrowRight'){event.preventDefault();goTo(state.index+1);}else if(event.key==='ArrowLeft'){event.preventDefault();goTo(state.index-1);}else if(event.code==='Space'){event.preventDefault();state.running?pause():play();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  motion.addEventListener?.('change',()=>{state.running=false;morph=null;sceneTransition=null;state.elapsed=scene().duration;render();});
  if(typeof ResizeObserver==='function')new ResizeObserver(measure).observe(svg);window.addEventListener('resize',measure);
  $('conductionOffset').value=params.c;$('valenceOffset').value=params.v;$('temperature').value=params.temperature;
  window.BandStory={goTo,setLocale,play,pause,replay,read(){return {scene:scene().id,elapsed:state.elapsed,running:state.running,progress:scene().duration?state.elapsed/scene().duration:1,transitioning:!!sceneTransition,transitionProgress:sceneTransition?sceneTransition.elapsed/sceneTransition.duration:1,phase,params:{...params},locale};}};
  setLocale(locale);const initial=scenes.findIndex(entry=>entry.id===location.hash.slice(1));goTo(initial>=0?initial:0,{instant:true});
})();
