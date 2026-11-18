export const SKINS=[
 {id:'classic',cn:'經典',en:'Classic',price:0,color:null,shape:'circle',category:'classic'},
 {id:'season-champion',cn:'月結冠軍',en:'Monthly champion',price:0,emoji:'🖕',shape:'emoji',category:'season',earned:true,electronOnly:true},
 {id:'mint',cn:'薄荷',en:'Mint',price:40,color:'#6cf0c0',shape:'circle',category:'classic'},
 {id:'gold',cn:'星光',en:'Starlight',price:80,color:'#ffd66d',shape:'star',category:'classic'},
 {id:'prism',cn:'稜鏡',en:'Prism',price:80,color:'#bca1ff',shape:'diamond',category:'classic'},
 {id:'nova',cn:'新星',en:'Nova',price:120,color:'#ffb477',shape:'hex',category:'classic'},
 ...[
  ['smile','開心笑臉','Smile','😄'],['cool','墨鏡酷客','Cool','😎'],['robot','小機器人','Robot','🤖'],['cat','貓咪','Cat','🐱'],
  ['ghost','小幽靈','Ghost','👻'],['alien','外星朋友','Alien','👽'],['fire','火焰','Flame','🔥'],['rocket','火箭','Rocket','🚀']
 ].map(([id,cn,en,emoji],i)=>({id,cn,en,emoji,price:i<4?60:90,shape:'emoji',category:'emoji'})),
 ...[
  ['TW','台灣球','Taiwan ball'],['JP','日本球','Japan ball'],['US','美國球','US ball'],['GB','英國球','UK ball'],
  ['FR','法國球','France ball'],['DE','德國球','Germany ball'],['IT','義大利球','Italy ball'],['CA','加拿大球','Canada ball'],
  ['BR','巴西球','Brazil ball'],['KR','韓國球','Korea ball'],['CN','中國球','China ball'],['UA','烏克蘭球','Ukraine ball']
 ].map(([country,cn,en])=>({id:'ball-'+country.toLowerCase(),country,cn,en,price:100,shape:'countryball',category:'countryball'})),
 ...[
  ['ruby','紅寶石','Ruby','#ff536f'],['emerald','綠寶石','Emerald','#53e8b3'],['sapphire','藍寶石','Sapphire','#6bb9ff'],
  ['amethyst','紫水晶','Amethyst','#bc89ff'],['ice','冰晶','Ice crystal','#b5f6ff'],['sunstone','太陽石','Sunstone','#ffbb60']
 ].map(([id,cn,en,color])=>({id,cn,en,color,price:140,shape:'crystal',category:'crystal'}))
];
export const COIN_REWARDS={random:{win:30,draw:20,loss:10},computer:{win:15,draw:10,loss:5}};
export function coinReward(kind,outcome){return COIN_REWARDS[kind]?.[outcome]||0;}
export function countryBallArt(code){
 const rect=(x,y,w,h,color)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+color+'"/>',base=rect(-1,-1,2,2,'#fff');
 if(code==='TW')return rect(-1,-1,2,2,'#e43142')+rect(-1,-1,1.18,1.05,'#143bb7')+'<g transform="translate(-.43 -.5)" fill="#fff"><path d="M0-.33 .05-.17 .16-.29 .14-.1 .29-.16 .19 0 .33 0 .17.05 .29.16 .1.14 .16.29 0.19 0 .33 -.05.17 -.16.29 -.14.1 -.29.16 -.19 0 -.33 0 -.17-.05 -.29-.16 -.1-.14 -.16-.29 0-.19Z"/><circle r=".15" stroke="#143bb7" stroke-width=".035"/></g>';
 if(code==='JP')return base+'<circle r=".44" fill="#d82d48"/>';
 if(code==='US')return base+Array.from({length:7},(_,i)=>rect(-1,-1+i*4/13,2,2/13,'#db4050')).join('')+rect(-1,-1,1.05,1.08,'#244388')+Array.from({length:9},(_,i)=>'<circle cx="'+(-.83+i%3*.28)+'" cy="'+(-.78+Math.floor(i/3)*.28)+'" r=".043" fill="#fff"/>').join('');
 if(code==='GB')return rect(-1,-1,2,2,'#254385')+'<path d="M-1-1 1 1M1-1-1 1" stroke="#fff" stroke-width=".36"/><path d="M-1-1 1 1M1-1-1 1" stroke="#e14054" stroke-width=".13"/><path d="M0-1V1M-1 0H1" stroke="#fff" stroke-width=".62"/><path d="M0-1V1M-1 0H1" stroke="#df334d" stroke-width=".35"/>';
 if(code==='FR'||code==='IT')return base+rect(-1,-1,.67,2,code==='FR'?'#2447a0':'#25955c')+rect(.33,-1,.67,2,'#e1434a');
 if(code==='DE')return rect(-1,-1,2,.67,'#21232c')+rect(-1,-.33,2,.67,'#e7464d')+rect(-1,.34,2,.66,'#ffd253');
 if(code==='CA')return base+rect(-1,-1,.5,2,'#e53c49')+rect(.5,-1,.5,2,'#e53c49')+'<path d="M0-.65 .13-.29 .34-.43 .27-.11 .55-.21 .43.13 .64.2 .15.39 .09.65H-.09L-.15.39-.64.2-.43.13-.55-.21-.27-.11-.34-.43-.13-.29Z" fill="#e53c49"/>';
 if(code==='BR')return rect(-1,-1,2,2,'#29955e')+'<path d="M0-.78 .91 0 0 .78-.91 0Z" fill="#ffe065"/><circle r=".43" fill="#24509c"/><path d="M-.41-.08Q0-.26.43.16" stroke="#fff" stroke-width=".075" fill="none"/>';
 if(code==='KR')return base+'<circle r=".39" fill="#3264b0"/><path d="M-.39 0A.39.39 0 0 1 .39 0Q.1-.2 0 0T-.39 0Z" fill="#e84b58"/><g stroke="#20222b" stroke-width=".095"><path d="M-.7-.55-.4-.75M-.65-.43-.35-.63M.4.75.7.55M.35.63.65.43M.4-.75.7-.55M.35-.63.65-.43M-.7.55-.4.75M-.65.43-.35.63"/></g>';
 if(code==='CN')return rect(-1,-1,2,2,'#e23e47')+'<path d="M-.5-.78-.43-.55-.2-.55-.39-.41-.32-.18-.5-.32-.68-.18-.61-.41-.8-.55-.57-.55Z" fill="#ffe36b"/><g fill="#ffe36b"><circle cx="-.07" cy="-.76" r=".055"/><circle cx=".12" cy="-.53" r=".055"/><circle cx=".12" cy="-.27" r=".055"/><circle cx="-.07" cy="-.07" r=".055"/></g>';
 if(code==='UA')return rect(-1,-1,2,1,'#4385d4')+rect(-1,0,2,1,'#ffdf65');
 return rect(-1,-1,2,2,'#78a9dd');
}
export function carrierSkinSVG(skin,carrier,x,y,size=2.6){
 const s=SKINS.find(s=>s.id===skin)||SKINS[0],band=carrier==='e'?'var(--ec)':'var(--ev)',color=s.color||band,fill=carrier==='e'?color:'var(--graph,#000)';
 const style='fill="'+fill+'" stroke="'+color+'" stroke-width="'+Math.max(1,size*.32)+'" pointer-events="none"';
 if(s.shape==='circle')return '<circle cx="'+x+'" cy="'+y+'" r="'+size+'" '+style+'/>';
 if(s.shape==='emoji'){
   const r=size*1.6;return '<g pointer-events="none"><circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+(carrier==='e'?band:'var(--graph,#000)')+'" fill-opacity=".24" stroke="'+band+'" stroke-width="'+Math.max(.65,size*.16)+'"/>'+(carrier==='h'?'<circle cx="'+x+'" cy="'+y+'" r="'+(r*1.22)+'" fill="none" stroke="'+band+'" stroke-width=".6"/>':'')+'<text x="'+x+'" y="'+y+'" dy=".35em" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif" font-size="'+size*2.5+'">'+s.emoji+'</text></g>';
 }
 if(s.shape==='countryball'){
   const r=size*1.5,id='flag-'+s.country+'-'+carrier+'-'+String(x)+'-'+String(y)+'-'+size;
   return '<g transform="translate('+x+' '+y+') scale('+r+')" pointer-events="none"><defs><clipPath id="'+id+'"><circle r="1"/></clipPath></defs><g clip-path="url(#'+id+')">'+countryBallArt(s.country)+'<circle cx="-.25" cy="-.35" r="1.2" fill="#fff" fill-opacity=".07"/></g><circle r="1" fill="none" stroke="'+band+'" stroke-width=".13"/>'+(carrier==='h'?'<circle r="1.18" stroke="'+band+'" stroke-width=".06" fill="none"/>':'')+'<g fill="#fff" stroke="#14141b" stroke-width=".065"><ellipse cx="-.3" cy=".06" rx=".2" ry=".25"/><ellipse cx=".3" cy=".06" rx=".2" ry=".25"/></g></g>';
 }
 if(s.shape==='crystal')return '<g transform="translate('+x+' '+y+') scale('+size*1.4+')" pointer-events="none"><path d="M0-1.35 .7-.5 .6.6 0 1.35-.6.6-.7-.5Z" fill="'+(carrier==='e'?color:'var(--graph,#000)')+'" stroke="'+color+'" stroke-width=".12"/><path d="M0-1.35.18-.45 0 .78-.6.6-.7-.5Z" fill="'+color+'" fill-opacity="'+(carrier==='e'?'.55':'.22')+'"/><path d="M0-1.35-.18-.45 0 .78.6.6.7-.5Z" fill="#fff" fill-opacity="'+(carrier==='e'?'.35':'.1')+'"/><path d="M-.7-.5.18-.45.6.6M.7-.5-.18-.45-.6.6M0-1.35 0 1.35" stroke="#fff" stroke-opacity=".45" stroke-width=".06" fill="none"/></g>';
 const count=s.shape==='star'?10:s.shape==='hex'?6:4,points=Array.from({length:count},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/count,r=size*(s.shape==='star'&&i%2?.5:1.25);return (x+Math.cos(a)*r)+','+(y+Math.sin(a)*r);}).join(' ');
 return '<polygon points="'+points+'" '+style+'/>';
}
