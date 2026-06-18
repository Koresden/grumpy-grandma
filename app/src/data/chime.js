// Two-note WebAudio notification chime (660→880 Hz sine, ~0.13s each), per the design.
// No audio file; generated at runtime. Respects the mute flag passed by the caller.
let ctx = null;

export function playChime() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    [[660, 0], [880, 0.13]].forEach(([freq, dt]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + dt);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + dt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.13);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.14);
    });
  } catch { /* audio unavailable — silent */ }
}
