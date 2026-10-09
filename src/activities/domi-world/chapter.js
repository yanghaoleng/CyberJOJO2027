export const WORDS = Object.freeze({apple:'苹果',bread:'面包',cake:'蛋糕',banana:'香蕉',car:'汽车',train:'火车',airplane:'飞机',bike:'自行车',jojo:'叫叫',cat:'铃铛',pig:'猪小弟'});
export const LESSONS = [
 ['早餐来了','apple','eat'],['野餐面包','bread','eat'],['分享蛋糕','cake','eat'],
 ['开车出发','car','drive'],['坐上小火车','train','drive'],['飞过云朵','airplane','drive'],
 ['叫叫来做客','jojo','dance'],['和铃铛跳舞','cat','dance'],['和猪小弟握手','pig','handshake'],['自己的小世界','banana','eat'],
].map(([title,word,action],i)=>({id:i+1,title,word,action,prompt:`${word}`,hint:action==='eat'?'说出食物，DOMI 会尝一尝':action==='drive'?'说出交通工具，DOMI 会驾驶它':action==='handshake'?'说出朋友的名字，和 DOMI 握手':'说出朋友的名字，一起跳舞'}));
export function parseWords(text){return String(text).toLowerCase().match(/[a-z]+/g)?.filter(w=>Object.hasOwn(WORDS,w))||[];}
export class ChapterRuntime {
 constructor(){this.index=0;this.voiceAttempts=0;this.menuAttempts=0;this.guided=new Set();this.independent=new Set();this.started=Date.now();this.complete=false;}
 dispatch(text,source='voice'){
  if(this.complete)return null;
  const words=[...new Set(parseWords(text))];if(source==='voice')this.voiceAttempts++;else if(source==='menu')this.menuAttempts++;
  const lesson=LESSONS[this.index];
  if(source!=='menu')for(const word of words){if(word!==lesson.word){this.independent.add(word);this.guided.delete(word);}else if(!this.independent.has(word))this.guided.add(word);}
  const word=words.at(-1);if(!word)return null;
  const action=['apple','bread','cake','banana'].includes(word)?'eat':['car','train','airplane','bike'].includes(word)?'drive':lesson.action==='handshake'?'handshake':'dance';
  const success=words.includes(lesson.word);
  if(success){this.index++;this.complete=this.index===LESSONS.length;}
  return {word,action,success,lessonId:lesson.id};
 }
 report(status='playing'){return {status:this.complete?'completed':status,voiceAttempts:this.voiceAttempts,menuAttempts:this.menuAttempts,completedLessons:this.index,totalLessons:LESSONS.length,durationSeconds:Math.min(86400,Math.floor((Date.now()-this.started)/1000)),words:[...this.independent,...this.guided],wordGroupsVersion:1,independentWords:[...this.independent],guidedWords:[...this.guided],chapter:'DOMI 的单词冒险 · 十关小章节'};}
}
