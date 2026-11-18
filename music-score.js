// Original scores. Every pattern uses eight-bar harmony with its own melody,
// instrumentation and rhythm; preview and equipped playback share this score.
const MUSIC_SCORES={
 'night-radio':{roots:[45,50,43,48,45,41,43,52],chord:[12,15,19,22],melody:[24,null,31,27,null,26,22,null,24,27,null,31,29,null,26,22],lead:'triangle',cutoff:1200,leadGain:.024,hold:2.3,pad:.016,bass:[0,null,null,null,7,null,null,null],kick:[0,7,10],snare:[4,12],hat:[2,6,10,14],swing:.1},
 'lattice-rain':{roots:[48,45,53,43,48,52,45,43],chord:[12,16,19,23],melody:[24,31,28,36,31,null,28,26,24,19,28,31,35,null,31,28],lead:'piano',cutoff:3800,leadGain:.030,hold:2.5,pad:.009,bass:[0,null,null,null,null,null,null,null],kick:[],snare:[],hat:[],swing:0},
 'pixel-jump':{roots:[48,53,55,45,48,41,43,55],chord:[12,16,19],melody:[24,28,31,36,35,31,28,26,24,19,24,28,31,28,26,23],lead:'square',cutoff:4200,leadGain:.011,hold:.82,pad:.006,bass:[0,null,12,null,7,null,12,null],kick:[0,4,8,12],snare:[4,12],hat:[2,6,10,14],swing:0},
 'neon-circuit':{roots:[42,38,45,40,42,47,45,40],chord:[12,15,19],melody:[24,null,31,27,34,null,31,29,27,24,22,null,27,31,34,36],lead:'sawtooth',cutoff:1600,leadGain:.015,hold:1.25,pad:.014,bass:[0,0,12,0,7,0,12,7],kick:[0,4,8,12],snare:[4,12],hat:[0,2,4,6,8,10,12,14],swing:0},
 'aurora-drift':{roots:[50,57,46,53,50,48,55,53],chord:[0,7,14,19],melody:[24,null,31,null,38,36,null,31,29,null,26,null,33,31,null,26],lead:'sine',cutoff:2800,leadGain:.031,hold:4.2,pad:.019,bass:[-12,null,null,null,null,null,null,null],kick:[],snare:[],hat:[],swing:0},
 'pulse-chase':{roots:[38,38,41,36,34,36,41,43],chord:[12,15,22],melody:[24,null,27,31,null,34,31,27,24,22,null,27,29,null,31,34],lead:'triangle',cutoff:2500,leadGain:.024,hold:1.2,pad:.010,bass:[0,0,null,12,0,null,7,0],kick:[0,3,6,10,11],snare:[4,12,15],hat:[0,2,3,6,8,10,11,14],swing:0},
 'orbital-odyssey':{roots:[45,41,48,43,45,50,48,43],chord:[12,19,24,27],melody:[24,null,null,31,36,null,34,null,31,27,null,29,31,null,24,null],lead:'triangle',cutoff:2200,leadGain:.029,hold:3.2,pad:.023,bass:[-12,null,null,null,0,null,null,null],kick:[0,8,14],snare:[12],hat:[2,6,10,14],swing:0},
 'redshift-finale':{roots:[36,32,39,34,36,41,39,34],chord:[12,15,18,22],melody:[36,31,null,30,27,24,23,null,24,27,30,31,null,34,31,27],lead:'sawtooth',cutoff:1300,leadGain:.017,hold:1.5,pad:.015,bass:[0,12,0,7,0,12,10,7],kick:[0,4,6,8,12,14],snare:[4,12],hat:[0,1,2,4,6,7,8,10,12,13,14],swing:0}
};
function scheduleScoreStep(track,step,time){
 const score=MUSIC_SCORES[track.id];if(!score)return false;
 const beat=60/track.bpm,eighth=beat/2,pos=step%16,root=score.roots[Math.floor(step/16)%score.roots.length],when=time+(step%2?eighth*score.swing:0);
 if(pos===0)for(const note of score.chord)musicTone(track,root+note,when,beat*8.4,score.pad,'triangle',850);
 const melody=score.melody[pos];if(melody!==null)musicTone(track,root+melody,when,eighth*score.hold,score.leadGain,score.lead,score.cutoff);
 const bass=score.bass[step%8];if(bass!==null)musicTone(track,root+bass,when,eighth*1.8,.035,'sine',480);
 for(const kind of ['kick','snare','hat'])if(score[kind].includes(pos))musicDrum(track,when,kind);
 return true;
}
