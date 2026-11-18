import {TEAM_SLOTS,teamVerdict,teamActionDeltas} from './team-core.mjs';
function value(r,board,team){const verdict=teamVerdict(r,board),opponent=team==='a'?'b':'a';return (verdict.winner===team?4:verdict.winner===opponent?-4:0)+(verdict.ratios[team]-verdict.ratios[opponent])*.25;}
// Replay the other players' executed moves, preserving order and board bounds.
// This explains contribution to the recorded match, rather than predicting a new game.
export function teamMvp(r){
 if(r.stage!=='finished'||!r.game.history.length)return null;const winner=r.game.history.at(-1).decision?.winner;if(!['a','b'].includes(winner))return null;
 const scores=TEAM_SLOTS.filter(s=>s.team===winner).map(s=>{
  const without={...r.game.history[0].startBoard};let improvement=0,spent=0,moves=0;
  for(const h of r.game.history){let actual={...h.startBoard};for(const slot of h.order||TEAM_SLOTS.map(x=>x.id)){
   const action=h.actions[slot],before=value(r,actual,winner);for(const [key,delta] of Object.entries(teamActionDeltas(action))){actual[key]=Math.max(-8,Math.min(8,actual[key]+delta));if(slot!==s.id)without[key]=Math.max(-8,Math.min(8,without[key]+delta));}
   if(slot===s.id){improvement+=value(r,actual,winner)-before;spent+=action.cost;moves+=Object.values(teamActionDeltas(action)).reduce((n,v)=>n+Math.abs(v),0);}
  }}
  return {slot:s.id,impact:value(r,r.game.board,winner)-value(r,without,winner),improvement,spent,moves,decisive:teamVerdict(r,without).winner!==winner};
 });
 const salt=[...(r.matchId||r.code||'')].reduce((n,c)=>n+c.charCodeAt(0),0)%2;
 const priority=slot=>(TEAM_SLOTS.findIndex(s=>s.id===slot)+salt*2)%4;
 scores.sort((a,b)=>Math.abs(b.impact-a.impact)>1e-9?b.impact-a.impact:Math.abs(b.improvement-a.improvement)>1e-9?b.improvement-a.improvement:a.spent-b.spent||priority(a.slot)-priority(b.slot));
 const best=scores[0];return {...best,team:winner,method:'recorded-counterfactual',tied:scores.length>1&&Math.abs(best.impact-scores[1].impact)<1e-9&&Math.abs(best.improvement-scores[1].improvement)<1e-9&&best.spent===scores[1].spent};
}
