// Server-derived, permanent achievements. Clients cannot claim or edit progress.
export const ACHIEVEMENTS=[
  {id:'secret-room-114514',group:'play',icon:'start',hidden:true,image:'/achievement-room-114514.webp',cn:'唐突惡臭',en:'An unexpected smell',detailCn:'輸入了那個六位數的房號。',detailEn:'Enter that particular six-digit room code.',metric:'secretRoom',target:1},
  {id:'season-champion',group:'rank',icon:'crown',cn:'月冕之主',en:'Monthly champion',detailCn:'在至少完成 10 場牌位對戰的月份，獲得月結第一名（並列也算）。',detailEn:'Finish a month at #1 with at least 10 ranked games, including ties.',metric:'seasonChampion',target:1},
  {id:'first-duel',group:'play',icon:'start',cn:'踏上能帶',en:'First contact',detailCn:'完整完成第一場對戰。',detailEn:'Finish your first game.',metric:'games',target:1},
  {id:'ten-duels',group:'play',icon:'start',cn:'漸入佳境',en:'Finding your rhythm',detailCn:'完整完成 10 場對戰。',detailEn:'Finish 10 games.',metric:'games',target:10},
  {id:'fifty-duels',group:'play',icon:'start',cn:'能帶常客',en:'Band regular',detailCn:'完整完成 50 場對戰。',detailEn:'Finish 50 games.',metric:'games',target:50},
  {id:'first-win',group:'play',icon:'win',cn:'第一道勝利',en:'First victory',detailCn:'贏得第一場對戰。',detailEn:'Win your first game.',metric:'wins',target:1},
  {id:'ten-wins',group:'play',icon:'win',cn:'勝利軌道',en:'Winning orbit',detailCn:'累計贏得 10 場對戰。',detailEn:'Win 10 games.',metric:'wins',target:10},
  {id:'long-duel',group:'play',icon:'endurance',cn:'十二回合的堅持',en:'Going the distance',detailCn:'完整完成一場 12 回合對戰。',detailEn:'Finish a 12-round game.',metric:'longGames',target:1},
  {id:'coins-100',group:'coins',icon:'coin',cn:'小有積蓄',en:'Pocket change',detailCn:'帳號金幣餘額曾達到 100。',detailEn:'Reach a balance of 100 coins.',metric:'peakCoins',target:100},
  {id:'coins-500',group:'coins',icon:'coin',cn:'滿載金幣',en:'Golden reserve',detailCn:'帳號金幣餘額曾達到 500。',detailEn:'Reach a balance of 500 coins.',metric:'peakCoins',target:500},
  {id:'coins-1000',group:'coins',icon:'coin',cn:'能帶富翁',en:'Band tycoon',detailCn:'帳號金幣餘額曾達到 1,000。',detailEn:'Reach a balance of 1,000 coins.',metric:'peakCoins',target:1000},
  {id:'first-skin',group:'collection',icon:'crystal',cn:'換個新樣子',en:'Fresh look',detailCn:'擁有第一款商店造型（不含預設造型）。',detailEn:'Own your first shop skin, excluding the default.',metric:'skins',target:1},
  {id:'five-skins',group:'collection',icon:'crystal',cn:'載子收藏家',en:'Carrier collector',detailCn:'擁有 5 款商店造型。',detailEn:'Own 5 shop skins.',metric:'skins',target:5},
  {id:'ten-skins',group:'collection',icon:'crystal',cn:'收藏展示間',en:'Showcase',detailCn:'擁有 10 款商店造型。',detailEn:'Own 10 shop skins.',metric:'skins',target:10},
  {id:'first-ranked',group:'rank',icon:'rank',cn:'正式入榜',en:'On the board',detailCn:'完成第一場真人積分對戰。',detailEn:'Finish your first rated human game.',metric:'rankedGames',target:1},
  {id:'rating-1100',group:'rank',icon:'rank',cn:'研究員之路',en:'Researcher',detailCn:'排名積分曾達到 1,100。',detailEn:'Reach a rating of 1,100.',metric:'peakRating',target:1100},
  {id:'rating-1300',group:'rank',icon:'rank',cn:'能帶專家',en:'Band expert',detailCn:'排名積分曾達到 1,300。',detailEn:'Reach a rating of 1,300.',metric:'peakRating',target:1300},
  {id:'rating-1500',group:'rank',icon:'rank',cn:'大師境界',en:'Mastery',detailCn:'排名積分曾達到 1,500。',detailEn:'Reach a rating of 1,500.',metric:'peakRating',target:1500},
  {id:'rank-first',group:'rank',icon:'crown',cn:'榜首之冠',en:'Top of the world',detailCn:'曾登上真人積分榜第一名（並列也算）。',detailEn:'Reach #1 on the human rating board, including ties.',metric:'champion',target:1}
];
