import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors=[],sent=[];let channel;
page.on('pageerror',error=>errors.push(error.message));
await page.routeWebSocket('**/voice',ws=>{channel=ws;ws.onMessage(data=>{if(typeof data!=='string')return;const m=JSON.parse(data);sent.push(m);if(m.type==='start')ws.send(JSON.stringify({type:'ready',transport:'seeduplex'}));if(m.type==='ping')ws.send(JSON.stringify({type:'pong',id:m.id}));});});
const hear=async(text,word,count,color)=>{
 channel.send(JSON.stringify({type:'transcript',id:crypto.randomUUID(),text,final:true}));
 const bubble=page.locator(`.word-food-bubble[data-word="${word}"]`);await bubble.waitFor();
 await bubble.locator('.food-model[data-model-status="ready"]').waitFor();
 assert.equal(await bubble.getAttribute('data-count'),String(count));assert.equal(await bubble.getAttribute('data-color'),color||'');
 assert.equal(await bubble.locator('.food-model').getAttribute('data-food-count'),String(count));return bubble;
};
const feed=async(bubble,lesson)=>{await bubble.tap();await page.waitForFunction(n=>document.querySelector('.word-bubble-play').dataset.wordLesson===String(n),lesson);};
const choose=async(slot,value)=>{await page.locator(`.token-${slot}`).tap();await page.locator('.word-bubble-suggestions').getByRole('button',{name:value,exact:true}).tap();};
try{
 await page.goto(process.env.QA_URL||'http://127.0.0.1:4173/words');await page.getByRole('button',{name:'开始和叫叫聊聊',exact:true}).click();await page.waitForSelector('.word-bubble-play',{timeout:120000});
 assert.equal(await page.locator('.token-count').count(),0);assert.equal(await page.locator('.token-color').count(),0);
 await feed(await hear('apple','apple',1),2);
 assert.equal(await page.locator('.word-bubble-prompt').innerText(),'two\nbananas');assert.equal(await page.locator('.token-color').count(),0);
 await choose('count','three');await choose('word','strawberries');
 assert.ok(sent.some(m=>m.type==='local_speech'&&m.text.includes('three strawberries')));
 const strawberry=await hear('two blue strawberries','strawberry',2,'blue');await page.screenshot({path:'/tmp/word-prefixes-two-blue.png'});await feed(strawberry,3);
 assert.equal(await page.locator('.token-color').innerText(),'red');
 await choose('count','five');await choose('color','purple');await choose('word','oranges');
 const orange=await hear('five purple oranges','orange',5,'purple');await page.screenshot({path:'/tmp/word-prefixes-five-purple.png'});
 for(const viewport of [{width:320,height:740},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);await page.waitForTimeout(150);await page.locator('.token-word').tap();
  const boxes=await page.locator('.word-bubble-heading button').evaluateAll(buttons=>buttons.map(button=>{const r=button.getBoundingClientRect();return{x:r.x,right:r.right,width:r.width,height:r.height,bottom:r.bottom}}));
  assert.ok(boxes.every(box=>box.x>=0&&box.right<=viewport.width&&box.bottom<=viewport.height&&box.height>=44));
  const style=await page.locator('.word-bubble-heading').evaluate(el=>{const s=getComputedStyle(el);return{background:s.backgroundColor,border:s.borderWidth,shadow:s.boxShadow}});
  assert.equal(style.background,'rgba(0, 0, 0, 0)');assert.equal(style.border,'0px');assert.equal(style.shadow,'none');
  await page.screenshot({path:`/tmp/word-prefixes-${viewport.width}.png`});await page.locator('.token-word').tap();
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'结束单词泡泡'}).tap();
 const report=await page.evaluate(()=>JSON.parse(localStorage.getItem('cyberjojo.activity-reports.v1'))[0].report);
 assert.ok(report.independentWords.includes('blue'));assert.ok(report.independentWords.includes('two'));assert.ok(report.guidedWords.includes('purple'));assert.ok(report.guidedWords.includes('five'));
 assert.deepEqual(report.spokenPhrases,['apple','two blue strawberries','five purple oranges']);assert.equal(report.voiceAttempts,3);assert.equal(report.menuAttempts,5);assert.equal(report.completedLessons,2);
 await page.getByRole('button',{name:/打开作品列表/}).tap();await page.getByRole('button',{name:'玩法',exact:true}).tap();
 await page.getByText('念出的词组',{exact:true}).waitFor();assert.equal(await page.locator('.activity-report details').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: progressively unlocked prefixes; touch suggestions/readback; real recolored 1–5 food models; 320/390/844 immersive UI; grouped vocabulary + phrase report');
}catch(error){await page.screenshot({path:'/tmp/word-prefixes-failure.png'});console.log('page errors',errors);throw error}finally{await browser.close()}
