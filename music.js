'use strict';
(()=>{
  const tracks={
    menu:{url:'lightless-dawn.mp3',volume:.24},
    voxel:{url:'voxel-revolution.mp3',volume:.20},
    newerWave:{url:'newer-wave.mp3',volume:.20},
    brainDance:{url:'brain-dance.mp3',volume:.20}
  };
  const sectorTracks=['voxel','newerWave','brainDance','newerWave'];
  let context=null,ready=false,mode='ready',muted=true,sector=0,current=null;
  const voices=new Set();

  function stopVoice(voice,fade=false){
    const now=context.currentTime;
    const gain=voice.gain.gain;
    gain.cancelScheduledValues(now);
    if(fade){
      gain.setValueAtTime(gain.value,now);
      gain.linearRampToValueAtTime(0,now+.3);
    }else{
      gain.setValueAtTime(0,now);
    }
    try {voice.source.stop(now+(fade?.3:0));} catch {}
  }

  function silence(fade=false){
    if(!context)return;
    if(current){
      const {name,offset,started}=current;
      const track=tracks[name];
      track.offset=(offset+context.currentTime-started)%track.buffer.duration;
      current=null;
    }
    for(const voice of voices)stopVoice(voice,fade);
  }

  function play(name){
    const track=tracks[name],source=context.createBufferSource(),gain=context.createGain();
    source.buffer=track.buffer;
    source.loop=true;
    source.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0,context.currentTime);
    gain.gain.linearRampToValueAtTime(track.volume,context.currentTime+.35);
    const voice={name,source,gain,offset:track.offset||0,started:context.currentTime};
    voices.add(voice);
    source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();};
    source.start(0,voice.offset);
    current=voice;
  }

  function trackForMode(){
    return mode==='playing'||mode==='paused'?sectorTracks[sector]:'menu';
  }

  function nextTrack(){
    return mode==='playing'||mode==='paused'?
      sectorTracks[(sector+1)%sectorTracks.length]:'voxel';
  }

  // Keep decoded audio for the current sector and one sector ahead. The
  // browser can cache the compressed recordings if they are needed again.
  function releaseUnusedBuffers(){
    const keep=new Set([trackForMode(),nextTrack(),current?.name]);
    for(const [name,track] of Object.entries(tracks)){
      if(!keep.has(name))delete track.buffer;
    }
  }

  function loadTrack(name){
    const track=tracks[name];
    if(!context||track.buffer||track.loading||track.failed)return;
    track.loading=true;
    fetch(track.url).then(response=>{
      if(!response.ok)throw Error('Music unavailable');
      return response.arrayBuffer();
    }).then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{
      track.buffer=buffer;
    }).catch(()=>{
      track.failed=true;
    }).finally(()=>{
      track.loading=false;
      reconcile();
    });
  }

  function reconcile(){
    if(!context)return;
    const primary=trackForMode();
    if(!muted&&!document.hidden&&mode!=='paused'){
      loadTrack(primary);
      loadTrack(nextTrack());
    }
    const name=!ready||muted||mode==='paused'||document.hidden?null:
      tracks[primary].failed&&mode==='playing'?'voxel':primary;
    if(!name){
      if(voices.size)silence();
    }else if(current?.name!==name&&context.state==='running'){
      if(tracks[name].buffer){
        silence(Boolean(current));
        play(name);
      }else{
        loadTrack(name);
        if(current?.name==='menu'&&mode==='playing')silence(true);
      }
    }
    releaseUnusedBuffers();
  }

  async function unlock(){
    try {
      if(!context){
        context=new(window.AudioContext||window.webkitAudioContext)();
        // Begin with the two tracks the player hears first.
        loadTrack('menu');
        loadTrack('voxel');
      }
      await context.resume();
      reconcile();
    } catch {}
  }

  window.StarfallMusic={
    unlock,
    setState(next,isMuted,reset=false,nextSector=0){
      const changed=next!==mode||isMuted!==muted||nextSector!==sector||reset;
      if(reset){
        if(current&&current.name!=='menu')silence();
        for(const name of ['voxel','newerWave','brainDance'])tracks[name].offset=0;
      }
      mode=next;
      muted=isMuted;
      sector=nextSector;
      if(changed)reconcile();
    }
  };
  window.addEventListener('retro-waves-start',unlock);
  window.addEventListener('retro-waves-ready',()=>{ready=true;reconcile();});
  document.addEventListener('visibilitychange',reconcile);
})();
