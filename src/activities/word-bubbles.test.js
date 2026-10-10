import test from 'node:test';import assert from 'node:assert/strict';
import {BubblePractice,WORD_LESSONS,readFoodWords,bubblePosition,AUTO_FEED_MS} from './word-bubbles/words.js';
test('spoken food words become model commands, goals advance only after feeding',()=>{const p=new BubblePractice();const b=p.hear('banana and apples');assert.equal(p.index,0);assert.deepEqual(b.map(x=>x.word),['banana','apple']);p.fed(b[0]);assert.equal(p.index,0);p.fed(b[1]);assert.equal(p.index,1);p.fed(b[1]);assert.equal(p.index,1);assert.deepEqual(p.report().guidedWords,['apple']);assert.deepEqual(p.report().independentWords,['banana']);});
test('ten fed goals complete; menu is not recorded as spoken vocabulary',()=>{const p=new BubblePractice();for(const w of WORD_LESSONS)p.fed(p.hear(w,'menu')[0]);assert.equal(p.report().status,'completed');assert.equal(p.report().completedLessons,10);assert.equal(p.report().voiceAttempts,0);assert.equal(p.report().menuAttempts,10);assert.deepEqual(p.report().words,[]);});
test('bubble positions avoid the actual character and other bubbles when space exists',()=>{const s={width:800,height:700},r={x:200,y:300,width:250,height:300,mouthX:300,mouthY:400};const p=bubblePosition(s,r);assert.ok(p.x+68<=r.x||p.x-68>=r.x+r.width||p.y+68<=r.y||p.y-68>=r.y+r.height);const q=bubblePosition(s,r,[p]);assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>112);assert.equal(AUTO_FEED_MS,8000);assert.deepEqual(readFoodWords('unknown javascript oranges'),['orange']);});
test('quantity and color unlock progressively, with grammatical countable and serving phrases',async()=>{
 const {lessonPrompt,foodPhrase}=await import('./word-bubbles/words.js');
 assert.equal(foodPhrase(lessonPrompt(0)),'apple');assert.equal(foodPhrase(lessonPrompt(1)),'two bananas');assert.equal(foodPhrase(lessonPrompt(2)),'three red oranges');
 assert.equal(foodPhrase({word:'strawberry',count:2,color:'pink'}),'two pink strawberries');
 assert.equal(foodPhrase({word:'milk',count:1,color:'blue'}),'one cup of blue milk');
 assert.equal(foodPhrase({word:'bread',count:3,color:null}),'three pieces of bread');
});
test('spoken prefixes belong to each food; orange is both a color and a noun',async()=>{
 const {readFoodPhrases}=await import('./word-bubbles/words.js');
 const phrases=readFoodPhrases('two green apples and three blue bananas, one orange and two orange apples');
 assert.deepEqual(phrases.map(({word,count,color})=>({word,count,color})),[{word:'apple',count:2,color:'green'},{word:'banana',count:3,color:'blue'},{word:'orange',count:1,color:null},{word:'apple',count:2,color:'orange'}]);
 assert.equal(readFoodPhrases('2 cups of pink milk')[0].phrase,'two cups of pink milk');
 assert.equal(readFoodPhrases('99 apples').length,0);assert.equal(readFoodPhrases('0 apples').length,0);assert.equal(readFoodPhrases('pineapple').length,0);
});
test('suggested words update the goal; unprompted quantity/color are independent and stored as phrases',()=>{
 const p=new BubblePractice();p.fed(p.hear('apple')[0]);
 assert.equal(p.prompt.count,2);assert.ok(p.setPrompt({word:'strawberry',count:3}));
 assert.equal(p.report().voiceAttempts,1);assert.equal(p.report().menuAttempts,1);
 const guided=p.hear('three strawberries')[0];p.fed(guided);assert.equal(p.index,2);
 p.hear('two blue oranges');
 assert.deepEqual(p.report().independentWords,['two','blue']);
 assert.deepEqual(p.report().guidedWords,['apple','three','strawberry','orange']);
 assert.deepEqual(p.report().spokenPhrases,['apple','three strawberries','two blue oranges']);
 assert.equal(p.setPrompt({count:500}),false);
});
test('a bubble from an old prompt cannot complete a newly selected food',()=>{
 const p=new BubblePractice(),old=p.hear('apple')[0];p.setPrompt({word:'banana'});p.fed(old);assert.equal(p.index,0);p.fed(p.hear('banana')[0]);assert.equal(p.index,1);
});
