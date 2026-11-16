(()=>{
// ===== Retro splash logic (ZX tape loader) =====
  const splash = document.getElementById('splash-screen');
  const loadingText = document.getElementById('loading-text');

  let gameStarted = false;

  function playTapeSound() {
    // short synthesized tape noise/tones (no external assets)
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();
    // Volume control (~19% loudness)
    const gain = audioCtx.createGain();
    gain.gain.value = 0.19;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const duration = 3.6;
    const sampleRate = audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      if (t < 0.5) {
        sample = Math.random() * 0.28 - 0.14;
      } else if (t < 1.5) {
        sample = Math.sin(2 * Math.PI * 2000 * t) * 0.35 + (Math.random() * 0.1 - 0.05);
      } else if (t < 2.6) {
        const freq = (Math.sin(2 * Math.PI * 18 * t) > 0) ? 1500 : 2500;
        sample = Math.sin(2 * Math.PI * freq * t) * 0.36 + (Math.random() * 0.18 - 0.09);
      } else {
        const decay = 1 - (t - 2.6) / 1.0;
        sample = Math.sin(2 * Math.PI * 1600 * t) * 0.22 * decay;
      }

      sample += (Math.random() * 0.08 - 0.04) * (1 - t / duration);
      data[i] = Math.max(-1, Math.min(1, sample));
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(audioCtx.destination);
    source.start();

    source.onended = () => {
      try { audioCtx.close(); } catch {}
    };
  }

  function startSplashSequence() {
    if (gameStarted) return;
    gameStarted = true;
    window.dispatchEvent(new Event('retro-waves-start'));

    loadingText.textContent = '> TAPE LOADING... <';
    try { playTapeSound(); } catch {}

    let dots = 0;
    const interval = setInterval(() => {
      dots = (dots + 1) % 4;
      loadingText.textContent = '> TAPE LOADING' + '.'.repeat(dots) + ' <';
    }, 300);

    setTimeout(() => {
      clearInterval(interval);
      splash.style.display = 'none';
      // kick off the game loop
      window.dispatchEvent(new Event('retro-waves-ready'));
    }, 3600);
  }

  // Start on click/tap/enter
  splash.addEventListener('click', startSplashSequence);
  splash.addEventListener('pointerdown', (e) => { e.preventDefault(); startSplashSequence(); }, { passive: false });
  splash.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startSplashSequence();
    }
  });


})();
