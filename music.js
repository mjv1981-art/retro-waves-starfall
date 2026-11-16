'use strict';
(()=>{
  const tracks={
    menu:{url:'lightless-dawn.mp3',volume:.24},
    voxel:{url:'voxel-revolution.mp3',volume:.20},
    redline:{volume:.27},
    rings:{volume:.27}
  };
  const sectorTracks=['voxel','redline','rings','redline'];
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

  function reconcile(){
    const name=!ready||muted||mode==='paused'||document.hidden?null:
      mode==='playing'?sectorTracks[sector]:'menu';
    if(!name){if(voices.size)silence();return;}
    if(current?.name===name||!context||context.state!=='running')return;
    if(!tracks[name].buffer){
      if(current?.name==='menu'&&mode==='playing')silence(true);
      return;
    }
    silence(Boolean(current));
    play(name);
  }

  // Original 16-bar synth arrangements. A small, pre-rendered loop avoids
  // timer drift, network requests and audio processing in the game loop.
  function renderLoop(name){
    const mars=name==='redline';
    const sampleRate=22050, beat=60/(mars?128:114);
    const length=Math.round(64*beat*sampleRate);
    const buffer=context.createBuffer(2,length,sampleRate);
    const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
    const tau=2*Math.PI;
    let seed=mars?3191:7613;
    const noise=()=>{
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      return seed/4294967296*2-1;
    };
    const add=(start,duration,amp,pan,tone,attack=.012)=>{
      const first=Math.round(start*beat*sampleRate);
      const span=Math.round(duration*beat*sampleRate);
      const lg=Math.sqrt((1-pan)*.5)*amp,rg=Math.sqrt((1+pan)*.5)*amp;
      for(let i=0;i<span;i++){
        const time=i/sampleRate;
        const envelope=Math.min(1,time/attack,(span-i)/(sampleRate*.045));
        const sample=tone(time)*envelope;
        const out=(first+i)%length;
        left[out]+=sample*lg;
        right[out]+=sample*rg;
      }
    };
    const note=(start,duration,midi,amp,pan,voice)=>{
      const freq=440*2**((midi-69)/12);
      const phase=tau*freq;
      add(start,duration,amp,pan,t=>voice(phase*t,t));
    };
    const bass=(p,t)=>Math.sin(p)*.75+Math.sin(2*p)*.2+Math.sin(3*p)*.08;
    const arp=(p,t)=>(Math.sin(p)*.72+Math.sin(2*p)*.22+Math.sin(3*p)*.12)*Math.exp(-5*t);
    const lead=(p,t)=>Math.sin(p+Math.sin(t*35)*.2)*.69+Math.sin(3*p)*.18;
    const pad=(p,t)=>(Math.sin(p*.997)+Math.sin(p*1.003))*.36+Math.sin(2*p)*.17;
    const progression=mars?
      [[45,57,60,64,67],[41,53,57,60,64],[48,55,60,64,67],[43,55,59,62,65]]:
      [[42,54,57,61,64],[38,54,57,62,66],[45,52,57,61,64],[40,52,56,59,64]];
    const melody=mars?[[2,3,4,2],[1,2,3,1],[2,4,3,2],[3,2,1,2]]:
      [[4,3,2,3],[2,3,4,1],[3,2,4,2],[4,2,1,3]];
    for(let bar=0;bar<16;bar++){
      const start=bar*4, chord=progression[bar%4];
      for(const step of mars?[0,1.5,2,3.25]:[0,2,2.75]){
        note(start+step,.65,chord[0]+(step===2?12:0),.19,0,bass);
      }
      for(let i=0;i<8;i++){
        const degree=1+([0,2,1,3,2,0,3,1][i]+Math.floor(bar/8))%4;
        note(start+i*.5,.43,chord[degree]+12,.085,(i%2?.38:-.38),arp);
        add(start+i*.5,.16,i%2?.035:.017,.22,t=>noise()*Math.exp(-55*t),.004);
      }
      for(const step of mars?[0,2,3.5]:[0,2]){
        add(start+step,.44,.26,0,t=>Math.sin(tau*(44*t+3.7*(1-Math.exp(-27*t))))*Math.exp(-15*t),.007);
      }
      for(const step of [1,3]){
        add(start+step,.32,.095,-.12,t=>(noise()*.62+Math.sin(tau*165*t)*.32)*Math.exp(-20*t),.004);
      }
      if(!mars||bar%8>=4){
        for(const degree of [1,2,3])note(start,3.9,chord[degree],.042,(degree-2)*.48,pad);
      }
      if(bar%8>=4||bar%4===2){
        melody[bar%4].forEach((degree,i)=>{
          if(i===2&&bar%2===0)return;
          note(start+i+(mars?.25:.5),i===3?.45:.72,chord[degree]+12,.10,-.12,lead);
        });
      }
    }
    return buffer;
  }

  function loadTracks(){
    for(const [name,track] of Object.entries(tracks)){
      if(!track.url)continue;
      fetch(track.url).then(response=>{
        if(!response.ok)throw Error('Music unavailable');
        return response.arrayBuffer();
      }).then(bytes=>context.decodeAudioData(bytes)).then(buffer=>{
        track.buffer=buffer;
        reconcile();
      }).catch(()=>{
        if(name==='voxel'){sectorTracks[0]='rings';reconcile();}
      });
    }
    for(const name of ['redline','rings']){
      setTimeout(()=>{tracks[name].buffer=renderLoop(name);reconcile();},0);
    }
  }

  async function unlock(){
    try {
      if(!context){
        context=new(window.AudioContext||window.webkitAudioContext)();
        loadTracks();
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
        for(const name of ['voxel','redline','rings'])tracks[name].offset=0;
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
