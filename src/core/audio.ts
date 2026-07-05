// 聲音即導航:空間嗡鳴的走音程度(detune)、殘響、房間音隨 D 變化。
// 用耳朵就能判斷離家多遠。AudioContext 必須在使用者手勢中建立(startAudio 由點擊觸發)。

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let detuneOsc: OscillatorNode | null = null;
let humFilter: BiquadFilterNode | null = null;
let feedback: GainNode | null = null;
let delayIn: DelayNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let lfoDepth: GainNode | null = null;
let humGain: GainNode | null = null;
let toneGain: GainNode | null = null;
let currentD = 0;
let figurePresent = false;

interface DoorVoice {
  src: AudioBufferSourceNode;
  lfo: OscillatorNode;
  gain: GainNode;
  pan: StereoPannerNode;
  x: number;
  z: number;
}
let doorVoices: DoorVoice[] = [];

export function startAudio(): void {
  if (ctx) return;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  ctx = new AC();
  void ctx.resume();

  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.5);

  // ─ 嗡鳴:三個諧波,第二個綁 detune
  humGain = ctx.createGain();
  humGain.gain.value = 0.16;
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 55;
  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 110;
  detuneOsc = o2;
  const o3 = ctx.createOscillator();
  o3.type = 'triangle';
  o3.frequency.value = 165;
  const g3 = ctx.createGain();
  g3.gain.value = 0.22;
  humFilter = ctx.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 420;
  o1.connect(humGain);
  o2.connect(humGain);
  o3.connect(g3);
  g3.connect(humGain);
  humGain.connect(humFilter);
  humFilter.connect(master);

  // ─ 呼吸 LFO:嗡鳴音量的緩慢起伏,深度綁 D(離家越遠越不穩定)
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.13;
  lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0;
  lfo.connect(lfoDepth);
  lfoDepth.connect(humGain.gain);
  lfo.start();

  // ─ 迴授延遲當殘響:feedback 量綁 D(殘響變長 = 離家更遠)
  delayIn = ctx.createDelay(1);
  delayIn.delayTime.value = 0.31;
  feedback = ctx.createGain();
  feedback.gain.value = 0.25;
  const dampen = ctx.createBiquadFilter();
  dampen.type = 'lowpass';
  dampen.frequency.value = 900;
  humFilter.connect(delayIn);
  delayIn.connect(dampen);
  dampen.connect(feedback);
  feedback.connect(delayIn);
  dampen.connect(master);

  // ─ 房間音:低通白噪
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const ch = noiseBuf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 260;
  toneGain = ctx.createGain();
  toneGain.gain.value = 0.02;
  noise.connect(nf);
  nf.connect(toneGain);
  toneGain.connect(master);

  o1.start();
  o2.start();
  o3.start();
  noise.start();

  applyDivergence();
  scheduleDrip();
}

function applyDivergence(): void {
  if (!ctx || !detuneOsc || !feedback || !humFilter) return;
  const t = ctx.currentTime;
  detuneOsc.detune.setTargetAtTime(6 + currentD * 95, t, 0.8);
  feedback.gain.setTargetAtTime(Math.min(0.72, 0.25 + currentD * 0.45), t, 0.8);
  humFilter.frequency.setTargetAtTime(420 - currentD * 170, t, 0.8);
  lfoDepth?.gain.setTargetAtTime(currentD * 0.07, t, 1.2);
}

export function setAudioDivergence(d: number): void {
  currentD = d;
  applyDivergence();
}

// ─ 水滴:偶發、帶回音;音高隨 D 往下掉,頻率隨 D 變密(濕區的體感)。
// 身影在現實中時水滴變稀 — 世界屏息。
function scheduleDrip(): void {
  if (!ctx) return;
  window.setTimeout(
    () => {
      drip();
      scheduleDrip();
    },
    (1400 + Math.random() * 7000 * (1 - currentD * 0.6)) *
      (figurePresent ? 1.9 : 1),
  );
}

function drip(): void {
  if (!ctx || !master || !delayIn) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = 'sine';
  const f = 850 + Math.random() * 500 - currentD * 280;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(g);
  g.connect(master);
  g.connect(delayIn);
  o.start(t);
  o.stop(t + 0.6);
}

// ─ 空間音:每道門後傳來水聲,音高編碼分岔預覽(t=0 相干清亮,t=1 發散低濁),
//   音量隨距離、聲像隨方位。這是「可學習的線索語言」的聲音層。
export function setDoorVoices(
  doors: { x: number; z: number; t: number }[],
): void {
  if (!ctx || !master || !noiseBuf) return;
  for (const v of doorVoices) {
    try {
      v.src.stop();
      v.lfo.stop();
    } catch {
      // 已停止
    }
    v.pan.disconnect();
  }
  doorVoices = [];
  for (const d of doors) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 7;
    filter.frequency.value = 1600 - d.t * 1000;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.4 + d.t * 0.7;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 30 + d.t * 70;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const pan = ctx.createStereoPanner();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(pan);
    pan.connect(master);
    src.start();
    lfo.start();
    doorVoices.push({ src, lfo, gain, pan, x: d.x, z: d.z });
  }
}

/** 每 frame 由 Player 呼叫:依玩家位置與朝向更新各門水聲的音量與聲像 */
export function updateListener(px: number, pz: number, yaw: number): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  for (const v of doorVoices) {
    const dx = v.x - px;
    const dz = v.z - pz;
    const dist = Math.hypot(dx, dz);
    const g = Math.max(0, 1 - dist / 7);
    v.gain.gain.setTargetAtTime(g * g * 0.12, t, 0.08);
    if (dist > 0.001) {
      const cross = (fx * dz - fz * dx) / dist;
      v.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, cross)), t, 0.08);
    }
  }
}

/** 身影狀態:在現實中 → 房間音變厚、水滴變稀;走近它 → 嗡鳴退開 */
export function setFigureState(present: boolean, near: boolean): void {
  figurePresent = present;
  if (!ctx || !toneGain || !humGain) return;
  const t = ctx.currentTime;
  toneGain.gain.setTargetAtTime(present ? 0.05 : 0.02, t, 1.0);
  humGain.gain.setTargetAtTime(near ? 0.1 : 0.16, t, 0.4);
}

// ─ 疊加態:所有分支的嗡鳴同時響 — 一簇彼此走音的諧波慢慢湧上來
let superGain: GainNode | null = null;

export function setSuperposition(on: boolean): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  if (on && !superGain) {
    superGain = ctx.createGain();
    superGain.gain.value = 0;
    superGain.connect(master);
    if (delayIn) superGain.connect(delayIn);
    for (const cents of [-136, -84, -33, 29, 76, 132]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 110;
      o.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = 0.13;
      o.connect(g);
      g.connect(superGain);
      o.start();
    }
    superGain.gain.linearRampToValueAtTime(0.45, t + 7);
    feedback?.gain.setTargetAtTime(0.72, t, 2);
  }
}

/** 收束:疊加的所有音淡出,只留下一個乾淨的 55Hz — 停止嘗試返回的安靜 */
export function resolveEnd(): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  superGain?.gain.setTargetAtTime(0, t, 2.5);
  humGain?.gain.setTargetAtTime(0.06, t, 3);
  toneGain?.gain.setTargetAtTime(0.004, t, 3);
  detuneOsc?.detune.setTargetAtTime(0, t, 2);
  feedback?.gain.setTargetAtTime(0.18, t, 3);
  lfoDepth?.gain.setTargetAtTime(0, t, 2);
  for (const v of doorVoices) v.gain.gain.setTargetAtTime(0, t, 0.8);
}

/** 穿門瞬間:一聲噪音掃頻 + 主音量短暫下沉(世界被抽換的體感) */
export function pulseTraverse(): void {
  if (!ctx || !master || !noiseBuf || !delayIn) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(1600, t);
  bp.frequency.exponentialRampToValueAtTime(140, t + 0.55);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  g.connect(delayIn);
  src.start(t);
  src.stop(t + 0.7);

  master.gain.cancelScheduledValues(t);
  master.gain.setTargetAtTime(0.3, t, 0.04);
  master.gain.setTargetAtTime(0.5, t + 0.35, 0.3);
}
