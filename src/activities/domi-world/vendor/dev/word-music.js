export const WORD_MUSIC=['forget-me-not','happy-lullaby','happy-adventure'];
export function createWordMusic(button,{onIcon=()=>{}}={}){
  const audio=new Audio();audio.preload='none';audio.loop=true;audio.volume=.24;
  let muted=false,unlocked=false,voiceBusy=false,disposed=false,index=-1;
  try{muted=localStorage.getItem('jma.word-music-muted')==='true';}catch{}
  function render(){button.setAttribute('aria-label',muted?'打开背景音乐':'关闭背景音乐');button.setAttribute('aria-pressed',String(!muted));onIcon(muted);}
  function sync(){if(disposed)return;if(!unlocked||muted||voiceBusy||document.hidden){audio.pause();return;}void audio.play().catch(()=>{});}
  function randomize(){const pool=WORD_MUSIC.map((_,i)=>i).filter(i=>i!==index);index=pool[Math.floor(Math.random()*pool.length)];audio.src=`/assets/music/word-world/${WORD_MUSIC[index]}.mp3`;sync();}
  const unlock=()=>{unlocked=true;sync();};
  const visibility=()=>sync();
  document.addEventListener('pointerdown',unlock,{capture:true});document.addEventListener('keydown',unlock,{capture:true});document.addEventListener('visibilitychange',visibility);
  button.onclick=()=>{muted=!muted;try{localStorage.setItem('jma.word-music-muted',String(muted));}catch{}render();sync();};
  randomize();render();
  return {randomize,setVoiceState(state){voiceBusy=['requesting','listening','speaking','thinking','transcribing'].includes(state);sync();},get status(){return {track:WORD_MUSIC[index],muted,paused:audio.paused};},dispose(){disposed=true;audio.pause();audio.removeAttribute('src');audio.load();document.removeEventListener('pointerdown',unlock,true);document.removeEventListener('keydown',unlock,true);document.removeEventListener('visibilitychange',visibility);button.onclick=null;}};
}
