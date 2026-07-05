// 聲音即導航:空間嗡鳴的走音程度(detune)、殘響、房間音隨 D 變化。
// 用耳朵就能判斷離家多遠。AudioContext 必須在使用者手勢中建立(startAudio 由點擊觸發)。

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let detuneOsc: OscillatorNode | null = null;
let humFilter: BiquadFilterNode | null = null;
let feedback: GainNode | null = null;
let delayIn: DelayNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let currentD = 0;

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
  const humGain = ctx.createGain();
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
  const ng = ctx.createGain();
  ng.gain.value = 0.02;
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(master);

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
}

export function setAudioDivergence(d: number): void {
  currentD = d;
  applyDivergence();
}

// ─ 水滴:偶發、帶回音;音高隨 D 往下掉
function scheduleDrip(): void {
  if (!ctx) return;
  window.setTimeout(() => {
    drip();
    scheduleDrip();
  }, 2500 + Math.random() * 6500);
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
