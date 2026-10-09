import { useEffect,useRef,useState } from 'react';
import { Microphone,SoundHigh,ArrowRight,Check,Sparks,NavArrowLeft } from 'iconoir-react';
import { LESSONS,WORDS,ChapterRuntime } from './chapter.js';
import { createStage } from './stage.js';
import { startChapterVoice } from './voice.js';
import { ACTIVITY_PROTOCOL,saveActivityReport } from '../activity-contract.js';
import './world.css';
export default function DomiWorld(){
 const runtime=useRef(null);if(!runtime.current)runtime.current=new ChapterRuntime();
 const host=useRef(null),stage=useRef(null),voice=useRef(null),pending=useRef(false),alive=useRef(false),timer=useRef(null),ended=useRef(false);
 const [index,setIndex]=useState(0),[feedback,setFeedback]=useState('这是什么？我能试试吗？'),[busy,setBusy]=useState(false),[mic,setMic]=useState(false),[status,setStatus]=useState(''),[input,setInput]=useState(''),[stageError,setStageError]=useState(false);
 const voiceGeneration=useRef(0);
 const session=new URLSearchParams(location.search).get('session'),embedded=!!session&&window.parent!==window;
 const send=(type,report)=>{if(embedded)window.parent.postMessage({protocol:ACTIVITY_PROTOCOL,type,sessionId:session,activityId:'words',report},location.origin);};
 const finish=(state='exited')=>{if(ended.current)return;ended.current=true;voice.current?.();voice.current=null;speechSynthesis.cancel();const report=runtime.current.report(state);if(embedded)send('result',report);else{saveActivityReport({id:crypto.randomUUID(),activityId:'words',createdAt:runtime.current.started,report});location.href='/';}};
 const act=(text,source='voice')=>{if(pending.current||ended.current)return;const cmd=runtime.current.dispatch(text,source);send('progress',runtime.current.report());if(!cmd){setFeedback('试着说一个下面的英文单词');return;}stage.current?.play(cmd);setFeedback(cmd.action==='eat'?`DOMI 正在吃 ${cmd.word}`:cmd.action==='drive'?`DOMI 正在驾驶 ${cmd.word}`:cmd.action==='handshake'?`DOMI 和 ${cmd.word} 握手`:`DOMI 和 ${cmd.word} 一起跳舞`);if(cmd.success){pending.current=true;setBusy(true);timer.current=setTimeout(()=>{pending.current=false;setBusy(false);setIndex(runtime.current.index);setFeedback(runtime.current.complete?'十关完成！你和 DOMI 造出了一个小世界':'下一关，继续说出你的想法');},3400);}};
 const actRef=useRef(act);actRef.current=act;
 useEffect(()=>{alive.current=true;try{stage.current=createStage(host.current);}catch{setStageError(true);}send('ready');send('progress',runtime.current.report());const receive=e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.protocol===ACTIVITY_PROTOCOL&&e.data.sessionId===session&&e.data.type==='exit')finish();};window.addEventListener('message',receive);const pause=()=>{if(document.hidden){voice.current?.();voice.current=null;setMic(false);}};document.addEventListener('visibilitychange',pause);return()=>{alive.current=false;voiceGeneration.current++;clearTimeout(timer.current);voice.current?.();stage.current?.dispose();speechSynthesis.cancel();window.removeEventListener('message',receive);document.removeEventListener('visibilitychange',pause);};},[]);
 async function toggleMic(){const generation=++voiceGeneration.current;if(mic){voice.current?.();voice.current=null;setMic(false);setStatus('');return;}setMic(true);setStatus('正在连接语音…');try{const stop=await startChapterVoice(t=>actRef.current(t),s=>{if(alive.current)setStatus(s==='listening'?'正在听你说…':s);});if(!alive.current||generation!==voiceGeneration.current){stop();return;}voice.current=stop;}catch{if(alive.current){setMic(false);setStatus('没有打开麦克风，可以点词或输入单词');}}}
 const lesson=LESSONS[Math.min(index,9)];
 return <main className="domi-world">
 {!embedded&&<button className="world-back" onClick={()=>finish()}><NavArrowLeft/>退出</button>}
 <header className="world-top"><span>DOMI’S LITTLE WORLD</span><strong>开口造世界</strong><span>{Math.min(index+1,10)} / 10</span></header>
 <div className="world-progress" aria-label={`已完成 ${index} 关`}>{LESSONS.map((l,i)=><span key={l.id} className={i<index?'done':i===index?'current':''}/>)}</div>
 <section className="world-stage" ref={host}>{stageError&&<p role="alert">立体舞台没有加载成功，请刷新后再试。</p>}<span className="world-actor-label">DOMI · 绿豆</span></section>
 <p className="world-feedback" aria-live="polite">{feedback}</p>
 {index===10?<section className="world-panel world-finished"><Check/><h1>我们的小世界完成了</h1><p>开口 {runtime.current.voiceAttempts} 次 · 完成十关</p><button onClick={()=>finish('completed')}>把记录收进相册 <ArrowRight/></button></section>:<section className="world-panel">
 <div className="world-lesson"><div><small>第 {lesson.id} 关 · {lesson.title}</small><h1>{lesson.prompt}<span>{WORDS[lesson.word]}</span></h1><p>{lesson.hint}</p></div><button className="world-hear" aria-label="听题干" onClick={()=>{speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(lesson.prompt);utterance.lang='en-US';speechSynthesis.speak(utterance);}}><SoundHigh/></button></div>
 <div className="world-controls"><button className={mic?'world-mic listening':'world-mic'} onClick={toggleMic}><Microphone/>{mic?'关闭麦克风':'开口说一说'}</button><form onSubmit={e=>{e.preventDefault();act(input,'text');setInput('');}}><input aria-label="输入英文单词" placeholder="也可以输入英文单词" value={input} disabled={busy} onChange={e=>setInput(e.target.value)}/><button aria-label="发送单词" disabled={busy||!input.trim()}><ArrowRight/></button></form></div>
 <small className="world-status" role="status">{status||'说出题干里的词就能前往下一关，也欢迎自由尝试其他词。'}</small>
 <div className="world-choices" aria-label="可尝试的单词">{Object.keys(WORDS).map(word=><button disabled={busy} key={word} onClick={()=>act(word,'menu')} className={word===lesson.word?'target':''}>{word}<small>{WORDS[word]}</small></button>)}</div><p className="world-note"><Sparks/>点词可以体验动作；开口和输入的词才记入词汇分组。</p>
 </section>}
 </main>;
}
