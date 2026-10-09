export const FOOD_WORDS=Object.freeze({apple:{label:'苹果',model:'apple'},banana:{label:'香蕉',model:'banana'},orange:{label:'橙子',model:'orange'},strawberry:{label:'草莓',model:'strawberry'},bread:{label:'面包',model:'bread'},cake:{label:'蛋糕',model:'cake'},noodles:{label:'面条',model:'noodles'},candy:{label:'糖果',model:'candy'},juice:{label:'果汁',model:'drink'},milk:{label:'牛奶',model:'milk'}});
export const WORD_LESSONS=Object.keys(FOOD_WORDS);
export const AUTO_FEED_MS=8000;
export function readFoodWords(text){return [...new Set((String(text).toLowerCase().match(/[a-z]+/g)||[]).map(w=>({apples:'apple',bananas:'banana',oranges:'orange',strawberries:'strawberry',candies:'candy',noodle:'noodles'}[w]||w)).filter(w=>Object.hasOwn(FOOD_WORDS,w)))];}
export class BubblePractice{
 constructor(){this.index=0;this.attempts=0;this.menuAttempts=0;this.guided=new Set();this.independent=new Set();this.started=Date.now();}
 hear(text,source='voice'){
  if(this.index>=WORD_LESSONS.length)return [];
  source==='voice'?this.attempts++:this.menuAttempts++;
  const words=readFoodWords(text),target=WORD_LESSONS[this.index];
  if(source==='voice')for(const word of words){if(word!==target){this.independent.add(word);this.guided.delete(word);}else if(!this.independent.has(word))this.guided.add(word);}
  return words.map(word=>({word,target:word===target,lesson:this.index}));
 }
 fed(bubble){if(bubble.target&&bubble.lesson===this.index)this.index++;}
 report(status='exited'){return {status:this.index===WORD_LESSONS.length?'completed':status,voiceAttempts:this.attempts,menuAttempts:this.menuAttempts,completedLessons:this.index,totalLessons:WORD_LESSONS.length,durationSeconds:Math.min(86400,Math.floor((Date.now()-this.started)/1000)),words:[...this.independent,...this.guided],wordGroupsVersion:1,independentWords:[...this.independent],guidedWords:[...this.guided],chapter:'多米的单词泡泡 · 水果和食物'};}
}
export function bubblePosition(stage,blocked,occupied=[]){
 const radius=Math.min(56,stage.width*.14),gap=12,pad=radius+gap;
 const options=[.2,.5,.8].flatMap(y=>[.2,.5,.8].map(x=>({x:Math.max(pad,Math.min(stage.width-pad,stage.width*x)),y:Math.max(Math.min(170,stage.height*.44),Math.min(stage.height-220,stage.height*y))})));
 const overlaps=p=>blocked&&p.x+radius+gap>blocked.x&&p.x-radius-gap<blocked.x+blocked.width&&p.y+radius+gap>blocked.y&&p.y-radius-gap<blocked.y+blocked.height;
 const distance=p=>Math.min(...occupied.map(b=>Math.hypot(p.x-b.x,p.y-b.y)),stage.width+stage.height);
 return options.filter(p=>!overlaps(p)).sort((a,b)=>distance(b)-distance(a))[0]||options.sort((a,b)=>Math.hypot(b.x-(blocked?.mouthX||stage.width/2),b.y-(blocked?.mouthY||stage.height/2))-Math.hypot(a.x-(blocked?.mouthX||stage.width/2),a.y-(blocked?.mouthY||stage.height/2)))[0];
}
