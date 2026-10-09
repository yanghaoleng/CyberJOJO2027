import { useEffect,useRef,useState } from 'react';
import { SoundHigh,ArrowRight,Check,NavArrowLeft,ViewGrid,Refresh,MusicNote,SoundOff } from 'iconoir-react';
import { LESSONS,WORDS,ChapterRuntime } from './chapter.js';
import { createStage } from './stage.js';
import { startChapterVoice } from './voice.js';
import { createVoiceInput } from './vendor/src/voice-input-control.js';
import { createWordMusic } from './vendor/dev/word-music.js';
import { ACTIVITY_PROTOCOL,saveActivityReport } from '../activity-contract.js';
import './vendor/src/voice-input-control.css';
import './vendor/dev/words.css';
import './world.css';
export default function DomiWorld(){
 const runtime=useRef(null);if(!runtime.current)runtime.current=new ChapterRuntime();
 const host=useRef(null),stage=useRef(null),voice=useRef(null),control=useRef(null),micButton=useRef(null),transcript=useRef(null),musicButton=useRef(null),music=useRef(null),alive=useRef(false),ended=useRef(false),micOn=useRef(false),generation=useRef(0),matched=useRef(false);
 const [index,setIndex]=useState(0),[feedback,setFeedback]=useState(''),[voiceState,setVoiceState]=useState('setup'),[menu,setMenu]=useState(false),[next,setNext]=useState(false),[countdown,setCountdown]=useState(5),[muted,setMuted]=useState(false),[reading,setReading]=useState(false),[stageError,setStageError]=useState(false);
 const session=new URLSearchParams(location.search).get('session'),embedded=!!session&&window.parent!==window;
 const send=(type,report)=>{if(embedded)window.parent.postMessage({protocol:ACTIVITY_PROTOCOL,type,sessionId:session,activityId:'words',report},location.origin);};
 function stopMic(){generation.current++;voice.current?.();voice.current=null;micOn.current=false;control.current?.setState('paused');setVoiceState('paused');}
 function finish(state='exited'){if(ended.current)return;ended.current=true;stopMic();speechSynthesis.cancel();const report=runtime.current.report(state);if(embedded)send('result',report);else{saveActivityReport({id:crypto.randomUUID(),activityId:'words',createdAt:runtime.current.started,report});location.href='/';}}
 function advance(){if(!matched.current)return;matched.current=false;setNext(false);setIndex(runtime.current.index);setFeedback('');control.current?.clearTranscript();}
 function act(text,source='voice'){
  if(matched.current||ended.current)return;
  const cmd=runtime.current.dispatch(text,source);send('progress',runtime.current.report());control.current?.setTranscript(text);if(!cmd){setFeedback('试着说出这个英文单词，也可以打开单词菜单');return;}
  stage.current?.play(cmd);setFeedback(cmd.action==='eat'?`DOMI 正在吃 ${cmd.word}`:cmd.action==='drive'?`DOMI 正在驾驶 ${cmd.word}`:cmd.action==='handshake'?`DOMI 和 ${cmd.word} 握手`:`DOMI 和 ${cmd.word} 一起跳舞`);
  if(cmd.success){matched.current=true;setNext(true);setCountdown(5);}
 }
 const actRef=useRef(act);actRef.current=act;
 function syncState(state){if(!alive.current)return;setVoiceState(state);control.current?.setState(micOn.current&&!['requesting','error'].includes(state)?'listening':state);music.current?.setVoiceState(state);if(state==='error'){micOn.current=false;voice.current=null;}}
 async function toggleMic(){if(micOn.current){stopMic();return;}const token=++generation.current;micOn.current=true;syncState('requesting');try{const stop=await startChapterVoice(t=>actRef.current(t),syncState,l=>control.current?.setLevel(l),(t,interim)=>control.current?.setTranscript(t,{interim}));if(!alive.current||token!==generation.current){stop();return;}voice.current=stop;if(index===0)hear();}catch{micOn.current=false;syncState('error');}}
 function hear(){speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(LESSONS[Math.min(index,9)].prompt);utterance.lang='en-US';utterance.rate=.65;utterance.onstart=()=>{setReading(true);music.current?.setVoiceState('speaking');};utterance.onend=utterance.onerror=()=>{if(alive.current){setReading(false);music.current?.setVoiceState(micOn.current?'listening':'off');}};speechSynthesis.speak(utterance);}
 useEffect(()=>{alive.current=true;try{stage.current=createStage(host.current);}catch{setStageError(true);}send('ready');send('progress',runtime.current.report());const receive=e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.protocol===ACTIVITY_PROTOCOL&&e.data.sessionId===session&&e.data.type==='exit')finish();};const pause=()=>{if(document.hidden){stopMic();speechSynthesis.cancel();}};window.addEventListener('message',receive);document.addEventListener('visibilitychange',pause);music.current=createWordMusic(musicButton.current,{onIcon:setMuted});return()=>{alive.current=false;generation.current++;voice.current?.();stage.current?.dispose();music.current?.dispose();speechSynthesis.cancel();window.removeEventListener('message',receive);document.removeEventListener('visibilitychange',pause);};},[]);
 useEffect(()=>{if(index===10)return;control.current=createVoiceInput({button:micButton.current,transcript:transcript.current,waveDots:6});control.current.setState(micOn.current?'listening':voiceState);return()=>{control.current?.dispose();control.current=null;};},[index===10]);
 useEffect(()=>{if(!next)return;const timer=setInterval(()=>setCountdown(n=>Math.max(0,n-1)),1000);return()=>clearInterval(timer);},[next]);
 useEffect(()=>{if(next&&countdown===0)advance();},[countdown,next]);
 useEffect(()=>{if(index>0&&index<10)hear();},[index]);
 useEffect(()=>{const key=e=>{if(e.key==='Escape'&&menu){e.preventDefault();setMenu(false);}if(e.key==='Enter'){e.preventDefault();if(next)advance();else if(!micOn.current)void toggleMic();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[menu,next,index]);
 const lesson=LESSONS[Math.min(index,9)];
 const hint=reading?'先听一听，再跟着说':({setup:'轮到你啦，试着说出来',requesting:'正在打开麦克风',listening:'我会一直听，你可以接着说',transcribing:'正在听懂你的话',paused:'已暂停，点一下继续',error:'语音暂时没有连上，点一下重试'})[voiceState]||'我在听';
 return <main className={`word-layout domi-immersive${menu?' word-menu-open':''}`} data-view={index===10?'complete':'play'}>
 <div id="word-stage" ref={host}/><div className="scene-shade" aria-hidden="true"/>
 <header className="word-header">{!embedded&&<button className="quiet-button domi-exit" onClick={()=>finish()} aria-label="退出"><NavArrowLeft/>退出</button>}<button ref={musicButton} id="word-music" className="quiet-button music-button" aria-label="背景音乐">{muted?<SoundOff/>:<MusicNote/>}</button></header>
 {stageError&&<p id="webgl-error" role="alert">立体场景暂时没有打开，请换一个支持 3D 的浏览器再试。</p>}
 <section id="word-panel" aria-label="英语冒险">
 {index===10?<div className="play-bottom complete-panel"><div className="complete-stamp"><Check/></div><h2>我们的小世界完成了</h2><p>开口 {runtime.current.voiceAttempts} 次 · 完成十关</p><button className="primary-button" onClick={()=>finish('completed')}>把记录收进相册 <ArrowRight/></button></div>:<>
 <div className="lesson-heading"><div className="lesson-progress-row"><div className="lesson-progress" aria-label={`已完成 ${index} 关`}>{LESSONS.map((l,i)=><span key={l.id} className={i<index?'done':i===index?'current':''}/>)}</div></div><div className="sentence-row"><h1 id="lesson-sentence" className="sentence"><span className={`read-along-word replaceable-word${reading?' is-reading':''}`} role="button" tabIndex={0} aria-label={`换一个 ${lesson.word}`} onClick={()=>setMenu(!menu)} onKeyDown={e=>{if(e.key===' '){e.preventDefault();setMenu(!menu);}}}>{lesson.prompt}</span></h1><button className="listen-button" aria-label="听题干" onClick={hear}><SoundHigh/></button></div></div>
 <div className="play-bottom"><div className="answer-result">{next&&<button id="next-lesson" className="next-button" onClick={advance}>{index===9?'完成':'继续'}<span className="continue-countdown"> {countdown}s</span><ArrowRight/></button>}<span className="transcript-loading" role="status" aria-label="正在识别你的话" hidden={voiceState!=='transcribing'}><Refresh/></span><div id="word-transcript" ref={transcript} hidden/></div><p id="mic-heading" className="voice-hint" role="status" aria-live="polite">{hint}</p><div className="voice-controls"><button id="word-mic" ref={micButton} onClick={toggleMic}/><button id="word-options-toggle" className="options-button" aria-label={menu?'关闭单词菜单':'打开单词菜单'} aria-expanded={menu} aria-controls="word-menu" onClick={()=>setMenu(!menu)}><ViewGrid/></button><div id="word-menu" className="word-menu" role="dialog" aria-label="点一个单词，让世界变化" hidden={!menu}><p>也可以点一个词</p><div className="word-options">{Object.keys(WORDS).map(word=><button className="word-option" disabled={next} key={word} onClick={()=>{act(word,'menu');setMenu(false);}}><span lang="en">{word}</span><small>{WORDS[word]}</small></button>)}</div></div></div></div>
 </>}
 </section><p id="world-feedback" className="sr-only" aria-live="polite">{feedback}</p>
 </main>;
}
