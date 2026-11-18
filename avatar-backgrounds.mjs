export const AVATAR_BACKGROUNDS=[
  {id:'midnight',cn:'午夜藍',en:'Midnight'},
  {id:'graphite',cn:'石墨黑',en:'Graphite'},
  {id:'ocean',cn:'深海',en:'Ocean'},
  {id:'aurora',cn:'極光',en:'Aurora'},
  {id:'amethyst',cn:'紫水晶',en:'Amethyst'},
  {id:'rose',cn:'玫瑰',en:'Rose'},
  {id:'sunset',cn:'日落',en:'Sunset'},
  {id:'lattice',cn:'晶格',en:'Lattice'}
];
export const avatarBackgroundId=value=>AVATAR_BACKGROUNDS.some(x=>x.id===value)?value:'midnight';
