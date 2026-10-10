export const FOOD_WORDS = Object.freeze({
 apple:{label:'苹果',model:'apple',plural:'apples'}, banana:{label:'香蕉',model:'banana',plural:'bananas'},
 orange:{label:'橙子',model:'orange',plural:'oranges'}, strawberry:{label:'草莓',model:'strawberry',plural:'strawberries'},
 bread:{label:'面包',model:'bread',unit:'piece',units:'pieces'}, cake:{label:'蛋糕',model:'cake',plural:'cakes'},
 noodles:{label:'面条',model:'noodles',unit:'bowl',units:'bowls'}, candy:{label:'糖果',model:'candy',plural:'candies'},
 juice:{label:'果汁',model:'drink',unit:'cup',units:'cups'}, milk:{label:'牛奶',model:'milk',unit:'cup',units:'cups'},
});
export const WORD_LESSONS = Object.keys(FOOD_WORDS);
export const QUANTITY_WORDS = ['one','two','three','four','five'];
export const WORD_COLORS = Object.freeze({red:{label:'红色',hex:'#ed656a'},yellow:{label:'黄色',hex:'#f4cf62'},green:{label:'绿色',hex:'#79c682'},blue:{label:'蓝色',hex:'#74b8ee'},pink:{label:'粉色',hex:'#eda1bf'},purple:{label:'紫色',hex:'#b598e3'},orange:{label:'橙色',hex:'#f4a464'},white:{label:'白色',hex:'#f3eee3'},brown:{label:'棕色',hex:'#b98459'},black:{label:'黑色',hex:'#383a42'}});
export const AUTO_FEED_MS = 8000;
const aliases = Object.fromEntries(Object.entries(FOOD_WORDS).flatMap(([word,food])=>[[word,word],...(food.plural?[[food.plural,word]]:[])]));
aliases.noodle='noodles';
export function lessonPrompt(index) {
 return {word:WORD_LESSONS[index],count:index>=1?2+((index-1)%2):null,color:index>=2?['red','yellow','green','pink'][(index-2)%4]:null};
}
export function phraseParts({word,count,color}) {
 const food=FOOD_WORDS[word];if(!food)return [];
 const parts=[];
 if(count)parts.push({slot:'count',text:QUANTITY_WORDS[count-1],label:`换数量：${QUANTITY_WORDS[count-1]}`});
 if(count&&food.unit)parts.push({text:`${count===1?food.unit:food.units} of`});
 if(color)parts.push({slot:'color',text:color,label:`换颜色：${color}`});
 parts.push({slot:'word',text:count>1&&food.plural?food.plural:word,label:`换食物：${word}`});
 return parts;
}
export const foodPhrase = prompt => phraseParts(prompt).map(part=>part.text).join(' ');
export function readFoodPhrases(text) {
 const tokens=String(text).toLowerCase().match(/[a-z]+|\d+|[,.;!?]/g)||[],results=[];let start=0;
 for(let i=0;i<tokens.length;i++) {
  const word=aliases[tokens[i]];if(!word)continue;
  // "orange apples" is a color + noun; "orange and apple" names two foods.
  if(tokens[i]==='orange'&&aliases[tokens[i+1]])continue;
  const prefix=tokens.slice(start,i);const boundary=prefix.findLastIndex(token=>['and',',','.',';','!','?'].includes(token));const scope=prefix.slice(boundary+1);
  const quantity=scope.findLast(token=>QUANTITY_WORDS.includes(token)||/^\d+$/.test(token)||['a','an'].includes(token));
  const count=quantity?(/^\d+$/.test(quantity)?Number(quantity):(QUANTITY_WORDS.indexOf(quantity)+1||1)):1;
  const color=scope.findLast(token=>Object.hasOwn(WORD_COLORS,token))||null;
  if(count>=1&&count<=5)results.push({word,count,color,phrase:foodPhrase({word,count:quantity?count:null,color}),vocabulary:[...(quantity?[QUANTITY_WORDS[count-1]]:[]),...(color?[color]:[]),word]});
  start=i+1;
 }
 return results;
}
export const readFoodWords = text => [...new Set(readFoodPhrases(text).map(entry=>entry.word))];
export class BubblePractice {
 constructor(){this.index=0;this.attempts=0;this.menuAttempts=0;this.guided=new Set();this.independent=new Set();this.started=Date.now();this.prompt=lessonPrompt(0);this.phrases=new Set();}
 setPrompt(patch){const next={...this.prompt,...patch};if(!FOOD_WORDS[next.word]||(next.count!==null&&(!Number.isInteger(next.count)||next.count<1||next.count>5))||(next.color!==null&&!WORD_COLORS[next.color]))return false;this.prompt=next;this.menuAttempts++;return true;}
 hear(text,source='voice') {
  if(this.index>=WORD_LESSONS.length)return [];
  source==='voice'?this.attempts++:this.menuAttempts++;
  const entries=readFoodPhrases(text),guided=new Set([this.prompt.word,...(this.prompt.count?[QUANTITY_WORDS[this.prompt.count-1]]:[]),...(this.prompt.color?[this.prompt.color]:[])]);
  if(source==='voice')for(const entry of entries){this.phrases.add(entry.phrase);for(const word of entry.vocabulary){if(!guided.has(word)){this.independent.add(word);this.guided.delete(word);}else if(!this.independent.has(word))this.guided.add(word);}}
  return entries.map(entry=>({...entry,target:entry.word===this.prompt.word,lesson:this.index}));
 }
 fed(bubble){if(bubble.word===this.prompt.word&&bubble.lesson===this.index){this.index++;this.prompt=lessonPrompt(this.index);}}
 report(status='exited'){return {status:this.index===WORD_LESSONS.length?'completed':status,voiceAttempts:this.attempts,menuAttempts:this.menuAttempts,completedLessons:this.index,totalLessons:WORD_LESSONS.length,durationSeconds:Math.min(86400,Math.floor((Date.now()-this.started)/1000)),words:[...this.independent,...this.guided],wordGroupsVersion:1,independentWords:[...this.independent],guidedWords:[...this.guided],spokenPhrases:[...this.phrases].slice(0,200),chapter:'多米的单词泡泡 · 水果、数量和颜色'};}
}
export function bubblePosition(stage,blocked,occupied=[]) {
 const radius=Math.min(64,stage.width*.16),gap=12,pad=radius+gap;
 const options=[.2,.5,.8].flatMap(y=>[.2,.5,.8].map(x=>({x:Math.max(pad,Math.min(stage.width-pad,stage.width*x)),y:Math.max(Math.min(205,stage.height*.44),Math.min(stage.height-220,stage.height*y))})));
 const overlaps=p=>blocked&&p.x+radius+gap>blocked.x&&p.x-radius-gap<blocked.x+blocked.width&&p.y+radius+gap>blocked.y&&p.y-radius-gap<blocked.y+blocked.height;
 const distance=p=>Math.min(...occupied.map(b=>Math.hypot(p.x-b.x,p.y-b.y)),stage.width+stage.height);
 return options.filter(p=>!overlaps(p)).sort((a,b)=>distance(b)-distance(a))[0]||options.sort((a,b)=>Math.hypot(b.x-(blocked?.mouthX||stage.width/2),b.y-(blocked?.mouthY||stage.height/2))-Math.hypot(a.x-(blocked?.mouthX||stage.width/2),a.y-(blocked?.mouthY||stage.height/2)))[0];
}
