/* ============================================================
   CADE NERF — audio.js
   100% procedural Web Audio — zero external audio files, so there's
   nothing here to license. Haptics (navigator.vibrate) fires alongside
   SFX at the same event boundaries, feature-checked and silent where
   unsupported. Music is a real step-sequencer with lookahead scheduling
   and three intensity states (calm/normal/meltdown) tied to game state.

   Fully self-contained — no imports needed. Every caller (player.js,
   main.js's Game object, teams.js once it's real, etc.) just imports
   what it needs from here.
   ============================================================ */

export const Haptics = {
  enabled: true,
  supported: typeof navigator!=="undefined" && !!navigator.vibrate,
  pulse(pattern){
    if(!this.enabled || !this.supported) return;
    try{ navigator.vibrate(pattern); }catch(e){}
  },
  graze(){ this.pulse(8); },
  hit(){ this.pulse([25,20,45]); },
  dash(){ this.pulse(10); },
  lifeLost(){ this.pulse([30,25,30,25,60]); },
  meltdown(){ this.pulse([18,30,18,30,42]); },
  finalWin(){ this.pulse([15,15,15,15,15,15,60]); },
  finalLose(){ this.pulse([35,25,80]); },
  boost(){ this.pulse([10,10,10,10,25]); }
};

export const AudioCore = (()=>{
  let ctx=null;
  function ensure(){
    if(ctx) return ctx;
    try{ ctx = new (window.AudioContext||window.webkitAudioContext)(); }
    catch(e){ ctx=null; }
    return ctx;
  }
  function unlock(){ ensure(); if(ctx && ctx.state==="suspended") ctx.resume(); }
  return { ensure, unlock, get ctx(){ return ctx; } };
})();

export const SFX = (()=>{
  let master=null, enabled=true;
  function ready(){
    const ctx = AudioCore.ensure(); if(!ctx) return null;
    if(!master){ master=ctx.createGain(); master.gain.value=0.32; master.connect(ctx.destination); }
    return ctx;
  }
  function tone(freq, dur, type, gain, glideTo){
    if(!enabled) return; const ctx=ready(); if(!ctx) return;
    const t0 = ctx.currentTime;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq, t0);
    if(glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1,glideTo), t0+dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001,gain), t0+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0+dur+0.02);
  }
  function noise(dur, gain){
    if(!enabled) return; const ctx=ready(); if(!ctx) return;
    const n = Math.max(1, Math.floor(ctx.sampleRate*dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src = ctx.createBufferSource(); src.buffer=buf;
    const g = ctx.createGain(); g.gain.value=gain;
    src.connect(g); g.connect(master);
    src.start();
  }
  return {
    setEnabled(v){ enabled=v; },
    isEnabled(){ return enabled; },
    unlock(){ AudioCore.unlock(); },
    graze(multi){ tone(420+Math.min(multi,15)*38, 0.08, "square", 0.16); },
    pump(){ tone(660,0.07,"triangle",0.22); setTimeout(()=>tone(880,0.09,"triangle",0.20),40); },
    bigPump(){ tone(660,0.08,"triangle",0.26); setTimeout(()=>tone(880,0.08,"triangle",0.24),40); setTimeout(()=>tone(1100,0.13,"triangle",0.22),80); },
    dash(){ tone(180,0.14,"sawtooth",0.20,900); },
    hit(){ noise(0.16,0.28); tone(120,0.20,"square",0.20,55); },
    lifeLost(){ tone(85,0.32,"square",0.26,38); },
    streak(n){ [660,880,1100].forEach((f,i)=>setTimeout(()=>tone(f,0.08,"square",0.18),i*55)); },
    boost(){ tone(440,0.10,"sawtooth",0.16,1400); setTimeout(()=>tone(900,0.14,"triangle",0.20),60); },
    tick(critical){ tone(critical?880:660, 0.05, "square", critical?0.20:0.10); },
    win(){ [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.16,"triangle",0.20),i*70)); },
    lose(){ noise(0.28,0.26); tone(110,0.36,"sawtooth",0.22,48); },
    ui(){ tone(500,0.05,"square",0.13); }
  };
})();

export const Music = (()=>{
  let enabled=true, gain=null, playing=false, timerID=null;
  let bpm=132, stepDur=0, step16=0, barIndex=0, nextNoteTime=0;
  let intensity="calm"; // calm | normal | meltdown
  const LOOKAHEAD_MS=25, SCHEDULE_AHEAD=0.12;

  // simple minor progression (Am–F–C–G) dropped an octave for the bass;
  // generic triads, not derived from any existing recording
  const CHORDS = [
    [220.00,261.63,329.63],
    [174.61,220.00,261.63],
    [130.81,164.81,196.00],
    [196.00,246.94,293.66]
  ];

  function ready(){
    const ctx = AudioCore.ensure(); if(!ctx) return null;
    if(!gain){ gain=ctx.createGain(); gain.gain.value=0.0001; gain.connect(ctx.destination); }
    return ctx;
  }

  function osc(ctx,freq,t,dur,type,peak,lp){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001,peak),t+0.012);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    if(lp){
      const f=ctx.createBiquadFilter(); f.type="lowpass"; f.frequency.value=lp;
      o.connect(f); f.connect(g);
    } else { o.connect(g); }
    g.connect(gain);
    o.start(t); o.stop(t+dur+0.02);
  }
  function kick(ctx,t){
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type="sine";
    o.frequency.setValueAtTime(150,t);
    o.frequency.exponentialRampToValueAtTime(46,t+0.09);
    g.gain.setValueAtTime(0.9,t);
    g.gain.exponentialRampToValueAtTime(0.001,t+0.16);
    o.connect(g); g.connect(gain);
    o.start(t); o.stop(t+0.18);
  }
  function hat(ctx,t,vol){
    const n = Math.floor(ctx.sampleRate*0.035);
    const buf = ctx.createBuffer(1,n,ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src=ctx.createBufferSource(); src.buffer=buf;
    const f=ctx.createBiquadFilter(); f.type="highpass"; f.frequency.value=6200;
    const g=ctx.createGain();
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.035);
    src.connect(f); f.connect(g); g.connect(gain);
    src.start(t);
  }

  function scheduleStep(step,t){
    const ctx = AudioCore.ctx;
    const chord = CHORDS[barIndex % CHORDS.length];
    const root = chord[0]/2;

    if(step%4===0) kick(ctx,t);

    if(step%4===0) osc(ctx, root, t, 0.22, "sawtooth", intensity==="calm"?0.09:0.20, 850);
    if(step%8===6 && intensity!=="calm") osc(ctx, root*1.5, t, 0.12, "sawtooth", 0.13, 850);

    if(intensity!=="calm" && step%2===1) hat(ctx,t, intensity==="meltdown"?0.13:0.07);

    if(intensity!=="calm"){
      const note = chord[step%3];
      const playArp = intensity==="meltdown" || step%2===0;
      if(playArp) osc(ctx, note, t, 0.10, "square", intensity==="meltdown"?0.09:0.05, intensity==="meltdown"?2600:1300);
    }

    if(step===15) barIndex++;
  }

  function scheduler(){
    const ctx = AudioCore.ctx; if(!ctx) return;
    while(nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD){
      scheduleStep(step16, nextNoteTime);
      nextNoteTime += stepDur;
      step16 = (step16+1)%16;
    }
    timerID = setTimeout(scheduler, LOOKAHEAD_MS);
  }

  return {
    setEnabled(v){ enabled=v; if(!v) this.stop(0.15); },
    isEnabled(){ return enabled; },
    setIntensity(level){ intensity=level; },
    start(level){
      if(level) intensity=level;
      if(!enabled) return;
      const ctx = ready(); if(!ctx) return;
      if(playing){
        // already running — just ramp volume back up (used for un-ducking)
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime+0.5);
        return;
      }
      stepDur = 60/bpm/4;
      step16=0; barIndex=0;
      nextNoteTime = ctx.currentTime + 0.05;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime+0.7);
      playing=true;
      scheduler();
    },
    duck(target){
      const ctx=AudioCore.ctx; if(!ctx||!gain) return;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(target, ctx.currentTime+0.6);
    },
    stop(fade){
      if(!playing) return;
      const ctx=AudioCore.ctx;
      if(ctx && gain){
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime+(fade||0.4));
      }
      playing=false;
      if(timerID) clearTimeout(timerID);
    }
  };
})();
