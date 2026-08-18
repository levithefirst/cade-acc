/* ============================================================
   CADE OPS — audio.js
   100% procedural Web Audio. No external music asset or copyrighted
   recording. The music uses the existing AudioCore scheduler and obeys
   the user's sound preference at every stage.
   ============================================================ */

export const Haptics = {
  enabled:true,
  supported:typeof navigator!=="undefined"&&!!navigator.vibrate,
  pulse(pattern){if(!this.enabled||!this.supported)return;try{navigator.vibrate(pattern);}catch(e){}},
  graze(){this.pulse(8)},hit(){this.pulse([25,20,45])},dash(){this.pulse(10)},
  lifeLost(){this.pulse([30,25,30,25,60])},meltdown(){this.pulse([18,30,18,30,42])},
  finalWin(){this.pulse([15,15,15,15,15,15,60])},finalLose(){this.pulse([35,25,80])},
  boost(){this.pulse([10,10,10,10,25])}
};

export const AudioCore=(()=>{
  let ctx=null;
  function ensure(){
    if(ctx)return ctx;
    try{ctx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){ctx=null;}
    return ctx;
  }
  function unlock(){ensure();if(ctx&&ctx.state==="suspended")ctx.resume();}
  return{ensure,unlock,get ctx(){return ctx}};
})();

export const SFX=(()=>{
  let master=null,enabled=true;
  function ready(){
    const ctx=AudioCore.ensure();if(!ctx)return null;
    if(!master){master=ctx.createGain();master.gain.value=.30;master.connect(ctx.destination);}
    return ctx;
  }
  function tone(freq,dur,type,gain,glideTo){
    if(!enabled)return;const ctx=ready();if(!ctx)return;
    const t0=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
    o.type=type;o.frequency.setValueAtTime(freq,t0);
    if(glideTo)o.frequency.exponentialRampToValueAtTime(Math.max(1,glideTo),t0+dur);
    g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(Math.max(.001,gain),t0+.008);g.gain.exponentialRampToValueAtTime(.0001,t0+dur);
    o.connect(g);g.connect(master);o.start(t0);o.stop(t0+dur+.02);
  }
  function noise(dur,gain){
    if(!enabled)return;const ctx=ready();if(!ctx)return;
    const n=Math.max(1,Math.floor(ctx.sampleRate*dur)),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const src=ctx.createBufferSource();src.buffer=buf;const g=ctx.createGain();g.gain.value=gain;src.connect(g);g.connect(master);src.start();
  }
  return{
    setEnabled(v){enabled=v},isEnabled(){return enabled},unlock(){AudioCore.unlock()},
    graze(multi){tone(420+Math.min(multi,15)*38,.08,"square",.16)},
    pump(){tone(660,.07,"triangle",.22);setTimeout(()=>tone(880,.09,"triangle",.20),40)},
    bigPump(){tone(660,.08,"triangle",.26);setTimeout(()=>tone(880,.08,"triangle",.24),40);setTimeout(()=>tone(1100,.13,"triangle",.22),80)},
    dash(){tone(180,.14,"sawtooth",.20,900)},
    hit(){noise(.16,.28);tone(120,.20,"square",.20,55)},
    lifeLost(){tone(85,.32,"square",.26,38)},
    streak(n){[660,880,1100].forEach((f,i)=>setTimeout(()=>tone(f,.08,"square",.18),i*55))},
    boost(){tone(440,.10,"sawtooth",.16,1400);setTimeout(()=>tone(900,.14,"triangle",.20),60)},
    tick(critical){tone(critical?880:660,.05,"square",critical?.20:.10)},
    win(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,.16,"triangle",.20),i*70))},
    lose(){noise(.28,.26);tone(110,.36,"sawtooth",.22,48)},
    ui(){tone(500,.05,"square",.13)}
  };
})();

export const Music=(()=>{
  let enabled=true,gain=null,playing=false,timerID=null;
  let bpm=146,stepDur=0,step16=0,barIndex=0,nextNoteTime=0,intensity="calm";
  const LOOKAHEAD_MS=25,SCHEDULE_AHEAD=.14;

  // Four original progressions. The rhythm section is deliberately denser
  // than the previous straight kick/bass loop, with a halftime snare layer,
  // syncopated bass and a small arcade lead. No external recording is used.
  const CHORDS=[
    [220,261.63,329.63],
    [196,246.94,293.66],
    [174.61,220,261.63],
    [196,246.94,311.13]
  ];
  const BASS=[55,55,65.41,73.42,55,55,65.41,82.41];
  const LEAD=[440,523.25,659.25,523.25,392,493.88,587.33,493.88];

  function ready(){
    const ctx=AudioCore.ensure();if(!ctx)return null;
    if(!gain){gain=ctx.createGain();gain.gain.value=.0001;gain.connect(ctx.destination)}
    return ctx;
  }
  function osc(ctx,freq,t,dur,type,peak,lp){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,peak),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    if(lp){const f=ctx.createBiquadFilter();f.type="lowpass";f.frequency.value=lp;o.connect(f);f.connect(g)}else{o.connect(g)}
    g.connect(gain);o.start(t);o.stop(t+dur+.02);
  }
  function kick(ctx,t,accent=false){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type="sine";o.frequency.setValueAtTime(accent?170:145,t);o.frequency.exponentialRampToValueAtTime(42,t+.11);
    g.gain.setValueAtTime(accent?1:.72,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(gain);o.start(t);o.stop(t+.17);
  }
  function snare(ctx,t,vol){
    const n=Math.floor(ctx.sampleRate*.085),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const src=ctx.createBufferSource();src.buffer=buf;const hp=ctx.createBiquadFilter();hp.type="highpass";hp.frequency.value=1800;const g=ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.085);
    src.connect(hp);hp.connect(g);g.connect(gain);src.start(t);
    osc(ctx,190,t,.055,"triangle",vol*.28,1100);
  }
  function hat(ctx,t,vol){
    const n=Math.floor(ctx.sampleRate*.028),buf=ctx.createBuffer(1,n,ctx.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const src=ctx.createBufferSource();src.buffer=buf;const f=ctx.createBiquadFilter();f.type="highpass";f.frequency.value=6500;const g=ctx.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.028);src.connect(f);f.connect(g);g.connect(gain);src.start(t);
  }
  function scheduleStep(step,t){
    const ctx=AudioCore.ctx,chord=CHORDS[barIndex%CHORDS.length],root=chord[0]/2;
    if(step%4===0)kick(ctx,t,step===0);
    if(step===4||step===12)snare(ctx,t,intensity==="meltdown"?.23:.18);
    if(step%2===1||intensity==="meltdown")hat(ctx,t,intensity==="meltdown"?.105:.065);

    const bass=BASS[(barIndex*2+Math.floor(step/2))%BASS.length];
    if(step%2===0||intensity==="meltdown")osc(ctx,bass,t,.16,"sawtooth",intensity==="calm"?.07:.13,900);
    if(intensity!=="calm"&&(step===3||step===7||step===11||step===15))osc(ctx,bass*2,t,.09,"square",.055,1600);

    if(intensity!=="calm"){
      const lead=LEAD[(barIndex*2+step)%LEAD.length];
      if(step%2===0||intensity==="meltdown")osc(ctx,lead,t,.095,"triangle",intensity==="meltdown"?.065:.035,2400);
      if(step%4===2)osc(ctx,chord[1],t,.13,"square",.028,1800);
    }
    if(step===15)barIndex++;
  }
  function scheduler(){
    const ctx=AudioCore.ctx;if(!ctx)return;
    while(nextNoteTime<ctx.currentTime+SCHEDULE_AHEAD){scheduleStep(step16,nextNoteTime);nextNoteTime+=stepDur;step16=(step16+1)%16}
    timerID=setTimeout(scheduler,LOOKAHEAD_MS);
  }
  return{
    setEnabled(v){enabled=v;if(!v)this.stop(.15)},isEnabled(){return enabled},setIntensity(level){intensity=level||"calm"},
    start(level){
      if(level)intensity=level;if(!enabled)return;const ctx=ready();if(!ctx)return;
      if(playing){gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setValueAtTime(gain.gain.value,ctx.currentTime);gain.gain.linearRampToValueAtTime(.46,ctx.currentTime+.35);return}
      stepDur=60/bpm/4;step16=0;barIndex=0;nextNoteTime=ctx.currentTime+.04;
      gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.linearRampToValueAtTime(.46,ctx.currentTime+.45);playing=true;scheduler();
    },
    duck(target){const ctx=AudioCore.ctx;if(!ctx||!gain)return;gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setValueAtTime(gain.gain.value,ctx.currentTime);gain.gain.linearRampToValueAtTime(target,ctx.currentTime+.35)},
    stop(fade){if(!playing)return;const ctx=AudioCore.ctx;if(ctx&&gain){gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setValueAtTime(gain.gain.value,ctx.currentTime);gain.gain.linearRampToValueAtTime(.0001,ctx.currentTime+(fade||.35))}playing=false;if(timerID)clearTimeout(timerID)}
  };
})();
