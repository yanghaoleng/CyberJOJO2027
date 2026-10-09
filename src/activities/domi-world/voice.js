export async function startChapterVoice(onText,onState,onLevel=()=>{},onTranscript=()=>{}){
 let stream,context,socket,processor,source,gain,closed=false,ready=false;
 const stop=()=>{closed=true;ready=false;if(processor){processor.onaudioprocess=null;processor.disconnect();}source?.disconnect();gain?.disconnect();stream?.getTracks().forEach(t=>t.stop());socket?.close();context?.close().catch(()=>{});};
 try{
 stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
 context=new AudioContext();await context.resume();
 socket=new WebSocket(import.meta.env.VITE_JOCAM_VOICE_URL || (['localhost','127.0.0.1'].includes(location.hostname)?'ws://127.0.0.1:8787/voice':`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/api/voice`));
 socket.onopen=()=>{if(closed)return;socket.send(JSON.stringify({type:'start',inputMode:'voice',character:'lvdou',sampleRate:16000,language:'en-US',resume:true}));socket.send(JSON.stringify({type:'interaction_mode',mode:'find'}));};
 socket.onmessage=e=>{if(typeof e.data!=='string'||closed)return;let m;try{m=JSON.parse(e.data);}catch{return;}if(m.type==='ready'){ready=true;onState('listening');}if(m.type==='transcript'){onTranscript(m.text,!m.final);if(m.final){onText(m.text);onState('listening');}else onState('transcribing');}if(m.type==='error'){stop();onState('error');};};
 socket.onerror=()=>{stop();onState('error');};socket.onclose=()=>{if(!closed){stop();onState('error');}};
 source=context.createMediaStreamSource(stream);processor=context.createScriptProcessor(2048,1,1);gain=context.createGain();gain.gain.value=0;source.connect(processor);processor.connect(gain);gain.connect(context.destination);
 processor.onaudioprocess=e=>{if(!ready||closed||socket.readyState!==1)return;const a=speechSynthesis.speaking?new Float32Array(e.inputBuffer.length):e.inputBuffer.getChannelData(0),ratio=context.sampleRate/16000,n=Math.floor(a.length/ratio),pcm=new Int16Array(n);for(let i=0;i<n;i++){let sum=0,count=0;for(let j=Math.floor(i*ratio);j<Math.floor((i+1)*ratio)&&j<a.length;j++){sum+=a[j];count++;}pcm[i]=Math.max(-1,Math.min(1,sum/(count||1)))*32767;}let energy=0;for(const v of a)energy+=v*v;onLevel(speechSynthesis.speaking?0:Math.min(1,Math.sqrt(energy/a.length)*15));socket.send(pcm.buffer);};
 return stop;
 }catch(e){stop();throw e;}
}
