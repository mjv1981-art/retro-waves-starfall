'use strict';
(()=>{
  const tracks={menu:{url:'lightless-dawn.mp3',volume:.24,offset:0},game:{url:'voxel-revolution.mp3',volume:.2,offset:0}};
  let context=null,ready=false,mode='ready',muted=true,current=null,signature='';
  const voices=new Set();
  function silence(fade=false){
    if(!context)return;
    if(current){const t=tracks[current.name];t.offset=(current.offset+context.currentTime-current.started)%t.buffer.duration;current=null;}
    for(const v of voices){try{v.gain.gain.cancelScheduledValues(context.currentTime);if(fade){v.gain.gain.setValueAtTime(v.gain.gain.value,context.currentTime);v.gain.gain.linearRampToValueAtTime(0,context.currentTime+.25);v.source.stop(context.currentTime+.25)}else{v.gain.gain.setValueAtTime(0,context.currentTime);v.source.stop()}}catch{}if(!fade)voices.delete(v)}
  }
  function reconcile(){
    const wanted=!ready||muted||mode==='paused'||document.hidden?null:mode==='playing'?'game':'menu';
    if(current?.name===wanted)return;
    const fade=!!wanted&&!!current;
    silence(fade);
    if(!wanted||!context||context.state!=='running'||!tracks[wanted].buffer)return;
    const t=tracks[wanted],source=context.createBufferSource(),gain=context.createGain();
    source.buffer=t.buffer;source.loop=true;source.connect(gain);gain.connect(context.destination);
    gain.gain.setValueAtTime(0,context.currentTime);gain.gain.linearRampToValueAtTime(t.volume,context.currentTime+.35);
    const v={name:wanted,source,gain,offset:t.offset,started:context.currentTime};
    voices.add(v);source.onended=()=>{voices.delete(v);source.disconnect();gain.disconnect()};
    source.start(0,t.offset);current=v;
  }
  async function unlock(){
    try{
      if(!context){context=new(window.AudioContext||window.webkitAudioContext)();
        for(const t of Object.values(tracks))fetch(t.url).then(r=>{if(!r.ok)throw Error('Music unavailable');return r.arrayBuffer()}).then(b=>context.decodeAudioData(b)).then(b=>{t.buffer=b;reconcile()}).catch(()=>{document.getElementById('music-status').textContent='Music unavailable · sound effects still active'});
      }
      await context.resume();reconcile();
    }catch{}
  }
  window.StarfallMusic={
    unlock,
    setState(next,isMuted,reset=false){
      const key=next+':'+isMuted;
      if(reset){if(current?.name==='game')silence();tracks.game.offset=0;signature='';}
      mode=next;muted=isMuted;
      if(key!==signature){signature=key;reconcile();}
    },
    ready(){ready=true;reconcile()}
  };
  window.addEventListener('retro-waves-start',unlock);
  window.addEventListener('retro-waves-ready',()=>window.StarfallMusic.ready());
  document.addEventListener('visibilitychange',reconcile);
})();
