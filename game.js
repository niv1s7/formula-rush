(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const map = document.getElementById('map');
  const mctx = map.getContext('2d');
  const W = 1200, H = 720, ROAD = 98, TOTAL_LAPS = 3;
  const $ = id => document.getElementById(id);
  const keys = new Set();
  const colors = ['#e75a3f','#66b7ff','#d9d650'];
  const TAU = Math.PI * 2;
  const point = t => {
    const a = t * TAU;
    return {x:600 + 418 * Math.cos(a) + 18 * Math.sin(3*a), y:360 + 225 * Math.sin(a) + 22 * Math.sin(2*a)};
  };
  const samples = Array.from({length:721},(_,i)=>point(i/720));
  const racers = [0,1,2].map((n)=>({t:(0.946 + n*.018)%1, speed:0.000045 + n*0.000001, color:colors[n], name:['NOVA','VECTOR','KITE'][n]}));
  const car = {x:point(.972).x,y:point(.972).y,angle:Math.atan2(point(.973).y-point(.971).y,point(.973).x-point(.971).x),speed:0,boost:100,progress:.972,prevProgress:.972,lap:0,lapStart:0,best:Infinity,lapTimes:[],offroad:false};
  let state='ready', last=performance.now(), raceElapsed=0, scale=1, ox=0, oy=0, animation=0, countdownTimer=0;

  function resize(){
    const dpr=Math.min(devicePixelRatio||1,2), r=canvas.getBoundingClientRect();
    canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    scale=Math.min(r.width/W,r.height/H);ox=(r.width-W*scale)/2;oy=(r.height-H*scale)/2;
    drawMap();
  }
  function drawTrack(c, roadWidth, curbWidth, showDash=true){
    c.save();c.lineJoin='round';c.lineCap='round';c.beginPath();
    samples.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();
    c.strokeStyle='#f1eee0';c.lineWidth=roadWidth+curbWidth;c.stroke();
    c.setLineDash([22,22]);c.lineDashOffset=0;c.strokeStyle='#e64d3d';c.lineWidth=roadWidth+curbWidth;c.stroke();c.setLineDash([]);
    c.strokeStyle='#30362f';c.lineWidth=roadWidth;c.stroke();
    c.strokeStyle='#353e31';c.lineWidth=roadWidth-8;c.stroke();
    if(showDash){c.setLineDash([9,15]);c.strokeStyle='#6d7767';c.lineWidth=2;c.stroke();c.setLineDash([]);}
    c.restore();
  }
  function drawMap(){
    const c=mctx,w=map.width,h=map.height;c.clearRect(0,0,w,h);c.fillStyle='#171d15';c.fillRect(0,0,w,h);
    c.save();c.translate(12,10);c.scale((w-24)/W,(h-20)/H);drawTrack(c,36,4,false);
    const s=point(0);c.fillStyle='#c1f26a';c.fillRect(s.x-2,s.y-21,4,42);
    racers.forEach(r=>{const p=point(r.t);c.fillStyle=r.color;c.beginPath();c.arc(p.x,p.y,12,0,TAU);c.fill();});
    c.fillStyle='#c1f26a';c.beginPath();c.arc(car.x,car.y,15,0,TAU);c.fill();c.restore();
  }
  function nearest(p){
    let best=Infinity,bestI=0,bestX=0,bestY=0;
    for(let i=0;i<samples.length-1;i++){
      const a=samples[i],b=samples[i+1],dx=b.x-a.x,dy=b.y-a.y;
      const f=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
      const x=a.x+dx*f,y=a.y+dy*f,d=(p.x-x)**2+(p.y-y)**2;
      if(d<best){best=d;bestI=i;bestX=x;bestY=y;}
    }
    return {distance:Math.sqrt(best),t:bestI/(samples.length-1),x:bestX,y:bestY};
  }
  function format(ms){if(!Number.isFinite(ms)||ms<0)return '--:--.---';const m=Math.floor(ms/60000),s=Math.floor(ms/1000)%60,th=Math.floor(ms%1000);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(th).padStart(3,'0')}`;}
  function setMessage(text,show=true){$('flagText').textContent=text;$('flagMessage').style.display=show?'block':'none';}
  function begin(){if(state==='racing'||state==='countdown')return;reset(false);state='countdown';$('sessionStatus').textContent='GET READY';$('countdown').classList.add('show');let n=3;$('countdown').textContent=n;const tick=()=>{if(state!=='countdown')return;if(n>1){n--;$('countdown').textContent=n;countdownTimer=setTimeout(tick,700);}else{$('countdown').textContent='GO!';countdownTimer=setTimeout(()=>{$('countdown').classList.remove('show');state='racing';$('sessionStatus').textContent='RACING';setMessage('',false);},550);}};countdownTimer=setTimeout(tick,650);}
  function reset(show=true){clearTimeout(countdownTimer);Object.assign(car,{x:point(.972).x,y:point(.972).y,angle:Math.atan2(point(.973).y-point(.971).y,point(.973).x-point(.971).x),speed:0,boost:100,progress:.972,prevProgress:.972,lap:0,lapStart:0,best:Infinity,lapTimes:[],offroad:false});racers.forEach((r,i)=>r.t=(.946+i*.018)%1);raceElapsed=0;state='ready';$('finishOverlay').classList.remove('show');$('countdown').classList.remove('show');$('sessionStatus').textContent='READY';$('lapValue').innerHTML='— <small>/ 3</small>';$('bestLap').textContent='--:--.---';$('raceTime').textContent='00:00.000';$('lapTime').innerHTML='LAP TIME&nbsp;&nbsp; --:--.---';$('positionValue').innerHTML='P4 <small>/ 4</small>';setMessage('PRESS ENTER TO START',show);$('speedValue').textContent='000';$('gearValue').textContent='N';$('progressFill').style.width='0%';$('progressValue').textContent='0%';drawMap();render();}
  function step(dt){
    if(state==='racing'){
      raceElapsed+=dt;
      const forward=keys.has('ArrowUp')||keys.has('w'),back=keys.has('ArrowDown')||keys.has('s'),left=keys.has('ArrowLeft')||keys.has('a'),right=keys.has('ArrowRight')||keys.has('d'),boost=(keys.has('Shift')||keys.has(' '))&&car.boost>0&&forward;
      const grip=car.offroad?.58:1;
      const accel=forward?310:0,brake=back?470:0;
      car.speed+= (accel-brake-(forward||back?0:car.speed*1.3))*dt/1000;
      car.speed=Math.max(0,Math.min(boost?505:365,car.speed));
      car.boost=Math.max(0,Math.min(100,car.boost+(boost?-26:10)*dt/1000));
      const steer=(right?1:0)-(left?1:0);
      car.angle+=steer*(0.0018+Math.min(car.speed/365,1)*.0034)*dt*grip*(car.speed>8?1:0);
      car.x+=Math.cos(car.angle)*car.speed*dt/1000;car.y+=Math.sin(car.angle)*car.speed*dt/1000;
      const near=nearest(car);car.offroad=near.distance>ROAD*.47;
      if(car.offroad){car.speed=Math.max(35,car.speed-115*dt/1000);}
      const old=car.progress;car.prevProgress=old;car.progress=near.t;
      if(old>.91&&car.progress<.09){
        const elapsed=raceElapsed-car.lapStart;car.lapTimes.push(elapsed);car.best=Math.min(car.best,elapsed);car.lapStart=raceElapsed;car.lap++;
        if(car.lap>=TOTAL_LAPS){finish();}
      }
      racers.forEach(r=>{r.t=(r.t+r.speed*dt)%1;});
      const place=1+racers.filter(r=>r.t>car.progress).length;
      $('positionValue').innerHTML=`P${place} <small>/ 4</small>`;
      $('lapValue').innerHTML=`${Math.min(car.lap+1,TOTAL_LAPS)} <small>/ ${TOTAL_LAPS}</small>`;
      $('raceTime').textContent=format(raceElapsed);
      $('lapTime').innerHTML=`LAP TIME&nbsp;&nbsp; ${format(raceElapsed-car.lapStart)}`;
      $('bestLap').textContent=format(car.best);
      $('speedValue').textContent=String(Math.round(car.speed*.92)).padStart(3,'0');
      $('gearValue').textContent=car.speed<3?'N':String(Math.min(8,Math.max(1,Math.floor(car.speed/48)+1)));
      $('boostBar').style.width=`${car.boost}%`;
      $('progressFill').style.width=`${Math.min(100,car.progress*100)}%`;
      $('progressValue').textContent=`${Math.floor(car.progress*100)}%`;
    }
    render();
  }
  function drawCar(c,x,y,angle,color,isPlayer=false){
    c.save();c.translate(x,y);c.rotate(angle);c.shadowColor='#000';c.shadowBlur=isPlayer?12:8;c.shadowOffsetY=4;
    c.fillStyle='#11140f';c.fillRect(-14,-16,9,8);c.fillRect(5,-16,9,8);c.fillRect(-14,8,9,8);c.fillRect(5,8,9,8);
    c.beginPath();c.moveTo(23,0);c.lineTo(12,-5);c.lineTo(4,-7);c.lineTo(-10,-6);c.lineTo(-15,-10);c.lineTo(-19,-10);c.lineTo(-17,-4);c.lineTo(-14,0);c.lineTo(-17,4);c.lineTo(-19,10);c.lineTo(-15,10);c.lineTo(-10,6);c.lineTo(4,7);c.lineTo(12,5);c.closePath();c.fillStyle=color;c.fill();c.shadowBlur=0;c.fillStyle='#171a16';c.beginPath();c.ellipse(3,0,7,4.2,0,0,TAU);c.fill();c.fillStyle='#d8ddd2';c.fillRect(-18,-2,4,4);c.restore();
  }
  function render(){
    const r=canvas.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
    ctx.fillStyle='#3e5b32';ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.14;ctx.strokeStyle='#a8bf88';ctx.lineWidth=1;for(let x=20;x<W;x+=44){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=12;y<H;y+=44){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}ctx.globalAlpha=1;
    // Infield details and a coastal run-off strip.
    ctx.fillStyle='#536f43';ctx.fillRect(410,326,112,72);ctx.fillStyle='#627d4a';ctx.fillRect(445,342,43,20);ctx.fillRect(456,369,53,13);
    ctx.fillStyle='#6c8960';ctx.globalAlpha=.55;ctx.beginPath();ctx.ellipse(600,693,220,32,0,0,TAU);ctx.fill();ctx.globalAlpha=1;
    drawTrack(ctx,ROAD,26,true);
    const start=point(0);const tangent=point(.002);const a=Math.atan2(tangent.y-start.y,tangent.x-start.x);ctx.save();ctx.translate(start.x,start.y);ctx.rotate(a);for(let i=0;i<8;i++){ctx.fillStyle=i%2?'#21251f':'#ecebdc';ctx.fillRect(-4,-ROAD/2+i*ROAD/8,8,ROAD/8);}ctx.restore();
    // Track-side boards.
    for(const t of [.11,.31,.52,.74,.86]){const p=point(t);ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#253021';ctx.fillRect(-18,-48,36,15);ctx.fillStyle='#dce2d1';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText('APEX',0,-38);ctx.restore();}
    racers.forEach((r,i)=>{const p=point(r.t);const ahead=point((r.t+.002)%1);drawCar(ctx,p.x,p.y,Math.atan2(ahead.y-p.y,ahead.x-p.x),r.color,false);});
    drawCar(ctx,car.x,car.y,car.angle,'#c1f26a',true);
    if(car.offroad&&state==='racing'){ctx.fillStyle='#ff543e';ctx.font='bold 12px monospace';ctx.fillText('OFF TRACK',car.x-35,car.y-27);}
    ctx.restore();drawMap();
  }
  function finish(){state='finished';$('sessionStatus').textContent='FINISHED';$('finishPosition').textContent=$('positionValue').textContent.split(' ')[0];$('finishBest').textContent=format(car.best);$('finishOverlay').classList.add('show');}
  window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key===' '?' ':e.key.toLowerCase());if(e.key==='Enter'&&state==='ready')begin();if(e.key.toLowerCase()==='r')reset();});
  window.addEventListener('keyup',e=>keys.delete(e.key===' '?' ':e.key.toLowerCase()));
  window.addEventListener('blur',()=>keys.clear());
  document.querySelectorAll('[data-control]').forEach(btn=>{const k={left:'a',right:'d',gas:'w',brake:'s'}[btn.dataset.control];const on=e=>{e.preventDefault();keys.add(k);btn.classList.add('pressed');if(state==='ready'&&k==='w')begin();};const off=e=>{e.preventDefault();keys.delete(k);btn.classList.remove('pressed');};btn.addEventListener('pointerdown',on);['pointerup','pointercancel','pointerleave'].forEach(ev=>btn.addEventListener(ev,off));});
  $('restartButton').addEventListener('click',()=>reset());$('raceAgain').addEventListener('click',()=>reset());
  function frame(now){const dt=Math.min(40,now-last);last=now;step(dt);animation=requestAnimationFrame(frame);}
  window.addEventListener('resize',resize);resize();reset();animation=requestAnimationFrame(frame);
})();

