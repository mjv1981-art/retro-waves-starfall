'use strict';
(()=>{
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
const W=1280,H=664,TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a),hyp=Math.hypot;
let dpr=1;function resize(){dpr=Math.min(devicePixelRatio||1,2);canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}resize();window.addEventListener('resize',resize);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const keys=new Set(),colors=['#c2d0d6','#7ee9df','#d3a1f2'];const sectors=[['THE QUIET BELT','#14263b','#6993b3'],['MARS / CANYON BATTERIES','#382039','#e19d88'],['SATURN / RING PASSAGE','#132e32','#77dccc'],['VENUS / SULFUR FRONT','#372b19','#edcd89']];
let mode='ready',muted=true,ac=null,best=0;try{best=+localStorage.getItem('starfall.best')||0}catch{}$('best').textContent=String(best).padStart(6,'0');
let score=0,lives=3,time=0,travel=0,level=0,sector=0,ground=0,ship,rocks=[],shots=[],hostile=[],turrets=[],particles=[],clouds=[],packs=[],rings=[],texts=[],special=null,spawn=0,turretSpawn=0,pickupTimer=11,pickupIndex=0,fire=0,shake=0,flash=0,msgTime=0,collisionTimer=0,sectorTime=0,unitSequence=0,lastGroundSound=-10;
let playerBeams=[], groundShake=0;
const stars=Array.from({length:170},()=>({x:rand(0,W),y:rand(0,H),z:rand(.2,1),r:rand(.5,1.6)}));
function audio(freq=180,dur=.08,type='sine',vol=.04,end=50){if(muted)return;try{ac??=new(window.AudioContext||window.webkitAudioContext)();ac.resume();const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,ac.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),ac.currentTime+dur);g.gain.setValueAtTime(vol,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+dur)}catch{}}
function announce(s){$('message').textContent=s;msgTime=3.5}
function saveBest(){if(score>best){best=Math.floor(score);try{localStorage.setItem('starfall.best',best)}catch{}$('best').textContent=String(best).padStart(6,'0')}}
function start(){score=0;lives=3;time=travel=level=sector=ground=sectorTime=unitSequence=0;lastGroundSound=-10;rocks=[];shots=[];hostile=[];turrets=[];particles=[];clouds=[];packs=[];rings=[];texts=[];special=null;spawn=.7;turretSpawn=2;pickupTimer=11;pickupIndex=0;fire=shake=flash=groundShake=0;playerBeams=[];ship={x:145,y:H/2,vx:0,vy:0,tilt:0,shield:100,inv:2,lastHit:-10};mode='playing';window.StarfallMusic?.setState(mode,muted,true,sector);window.StarfallMusic?.unlock();keys.clear();$('overlay').hidden=true;announce('WELCOME, PILOT · HOLD SPACE TO FIRE');sync()}
function pause(){if(mode==='playing'){mode='paused';showOverlay('FLIGHT ON HOLD','Take a breath.','Your voyage will be right here.','RESUME VOYAGE');$('restart').hidden=false;sync()}else if(mode==='paused'){mode='playing';$('overlay').hidden=true;keys.clear();sync()}}
function showOverlay(tag,title,desc,button){$('tag').textContent=tag;$('heading').textContent=title;$('description').textContent=desc;$('start').textContent=button;$('overlay').hidden=false}
$('start').onclick=()=>mode==='paused'?pause():start();$('restart').onclick=start;$('pause').onclick=pause;
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'SOUND OFF':'SOUND ON';window.StarfallMusic?.setState(mode,muted,false,sector);if(!muted)window.StarfallMusic?.unlock();audio(400,.1,'sine',.03,600)};
window.addEventListener('retro-waves-ready',()=>{muted=false;$('sound').textContent='SOUND ON';window.StarfallMusic?.setState(mode,muted,false,sector)});

const fullscreenButton=$('fullscreen');
const gameFrame=fullscreenButton.closest('.frame');
fullscreenButton.disabled=!document.fullscreenEnabled||!gameFrame.requestFullscreen;
fullscreenButton.title=fullscreenButton.disabled?'Fullscreen is unavailable in this browser':'Toggle fullscreen (F)';
async function toggleFullscreen(){
  if(fullscreenButton.disabled)return;
  try {
    if(document.fullscreenElement===gameFrame)await document.exitFullscreen();
    else await gameFrame.requestFullscreen();
  } catch {
    const message=$('message');
    announce('FULLSCREEN UNAVAILABLE');
    message.style.opacity=1;
    setTimeout(()=>{if(message.textContent==='FULLSCREEN UNAVAILABLE')message.style.opacity=0;},2500);
  }
}
fullscreenButton.addEventListener('click',toggleFullscreen);
document.addEventListener('fullscreenchange',()=>{
  const active=document.fullscreenElement===gameFrame;
  fullscreenButton.textContent=active?'EXIT FULLSCREEN':'FULLSCREEN';
  fullscreenButton.setAttribute('aria-pressed',String(active));
});

window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(!e.repeat){if(e.code==='KeyF'&&$('splash-screen').style.display==='none')toggleFullscreen();if(e.code==='KeyP'||(e.code==='Escape'&&!document.fullscreenElement))pause();if(e.code==='KeyE'&&mode==='playing')useSpecial()}keys.add(e.code)});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();if(mode==='playing')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause()});
function addScore(n){score+=n;saveBest();const l=score>=4200?4:score>=2400?3:score>=1300?2:score>=300?1:0;if(score>=600&&!ship.lateral){ship.lateral=true;announce('LATERAL THRUSTERS ONLINE · A / D OR ← / →');spawn=Math.max(spawn,2.5)}if(l>level){level=l;announce(['','TWIN PULSE ONLINE','SPREAD 20° ONLINE','SPREAD 30° ONLINE','SPREAD 50° ONLINE'][l]);audio(450,.3,'triangle',.05,1000)}}
function burst(x,y,n,col,speed=150){for(let i=0;i<n&&particles.length<750;i++){let a=rand(0,TAU),v=rand(20,speed);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.2,.8),max:.8,col,r:rand(1,3)})}}
function ring(x,y,col,max=100){rings.push({x,y,r:4,max,life:.6,col})}
function rock(x,y,r,mat=0,budget=null){const count=10,shape=Array.from({length:count},()=>rand(.76,1.05));const health=r>42?5:r>24?3:1;return {x,y,r,mat,vx:-rand(85,150)-Math.min(time*.3,80),vy:rand(-24,24),a:rand(0,TAU),spin:rand(-.7,.7),hp:health*(mat===2?2:1),shape,budget:budget??Math.round(r*2),hit:0,dodge:false,age:0}}
function breakRock(a,credit=true,harmless=false){if(a.dead)return;a.dead=true;const col=colors[a.mat];burst(a.x,a.y,Math.min(32,a.r),col,a.r*4);shake=Math.max(shake,a.r/10);audio(a.r>30?80:240,.13,'triangle',credit?.025:.008,30);if(a.r>24&&!harmless){if(credit)addScore(a.budget*.35);const count=a.mat===1?3:2;for(let i=0;i<count;i++){const angle=(i/count)*TAU+rand(-.2,.2),nr=a.r/(count===3?1.95:1.65),b=rock(a.x+Math.cos(angle)*nr*.7,a.y+Math.sin(angle)*nr*.7,nr,a.mat,a.budget*.65/count);b.vx=a.vx+Math.cos(angle)*65;b.vy=a.vy+Math.sin(angle)*90;b.spin=rand(-2.5,2.5);b.age=-.2;rocks.push(b)}}else{if(credit)addScore(a.budget);clouds.push({x:a.x,y:a.y,r:Math.max(28,a.r*1.8),life:3.8,col,claimed:false,vx:a.vx*.4});ring(a.x,a.y,col,Math.max(30,a.r*2))}}
function damage(amount){if(ship.inv>0||mode!=='playing')return;ship.lastHit=time;shake=12;flash=.25;audio(100,.25,'sawtooth',.04,30);ship.inv=.85;if(ship.shield>0){ship.shield=Math.max(0,ship.shield-amount);ring(ship.x,ship.y,'#7ee9df',65)}else{lives--;burst(ship.x,ship.y,70,'#d8ff88',330);special=null;if(lives<=0){mode='over';saveBest();showOverlay('SIGNAL LOST / VOYAGE COMPLETE','One more flight?','Final score '+Math.floor(score).toLocaleString()+' · Distance '+Math.floor(travel)+' km. The next frontier is waiting.','LAUNCH AGAIN ↗');$('restart').hidden=true}else{ship.x=145;ship.y=H*.4;ship.vx=ship.vy=0;ship.shield=100;ship.inv=3;announce('NEW SHIP DEPLOYED · '+lives+' REMAINING')}}}
const specialNames=['RADIAL BURST','REPULSOR','EMERGENCY CLEAR','OVERDRIVE','PIERCING LASER','HOMING ROCKETS','PLASMA BOLT'];
const specialIcons=['R','P','C','O','L','M','B'];
const specialCharges=[5,5,1,0,3,3,4];
// Introduce the new weapons in the first three drops, then cycle all seven.
const pickupOrder=[4,5,6,0,1,2,3];
function collect(p){special={type:p.type,charges:specialCharges[p.type],remaining:10,cool:0};ring(ship.x,ship.y,'#d7ff80',100);announce(specialNames[p.type]+(p.type===3?' · 10 SECONDS':' · PRESS E'));audio(500,.25,'sine',.07,1200);p.dead=true}
function useSpecial(){if(!special||special.type===3||special.cool>0)return;special.cool=.5;const type=special.type;if(type>=4){fireAdvancedSpecial(type);spendSpecial();return}if(type===0){for(let i=0;i<32;i++){let a=i*TAU/32;shots.push({x:ship.x,y:ship.y,vx:Math.cos(a)*620,vy:Math.sin(a)*620,life:1.8,power:2,col:'#d7ff80'})}ring(ship.x,ship.y,'#d7ff80',160)}else if(type===1){for(const a of rocks){let dx=a.x-ship.x,dy=a.y-ship.y,d=hyp(dx,dy);if(d<320){a.vx+=dx/Math.max(d,1)*500;a.vy+=dy/Math.max(d,1)*500;a.spin+=rand(-3,3)}}for(const b of hostile){if(hyp(b.x-ship.x,b.y-ship.y)<320){b.vx=Math.abs(b.vx)+160;b.vy=-b.vy;b.deflected=true}}ring(ship.x,ship.y,'#7ee9df',320)}else{for(const a of [...rocks])if(hyp(a.x-ship.x,a.y-ship.y)<360)breakRock(a,true,true);for(const t of turrets)if(hyp(t.x-ship.x,t.y-ship.y)<360)destroyTurret(t);hostile=hostile.filter(b=>hyp(b.x-ship.x,b.y-ship.y)>360);ring(ship.x,ship.y,'#fff',360)}shake=10;audio(160,.5,'sawtooth',.04,30);spendSpecial()}

function spendSpecial(){
  if(--special.charges<=0)special=null;
}

function hitRock(a,power,x,y,push=0){
  a.hp-=power;
  a.hit=.12;
  a.vx+=push;
  burst(x,y,9,colors[a.mat],150);
  if(a.hp<=0)breakRock(a);
}

function hitTurret(t,power,x,y){
  t.hp-=power;
  t.hit=.15;
  burst(x,y,8,'#ffa892',100);
  if(t.hp<=0)destroyTurret(t);
}

function fireAdvancedSpecial(type){
  const x=ship.x+25,y=ship.y;
  if(type===4){
    const targets=[...rocks,...turrets];
    playerBeams.push({x,y,life:.32});
    for(const target of targets){
      if(target.dead||target.x>W+55)continue;
      const radius=target.r?target.r*.9+8:32;
      const hit=segmentHit(x,y,W+40,y,target.x,target.y,radius);
      if(!Number.isFinite(hit))continue;
      const impactX=x+(W+40-x)*hit;
      if(target.r)hitRock(target,6,impactX,y,25);
      else hitTurret(target,6,impactX,y);
    }
    shake=Math.max(shake,6);
    audio(1040,.33,'sawtooth',.045,180);
  }else if(type===5){
    for(const side of [-1,1]){
      shots.push({kind:'missile',x,y:y+side*8,vx:460,vy:side*115,life:2.3,power:4,col:'#ffad67'});
    }
    audio(92,.24,'sawtooth',.05,200);
  }else{
    shots.push({kind:'plasma',x,y,vx:600,vy:0,life:2,power:5,col:'#de9dff'});
    ring(x,y,'#de9dff',60);
    audio(420,.24,'triangle',.07,85);
  }
}

function activeTargets(){
  return [...rocks,...turrets].filter(target=>!target.dead);
}

function guideMissile(shot,dt){
  let nearest=null,distance=560;
  for(const target of activeTargets()){
    if(target.x<shot.x-8||target.x>W+55)continue;
    const range=hyp(target.x-shot.x,target.y-shot.y);
    if(range<distance){nearest=target;distance=range}
  }
  if(!nearest)return;
  const heading=Math.atan2(shot.vy,shot.vx);
  const desired=Math.atan2(nearest.y-shot.y,nearest.x-shot.x);
  const turn=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
  const angle=heading+clamp(turn,-dt*4,dt*4);
  shot.vx=Math.cos(angle)*550;
  shot.vy=Math.sin(angle)*550;
}

function advanceSpecialShot(shot,dt){
  if(shot.kind==='missile')guideMissile(shot,dt);
  const x=shot.x,y=shot.y;
  shot.x+=shot.vx*dt;
  shot.y+=shot.vy*dt;
  shot.life-=dt;
  let hit=Infinity;
  for(const target of activeTargets()){
    const radius=(target.r?target.r*.9:27)+(shot.kind==='plasma'?15:4);
    hit=Math.min(hit,segmentHit(x,y,shot.x,shot.y,target.x,target.y,radius));
  }
  if(!Number.isFinite(hit))return;
  shot.x=x+(shot.x-x)*hit;
  shot.y=y+(shot.y-y)*hit;
  shot.life=0;
  const radius=shot.kind==='plasma'?128:86;
  for(const target of activeTargets()){
    const distance=hyp(target.x-shot.x,target.y-shot.y);
    if(distance>radius+(target.r||27))continue;
    const power=distance<radius*.55+(target.r||27)?shot.power:2;
    if(target.r)hitRock(target,power,shot.x,shot.y,35);
    else hitTurret(target,power,shot.x,shot.y);
  }
  if(shot.kind==='plasma'){
    hostile=hostile.filter(ammo=>hyp(ammo.x-shot.x,ammo.y-shot.y)>radius);
  }
  burst(shot.x,shot.y,36,shot.col,245);
  ring(shot.x,shot.y,shot.col,radius);
  shake=Math.max(shake,8);
  audio(95,.29,'triangle',.045,35);
}

function drawSpecialShot(shot){
  ctx.save();
  ctx.translate(shot.x,shot.y);
  ctx.rotate(Math.atan2(shot.vy,shot.vx));
  ctx.shadowColor=shot.col;
  ctx.shadowBlur=14;
  if(shot.kind==='missile'){
    path([[-9,-3],[4,-3],[12,0],[4,3],[-9,3]],'#ffe4a2',shot.col);
    path([[-9,-2],[-25,0],[-9,2]],'#ff7955',shot.col);
  }else{
    ctx.fillStyle=shot.col;
    ctx.beginPath();ctx.ellipse(0,0,14,10,0,0,TAU);ctx.fill();
    ctx.fillStyle='#fff4ff';
    ctx.beginPath();ctx.ellipse(5,0,6,5,0,0,TAU);ctx.fill();
  }
  ctx.restore();
}

function drawPlayerBeams(){
  for(const beam of playerBeams){
    ctx.save();
    ctx.globalAlpha=Math.min(1,beam.life*5);
    ctx.lineWidth=15;
    ctx.strokeStyle='#5df8ff';
    ctx.shadowBlur=20;
    ctx.shadowColor='#35d7ff';
    ctx.beginPath();ctx.moveTo(beam.x,beam.y);ctx.lineTo(W+40,beam.y);ctx.stroke();
    ctx.lineWidth=5;
    ctx.strokeStyle='#ecffff';ctx.stroke();
    ctx.restore();
  }
}

function shoot(){const over=special?.type===3;let angles=level===0?[0]:level===1?[0,0]:level===2?[-10,0,10]:level===3?[-15,0,15]:[-25,-12.5,0,12.5];if(over)angles=[-35,-25,-15,-5,5,15,25,35];angles.forEach((a,i)=>{const v=a*Math.PI/180;shots.push({x:ship.x+22,y:ship.y+(level===1&&!over?(i?6:-6):0),vx:Math.cos(v)*850,vy:Math.sin(v)*850,life:1.6,power:over?3:1,col:over?'#d7ff80':'#99eeeb'})});burst(ship.x+24,ship.y,2,'#c3ffff',60);audio(over?400:650,.035,'triangle',.012,180)}
function destroyTurret(t){
  if(t.dead)return;
  t.dead=true;
  addScore(t.type==='laser'?220:t.type==='rocket'?160:100);
  const heavy=t.type==='laser';
  burst(t.x,t.y,heavy?90:64,'#ff9c62',360);
  burst(t.x,t.y-6,26,'#fff0ad',200);
  ring(t.x,t.y,'#ffd079',heavy?190:145);
  ring(t.x,t.y,'#fb694b',heavy?125:95);
  groundShake=Math.max(groundShake,heavy?23:17);
  audio(108,.42,'triangle',.075,26);
}
function sync(){ window.StarfallMusic?.setState(mode,muted,false,sector); $('score').textContent=String(Math.floor(score)).padStart(6,'0');$('shieldValue').textContent=Math.ceil(ship?.shield??100);$('shieldBar').style.width=(ship?.shield??100)+'%';$('lives').textContent='▹ '.repeat(lives).trim();$('tier').textContent=['MK I','MK II','MK III','MK IV','MK V'][level];$('gun').textContent=['SINGLE PULSE','TWIN PULSE','SPREAD / 20°','SPREAD / 30°','SPREAD / 50°'][level];$('special').textContent=special?specialNames[special.type]+' / '+(special.type===3?Math.ceil(special.remaining)+'s':special.charges+' SHOTS'):'NO PAYLOAD';let goals=[300,600,1300,2400,4200],labels=['TWIN PULSE','LATERAL THRUSTERS','20° SPREAD','30° SPREAD','50° SPREAD'];let i=goals.findIndex(n=>score<n);$('next').textContent=i<0?'ALL SYSTEMS EVOLVED':'NEXT: '+labels[i];$('target').textContent=i<0?'MAX':Math.floor(score)+' / '+goals[i];$('progress').style.width=(i<0?100:score/goals[i]*100)+'%';$('distance').textContent=String(Math.floor(travel)).padStart(4,'0')+' km';$('status').textContent=mode==='playing'?(Math.sin(time*.12)>.2?'BELT ACTIVITY HIGH':'RECOVERY WINDOW'):mode==='paused'?'FLIGHT PAUSED':'SYSTEMS READY';document.querySelector('.sector').innerHTML='<span>'+String(sector+1).padStart(2,'0')+'</span> / '+sectors[sector][0];$('message').style.opacity=msgTime>0?1:0;}
function update(dt){time+=dt;travel+=dt*12;sectorTime+=dt;const nextSector=Math.floor(time/38)%4;if(nextSector!==sector){sector=nextSector;sectorTime=0;announce(sectors[sector][0]+(sector%2?' · SURFACE BATTERIES AHEAD':' · ENTERING DEEP SPACE'));spawn=Math.max(spawn,2)}ground+=( (sector%2?1:0)-ground)*Math.min(1,dt*.65);const floor=H-32-ground*87;ship.inv=Math.max(0,ship.inv-dt);ship.vx+=( ((keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0))*(ship.lateral?330:0)-ship.vx)*Math.min(1,dt*10);ship.vy+=(((keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0))*340-ship.vy)*Math.min(1,dt*10);ship.x=clamp(ship.x+ship.vx*dt,45,W*.48);ship.y=clamp(ship.y+ship.vy*dt,62,floor-25);ship.tilt+=(ship.vy*.00065-ship.tilt)*dt*9;if(time-ship.lastHit>4)ship.shield=Math.min(100,ship.shield+dt*7);fire-=dt;if(keys.has('Space')&&fire<=0){shoot();fire=special?.type===3?.1:.17}if(special){special.cool=Math.max(0,special.cool-dt);if(special.type===3){special.remaining-=dt;if(special.remaining<=0){special=null;announce('OVERDRIVE EXPIRED · PRIMARY RESTORED')}}}
spawn-=dt;const intensity=Math.sin(time*.12)>.2?1:.58;if(spawn<=0){const r=rand(18,55),mat=time<76?0:Math.random()<.55?Math.floor(rand(0,3)):0;rocks.push(rock(W+r,rand(90,floor-70),r,mat));spawn=rand(.65,1.5)/intensity/Math.min(2,1+time/220)}turretSpawn-=dt;if(sector%2&&ground>.8&&turretSpawn<=0){const type=['cannon','rocket','laser'][unitSequence++%3];turrets.push(makeUnit(W+45,floor-26,type));turretSpawn=rand(1.8,3.0)/intensity}pickupTimer-=dt;if(pickupTimer<=0){packs.push({x:W+25,y:rand(120,floor-100),type:pickupOrder[pickupIndex++%pickupOrder.length],a:0});pickupTimer=rand(15,21)}
for(const p of packs){p.x-=120*dt;p.a+=dt;if(hyp(p.x-ship.x,p.y-ship.y)<35)collect(p)}packs=packs.filter(p=>!p.dead&&p.x>-40);
updateUnits(dt,floor);
for(const a of rocks){a.age+=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;a.a+=a.spin*dt;a.hit=Math.max(0,a.hit-dt);if(a.y<a.r+48){a.y=a.r+48;a.vy=Math.abs(a.vy)}if(a.y>floor-a.r){a.y=floor-a.r;a.vy=-Math.abs(a.vy)*.8}if(a.x+a.r<0&&!a.dodge){a.dodge=true;addScore(a.budget*.08)}if(hyp(a.x-ship.x,a.y-ship.y)<a.r*.85+12){damage(clamp(a.r*.6+hyp(a.vx-ship.vx,a.vy-ship.vy)*.03,12,65));a.vx+=100;a.vy+=(a.y>ship.y?1:-1)*90}}
for(let i=0;i<rocks.length;i++)for(let j=i+1;j<rocks.length;j++){const a=rocks[i],b=rocks[j];if(a.dead||b.dead||a.age<0||b.age<0)continue;let dx=b.x-a.x,dy=b.y-a.y,d=hyp(dx,dy),min=(a.r+b.r)*.86;if(d<min&&d>.1){let nx=dx/d,ny=dy/d,overlap=min-d;a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;let v=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(v<0){let m1=a.r*a.r,m2=b.r*b.r,imp=-1.7*v/(1/m1+1/m2);a.vx-=imp*nx/m1;a.vy-=imp*ny/m1;b.vx+=imp*nx/m2;b.vy+=imp*ny/m2;a.spin+=ny*.3;b.spin-=ny*.3;if(v< -25)burst((a.x+b.x)/2,(a.y+b.y)/2,4,'#a7c3cf',70)}}}
for(const b of shots){if(b.kind){advanceSpecialShot(b,dt);continue}const ox=b.x,oy=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;for(const a of rocks){if(a.dead||b.life<=0)continue;const dx=b.x-ox,dy=b.y-oy,den=dx*dx+dy*dy,u=clamp(((a.x-ox)*dx+(a.y-oy)*dy)/(den||1),0,1);if(hyp(a.x-(ox+u*dx),a.y-(oy+u*dy))<a.r*.9+3){b.life=0;a.hp-=b.power;a.vx+=b.vx*.025;a.vy+=b.vy*.025;a.spin+=(b.y-a.y)*.007;a.hit=.1;burst(b.x,b.y,7,colors[a.mat],120);if(a.hp<=0)breakRock(a)}}for(const t of turrets)if(!t.dead&&b.life>0&&hyp(t.x-b.x,t.y-b.y)<25){b.life=0;t.hp-=b.power;t.hit=.15;burst(b.x,b.y,8,'#ffa892',100);if(t.hp<=0)destroyTurret(t)}}
updateHostiles(dt);shots=shots.filter(b=>b.life>0&&b.x>-30&&b.x<W+70&&b.y>-30&&b.y<H+30);rocks=rocks.filter(a=>!a.dead&&a.x>-a.r*3&&a.x<W+400);
for(const c of clouds){c.life-=dt;c.x+=c.vx*dt;c.r+=dt*5;if(!c.claimed&&hyp(c.x-ship.x,c.y-ship.y)<c.r){c.claimed=true;addScore(3);texts.push({x:ship.x,y:ship.y-25,text:'+3 STARDUST',life:1});ship.dust=.35}}clouds=clouds.filter(c=>c.life>0);if(ship.dust)ship.dust=Math.max(0,ship.dust-dt);for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.vx*=Math.exp(-dt*2);p.vy*=Math.exp(-dt*2)}particles=particles.filter(p=>p.life>0);for(const r of rings){r.life-=dt;r.r+=(r.max-r.r)*dt*6}rings=rings.filter(r=>r.life>0);for(const t of texts){t.y-=20*dt;t.life-=dt}texts=texts.filter(t=>t.life>0);playerBeams=playerBeams.filter(beam=>(beam.life-=dt)>0);groundShake*=Math.exp(-dt*4.5);shake*=Math.exp(-dt*9);flash=Math.max(0,flash-dt);msgTime=Math.max(0,msgTime-dt);sync()}
// Cinematic matte paintings; simulation and collision geometry remain independent.
const backdrops=typeof Image==='undefined'?[]:['orbit','mars','orbit','venus'].map(name=>{const i=new Image();i.src=name+'.png';return i});
function drawBackdrop(shakeX=0,shakeY=0){
  const paint=(i,alpha)=>{const image=backdrops[i];if(!image?.complete||!image.naturalWidth)return;ctx.save();ctx.globalAlpha=alpha;const scale=Math.max(W/image.width,H/image.height)*1.06,w=image.width*scale,h=image.height*scale;const drift=Math.sin(travel*.0007)*W*.015;ctx.drawImage(image,(W-w)/2+drift+shakeX,(H-h)/2+shakeY,w,h);ctx.restore()};
  const mix=Math.min(1,sectorTime/3);if(time<3){paint(0,1)}else{paint((sector+3)%4,1);paint(sector,mix)}ctx.fillStyle='rgba(2,8,16,.24)';ctx.fillRect(0,0,W,H);
}
function groundAudio(type,x){if(time-lastGroundSound<.075)return;lastGroundSound=time;const dist=clamp(1-Math.abs(x-ship.x)/1500,.25,1);if(type==='charge')audio(140,.45,'sine',.007*dist,650);else if(type==='laser')audio(900,.22,'sawtooth',.009*dist,120);else if(type==='rocket')audio(85,.3,'sawtooth',.012*dist,28);else if(type==='impact')audio(55,.16,'triangle',.009*dist,25);else audio(160,.075,'square',.007*dist,45)}
function makeUnit(x,y,type){const hp=type==='laser'?3:type==='rocket'?2:time>114?3:1;return {x,y,type,hp,maxHp:hp,timer:rand(1.2,2),hit:0,aim:Math.PI,charge:0,beam:0,beamTick:0,burst:0,burstTimer:0,recoil:0}}
// Earliest intersection along a segment. All enemy weapons share the same asteroid collision rules.
function segmentHit(x1,y1,x2,y2,cx,cy,r){const dx=x2-x1,dy=y2-y1,fx=x1-cx,fy=y1-cy,a=dx*dx+dy*dy;if(fx*fx+fy*fy<=r*r)return 0;if(a<1e-9)return Infinity;const b=2*(fx*dx+fy*dy),c=fx*fx+fy*fy-r*r,disc=b*b-4*a*c;if(disc<0)return Infinity;const t=(-b-Math.sqrt(disc))/(2*a);return t>=0&&t<=1?t:Infinity}
function launchUnit(t,type,offset=0){const a=t.aim+offset,speed=type==='rocket'?175:300;hostile.push({x:t.x+Math.cos(a)*29,y:t.y+Math.sin(a)*29,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life:6,type,age:0,deflected:false});t.recoil=1;burst(t.x+Math.cos(a)*32,t.y+Math.sin(a)*32,type==='rocket'?9:5,type==='rocket'?'#f6c086':'#f8d39f',90);groundAudio(type,t.x)}
function fireBeam(t){const x2=t.x+Math.cos(t.aim)*1500,y2=t.y+Math.sin(t.aim)*1500;let first=1,rockHit=null;for(const a of rocks){if(a.dead)continue;const hit=segmentHit(t.x,t.y,x2,y2,a.x,a.y,a.r*.9+3);if(hit<first){first=hit;rockHit=a}}t.endX=t.x+(x2-t.x)*first;t.endY=t.y+(y2-t.y)*first;
  if(t.beamTick<=0){t.beamTick=.14;const shipHit=segmentHit(t.x,t.y,x2,y2,ship.x,ship.y,16);if(shipHit<first)damage(34);if(rockHit){rockHit.hp-=3;rockHit.hit=.12;burst(t.endX,t.endY,8,'#ffc3a4',120);if(rockHit.hp<=0)breakRock(rockHit,false)}}
}
function updateUnits(dt,floor){for(const t of turrets){t.x-=100*dt;t.y=floor-26;t.timer-=dt;t.hit=Math.max(0,t.hit-dt);t.recoil=Math.max(0,t.recoil-dt*7);const desired=Math.atan2(ship.y-t.y,ship.x-t.x);if(!t.beam&&t.charge<.01||t.charge>.35)t.aim=desired;
  if(t.charge>0){t.charge-=dt;if(t.charge<=0){t.beam=.48;t.beamTick=0;groundAudio('laser',t.x);shake=Math.max(shake,2)}}
  if(t.beam>0){t.beam-=dt;t.beamTick-=dt;fireBeam(t)}
  if(t.burst>0){t.burstTimer-=dt;if(t.burstTimer<=0){launchUnit(t,'shell',(t.burst-2)*.035);t.burst--;t.burstTimer=.17}}
  if(t.timer<=0&&t.x>ship.x+60&&t.x<W-35){if(t.type==='laser'){t.charge=1.1;t.timer=4.8;groundAudio('charge',t.x)}else if(t.type==='rocket'){launchUnit(t,'rocket',-.07);launchUnit(t,'rocket',.07);t.timer=3.9}else{t.burst=3;t.burstTimer=0;t.timer=2.7}}
  if(hyp(ship.x-t.x,ship.y-t.y)<35){damage(40);t.x-=15}}
  turrets=turrets.filter(t=>!t.dead&&t.x>-60&&ground>.25);
}
function rocketBlast(b){ring(b.x,b.y,'#ffba79',65);burst(b.x,b.y,18,'#ffc68f',160);groundAudio('impact',b.x);shake=Math.max(shake,3);for(const a of [...rocks])if(!a.dead&&hyp(a.x-b.x,a.y-b.y)<a.r+44){a.hp-=2;a.hit=.1;if(a.hp<=0)breakRock(a,false)}if(!b.deflected&&hyp(ship.x-b.x,ship.y-b.y)<55)damage(28)}
function updateHostiles(dt){for(const b of hostile){const ox=b.x,oy=b.y;b.age=(b.age||0)+dt;if(b.type==='rocket'&&!b.deflected&&b.age<1.1){let a=Math.atan2(b.vy,b.vx),target=Math.atan2(ship.y-b.y,ship.x-b.x),diff=Math.atan2(Math.sin(target-a),Math.cos(target-a));a+=clamp(diff,-dt*.7,dt*.7);const speed=Math.min(310,hyp(b.vx,b.vy)+dt*90);b.vx=Math.cos(a)*speed;b.vy=Math.sin(a)*speed}b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
  let first=Infinity,hitRock=null;for(const a of rocks){if(a.dead)continue;const hit=segmentHit(ox,oy,b.x,b.y,a.x,a.y,a.r*.9+3);if(hit<first){first=hit;hitRock=a}}
  const sh=b.deflected?Infinity:segmentHit(ox,oy,b.x,b.y,ship.x,ship.y,18);
  if(sh<first){b.x=ox+(b.x-ox)*sh;b.y=oy+(b.y-oy)*sh;damage(b.type==='rocket'?28:20);b.life=0;if(b.type==='rocket')rocketBlast(b)}else if(hitRock){b.x=ox+(b.x-ox)*first;b.y=oy+(b.y-oy)*first;b.life=0;hitRock.hp-=b.type==='rocket'?2:1;hitRock.hit=.1;hitRock.vx+=b.vx*.025;hitRock.vy+=b.vy*.025;burst(b.x,b.y,6,'#ffc68f',110);if(hitRock.hp<=0)breakRock(hitRock,false);if(b.type==='rocket')rocketBlast(b)}
  if(b.deflected&&b.life>0)for(const t of turrets)if(!t.dead&&segmentHit(ox,oy,b.x,b.y,t.x,t.y,28)<Infinity){b.life=0;t.hp-=2;if(t.hp<=0)destroyTurret(t)}}hostile=hostile.filter(b=>b.life>0&&b.x>-60&&b.x<W+100&&b.y>-60&&b.y<H+30);
}
function pixelRect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
function drawDetailedUnit(t){ctx.save();ctx.translate(Math.round(t.x),Math.round(t.y));const accent=t.type==='laser'?'#a9dfed':t.type==='rocket'?'#e4b779':'#c8cab7';
  // Caterpillar tread, road wheels, armor skirts, suspension and access panel rivets.
  pixelRect(-33,12,66,14,'#0b131b');pixelRect(-30,10,60,4,'#82909a');pixelRect(-29,23,58,3,'#364351');for(let x=-25;x<30;x+=10){pixelRect(x,14,7,7,'#596570');pixelRect(x+2,16,3,3,'#171f28')}for(let x=-31;x<32;x+=6){pixelRect(x,11,3,2,'#a8ac9e');pixelRect(x,24,3,2,'#777d79')}
  path([[-30,10],[-23,-3],[20,-3],[31,10]],t.hit?'#ece4c8':'#48545e','#a2b0b2',1);pixelRect(-23,1,45,8,'#596570');pixelRect(-19,3,14,4,'#202e39');for(let x=0;x<19;x+=4)pixelRect(x,2,2,5,'#283844');for(let x=-23;x<25;x+=11)pixelRect(x,8,2,2,'#c8c8b0');pixelRect(23,3,3,3,'#ff9b72');pixelRect(-26,-4,4,5,accent);
  ctx.save();ctx.translate(0,-5);ctx.rotate(t.aim);ctx.translate(-t.recoil*4,0);
  if(t.type==='rocket'){pixelRect(-10,-14,32,28,'#26313c');pixelRect(-7,-12,28,24,'#7b7866');for(let row=-8;row<=8;row+=8){pixelRect(10,row-2,14,5,'#121d27');pixelRect(10,row-2,3,5,'#a5a793');pixelRect(-4,row-2,12,4,'#b8ad87')}pixelRect(-9,-14,30,2,'#d2c6a0')}
  else if(t.type==='laser'){pixelRect(-13,-11,25,22,'#3a5967');pixelRect(-11,-9,21,3,'#a3b7be');pixelRect(6,-6,29,12,'#273f50');for(let x=9;x<30;x+=5)pixelRect(x,-8,3,16,'#83c9d3');pixelRect(31,-4,7,8,t.charge>0?'#fff6bd':'#b1f2ed');pixelRect(-6,-5,8,10,'#81bac1')}
  else{path([[-16,-11],[8,-10],[14,-5],[14,7],[-13,10]],'#65716e','#c1c4a9',1);pixelRect(8,-4,29,8,'#394b56');pixelRect(12,-4,22,2,'#b2c4c4');pixelRect(33,-6,9,12,'#657c85');pixelRect(40,-3,3,6,'#101e29');pixelRect(-9,-6,7,4,'#8d9b83')}
  ctx.restore();pixelRect(10,-19,2,15,'#a3b7af');pixelRect(9,-21,4,3,t.type==='laser'?'#9df0ea':'#f4ae75');for(let i=0;i<t.maxHp;i++)pixelRect(-9+i*7,29,5,2,i<t.hp?accent:'#333d45');
  if(t.charge>0){ctx.strokeStyle='#ffc27e';ctx.globalAlpha=.55;ctx.setLineDash([7,10]);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(t.aim)*1500,Math.sin(t.aim)*1500);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;ctx.fillStyle='#fff1ba';ctx.beginPath();ctx.arc(Math.cos(t.aim)*35,Math.sin(t.aim)*35,3+(1.1-t.charge)*5,0,TAU);ctx.fill()}
  ctx.restore();if(t.beam>0){ctx.save();ctx.strokeStyle='#ff795666';ctx.lineWidth=13;ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(t.endX,t.endY);ctx.stroke();ctx.strokeStyle='#fff1be';ctx.lineWidth=3;ctx.stroke();ctx.restore()}}
function drawDetailedRock(a){ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.a);const palette=a.mat===1?['#234751','#6aabb6','#b8f3ec']:a.mat===2?['#393a4e','#797790','#c1bacf']:['#423e3d','#82766a','#c0b39c'];const pts=a.shape.map((v,i)=>[Math.cos(i*TAU/10)*a.r*v,Math.sin(i*TAU/10)*a.r*v]);path(pts,a.hit?'#ccecf0':palette[0],palette[1],1.5);for(let i=0;i<10;i++){const next=pts[(i+1)%10];path([pts[i],next,[a.r*.08,-a.r*.06]],i%3===0?palette[1]+'66':i%3===1?'#00000033':null,null)}
  for(let i=0;i<5;i++){const ang=i*2.4+1,r=a.r*(.15+(i%3)*.15),x=Math.cos(ang)*r,y=Math.sin(ang)*r,cr=a.r*(.09+(i%2)*.035);ctx.fillStyle=palette[0];ctx.strokeStyle=palette[1];ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x,y,cr*1.2,cr,.4,0,TAU);ctx.fill();ctx.stroke();pixelRect(x-cr/2,y+cr/2,2,2,palette[2])}
  if(a.mat===1)path([[-a.r*.4,0],[0,-a.r*.5],[a.r*.25,0],[0,a.r*.5]],'#71e4d544','#a4fff0',1);if(a.mat===2){ctx.strokeStyle='#b9a3ce';ctx.beginPath();ctx.moveTo(-a.r*.6,0);ctx.lineTo(0,a.r*.25);ctx.lineTo(a.r*.5,-a.r*.3);ctx.stroke()}ctx.restore()}
function drawDetailedShip(s){ctx.save();ctx.translate(s.x,s.y+(s.dust?Math.sin(time*100)*2:0));ctx.rotate(s.tilt);ctx.globalAlpha=s.inv>0?.55+Math.sin(time*24)*.35:1;
  path([[-19,-5],[-40-rand(0,13),0],[-19,5]],'#5ce6df55','#8dfaf0',1);pixelRect(-31,-2,14,4,'#ddfff5');
  path([[-17,-8],[-24,-23],[-4,-15],[10,-4]],'#465965','#b5c4c2',1);path([[-17,8],[-24,23],[-4,15],[10,4]],'#394853','#8b9c9f',1);pixelRect(-19,-20,9,3,'#ddad7d');pixelRect(-19,18,9,3,'#d3926e');
  path([[28,0],[12,-5],[-8,-9],[-22,-5],[-20,5],[-8,9],[12,5]],'#8da2a6','#e7e7cf',1);path([[25,0],[-16,0],[-18,5],[-7,8],[12,4]],'#4e6979',null);path([[9,-4],[-2,-6],[-9,-3],[-2,0],[12,0]],'#65c5d8','#d4f6ef',1);pixelRect(-19,-5,4,10,'#2f4654');for(let x=-15;x<-5;x+=3)pixelRect(x,2,1,4,'#263c49');pixelRect(13,-2,12,2,'#f4edcf');pixelRect(-11,-13,17,3,'#a0b5b6');pixelRect(-11,11,17,3,'#637f8f');pixelRect(4,-13,6,2,'#e0e1c0');pixelRect(4,12,6,2,'#e0e1c0');if(level>1){pixelRect(-17,-25,14,3,'#8ca7b4');pixelRect(-17,23,14,3,'#8ca7b4')}
  if(s.inv>0){ctx.strokeStyle='#7ee9df66';ctx.beginPath();ctx.arc(0,0,34,0,TAU);ctx.stroke()}ctx.restore()}
function drawEnemyAmmo(){for(const b of hostile){ctx.save();ctx.translate(b.x,b.y);ctx.rotate(Math.atan2(b.vy,b.vx));if(b.type==='rocket'){path([[-8,-3],[4,-3],[10,0],[4,3],[-8,3]],'#b5bbad','#ece4bf',1);pixelRect(-6,-5,4,2,'#a57558');pixelRect(-6,3,4,2,'#a57558');path([[-8,-2],[-21-rand(0,8),0],[-8,2]],'#ffb96c','#ffdb95',1)}else{ctx.strokeStyle=b.deflected?'#7ee9df':'#ffbd7f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(4,0);ctx.stroke();pixelRect(1,-1,4,2,'#fff8c7')}ctx.restore()}}

function path(points,fill,stroke,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}}
function draw(dt){ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#060d18';ctx.fillRect(0,0,W,H);const palette=sectors[sector];let neb=ctx.createRadialGradient(W*.72,H*.35,5,W*.7,H*.35,W*.65);neb.addColorStop(0,palette[1]);neb.addColorStop(1,'#060d18');ctx.fillStyle=neb;ctx.fillRect(0,0,W,H);for(const s of stars){if(mode==='playing'||mode==='ready'){s.x-=dt*(12+s.z*35);if(s.x<0)s.x=W}s.y=clamp(s.y,0,H);ctx.globalAlpha=s.z*.7;ctx.fillStyle='#c8e6f2';ctx.fillRect(s.x,s.y,s.r,s.r)}ctx.globalAlpha=1;
const impact=mode==='playing'&&!reducedMotion.matches?Math.max(shake,groundShake):0;
const shakeX=Math.sin(time*91)*impact,shakeY=Math.sin(time*113)*impact*.72;
drawBackdrop(shakeX*.6,shakeY*.6);
ctx.save();ctx.translate(shakeX,shakeY);
if(ground>.01){ctx.globalAlpha=ground*.5;const base=H-32-ground*87;for(let layer=0;layer<2;layer++){let pts=[[0,H]];for(let x=0;x<=W+40;x+=25){const v=x+travel*(layer?2:1);pts.push([x,base+25-layer*5-Math.sin(v*.008)*14-Math.sin(v*.023)*8])}pts.push([W,H]);path(pts,layer?'#171e2b':'#302a3a',layer?'#56636c':'#55505f')}ctx.fillStyle=sector===1?'rgba(69,36,24,.48)':'rgba(48,42,23,.48)';ctx.fillRect(0,base+5,W,H-base);for(let n=0;n<110;n++){const x=(n*97-travel*8%W+W)%W,y=base+12+(n*23)%85;pixelRect(x,y,2+n%4,1+n%2,sector===1?'#9a66554d':'#a3925e4d')}ctx.strokeStyle=palette[2]+'77';ctx.setLineDash([4,10]);ctx.beginPath();ctx.moveTo(0,base-7);ctx.lineTo(W,base-7);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1}
for(const c of clouds){ctx.globalAlpha=c.life/3.8*.22;let g=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,c.r);g.addColorStop(0,c.col);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(c.x,c.y,c.r,0,TAU);ctx.fill();ctx.globalAlpha=1}
for(const a of rocks)drawDetailedRock(a);
for(const t of turrets)drawDetailedUnit(t);
for(const p of packs){ctx.save();ctx.translate(p.x,p.y+Math.sin(p.a*3)*4);ctx.shadowColor='#d7ff80';ctx.shadowBlur=15;path([[0,-19],[19,0],[0,19],[-19,0]],'#1b2f26','#d7ff80',1.5);ctx.shadowBlur=0;ctx.fillStyle='#d7ff80';ctx.textAlign='center';ctx.font='bold 13px monospace';ctx.fillText(specialIcons[p.type],0,5);ctx.font='9px monospace';ctx.fillText(specialNames[p.type],0,36);ctx.restore()}
ctx.lineCap='round';for(const b of shots){if(b.kind){drawSpecialShot(b);continue}ctx.strokeStyle=b.col;ctx.shadowColor=b.col;ctx.shadowBlur=8;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x-b.vx*.014,b.y-b.vy*.014);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.shadowBlur=0;drawPlayerBeams();drawEnemyAmmo();
drawDetailedShip(ship||{x:145,y:330,tilt:0,inv:0,shield:100});
for(const p of particles){ctx.globalAlpha=clamp(p.life/.5,0,1);ctx.fillStyle=p.col;ctx.fillRect(p.x,p.y,p.r,p.r)}ctx.globalAlpha=1;for(const r of rings){ctx.globalAlpha=r.life/.6;ctx.strokeStyle=r.col;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,TAU);ctx.stroke()}ctx.globalAlpha=1;for(const t of texts){ctx.globalAlpha=t.life;ctx.fillStyle='#b4d8ca';ctx.font='10px monospace';ctx.fillText(t.text,t.x,t.y)}ctx.globalAlpha=1;ctx.restore();if(flash>0){ctx.fillStyle='rgba(255,108,90,'+flash*.5+')';ctx.fillRect(0,0,W,H)}}
let last=performance.now(),acc=0;function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;if(mode==='playing'){acc+=dt;while(acc>=1/120){update(1/120);acc-=1/120;if(mode!=='playing'){acc=0;break}}}else acc=0;draw(dt);requestAnimationFrame(frame)}requestAnimationFrame(frame);
// Deterministic hooks for local mechanics checks; no user-facing cheats or remote dependencies.
if(location.hostname==='localhost')window.__starfall={start,update,addScore,damage,useSpecial,collect,breakRock,rock,getState:()=>({mode,score,lives,level,ship,special,rocks,sector,time,turrets,hostile,shots,playerBeams,groundShake}),addRock:a=>rocks.push(a),makeUnit,updateUnits,updateHostiles,segmentHit,addUnit:t=>turrets.push(t),addHostile:b=>hostile.push(b)};
})();
