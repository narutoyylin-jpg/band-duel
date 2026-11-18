(() => {
  'use strict';

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const ink='var(--fg)',muted='var(--muted)',blue='var(--blue)',orange='var(--orange)',soft='var(--soft)',surface='var(--surface)';

  function draw({applications=[],active=0,width=800,height=300,locale='cn',progress=0}={}){
    const items=[];
    if(!applications.length||width<=0||height<=0)return items;
    active=clamp(Math.floor(active),0,applications.length-1);
    const gallery=width>=760&&height>=220;
    const selected=gallery?applications.map((application,index)=>({application,index})):[{application:applications[active],index:active}];

    for(const {application,index} of selected){
      const kind=application.kind||application.id||'detector';
      const prefix='app-art-'+kind+'-'+(application.id||index)+'-';
      const emphasis=gallery&&index!==active?.53:1;
      const cellWidth=gallery?width/applications.length:width;
      const centerX=gallery?cellWidth*(index+.5):width/2;
      const iconHeight=gallery?Math.min(height-84,cellWidth*.57,188):Math.min(height-46,width*.59,210);
      const halfExtent=kind==='fiber'||kind==='communication'?90:kind==='satellite'?78:kind==='laser'?76:70;
      const safeIconHeight=Math.max(24,Math.min(iconHeight,(cellWidth-24)*50/halfExtent));
      const centerY=gallery?(height-72)/2:(height-28)/2;
      const scale=safeIconHeight/100;
      const transform=`translate(${centerX} ${centerY}) scale(${scale})`;
      const pulse=.5+.5*Math.sin(clamp(progress,0,1)*Math.PI*6);
      let serial=0;
      const put=(tag,key,attrs,text)=>{
        items.push({tag,layer:'label',attrs:{class:'device-shape','data-key':prefix+(key||serial++),transform,opacity:emphasis,...attrs},...(text===undefined?{}:{text})});
      };
      const path=(key,d,stroke=ink,strokeWidth=2,extra={})=>put('path',key,{d,fill:'none',stroke,'stroke-width':strokeWidth,'stroke-linecap':'round','stroke-linejoin':'round',...extra});
      const rect=(key,x,y,w,h,fill=soft,extra={})=>put('rect',key,{x,y,width:w,height:h,rx:5,fill,...extra});
      const circle=(key,cx,cy,r,fill,extra={})=>put('circle',key,{cx,cy,r,fill,...extra});
      const ellipse=(key,cx,cy,rx,ry,fill,extra={})=>put('ellipse',key,{cx,cy,rx,ry,fill,...extra});

      if(kind==='led'){
        circle('halo',0,-13,37,orange,{opacity:emphasis*(.05+pulse*.045)});
        path('rays','M0-45v-5M-34-37l-6-6M34-37l6-6M-45-13h-8M45-13h8',orange,1.9,{opacity:emphasis*(.42+pulse*.3)});
        path('glass','M-21 16C-21 4-30 0-30-16a30 30 0 0 1 60 0c0 16-9 20-9 32Z',ink,2,{fill:surface});
        ellipse('light',0,-12,21,24,orange,{opacity:emphasis*(.12+pulse*.07)});
        path('filament','M-12 6l5-11 7 8 7-8 5 11M-6 6v13M6 6v13',orange,2);
        rect('base',-19,18,38,20,soft,{rx:3,stroke:ink,'stroke-width':1.7});
        path('threads','M-16 23h32M-16 29h32',muted,1.4);
        path('bottom','M-9 38v5h18v-5',ink,1.8,{fill:soft});
      }else if(kind==='laser'){
        path('beam-halo','M32 0H75',orange,7,{opacity:emphasis*.08});
        path('beam','M32 0H75',orange,1.7,{opacity:emphasis*(.6+pulse*.4)});
        rect('mount',-51,18,76,15,soft,{rx:4,stroke:muted,'stroke-width':1.5});
        rect('body',-47,-20,65,42,surface,{rx:7,stroke:ink,'stroke-width':2});
        for(let i=0;i<5;i++)path('fin-'+i,`M${-38+i*10}-17v35`,muted,1.1);
        rect('nose',18,-13,20,26,soft,{rx:3,stroke:ink,'stroke-width':1.7});
        ellipse('aperture',38,0,4,11,ink,{stroke:ink,'stroke-width':1});
        ellipse('lens',39,0,2.5,6,orange,{opacity:emphasis*.85});
        path('cable','M-47 1h-17v24',muted,2);
        for(const x of [-36,7])circle('mount-bolt-'+x,x,26,2,muted);
      }else if(kind==='fiber'||kind==='communication'){
        path('fiber-shadow','M-59 30C-13 56-17-37 25-22S50 14 75-9',blue,11,{opacity:emphasis*.08});
        path('fiber','M-59 30C-13 56-17-37 25-22S50 14 75-9',muted,6);
        path('core','M-59 30C-13 56-17-37 25-22S50 14 75-9',blue,2.5,{opacity:emphasis*.9});
        rect('connector',-72,12,30,31,surface,{rx:4,stroke:ink,'stroke-width':1.8});
        rect('connector-cap',-74,16,9,23,soft,{rx:2,stroke:ink,'stroke-width':1.3});
        for(let i=0;i<3;i++)path('connector-grip-'+i,`M${-59+i*5}17v21`,muted,1);
        const sweep=(clamp(progress,0,1)*3)%1;
        const light=sweep<.5?cubic([-59,30],[-13,56],[-17,-37],[25,-22],sweep*2):cubic([25,-22],[67,-7],[50,14],[75,-9],(sweep-.5)*2);
        circle('signal',light[0],light[1],3.5,blue,{opacity:emphasis*.9});
        circle('end-light',75,-9,4,blue,{opacity:emphasis*(.3+pulse*.5)});
        path('end-rays','M78-18l7-4M82-9h8M79 0l7 4',blue,1.6,{opacity:emphasis*.6});
      }else if(kind==='thermal'){
        path('camera-handle','M-3 19l-8 27h22L7 18',ink,1.9,{fill:soft});
        rect('body',-44,-38,83,61,surface,{rx:9,stroke:ink,'stroke-width':2});
        rect('screen-frame',-36,-30,57,43,ink,{rx:3});
        rect('screen',-32,-26,49,35,blue,{rx:1,opacity:emphasis*.8});
        ellipse('heat-outer',-7,-7,13,13,orange,{opacity:emphasis*.95});
        ellipse('heat-inner',-7,-9,8,10,'#ffd37e');
        circle('head',-7,-16,5.2,'#fff0bd');
        path('heat-body','M-14 3l3-13h8L1 3', '#fff0bd',4);
        path('screen-grid','M-31-9h47M-7-25V8',surface,.8,{opacity:emphasis*.25});
        circle('button',30,-15,3,muted);
        circle('small-button',30,-4,2,muted);
        rect('lens-side',39,-27,12,28,soft,{rx:4,stroke:ink,'stroke-width':1.5});
        ellipse('lens',51,-13,4,11,blue,{stroke:ink,'stroke-width':1.3});
        path('scan','M59-27l14-8M61-13h15M59 1l14 8',orange,1.3,{opacity:emphasis*(.3+pulse*.4)});
      }else if(kind==='gas'){
        rect('body',-32,-42,64,84,surface,{rx:9,stroke:ink,'stroke-width':2});
        rect('display',-23,-28,46,27,soft,{rx:3,stroke:muted,'stroke-width':1});
        path('display-graph','M-18-8l7-6 7 2 8-9 12 5',blue,1.8);
        for(const x of [-14,0,14])circle('key-'+x,x,12,4,x===0?orange:soft,{stroke:muted,'stroke-width':1});
        for(let i=0;i<5;i++)path('vent-'+i,`M-19 ${25+i*2.7}h38`,muted,1);
        circle('gas-a',-55,-15,5,orange,{opacity:emphasis*.65});
        circle('gas-b',-60,4,3.5,orange,{opacity:emphasis*.45});
        circle('gas-c',-48,21,4,orange,{opacity:emphasis*.7});
        path('air','M-47-5h10M-41-9l4 4-4 4',orange,1.3,{opacity:emphasis*(.4+pulse*.5)});
        path('probe','M32-25h10v-16h14',ink,1.6);
      }else if(kind==='satellite'){
        path('earth','M-72 46Q0-3 72 46',blue,2,{opacity:emphasis*.65});
        path('earth-grid','M-52 37Q0 10 52 37M-20 20Q-11 28-7 44M20 20Q11 28 7 44',blue,1,{opacity:emphasis*.3});
        path('observation','M-8 3l-23 25M8 3l23 25',orange,1.2,{opacity:emphasis*(.25+pulse*.35)});
        rect('left-array',-76,-34,48,28,blue,{rx:2,stroke:ink,'stroke-width':1.3,opacity:emphasis*.75});
        rect('right-array',28,-34,48,28,blue,{rx:2,stroke:ink,'stroke-width':1.3,opacity:emphasis*.75});
        for(const sign of [-1,1]){for(let i=1;i<4;i++)path('solar-v-'+sign+'-'+i,`M${sign*(28+i*12)}-33v26`,surface,.7,{opacity:emphasis*.6});path('solar-h-'+sign,`M${sign*29}-20H${sign*75}`,surface,.7,{opacity:emphasis*.6});}
        path('struts','M-28-20h13M15-20h13',ink,2);
        rect('body',-16,-38,32,35,soft,{rx:5,stroke:ink,'stroke-width':1.8});
        rect('body-panel',-10,-32,20,23,surface,{rx:2,stroke:muted,'stroke-width':1});
        path('lens-mount','M-9-3v8H9v-8',ink,1.7,{fill:soft});
        ellipse('lens',0,6,8,3.5,orange,{stroke:ink,'stroke-width':1});
        path('aerial','M8-38l9-10M12-46l6 6',muted,1.4);
      }else{
        rect('board',-47,-33,94,66,soft,{rx:7,stroke:muted,'stroke-width':1.3});
        for(const sign of [-1,1])for(let i=0;i<5;i++)path('pin-'+sign+'-'+i,`M${sign*29} ${-23+i*11}h${sign*12}`,muted,1.5);
        rect('chip',-29,-29,58,58,surface,{rx:5,stroke:ink,'stroke-width':2});
        rect('sensor-window',-19,-19,38,38,blue,{rx:3,opacity:emphasis*.75});
        path('pixel-grid','M-6-18v36M6-18v36M-18-6h36M-18 6h36',surface,1,{opacity:emphasis*.7});
        path('light','M-56-47l23 20M-42-49l15 18M-60-30l24 13',orange,1.7,{opacity:emphasis*(.35+pulse*.5)});
      }

      const titleY=gallery?centerY+safeIconHeight/2+25:centerY+safeIconHeight/2+22;
      const titleSize=gallery?15:height<160?12:16;
      items.push({tag:'text',layer:'label',attrs:{x:centerX,y:Math.min(height-5,titleY),'text-anchor':'middle',class:'application-title','data-key':prefix+'title',opacity:emphasis,style:`font-size:${titleSize}px;font-weight:550;fill:var(--fg)`},text:application.name||''});
      if(gallery&&application.use){
        const useSize=11;
        const rows=wrap(application.use,Math.max(14,Math.floor((cellWidth-34)/(locale==='en'?useSize*.53:useSize))),locale).slice(0,2);
        rows.forEach((text,row)=>items.push({tag:'text',layer:'label',attrs:{x:centerX,y:Math.min(height-5,titleY+21+row*16),'text-anchor':'middle',class:'application-use','data-key':prefix+'use-'+row,opacity:emphasis,style:`font-size:${useSize}px;fill:var(--muted)`},text}));
      }
    }
    return items;
  }

  function mix(a,b,t){return a+(b-a)*t;}
  function cubic(a,b,c,d,t){const q=1-t;return[0,1].map(i=>q*q*q*a[i]+3*q*q*t*b[i]+3*q*t*t*c[i]+t*t*t*d[i]);}
  function wrap(value,max,locale){
    const pieces=locale==='en'?value.split(/\s+/):Array.from(value),rows=[];let line='';
    for(const piece of pieces){const next=line+(line&&locale==='en'?' ':'')+piece;if(next.length>max&&line){rows.push(line);line=piece;}else line=next;}
    if(line)rows.push(line);return rows;
  }

  window.BandApplicationArt={draw};
})();
