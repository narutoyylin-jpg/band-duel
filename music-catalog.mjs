export const MUSIC_TRACKS=[
 {id:'quiet-orbit',cn:'靜謐軌道',en:'Quiet Orbit',genre:'Ambient',price:0,bpm:78,icon:'◌',color:'#8ebeff'},
 {id:'band-clash',cn:'能帶交鋒',en:'Band Clash',genre:'Electronic',price:0,bpm:108,icon:'ϟ',color:'#ff8f9f'},
 {id:'night-radio',cn:'夜航電台',en:'Night Radio',genre:'Lo-fi',price:120,bpm:72,icon:'◉',color:'#d7a7ff'},
 {id:'lattice-rain',cn:'晶格之雨',en:'Lattice Rain',genre:'Piano',price:160,bpm:68,icon:'♩',color:'#a5d8ef'},
 {id:'pixel-jump',cn:'像素躍遷',en:'Pixel Jump',genre:'Chiptune',price:180,bpm:132,icon:'▦',color:'#a6e9ac'},
 {id:'neon-circuit',cn:'霓虹迴路',en:'Neon Circuit',genre:'Synthwave',price:200,bpm:116,icon:'◇',color:'#f89fe1'},
 {id:'aurora-drift',cn:'極光漂流',en:'Aurora Drift',genre:'Dream ambient',price:220,bpm:82,icon:'≋',color:'#8ae0cf'},
 {id:'pulse-chase',cn:'脈衝追擊',en:'Pulse Chase',genre:'Breakbeat',price:240,bpm:144,icon:'⌁',color:'#ffb27f'},
 {id:'orbital-odyssey',cn:'星環遠征',en:'Orbital Odyssey',genre:'Cinematic',price:280,bpm:96,icon:'✦',color:'#ead18e'},
 {id:'redshift-finale',cn:'紅移終章',en:'Redshift Finale',genre:'Dark synth',price:320,bpm:124,icon:'◈',color:'#ee8d9b'}
];
export const FREE_MUSIC=['quiet-orbit','band-clash'];
export const DEFAULT_MUSIC={home:'quiet-orbit',duel:'band-clash'};
export const musicById=id=>MUSIC_TRACKS.find(t=>t.id===id);
