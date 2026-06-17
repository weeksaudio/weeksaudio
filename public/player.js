// ── Supabase init ──
const _supa = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── State ──
let tracks = [];
let currentIndex = -1;
let isPlaying = false;
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let waveformData = [];
let rafId = null;

const audio = document.getElementById('audio-el');
const canvas = document.getElementById('waveform');
const ctx2d  = canvas.getContext('2d');

// ── Media Session (background audio / lock screen) ──
function updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.name,
    artist: 'WEEKS® Audio Design',
    album: 'WEEKS® Audio Design',
  });
  navigator.mediaSession.setActionHandler('play',     () => { startPlay(); });
  navigator.mediaSession.setActionHandler('pause',    () => { audio.pause(); isPlaying = false; document.getElementById('play-pause-btn').innerHTML = '&#9654;'; });
  navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
  navigator.mediaSession.setActionHandler('nexttrack',     nextTrack);
}

// ── Load tracks ──
async function loadTracks() {
  const { data, error } = await _supa
    .from('tracks')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    document.getElementById('track-list').innerHTML =
      '<div class="empty-state">Could not load tracks.</div>';
    return;
  }

  tracks = data || [];
  renderPlaylist();
  if (tracks.length > 0) selectTrack(0, false);
}

// ── Render playlist ──
function renderPlaylist() {
  const list = document.getElementById('track-list');
  if (tracks.length === 0) {
    list.innerHTML = '<div class="empty-state">No tracks yet.</div>';
    return;
  }

  list.innerHTML = tracks.map((t, i) => `
    <div class="track-row ${i === currentIndex ? 'active' : ''}" id="row-${i}" onclick="selectTrack(${i}, true)">
      <div class="track-left">
        <span class="track-index">${String(i + 1).padStart(2, '0')}</span>
        <span class="track-name">${escHtml(t.name)}</span>
      </div>
      <div class="track-right">
        <span class="track-duration" id="dur-${i}">—:——</span>
        <button class="track-buy-btn" onclick="event.stopPropagation(); buyTrack('${t.id}', '${escHtml(t.name)}', ${t.price}, '${t.audio_url}')">BUY — $${Number(t.price).toFixed(2)}</button>
      </div>
    </div>
  `).join('');

  tracks.forEach((t, i) => {
    const tmp = new Audio();
    tmp.crossOrigin = 'anonymous';
    tmp.src = t.audio_url;
    tmp.addEventListener('loadedmetadata', () => {
      const el = document.getElementById(`dur-${i}`);
      if (el) el.textContent = fmtTime(tmp.duration);
    });
  });
}

// ── Stripe checkout ──
async function buyTrack(trackId, trackName, price, audioUrl) {
  const btn = event.target;
  const original = btn.textContent;
  btn.textContent = 'LOADING...';
  btn.disabled = true;

  try {
    const res = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId, trackName, price, audioUrl }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Checkout error. Please try again.');
      btn.textContent = original;
      btn.disabled = false;
    }
  } catch(e) {
    alert('Checkout error. Please try again.');
    btn.textContent = original;
    btn.disabled = false;
  }
}

// ── Select track ──
function selectTrack(index, autoplay) {
  currentIndex = index;
  const t = tracks[index];

  document.querySelectorAll('.track-row').forEach((r, i) => {
    r.classList.toggle('active', i === index);
  });

  document.getElementById('active-name').textContent = t.name;
  document.getElementById('now-playing-label-text').textContent = 'SELECTED';

  const buyBtn = document.getElementById('active-buy-btn');
  buyBtn.onclick = (e) => {
    e.preventDefault();
    buyTrack(t.id, t.name, t.price, t.audio_url);
  };
  buyBtn.style.display = 'inline-block';

  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    cancelAnimationFrame(rafId);
  }

  sourceNode = null;
  audio.crossOrigin = 'anonymous';
  audio.src = t.audio_url;
  audio.load();

  document.getElementById('play-pause-btn').innerHTML = '&#9654;';
  document.getElementById('pulse').classList.add('hidden');
  document.getElementById('time-current').textContent = '0:00';
  document.getElementById('time-total').textContent = '—:——';
  waveformData = [];
  drawWaveform(0);

  updateMediaSession(t);

  if (autoplay) {
    audio.addEventListener('canplaythrough', () => startPlay(), { once: true });
  }
}

// ── Playback ──
function startPlay() {
  audio.play().then(() => {
    isPlaying = true;
    document.getElementById('play-pause-btn').innerHTML = '&#9646;&#9646;';
    document.getElementById('pulse').classList.remove('hidden');
    document.getElementById('now-playing-label-text').textContent = 'NOW PLAYING';
    navigator.mediaSession && (navigator.mediaSession.playbackState = 'playing');

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        sourceNode = audioCtx.createMediaElementSource(audio);
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination);
      } else if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    } catch(e) { console.log('AudioContext:', e); }

    animateWaveform();
  }).catch(e => console.error('Playback failed:', e));
}

function togglePlay() {
  if (currentIndex < 0) return;
  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    document.getElementById('play-pause-btn').innerHTML = '&#9654;';
    document.getElementById('pulse').classList.add('hidden');
    cancelAnimationFrame(rafId);
    navigator.mediaSession && (navigator.mediaSession.playbackState = 'paused');
  } else {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    startPlay();
  }
}

function skipBack()    { audio.currentTime = Math.max(0, audio.currentTime - 10); }
function skipForward() { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); }

function prevTrack() {
  if (!tracks.length) return;
  selectTrack((currentIndex - 1 + tracks.length) % tracks.length, isPlaying);
}
function nextTrack() {
  if (!tracks.length) return;
  selectTrack((currentIndex + 1) % tracks.length, isPlaying);
}

audio.addEventListener('ended', nextTrack);
audio.addEventListener('timeupdate', () => {
  document.getElementById('time-current').textContent = fmtTime(audio.currentTime);
  if (audio.duration) drawWaveform(audio.currentTime / audio.duration);
});
audio.addEventListener('loadedmetadata', () => {
  document.getElementById('time-total').textContent = fmtTime(audio.duration);
});

// ── Waveform ──
function resizeCanvas() {
  const wrap = document.getElementById('waveform-wrap');
  canvas.width  = wrap.clientWidth * devicePixelRatio;
  canvas.height = wrap.clientHeight * devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawWaveform(progress) {
  const W = canvas.width  / devicePixelRatio;
  const H = canvas.height / devicePixelRatio;
  ctx2d.clearRect(0, 0, W, H);

  const bars  = Math.floor(W / 4);
  const barW  = 2;
  const gap   = (W - bars * barW) / bars;
  const mid   = H / 2;
  const played = Math.floor(bars * progress);

  for (let i = 0; i < bars; i++) {
    const amp = waveformData[i] !== undefined
      ? waveformData[i]
      : (0.15 + 0.22 * Math.sin(i * 0.4) + 0.08 * Math.sin(i * 0.13));
    const h = Math.max(2, amp * H * 0.82);
    const x = i * (barW + gap);

    if (i < played) {
      ctx2d.fillStyle = '#4a7c59';
      ctx2d.shadowColor = '#7aab8a';
      ctx2d.shadowBlur = 3;
    } else {
      ctx2d.fillStyle = '#1e221e';
      ctx2d.shadowBlur = 0;
    }
    ctx2d.fillRect(x, mid - h / 2, barW, h);
  }
  ctx2d.shadowBlur = 0;
}

function animateWaveform() {
  if (!isPlaying) return;
  if (analyser) {
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buf);
    const bars = Math.floor((canvas.width / devicePixelRatio) / 4);
    waveformData = [];
    for (let i = 0; i < bars; i++) {
      waveformData.push(buf[Math.floor(i / bars * buf.length)] / 255);
    }
  }
  drawWaveform(audio.duration ? audio.currentTime / audio.duration : 0);
  rafId = requestAnimationFrame(animateWaveform);
}

document.getElementById('waveform-wrap').addEventListener('click', (e) => {
  if (!audio.duration) return;
  const rect = canvas.getBoundingClientRect();
  audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  if (!isPlaying) drawWaveform(audio.currentTime / audio.duration);
});

// ── Utils ──
function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

loadTracks();
