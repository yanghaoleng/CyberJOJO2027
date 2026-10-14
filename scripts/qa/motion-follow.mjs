import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const url = process.env.QA_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const errors=[],sent=[];let channel;
page.on('pageerror',e=>errors.push(e.message));
await page.routeWebSocket('**/voice',ws=>{channel=ws;ws.onMessage(raw=>{if(typeof raw!=='string')return;const m=JSON.parse(raw);sent.push(m);if(m.type==='start')ws.send(JSON.stringify({type:'ready',transport:'seeduplex'}));if(m.type==='ping')ws.send(JSON.stringify({type:'pong',id:m.id}));});});
if(process.env.POSE_FIXTURE){
  await page.route('**/qa-pose.jpg',r=>r.fulfill({path:process.env.POSE_FIXTURE,contentType:'image/jpeg'}));
  await page.addInitScript(()=>{
    const native=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{
      const audio=constraints.audio?await native({audio:constraints.audio}):new MediaStream();
      const image=await createImageBitmap(await(await fetch('/qa-pose.jpg')).blob());
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const draw=()=>{canvas.getContext('2d').drawImage(image,0,0);};draw();setInterval(draw,66);
      return new MediaStream([...audio.getAudioTracks(),...canvas.captureStream(15).getVideoTracks()]);
    };
  });
}
try{
  await page.goto(url);
  await page.getByRole('button',{name:'开始和叫叫聊聊',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.camera-stage')?.dataset.voiceState==='listening');
  await page.waitForSelector('.camera-stage.is-live.is-rive-ready:not(.is-character-switching)');
  const hear = text => channel.send(JSON.stringify({type:'transcript',text,final:true,id:crypto.randomUUID()}));
  for(const phrase of ['叫叫一二三木头人','我做什么你做什么','你跟我学']){
    hear(phrase); await page.getByRole('heading',{name:'动作跟随',exact:true}).waitFor();
    await page.waitForFunction(()=>['tracking','waiting'].includes(document.querySelector('.motion-follow-overlay')?.dataset.motionStatus),{timeout:25000});
    const bindings=(await page.locator('.motion-follow-overlay').getAttribute('data-motion-bindings')).split(',');
    assert.equal(bindings.length,10);
    if(process.env.POSE_FIXTURE) await page.waitForFunction(()=>document.querySelector('.motion-follow-overlay')?.dataset.motionStatus==='tracking');
    await page.waitForTimeout(750);
    await page.screenshot({path:'/tmp/jojo-motion-follow-mobile.png'});
    hear('结束跟随'); await page.locator('.motion-follow-overlay').waitFor({state:'detached'});
    assert.equal(await page.locator('.camera-stage').getAttribute('data-gameplay-mode'),'none');
  }
  hear('你跟我学');await page.getByRole('heading',{name:'动作跟随'}).waitFor();
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:'/tmp/jojo-motion-follow-landscape.png'});
  await page.getByRole('button',{name:'结束动作跟随'}).click();
  channel.send(JSON.stringify({type:'character_switch',character:'lvdou'}));
  await page.waitForFunction(()=>document.querySelector('.camera-stage')?.dataset.character==='lvdou');
  await page.waitForTimeout(850);
  hear('你跟我学');await page.getByRole('heading',{name:'动作跟随'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.camera-stage')?.dataset.character==='jiaojiao');
  await page.getByRole('button',{name:'结束动作跟随'}).click();
  assert.ok(sent.some(m=>m.type==='interaction_mode'&&m.mode==='follow'));
  assert.ok(sent.some(m=>m.type==='interaction_mode'&&m.mode==='none'));
  assert.deepEqual(errors,[]);console.log('PASS: all wake words, actual 10-bone bindings, pose worker, voice exit, button exit, portrait/landscape');
}catch(error){await page.screenshot({path:'/tmp/jojo-motion-follow-failure.png'});console.log('page errors',errors,'last messages',sent.slice(-8));throw error;}finally{await browser.close();}
