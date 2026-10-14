import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1000,height:640}});
const base=process.env.QA_URL||'http://127.0.0.1:4173';
await page.route('**/rig-qa',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#242015"></body></html>'}));
await page.goto(base+'/rig-qa');
try{
 const result=await page.evaluate(async()=>{
  const mod=await import('/node_modules/.vite/deps/@rive-app_canvas.js');const R=mod.default||mod;
  const {createMotionRig}=await import('/src/motion-follow.js');
  R.RuntimeLoader.setWasmUrl('/rive/canvas.wasm');const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=640;canvas.style='width:1000px;height:640px;object-fit:contain';document.body.append(canvas);
  const r=await new Promise((resolve,reject)=>{const r=new R.Rive({canvas,src:'/media/jiaojiao.riv',autoplay:false,layout:new R.Layout({fit:R.Fit.Contain,alignment:R.Alignment.BottomCenter}),onLoad:()=>resolve(r),onLoadError:reject});});
  const poses=[];
  for(const name of ['Ipad','TalkingEmotion_Normal']){const a=r.artboard.animationByName(name);const p=new r.runtime.LinearAnimationInstance(a,r.artboard);p.time=name==='Ipad'?1:0;p.apply(1);poses.push(p);}
  r.artboard.advance(0);
  const rig=createMotionRig(r);rig.install();
  const upperL=r.artboard.bone('IP_CJ_upperarm_L'),upperR=r.artboard.bone('IP_CJ_arm_R');
  const baseline=[upperL.rotation,upperR.rotation];
  const draw=()=>{r.renderer.clear();r.renderer.save();r.alignRenderer();r.artboard.draw(r.renderer);r.renderer.restore();r.renderer.flush();r.runtime.resolveAnimationFrame();};
  const check=[];
  for(const [name,angles] of [['raised',{upperL:-.7,lowerL:-1.1,upperR:-2.4,lowerR:-2.0,head:-1.25,body:-1.5}],['down',{upperL:1.6,lowerL:1.6,upperR:1.6,lowerR:1.6,head:-1.9,body:-1.7}]]){
    rig.update({angles},1);for(let i=0;i<12;i++)rig.afterAdvance(1+i*25);
    for(const [key,bone] of [['upperL',upperL],['upperR',upperR]]){const w=bone.worldTransform();const angle=Math.atan2(w.xy,w.xx);check.push({name,key,angle,target:angles[key],error:Math.abs(Math.atan2(Math.sin(angle-angles[key]),Math.cos(angle-angles[key])))});}
    draw();window.rigCanvas=canvas;window.rigData={r,rig,draw};
  }
  rig.reset();const restored=[upperL.rotation,upperR.rotation];
  rig.update({angles:{upperL:-.7,lowerL:-1.1,upperR:-2.4,lowerR:-2.0,head:-1.25,body:-1.5}},1);for(let i=0;i<12;i++)rig.afterAdvance(1+i*25);draw();
  return{bindings:rig.capabilities,check,baseline,restored};
 });
 assert.equal(result.bindings.length,10);assert.ok(result.check.every(x=>x.error<.16),JSON.stringify(result.check));assert.deepEqual(result.restored,result.baseline);
 await page.screenshot({path:'/tmp/jojo-motion-rig-raised.png'});console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
