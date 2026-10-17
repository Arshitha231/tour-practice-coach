// ── Constants ──────────────────────────────────────────────────────────────

// Longer phrases must come before shorter substrings.
// Note: Chrome's Web Speech API often strips "um"/"uh" as noise — the word-based
// fillers below ("like", "basically", etc.) are far more reliably detected.
const FILLER_WORDS = [
  'you know what i mean', 'know what i mean',
  'you know', 'i mean',
  'kind of like', 'sort of like',
  'okay so', 'so like', 'and um', 'and uh', 'and so',
  'kind of', 'sort of', 'sort a', 'kinda', 'sorta',
  'um', 'uhm', 'uh', 'er', 'ah', 'erm',
  'like',
  'basically', 'literally', 'actually', 'obviously',
  'right', 'okay',
  // Exclusionary/casual language — UW guides should prefer "everyone" / "folks" / "y'all"
  'guys',
];

const STORY_CUES = [
  // explicit story markers
  'for example', 'for instance',
  'one time', 'one day', 'one night', 'one morning',
  'there was a', 'there was once', 'there used to be',
  'i remember when', 'i remember', 'i recall',
  'back in', 'back when', 'way back', 'years ago',
  'fun fact', 'interesting fact', 'cool fact', 'random fact',
  'did you know', "you wouldn't believe",
  'legend has it', 'the story goes', 'the legend',
  'speaking of', 'historically', 'historical',
  'let me tell you', 'believe it or not',
  'true story', 'fun story', 'crazy story', 'cool story',
  'let me share', "i'll share",
  // narrative openers
  'picture this', 'imagine if', 'imagine that',
  'rumor has it', 'they say', 'people say', 'word is',
  'used to be', 'used to',
  'founded in', 'built in', 'opened in', 'established in',
  'the first time', 'the last time',
  'when i was', 'when we', 'when they',
  // tour-guide story hooks
  'the funny thing', 'the cool thing', 'the interesting thing',
  'the crazy thing', 'the wild thing',
  'this building', 'this place', 'this spot',
  'fun bit of history', 'piece of trivia',
  'a while back', 'years back',
];

// Audience-directed question cues (ice breakers)
const ICE_BREAKER_CUES = [
  "do y'all", 'do yall', 'do you all', 'do you guys', 'do you folks',
  'have any of you', 'any of you',
  'anyone here', 'anyone been', 'anyone else',
  'who here', "who's been", 'who has been', 'who else',
  'raise your hand', 'show of hands', 'hands up',
  'what do you think', "what's your favorite", 'whats your favorite',
  'have you ever', 'have you all', 'has anyone',
  'how many of you', 'how many people',
  'can i get', 'can anyone',
  'would you rather', 'which one of you',
  'by show of', 'quick question for you',
];

// Common stopwords to exclude from manual key-term extraction
const STOPWORDS = new Set((
  "a,about,above,across,after,again,against,all,almost,along,also,although,always," +
  "am,among,an,and,another,any,anyone,anything,are,around,as,at,back,be,because," +
  "been,before,being,below,between,both,but,by,came,can,cannot,come,could,did," +
  "do,does,doing,done,down,during,each,either,else,enough,even,ever,every," +
  "everyone,everything,few,find,first,for,from,further,get,give,go,goes,going," +
  "gone,good,got,had,has,have,having,he,her,here,hers,herself,him,himself," +
  "his,how,however,i,if,in,inside,into,is,it,its,itself,just,keep,know,last," +
  "let,like,little,look,made,make,many,may,me,might,more,most,much,must,my," +
  "myself,never,new,no,nor,not,now,of,off,often,on,once,one,only,onto,or," +
  "other,others,our,ours,ourselves,out,over,own,part,per,put,rather,really," +
  "right,said,same,see,seem,several,she,should,since,so,some,someone,something," +
  "sometimes,still,such,take,than,that,the,their,theirs,them,themselves,then," +
  "there,these,they,thing,things,this,those,through,thus,to,today,together," +
  "too,toward,two,under,until,up,upon,us,use,used,using,very,want,was,way," +
  "we,well,were,what,when,where,which,while,who,whom,why,will,with,within," +
  "without,would,yes,yet,you,your,yours,yourself,yourselves,also,really," +
  "actually,basically,literally,kind,sort"
).split(','));

// dB range for the volume bar
const DB_MIN = -58;
const DB_MAX = -10;

// ── State ──────────────────────────────────────────────────────────────────

const state = {
  running: false,
  startTime: null,
  timerInterval: null,
  elapsedSeconds: 0,

  // audio
  audioCtx: null,
  analyser: null,
  micSource: null,
  volInterval: null,
  goodFrames: 0,
  totalFrames: 0,

  // speech
  recognition: null,
  finalTranscript: '',
  interimTranscript: '',
  lastInterimCounted: '',
  lastHeard: '',

  // metrics
  fillerCounts: {},
  totalFillers: 0,
  storyCount: 0,
  storyLog: [],
  lastStoryAt: -30000,
  iceBreakerCount: 0,
  iceBreakerLog: [],
  lastIceBreakerAt: -30000,
  wordCount: 0,
  matchedKeyTerms: new Set(),

  // tour manual
  manualTexts: {},        // {fileName: rawText}
  manualKeyTerms: [],     // unique key terms extracted from all manuals

  // camera
  camStream: null,

  // difficulty + focus
  mode: 'medium',           // 'easy' | 'medium' | 'strict'
  focusAreas: new Set(),    // subset of CATEGORY_KEYS
};

// Category keys shared across focus + report
const CATEGORY_KEYS = ['accuracy', 'projection', 'energy', 'storytelling', 'iceBreakers', 'fillers'];
const CATEGORY_LABELS = {
  accuracy:    'Accuracy of Information',
  projection:  'Voice Projection',
  energy:      'Energy',
  storytelling:'Storytelling',
  iceBreakers: 'Ice Breaker Questions',
  fillers:     'Filler Control',
};

// Illustrated empty-state (clipboard with checkmarks + sparkles + leaf).
// Palette locked to the warm cream + plum theme so it feels native.
const EMPTY_STATE_SVG = `
<svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- soft lavender blob behind the clipboard -->
  <ellipse cx="112" cy="106" rx="86" ry="52" fill="#E6DBEE"/>

  <!-- leaf, bottom-right of clipboard -->
  <g transform="translate(142 118)">
    <path d="M0 0 Q18 -14 36 -6 Q30 14 10 18 Q0 14 0 0 Z" fill="#6B8E5C"/>
    <path d="M4 2 Q18 -4 30 -2" stroke="#3F5A32" stroke-width="1.2" fill="none" stroke-linecap="round"/>
    <path d="M8 10 Q18 6 26 8" stroke="#3F5A32" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.6"/>
  </g>

  <!-- clipboard back shadow -->
  <rect x="60" y="42" width="92" height="112" rx="8" fill="#D4C4DF"/>

  <!-- clipboard body -->
  <rect x="56" y="38" width="92" height="112" rx="8" fill="#FBF7EC" stroke="#2A2342" stroke-width="2.5"/>

  <!-- clip at top -->
  <rect x="86" y="28" width="32" height="18" rx="4" fill="#2A2342"/>
  <rect x="92" y="24" width="20" height="12" rx="3" fill="#4A3860"/>

  <!-- checklist row 1 (checked) -->
  <rect x="70" y="68" width="14" height="14" rx="3" fill="none" stroke="#6E4F72" stroke-width="2"/>
  <path d="M73 75 L77 79 L83 70" stroke="#6B8E5C" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="90" y="72" width="46" height="4" rx="2" fill="#6E4F72" opacity="0.7"/>
  <rect x="90" y="80" width="30" height="3" rx="1.5" fill="#6E4F72" opacity="0.35"/>

  <!-- checklist row 2 (checked) -->
  <rect x="70" y="98" width="14" height="14" rx="3" fill="none" stroke="#6E4F72" stroke-width="2"/>
  <path d="M73 105 L77 109 L83 100" stroke="#6B8E5C" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="90" y="102" width="40" height="4" rx="2" fill="#6E4F72" opacity="0.7"/>
  <rect x="90" y="110" width="26" height="3" rx="1.5" fill="#6E4F72" opacity="0.35"/>

  <!-- checklist row 3 (unchecked, lower opacity to suggest "to do") -->
  <rect x="70" y="128" width="14" height="14" rx="3" fill="none" stroke="#6E4F72" stroke-width="2" opacity="0.5"/>
  <rect x="90" y="132" width="36" height="4" rx="2" fill="#6E4F72" opacity="0.35"/>

  <!-- sparkles -->
  <g fill="#D4B678">
    <path d="M172 50 L174 56 L180 58 L174 60 L172 66 L170 60 L164 58 L170 56 Z"/>
    <path d="M38 72 L39.5 76 L43.5 77.5 L39.5 79 L38 83 L36.5 79 L32.5 77.5 L36.5 76 Z"/>
    <circle cx="168" cy="82" r="2"/>
    <circle cx="46" cy="48" r="1.6"/>
  </g>
</svg>`;

// Difficulty-mode presets. Easy = forgiving, Strict = tour-day standard.
const MODE_PRESETS = {
  easy: {
    targetMinutes: 10, expectedStories: 3, maxFillersPerMin: 4,
    expectedIceBreakers: 2, targetWPM: 140, minProjectionPct: 50,
    projThreshold: 28,
  },
  medium: {
    targetMinutes: 10, expectedStories: 4, maxFillersPerMin: 2.5,
    expectedIceBreakers: 3, targetWPM: 150, minProjectionPct: 60,
    projThreshold: 38,
  },
  strict: {
    targetMinutes: 10, expectedStories: 5, maxFillersPerMin: 1.5,
    expectedIceBreakers: 4, targetWPM: 160, minProjectionPct: 72,
    projThreshold: 50,
  },
};

// ── DOM refs ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const timerDisplay  = $('timerDisplay');
const recordBadge   = $('recordingBadge');
const startBtn      = $('startBtn');
const stopBtn       = $('stopBtn');
const resetBtn      = $('resetBtn');
const volumeFill    = $('volumeFill');
const thresholdMark = $('thresholdMarker');
const projStatus    = $('projStatus');
const projPct       = $('projPct');
const fillerCountEl = $('fillerCount');
const fillersPerMin = $('fillersPerMin');
const fillerTags    = $('fillerTags');
const storyCountEl  = $('storyCount');
const storyTargetEl = $('storyTarget');
const storyLog      = $('storyLog');
const transcriptBox = $('transcriptBox');
const cameraFeed    = $('cameraFeed');
const cameraOverlay = $('cameraOverlay');
const cameraBtn     = $('cameraBtn');
const gradeModal    = $('gradeModal');
const gradeContent  = $('gradeContent');

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Timer ──────────────────────────────────────────────────────────────────

function startTimer() {
  state.startTime = Date.now() - state.elapsedSeconds * 1000;
  state.timerInterval = setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    timerDisplay.textContent = fmt(state.elapsedSeconds);
    updateRates();
  }, 500);
}

function stopTimer() {
  clearInterval(state.timerInterval);
}

// ── Audio / Volume ─────────────────────────────────────────────────────────

async function startAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  state.audioCtx = new AudioContext();
  state.analyser = state.audioCtx.createAnalyser();
  state.analyser.fftSize = 1024;
  state.micSource = state.audioCtx.createMediaStreamSource(stream);
  state.micSource.connect(state.analyser);
  state.volInterval = setInterval(tickVolume, 100);
}

function rmsToDb(rms) {
  if (rms < 1e-5) return -100;
  return 20 * Math.log10(rms);
}

function dbToPct(db) {
  return clamp(((db - DB_MIN) / (DB_MAX - DB_MIN)) * 100, 0, 100);
}

function tickVolume() {
  const buf = new Float32Array(state.analyser.fftSize);
  state.analyser.getFloatTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += v * v;
  const rms = Math.sqrt(sum / buf.length);
  const db = rmsToDb(rms);
  const pct = dbToPct(db);

  volumeFill.style.width = pct + '%';

  const threshold = parseInt($('projThreshold').value) || 40;
  state.totalFrames++;
  if (pct >= threshold) state.goodFrames++;

  const goodPct = state.totalFrames ? Math.round((state.goodFrames / state.totalFrames) * 100) : 0;
  projPct.textContent = `Good projection: ${goodPct}%`;

  if (pct < threshold * 0.5) {
    projStatus.textContent = 'Too quiet!';
    projStatus.style.color = 'var(--red)';
  } else if (pct < threshold) {
    projStatus.textContent = 'Speak louder';
    projStatus.style.color = 'var(--yellow)';
  } else {
    projStatus.textContent = 'Good projection!';
    projStatus.style.color = 'var(--green)';
  }
}

function stopAudio() {
  clearInterval(state.volInterval);
  state.audioCtx?.close();
  state.audioCtx = null;
  state.analyser = null;
  state.micSource = null;
}

// ── Speech Recognition ─────────────────────────────────────────────────────

function startSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert('Speech recognition requires Google Chrome. Please open this app in Chrome.');
    return;
  }
  state.recognition = new SR();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = 'en-US';

  state.recognition.onresult = e => {
    let interim = '';
    let newFinal = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) newFinal += t + ' ';
      else interim += t;
    }

    // ── Analyse interim text incrementally so fillers count as they're spoken ──
    if (interim) {
      let common = 0;
      while (
        common < state.lastInterimCounted.length &&
        common < interim.length &&
        state.lastInterimCounted[common] === interim[common]
      ) common++;
      const newPortion = interim.slice(common);
      if (newPortion.trim()) {
        analyse(newPortion.toLowerCase());
        updateLastHeard(newPortion);
      }
      state.lastInterimCounted = interim;
    }

    if (newFinal) {
      state.finalTranscript += newFinal;
      console.log('[Speech final]', newFinal.trim());
      updateLastHeard(newFinal);
      // Reset interim tracker since a phrase finalized
      state.lastInterimCounted = '';
    }

    state.interimTranscript = interim;
    renderTranscript();
  };

  state.recognition.onerror = e => {
    if (e.error !== 'no-speech') console.error('[SR error]', e.error);
  };

  state.recognition.onstart = () => {
    console.log('[Speech] recognition started');
    $('micIndicator').classList.add('active');
  };

  state.recognition.onend = () => {
    console.log('[Speech] recognition ended');
    if (state.running) {
      setTimeout(() => {
        if (state.running) {
          try { state.recognition.start(); } catch (err) { console.warn('[SR restart]', err); }
        }
      }, 200);
    } else {
      $('micIndicator').classList.remove('active');
    }
  };

  try {
    state.recognition.start();
  } catch (err) {
    console.error('[SR could not start]', err);
  }
}

function updateLastHeard(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  state.lastHeard = (state.lastHeard + ' ' + trimmed).trim().slice(-100);
  const el = $('lastHeard');
  if (el) el.textContent = `Heard: "${state.lastHeard}"`;
}

function stopSpeech() {
  state.recognition?.stop();
  state.recognition = null;
  $('micIndicator')?.classList.remove('active');
}

function analyse(text) {
  // ── Filler words ──
  // Strip each match from the working text so shorter sub-patterns
  // (e.g. "like" inside "so like") aren't double-counted.
  let working = text;
  for (const f of FILLER_WORDS) {
    const re = new RegExp(`\\b${f.replace(/ /g, '\\s+')}\\b`, 'gi');
    const hits = working.match(re);
    if (hits) {
      state.fillerCounts[f] = (state.fillerCounts[f] || 0) + hits.length;
      state.totalFillers += hits.length;
      working = working.replace(re, ' ');
    }
  }

  // ── Story cues (8-second debounce, expanded list) ──
  const now = Date.now();
  for (const cue of STORY_CUES) {
    if (text.includes(cue) && now - state.lastStoryAt > 8000) {
      state.storyCount++;
      state.lastStoryAt = now;
      state.storyLog.push({ cue, time: state.elapsedSeconds });
      break;
    }
  }

  // ── Ice breaker questions (10-second debounce) ──
  for (const cue of ICE_BREAKER_CUES) {
    if (text.includes(cue) && now - state.lastIceBreakerAt > 10000) {
      state.iceBreakerCount++;
      state.lastIceBreakerAt = now;
      state.iceBreakerLog.push({ cue, time: state.elapsedSeconds });
      break;
    }
  }

  // ── Word count (rough — for energy / WPM) ──
  const words = text.trim().split(/\s+/).filter(Boolean);
  state.wordCount += words.length;

  // ── Manual coverage (which key terms did the guide mention?) ──
  if (state.manualKeyTerms.length) {
    for (const term of state.manualKeyTerms) {
      if (!state.matchedKeyTerms.has(term)) {
        const re = new RegExp(`\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        if (re.test(text)) state.matchedKeyTerms.add(term);
      }
    }
  }

  renderMetrics();
}

// ── Manual key-term extraction ─────────────────────────────────────────
function extractKeyTerms(text) {
  // Capture proper nouns (capitalized words mid-sentence) and meaningful
  // multi-letter tokens; strip stopwords and very short words.
  const cleaned = text.replace(/\s+/g, ' ');
  const tokens = cleaned.match(/[A-Za-z][A-Za-z'-]+|\d{3,4}/g) || [];
  const counts = new Map();
  for (const raw of tokens) {
    const tok = raw.toLowerCase();
    if (tok.length < 4) continue;
    if (STOPWORDS.has(tok)) continue;
    counts.set(tok, (counts.get(tok) || 0) + 1);
  }
  // Sort by frequency (most-mentioned terms = most important)
  // Cap at 80 terms so coverage % is meaningful for a typical tour
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([t]) => t);
}

function rebuildManualKeyTerms() {
  const combined = Object.values(state.manualTexts).join(' \n ');
  state.manualKeyTerms = extractKeyTerms(combined);
  // Reset matches since term set changed
  state.matchedKeyTerms = new Set();
  const el = $('manualStatus');
  if (el) {
    if (state.manualKeyTerms.length === 0) {
      el.textContent = 'No manual loaded — Accuracy will be skipped.';
      el.style.color = 'var(--muted)';
    } else {
      el.textContent = `Manual loaded: ${state.manualKeyTerms.length} key terms tracked.`;
      el.style.color = 'var(--green)';
    }
  }
}

function renderMetrics() {
  fillerCountEl.textContent = state.totalFillers;
  storyCountEl.textContent  = state.storyCount;
  $('iceCount').textContent = state.iceBreakerCount;

  // filler tags
  fillerTags.innerHTML = '';
  Object.entries(state.fillerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([word, count]) => {
      const t = document.createElement('span');
      t.className = 'f-tag';
      t.textContent = `"${word}" ×${count}`;
      fillerTags.appendChild(t);
    });

  // story log
  storyLog.innerHTML = '';
  state.storyLog.forEach(s => {
    const d = document.createElement('div');
    d.className = 'story-item';
    d.textContent = `${fmt(s.time)} — "${s.cue}"`;
    storyLog.appendChild(d);
  });

  // ice breaker log
  const iceLog = $('iceLog');
  iceLog.innerHTML = '';
  state.iceBreakerLog.forEach(s => {
    const d = document.createElement('div');
    d.className = 'story-item';
    d.textContent = `${fmt(s.time)} — "${s.cue}"`;
    iceLog.appendChild(d);
  });

  // accuracy / coverage
  const accEl = $('accuracyPct');
  if (state.manualKeyTerms.length === 0) {
    accEl.textContent = '—';
    $('accuracySub').textContent = 'upload manual to enable';
    $('missedTerms').innerHTML = '';
  } else {
    const pct = Math.round((state.matchedKeyTerms.size / state.manualKeyTerms.length) * 100);
    accEl.textContent = `${pct}%`;
    $('accuracySub').textContent = `${state.matchedKeyTerms.size} / ${state.manualKeyTerms.length} key terms`;
  }
}

function updateRates() {
  const mins = Math.max(state.elapsedSeconds / 60, 0.01);
  fillersPerMin.textContent = `${(state.totalFillers / mins).toFixed(1)} per minute`;
  const n = parseInt($('expectedStories').value) || 5;
  storyTargetEl.textContent = `Target: ${n} stories`;
  const iceN = parseInt($('expectedIceBreakers').value) || 3;
  $('iceTarget').textContent = `Target: ${iceN} questions`;

  // WPM live
  const wpm = state.elapsedSeconds > 5 ? Math.round(state.wordCount / mins) : 0;
  const targetWPM = parseInt($('targetWPM').value) || 150;
  $('wpmCount').textContent = wpm;
  $('wpmLabel').textContent = `words/min • target ${targetWPM}`;
  const energyEl = $('energyStatus');
  if (state.elapsedSeconds < 15) {
    energyEl.textContent = '—'; energyEl.style.color = 'var(--muted)';
  } else if (wpm >= targetWPM * 0.85 && wpm <= targetWPM * 1.2) {
    energyEl.textContent = 'Engaged'; energyEl.style.color = 'var(--green)';
  } else if (wpm < targetWPM * 0.6) {
    energyEl.textContent = 'Low energy / monotone'; energyEl.style.color = 'var(--red)';
  } else if (wpm < targetWPM * 0.85) {
    energyEl.textContent = 'A bit flat'; energyEl.style.color = 'var(--amber)';
  } else if (wpm > targetWPM * 1.4) {
    energyEl.textContent = 'Slow down'; energyEl.style.color = 'var(--amber)';
  } else {
    energyEl.textContent = 'Slightly fast'; energyEl.style.color = 'var(--amber)';
  }
}

function renderTranscript() {
  let html = '';

  if (state.finalTranscript) {
    let t = escapeHtml(state.finalTranscript);

    // Highlight story cues (blue) — do first so they aren't overwritten
    for (const cue of STORY_CUES) {
      const re = new RegExp(`\\b(${cue.replace(/ /g, '\\s+')})\\b`, 'gi');
      t = t.replace(re, '<span class="hl-story">$1</span>');
    }
    // Highlight fillers (red)
    for (const f of FILLER_WORDS) {
      const re = new RegExp(`\\b(${f.replace(/ /g, '\\s+')})\\b`, 'gi');
      t = t.replace(re, m => `<span class="hl-filler">${m}</span>`);
    }

    html += `<span class="t-final">${t}</span>`;
  }

  if (state.interimTranscript) {
    html += `<span class="t-interim"> ${escapeHtml(state.interimTranscript)}</span>`;
  }

  if (html) {
    transcriptBox.innerHTML = html;
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
  }
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Camera ─────────────────────────────────────────────────────────────────

async function startCamera() {
  try {
    state.camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    cameraFeed.srcObject = state.camStream;
    cameraOverlay.classList.add('hidden');
    cameraBtn.textContent = 'Disable Camera';
    // If practice is already running, attach the gesture watcher
    if (state.running && gestureRecognizer) {
      await new Promise(r => {
        if (cameraFeed.readyState >= 1) return r();
        cameraFeed.onloadedmetadata = r;
      });
      startMainCamGestureLoop();
    }
  } catch {
    alert('Camera access was denied. Please allow camera access and try again.');
  }
}

function stopCamera() {
  stopMainCamGestureLoop();
  state.camStream?.getTracks().forEach(t => t.stop());
  state.camStream = null;
  cameraFeed.srcObject = null;
  cameraOverlay.classList.remove('hidden');
  cameraBtn.textContent = 'Enable Camera';
}

cameraBtn.addEventListener('click', () => state.camStream ? stopCamera() : startCamera());

// ── Manual upload (Word docs + images) ─────────────────────────────────────

$('manualUpload').addEventListener('change', e => {
  Array.from(e.target.files).forEach(handleManualFile);
  e.target.value = ''; // allow re-uploading same file
});

async function handleManualFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    await renderPdf(file);
  } else if (name.endsWith('.docx')) {
    await renderDocx(file);
  } else if (file.type.startsWith('image/')) {
    renderImage(file);
  } else {
    alert(`Unsupported file: ${file.name}. Please upload a PDF, .docx, or image.`);
  }
}

async function renderPdf(file) {
  if (typeof pdfjsLib === 'undefined') {
    alert('PDF parser failed to load. Check your internet connection.');
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'manual-doc';
  wrap.innerHTML = `
    <div class="manual-doc-title">
      <span>&#x1F4D5; ${escapeHtml(file.name)}</span>
      <button title="Remove">&#x2715;</button>
    </div>
    <div class="manual-doc-body"><em>Reading PDF...</em></div>
  `;
  const key = `pdf:${file.name}`;
  wrap.querySelector('button').addEventListener('click', () => {
    wrap.remove();
    delete state.manualTexts[key];
    rebuildManualKeyTerms();
  });
  $('manualImages').appendChild(wrap);
  const body = wrap.querySelector('.manual-doc-body');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    let plain = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map(it => it.str)
        .filter(s => s.trim())
        .join(' ');
      plain += ' ' + text;
      pages.push(`<h3>Page ${i}</h3><p>${escapeHtml(text) || '<em>(no extractable text)</em>'}</p>`);
    }

    body.innerHTML = pages.join('') || '<em>(no extractable text in PDF)</em>';
    state.manualTexts[key] = plain;
    rebuildManualKeyTerms();
  } catch (err) {
    console.error(err);
    body.innerHTML = `<em style="color:var(--red)">Could not read PDF: ${escapeHtml(err.message)}</em>`;
  }
}

async function renderDocx(file) {
  if (typeof mammoth === 'undefined') {
    alert('Word doc parser failed to load. Check your internet connection.');
    return;
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    const textResult = await mammoth.extractRawText({ arrayBuffer });

    const wrap = document.createElement('div');
    wrap.className = 'manual-doc';
    wrap.innerHTML = `
      <div class="manual-doc-title">
        <span>&#x1F4C4; ${escapeHtml(file.name)}</span>
        <button title="Remove">&#x2715;</button>
      </div>
      <div class="manual-doc-body">${htmlResult.value || '<em>(empty document)</em>'}</div>
    `;
    const key = `docx:${file.name}`;
    wrap.querySelector('button').addEventListener('click', () => {
      wrap.remove();
      delete state.manualTexts[key];
      rebuildManualKeyTerms();
    });
    $('manualImages').appendChild(wrap);

    state.manualTexts[key] = textResult.value || '';
    rebuildManualKeyTerms();
  } catch (err) {
    console.error(err);
    alert(`Could not read ${file.name}: ${err.message}`);
  }
}

function renderImage(file) {
  const url = URL.createObjectURL(file);
  const img = document.createElement('img');
  img.src = url;
  img.title = file.name;
  img.addEventListener('click', () => window.open(url, '_blank'));
  $('manualImages').appendChild(img);
}

// ── Position Coach (long-range pose-based distance + fist gesture) ────────
//
// Detection chain:
//   1. Face detector  (works up to ~6 ft) — most accurate close up
//   2. Pose landmarker (works up to ~15 ft) — uses shoulder span at distance
//   3. Gesture recognizer — listens for "Closed_Fist" to auto-start practice
//
// Once the user is within tolerance of the target distance AND holds a fist
// for ~0.6 sec, the overlay closes and practice starts automatically.
// During practice, if they enable the main camera, the same gesture watcher
// listens for a closing fist to stop & grade.

const FACE_WIDTH_CM = 15;        // avg adult face (intercanthal-corrected)
const SHOULDER_WIDTH_CM = 41;    // avg adult bi-acromial breadth
const CAMERA_FOV_DEG = 65;       // typical laptop webcam horizontal FOV
const PERFECT_TOLERANCE_FT = 0.8;
const FIST_HOLD_FRAMES = 10;     // ~0.5s at ~20fps detection loop

let faceDetector = null;
let poseLandmarker = null;
let gestureRecognizer = null;
let mpVision = null;             // FilesetResolver vision
let posStream = null;
let posLoopId = null;
let calibrationFactor = 1.0;
let fistFrames = 0;
let gestureArmed = false;        // becomes true after ~1.5s grace so user
                                 // can take their hand off the keyboard
let practiceFistFrames = 0;
let practiceFistArmed = false;
let mainCamGestureLoopId = null;

const posVideo = $('posVideo');
const posCanvas = $('posCanvas');
const posDistanceEl = $('posDistance');
const posInstructionEl = $('posInstruction');

async function initMediaPipe() {
  if (mpVision) return true;
  posInstructionEl.textContent = 'Loading vision models (face, body, hands)...';
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.6/vision_bundle.mjs');
    mpVision = await mod.FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.6/wasm'
    );
    faceDetector = await mod.FaceDetector.createFromOptions(mpVision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
      },
      runningMode: 'VIDEO',
    });
    poseLandmarker = await mod.PoseLandmarker.createFromOptions(mpVision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
    gestureRecognizer = await mod.GestureRecognizer.createFromOptions(mpVision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
      },
      runningMode: 'VIDEO',
      numHands: 1,
    });
    return true;
  } catch (err) {
    console.error('MediaPipe init failed:', err);
    posInstructionEl.textContent = 'Could not load vision models (check internet)';
    posInstructionEl.style.color = 'var(--red)';
    return false;
  }
}

function distanceFromFacePx(facePxWidth, videoWidthPx) {
  const focalPx = (videoWidthPx / 2) / Math.tan((CAMERA_FOV_DEG / 2) * Math.PI / 180);
  const distanceCm = (FACE_WIDTH_CM * focalPx) / facePxWidth;
  return (distanceCm / 30.48) * calibrationFactor;
}

function distanceFromShoulderPx(shoulderPxWidth, videoWidthPx) {
  const focalPx = (videoWidthPx / 2) / Math.tan((CAMERA_FOV_DEG / 2) * Math.PI / 180);
  const distanceCm = (SHOULDER_WIDTH_CM * focalPx) / shoulderPxWidth;
  return (distanceCm / 30.48) * calibrationFactor;
}

// Sample face once (used by recalibrate)
function detectFaceOnce() {
  if (!faceDetector || posVideo.readyState < 2) return null;
  const res = faceDetector.detectForVideo(posVideo, performance.now());
  if (!res.detections || res.detections.length === 0) return null;
  return res.detections.reduce(
    (big, d) => d.boundingBox.width > big.boundingBox.width ? d : big,
    res.detections[0]
  );
}

function drawOverlay(box, method, fistHeld) {
  const ctx = posCanvas.getContext('2d');
  posCanvas.width = posVideo.videoWidth;
  posCanvas.height = posVideo.videoHeight;
  ctx.clearRect(0, 0, posCanvas.width, posCanvas.height);
  if (box) {
    ctx.strokeStyle = method === 'pose' ? '#4338ca' : '#22c55e';
    ctx.lineWidth = 4;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText(method, box.x + 6, box.y + 18);
  }
  if (fistHeld) {
    // Big fist indicator in corner
    ctx.fillStyle = 'rgba(34,197,94,0.9)';
    ctx.font = 'bold 36px Inter, sans-serif';
    ctx.fillText('✊ FIST', 20, posCanvas.height - 24);
  }
}

function posDetectLoop() {
  if (!posVideo.videoWidth) {
    posLoopId = requestAnimationFrame(posDetectLoop);
    return;
  }

  const ts = performance.now();
  let distanceFt = null;
  let drawBox = null;
  let method = null;

  // 1. Try face detection (close-range, most accurate)
  if (faceDetector) {
    const fRes = faceDetector.detectForVideo(posVideo, ts);
    if (fRes.detections?.length) {
      const face = fRes.detections.reduce(
        (big, d) => d.boundingBox.width > big.boundingBox.width ? d : big,
        fRes.detections[0]
      );
      const b = face.boundingBox;
      // Only trust face if it's big enough (>20 px) — otherwise prefer pose
      if (b.width > 20) {
        distanceFt = distanceFromFacePx(b.width, posVideo.videoWidth);
        drawBox = { x: b.originX, y: b.originY, w: b.width, h: b.height };
        method = 'face';
      }
    }
  }

  // 2. Fall back to pose (works at long range using shoulder span)
  if (distanceFt === null && poseLandmarker) {
    const pRes = poseLandmarker.detectForVideo(posVideo, ts);
    if (pRes.landmarks?.length) {
      const lm = pRes.landmarks[0];
      const ls = lm[11], rs = lm[12]; // left/right shoulder
      if (ls && rs && ls.visibility > 0.3 && rs.visibility > 0.3) {
        const dxNorm = Math.abs(rs.x - ls.x);
        const dyNorm = Math.abs(rs.y - ls.y);
        const shoulderPx = Math.sqrt(dxNorm * dxNorm + dyNorm * dyNorm) * posVideo.videoWidth;
        if (shoulderPx > 15) {
          distanceFt = distanceFromShoulderPx(shoulderPx, posVideo.videoWidth);
          // Build a bounding box from nose+shoulders+hips for visualization
          const nose = lm[0];
          const lh = lm[23], rh = lm[24];
          const xs = [ls.x, rs.x, lh?.x ?? ls.x, rh?.x ?? rs.x].map(v => v * posVideo.videoWidth);
          const ys = [nose?.y ?? ls.y, ls.y, rs.y, lh?.y ?? ls.y, rh?.y ?? rs.y]
            .map(v => v * posVideo.videoHeight);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          drawBox = { x: minX - 20, y: minY - 20, w: (maxX - minX) + 40, h: (maxY - minY) + 40 };
          method = 'pose';
        }
      }
    }
  }

  // 3. Gesture detection (closed-fist to start/stop)
  let fistDetected = false;
  if (gestureRecognizer) {
    const gRes = gestureRecognizer.recognizeForVideo(posVideo, ts);
    const name = gRes.gestures?.[0]?.[0]?.categoryName;
    fistDetected = (name === 'Closed_Fist');
  }

  // Track fist hold frames
  if (fistDetected) fistFrames++;
  else fistFrames = 0;

  drawOverlay(drawBox, method, fistDetected);

  // ── Update UI ──
  if (distanceFt === null) {
    posDistanceEl.textContent = '— ft';
    posInstructionEl.textContent = 'No person detected — step into frame';
    posInstructionEl.style.color = 'var(--amber)';
    posLoopId = requestAnimationFrame(posDetectLoop);
    return;
  }

  const target = parseFloat($('posTarget').value) || 10;
  const diff = distanceFt - target;
  const positionOK = Math.abs(diff) <= PERFECT_TOLERANCE_FT;

  posDistanceEl.textContent = `${distanceFt.toFixed(1)} ft`;

  if (positionOK) {
    posDistanceEl.style.color = 'var(--green)';
    if (fistDetected) {
      const pct = Math.min(100, Math.round((fistFrames / FIST_HOLD_FRAMES) * 100));
      posInstructionEl.innerHTML = `&#x270A; HOLD FIST... ${pct}%`;
      posInstructionEl.style.color = 'var(--green)';
    } else {
      posInstructionEl.innerHTML = '&#x2713; PERFECT &mdash; show &#x270A; fist to start';
      posInstructionEl.style.color = 'var(--green)';
    }
  } else if (diff < 0) {
    posInstructionEl.innerHTML = `&#x2B07; MOVE BACK ${Math.abs(diff).toFixed(1)} ft`;
    posInstructionEl.style.color = 'var(--accent)';
    posDistanceEl.style.color = 'var(--accent)';
  } else {
    posInstructionEl.innerHTML = `&#x2B06; MOVE FORWARD ${diff.toFixed(1)} ft`;
    posInstructionEl.style.color = 'var(--orange)';
    posDistanceEl.style.color = 'var(--orange)';
  }

  // Auto-trigger start when fist held while in position.
  // Hand the Position Coach camera stream off to the main camera feed so
  // the stop-fist gesture also works without the user flipping switches.
  if (gestureArmed && positionOK && fistFrames >= FIST_HOLD_FRAMES && !state.running) {
    gestureArmed = false;
    console.log('[Gesture] Fist trigger — starting practice');
    closePositionCoach(true);     // true = transfer stream to main cam
    setTimeout(() => startBtn.click(), 200);
    return;
  }

  posLoopId = requestAnimationFrame(posDetectLoop);
}

$('positionBtn').addEventListener('click', async () => {
  $('positionOverlay').style.display = 'flex';
  posInstructionEl.style.color = 'var(--muted)';
  posDistanceEl.style.color = 'var(--accent)';
  posDistanceEl.textContent = '— ft';
  fistFrames = 0;
  gestureArmed = false;

  try {
    // Request high resolution so a small face is still detectable at distance
    posStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    posVideo.srcObject = posStream;
    await new Promise(r => {
      if (posVideo.readyState >= 1) return r();
      posVideo.onloadedmetadata = r;
    });
  } catch (err) {
    console.error(err);
    posInstructionEl.textContent = 'Camera access denied';
    posInstructionEl.style.color = 'var(--red)';
    return;
  }

  const ok = await initMediaPipe();
  if (!ok) return;

  posInstructionEl.textContent = 'Stand back to begin...';
  posLoopId = requestAnimationFrame(posDetectLoop);
  // Arm gesture after a short grace period so user can settle into position
  setTimeout(() => { gestureArmed = true; }, 1500);
});

$('closePosition').addEventListener('click', () => closePositionCoach(false));

function closePositionCoach(transferStreamToMainCam = false) {
  $('positionOverlay').style.display = 'none';
  if (posLoopId) cancelAnimationFrame(posLoopId);
  posLoopId = null;
  if (posStream) {
    if (transferStreamToMainCam) {
      // Hand live stream to the main camera feed so Stop gesture + self-view
      // keep working seamlessly. No tracks stopped.
      state.camStream = posStream;
      cameraFeed.srcObject = posStream;
      cameraOverlay.classList.add('hidden');
      cameraBtn.textContent = 'Disable Camera';
    } else {
      posStream.getTracks().forEach(t => t.stop());
    }
    posStream = null;
  }
  posVideo.srcObject = null;
  fistFrames = 0;
  gestureArmed = false;
}

$('recalibrate').addEventListener('click', () => {
  const face = detectFaceOnce();
  const target = parseFloat($('posTarget').value) || 10;
  if (face && face.boundingBox.width > 20) {
    calibrationFactor = 1.0;
    const rawFt = distanceFromFacePx(face.boundingBox.width, posVideo.videoWidth);
    calibrationFactor = target / rawFt;
    console.log(`[Calibrate face] raw=${rawFt.toFixed(2)}ft → factor=${calibrationFactor.toFixed(3)}`);
    return;
  }
  // Fall back to shoulder-based calibration
  if (poseLandmarker && posVideo.videoWidth) {
    const pRes = poseLandmarker.detectForVideo(posVideo, performance.now());
    const lm = pRes.landmarks?.[0];
    if (lm && lm[11] && lm[12]) {
      const dx = Math.abs(lm[12].x - lm[11].x);
      const dy = Math.abs(lm[12].y - lm[11].y);
      const shoulderPx = Math.sqrt(dx*dx + dy*dy) * posVideo.videoWidth;
      calibrationFactor = 1.0;
      const rawFt = distanceFromShoulderPx(shoulderPx, posVideo.videoWidth);
      calibrationFactor = target / rawFt;
      console.log(`[Calibrate shoulders] raw=${rawFt.toFixed(2)}ft → factor=${calibrationFactor.toFixed(3)}`);
      return;
    }
  }
  alert('No face or body visible — step into frame first.');
});

// ── Gesture watcher on the MAIN camera feed (to stop practice with a fist) ──

function startMainCamGestureLoop() {
  if (mainCamGestureLoopId) cancelAnimationFrame(mainCamGestureLoopId);
  if (!gestureRecognizer || !cameraFeed.videoWidth) return;
  practiceFistFrames = 0;
  practiceFistArmed = false;
  // Grace period so the fist used to START doesn't immediately STOP
  setTimeout(() => { practiceFistArmed = true; }, 3000);

  const loop = () => {
    if (!state.running || !state.camStream) { mainCamGestureLoopId = null; return; }
    if (cameraFeed.videoWidth) {
      try {
        const r = gestureRecognizer.recognizeForVideo(cameraFeed, performance.now());
        const name = r.gestures?.[0]?.[0]?.categoryName;
        if (name === 'Closed_Fist') practiceFistFrames++;
        else practiceFistFrames = 0;

        if (practiceFistArmed && practiceFistFrames >= FIST_HOLD_FRAMES) {
          console.log('[Gesture] Fist trigger — stopping practice');
          practiceFistArmed = false;
          stopBtn.click();
          return;
        }
      } catch (err) {
        console.warn('[Main cam gesture]', err);
      }
    }
    mainCamGestureLoopId = requestAnimationFrame(loop);
  };
  mainCamGestureLoopId = requestAnimationFrame(loop);
}

function stopMainCamGestureLoop() {
  if (mainCamGestureLoopId) cancelAnimationFrame(mainCamGestureLoopId);
  mainCamGestureLoopId = null;
}

// ── Projection threshold slider ────────────────────────────────────────────

$('projThreshold').addEventListener('input', function () {
  $('thresholdLabel').textContent = this.value + '%';
  thresholdMark.style.left = this.value + '%';
});
// Init marker position
thresholdMark.style.left = $('projThreshold').value + '%';

// ── Start / Stop / Reset ───────────────────────────────────────────────────

startBtn.addEventListener('click', async () => {
  state.running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  recordBadge.classList.add('active');
  transcriptBox.innerHTML = '';

  startTimer();
  try {
    await startAudio();
  } catch {
    alert('Microphone access denied. Please allow microphone access and refresh.');
    resetAll();
    return;
  }
  startSpeech();

  // If main camera is on AND gesture recognizer is loaded, watch for stop fist
  if (state.camStream && gestureRecognizer) startMainCamGestureLoop();
});

stopBtn.addEventListener('click', () => {
  state.running = false;
  stopBtn.disabled = true;
  startBtn.disabled = false;
  recordBadge.classList.remove('active');

  stopTimer();
  stopAudio();
  stopSpeech();
  stopMainCamGestureLoop();
  showGrade();
});

resetBtn.addEventListener('click', resetAll);

function resetAll() {
  state.running = false;
  stopTimer();
  stopAudio();
  stopSpeech();

  Object.assign(state, {
    elapsedSeconds: 0,
    goodFrames: 0, totalFrames: 0,
    fillerCounts: {}, totalFillers: 0,
    storyCount: 0, storyLog: [],
    iceBreakerCount: 0, iceBreakerLog: [],
    wordCount: 0,
    matchedKeyTerms: new Set(),
    finalTranscript: '', interimTranscript: '',
    lastInterimCounted: '', lastHeard: '',
    lastStoryAt: -30000, lastIceBreakerAt: -30000,
  });

  const lastHeardEl = $('lastHeard');
  if (lastHeardEl) lastHeardEl.textContent = '';

  timerDisplay.textContent = '00:00';
  volumeFill.style.width = '0%';
  projStatus.textContent = '—';
  projStatus.style.color = 'var(--muted)';
  projPct.textContent = 'Good projection: 0%';
  fillerCountEl.textContent = '0';
  fillersPerMin.textContent = '0.0 per minute';
  fillerTags.innerHTML = '';
  storyCountEl.textContent = '0';
  storyLog.innerHTML = '';
  $('iceCount').textContent = '0';
  $('iceLog').innerHTML = '';
  $('wpmCount').textContent = '0';
  $('energyStatus').textContent = '—';
  $('energyStatus').style.color = 'var(--muted)';
  if (state.manualKeyTerms.length === 0) {
    $('accuracyPct').textContent = '—';
    $('accuracySub').textContent = 'upload manual to enable';
  } else {
    $('accuracyPct').textContent = '0%';
    $('accuracySub').textContent = `0 / ${state.manualKeyTerms.length} key terms`;
  }
  $('missedTerms').innerHTML = '';
  transcriptBox.innerHTML = '<span class="placeholder-text">Transcript will appear here once you start...</span>';

  startBtn.disabled = false;
  stopBtn.disabled = true;
  recordBadge.classList.remove('active');
  gradeModal.style.display = 'none';
}

// ── Grading ────────────────────────────────────────────────────────────────
// Strict-supervisor rubric, 6 categories totaling 100 points:
//   Accuracy of Information ........... 20
//   Voice Projection .................. 15
//   Energy (words/min) ................ 15
//   Storytelling ...................... 20
//   Ice Breaker Questions ............. 15
//   Filler Control .................... 15

function showGrade() {
  const expectedStories     = parseInt($('expectedStories').value)    || 5;
  const expectedIceBreakers = parseInt($('expectedIceBreakers').value) || 3;
  const maxFillerRate       = parseFloat($('maxFillersPerMin').value) || 2;
  const minProjPct          = parseInt($('minProjectionPct').value)   || 65;
  const targetWPM           = parseInt($('targetWPM').value)          || 150;
  const rubricNotes         = $('rubricNotes').value.trim();

  const actualMin  = state.elapsedSeconds / 60;
  const fillerRate = actualMin > 0.05 ? state.totalFillers / actualMin : 0;
  const goodPct    = state.totalFrames ? (state.goodFrames / state.totalFrames) * 100 : 0;
  const wpm        = actualMin > 0.05 ? state.wordCount / actualMin : 0;
  const hasManual  = state.manualKeyTerms.length > 0;
  const coveragePct = hasManual
    ? (state.matchedKeyTerms.size / state.manualKeyTerms.length) * 100
    : 0;

  // ── 1. Accuracy /20 ──
  let aS, aG, aF;
  if (!hasManual) {
    aS = null; aG = 'fair';
    aF = `No tour manual was uploaded, so accuracy of information cannot be scored. Upload your manual (PDF or .docx) in the sidebar to enable this category — the grader will track how many key facts and named entities you mention.`;
  } else if (coveragePct >= 75) { aS = 20; aG = 'excellent';
    aF = `Strong — you covered ${coveragePct.toFixed(0)}% of the manual's key terms (${state.matchedKeyTerms.size}/${state.manualKeyTerms.length}). The content is in your head.`;
  } else if (coveragePct >= 55) { aS = 15; aG = 'good';
    aF = `Decent at ${coveragePct.toFixed(0)}% coverage. You hit the headlines but missed important specifics. Go back through the manual and identify what you skipped.`;
  } else if (coveragePct >= 35) { aS = 9; aG = 'fair';
    aF = `Weak — only ${coveragePct.toFixed(0)}% of manual content surfaced (${state.matchedKeyTerms.size}/${state.manualKeyTerms.length}). You're winging large sections. Guests can tell when you're guessing.`;
  } else { aS = 3; aG = 'poor';
    aF = `Critically low — ${coveragePct.toFixed(0)}% coverage. You barely touched the manual material. This is the single most important fix: you cannot guide a tour you don't know.`;
  }

  // ── 2. Voice Projection /15 ──
  let pS, pG, pF;
  if      (goodPct >= minProjPct * 1.15) { pS = 15; pG = 'excellent'; }
  else if (goodPct >= minProjPct)        { pS = 12; pG = 'good'; }
  else if (goodPct >= minProjPct * 0.75) { pS = 8;  pG = 'fair'; }
  else if (goodPct >= minProjPct * 0.5)  { pS = 4;  pG = 'poor'; }
  else                                   { pS = 1;  pG = 'poor'; }

  if (pS >= 13) pF = `Strong projection ${goodPct.toFixed(0)}% of the time. Guests at the back of the group can hear every word.`;
  else if (pS >= 10) pF = `Acceptable at ${goodPct.toFixed(0)}%, but not consistent. In larger groups you'll lose people. Project from the diaphragm and aim at the last row.`;
  else if (pS >= 6) pF = `Weak at ${goodPct.toFixed(0)}%. You drop your voice and guests lose the thread. Speak loudly enough that it feels almost too loud — that's usually right.`;
  else pF = `Inaudible most of the tour (${goodPct.toFixed(0)}%). If guests can't hear you, nothing else matters. Foundational failure.`;

  // ── 3. Energy /15 ──
  let eS, eG, eF;
  const ratioWPM = targetWPM > 0 ? wpm / targetWPM : 1;
  if      (ratioWPM >= 0.9 && ratioWPM <= 1.2) { eS = 15; eG = 'excellent'; }
  else if (ratioWPM >= 0.75 && ratioWPM <= 1.35) { eS = 11; eG = 'good'; }
  else if (ratioWPM >= 0.55 && ratioWPM <= 1.55) { eS = 6; eG = 'fair'; }
  else                                            { eS = 2; eG = 'poor'; }

  const slow = wpm < targetWPM * 0.9;
  if (eS >= 13) eF = `Engaged pace at ${wpm.toFixed(0)} WPM (target ${targetWPM}). Energetic but controlled.`;
  else if (eS >= 9) eF = `${slow ? 'A bit flat' : 'A bit rushed'} at ${wpm.toFixed(0)} WPM. ${slow ? 'Bring more vocal variety and pep — guests mirror your energy.' : "Pump the brakes; let key facts land."}`;
  else if (eS >= 5) eF = `${slow ? 'Low energy' : 'Rushed'} at ${wpm.toFixed(0)} WPM. ${slow ? 'You sound monotone — vary your pitch and pace to keep guests with you.' : 'You\'re sprinting; guests can\'t absorb information at this rate.'}`;
  else eF = `${slow ? 'Painfully slow' : 'Frantic'} at ${wpm.toFixed(0)} WPM. ${slow ? 'Long dead patches kill the tour.' : 'You sound nervous and untrustworthy.'} Target is around ${targetWPM} WPM.`;

  // ── 4. Storytelling /20 ──
  let sS, sG, sF;
  const ratio = expectedStories > 0 ? state.storyCount / expectedStories : 1;
  if      (ratio >= 1.0) { sS = 20; sG = 'excellent'; }
  else if (ratio >= 0.8) { sS = 16; sG = 'good'; }
  else if (ratio >= 0.6) { sS = 10; sG = 'fair'; }
  else if (ratio >= 0.4) { sS = 5;  sG = 'poor'; }
  else                   { sS = 1;  sG = 'poor'; }

  const missing = Math.max(0, expectedStories - state.storyCount);
  if (sS >= 18) sF = `Hit target with ${state.storyCount}/${expectedStories} stories. Stories are what guests remember — keep this up.`;
  else if (sS >= 13) sF = `${state.storyCount}/${expectedStories} stories — close, but you left ${missing} on the table. Every stop deserves a human moment.`;
  else if (sS >= 8) sF = `Only ${state.storyCount}/${expectedStories} stories. Missing ${missing}. You're giving a lecture, not a tour. Facts inform, stories transform.`;
  else sF = `${state.storyCount}/${expectedStories} stories. Without stories this is just a walking pamphlet. Major deficiency — add anecdotes at every major stop.`;

  // ── 5. Ice Breaker Questions /15 ──
  let iS, iG, iF;
  const iceRatio = expectedIceBreakers > 0 ? state.iceBreakerCount / expectedIceBreakers : 1;
  if      (iceRatio >= 1.0) { iS = 15; iG = 'excellent'; }
  else if (iceRatio >= 0.7) { iS = 11; iG = 'good'; }
  else if (iceRatio >= 0.4) { iS = 6;  iG = 'fair'; }
  else if (state.iceBreakerCount > 0) { iS = 3; iG = 'poor'; }
  else                                { iS = 0; iG = 'poor'; }

  if (iS >= 13) iF = `Great audience engagement — ${state.iceBreakerCount}/${expectedIceBreakers} audience questions. You're treating guests as participants, not spectators.`;
  else if (iS >= 9) iF = `${state.iceBreakerCount}/${expectedIceBreakers} ice breakers. Decent, but more would warm up the group. Try one at the start and one mid-tour to re-energize.`;
  else if (iS >= 4) iF = `Only ${state.iceBreakerCount}/${expectedIceBreakers} audience questions. The tour feels one-way. Ask things like "Do y'all huskies prefer coffee or tea?" to break the ice.`;
  else iF = `${state.iceBreakerCount} ice breakers — essentially none. You're talking AT guests, not WITH them. Plan at least ${expectedIceBreakers} short questions you can ask at scenic stops.`;

  // ── 6. Filler Control /15 (STRICT supervisor scale) ──
  // Professional speakers run ~0.1-0.3 fillers/min. Anything above 1/min is
  // immediately noticeable to guests. Anything above the user's set max is poor.
  let fS, fG, fF;
  if      (fillerRate < 0.3)                  { fS = 15; fG = 'excellent'; }
  else if (fillerRate < 0.6)                  { fS = 12; fG = 'good'; }
  else if (fillerRate < 1.0)                  { fS = 9;  fG = 'fair'; }
  else if (fillerRate < maxFillerRate)        { fS = 6;  fG = 'fair'; }
  else if (fillerRate < maxFillerRate * 1.5)  { fS = 3;  fG = 'poor'; }
  else if (fillerRate < maxFillerRate * 2.5)  { fS = 1;  fG = 'poor'; }
  else                                        { fS = 0;  fG = 'poor'; }

  const topFillers = Object.entries(state.fillerCounts)
    .sort((a,b) => b[1]-a[1]).slice(0,3)
    .map(([w,c]) => `"${w}" (${c}×)`).join(', ');

  if (fS >= 13) fF = `Tight filler control — ${fillerRate.toFixed(2)}/min (${state.totalFillers} total in ${actualMin.toFixed(1)} min). You sound prepared.`;
  else if (fS >= 10) fF = `Good but not great — ${fillerRate.toFixed(2)}/min (${state.totalFillers} total). Worst offenders: ${topFillers || 'none'}. A pause is more powerful than a filler.`;
  else if (fS >= 7) fF = `Noticeable filler problem — ${fillerRate.toFixed(2)}/min (${state.totalFillers} total). Top offenders: ${topFillers || 'none'}. Guests start counting your "${(topFillers||'').split('"')[1] || 'fillers'}" instead of listening to the content.`;
  else if (fS >= 4) fF = `Too many fillers — ${fillerRate.toFixed(2)}/min (${state.totalFillers} total). Offenders: ${topFillers || 'none'}. This is undermining your credibility on every stop.`;
  else fF = `Unacceptable — ${fillerRate.toFixed(2)}/min (${state.totalFillers} total fillers). Offenders: ${topFillers || 'none'}. Record yourself and listen back; this is the fastest cure.`;

  // ── Overall ──
  // Renormalize if accuracy is skipped (no manual)
  const earnedCats = [pS, eS, sS, iS, fS].reduce((a,b)=>a+b,0);
  const maxCats    = 15 + 15 + 20 + 15 + 15; // 80
  const total = hasManual
    ? (aS + earnedCats)
    : Math.round((earnedCats / maxCats) * 100);

  let letter, letterColor, verdict;
  if      (total >= 93) { letter='A+'; letterColor=`var(--green)`;  verdict='Outstanding — ready to lead tours independently.'; }
  else if (total >= 90) { letter='A';  letterColor=`var(--green)`;  verdict='Excellent — minor refinements needed.'; }
  else if (total >= 83) { letter='B+'; letterColor=`var(--accent)`; verdict='Good — solid foundation, clear areas to strengthen.'; }
  else if (total >= 80) { letter='B';  letterColor=`var(--accent)`; verdict='Satisfactory — shows promise, needs more reps.'; }
  else if (total >= 70) { letter='C';  letterColor=`var(--amber)`; verdict='Needs improvement — not yet ready for unsupervised tours.'; }
  else if (total >= 60) { letter='D';  letterColor=`var(--orange)`; verdict='Below expectations — significant work required.'; }
  else                  { letter='F';  letterColor=`var(--red)`;    verdict='Failing — fundamentals are not in place.'; }

  // ── Supervisor note ──
  const issues = [];
  if (hasManual && coveragePct < 60)               issues.push(`only ${coveragePct.toFixed(0)}% manual coverage`);
  if (goodPct < minProjPct)                        issues.push(`projection at ${goodPct.toFixed(0)}%`);
  if (wpm < targetWPM * 0.75 || wpm > targetWPM * 1.35) issues.push(`energy off (${wpm.toFixed(0)} WPM vs target ${targetWPM})`);
  if (state.storyCount < expectedStories * 0.8)    issues.push(`only ${state.storyCount}/${expectedStories} stories`);
  if (state.iceBreakerCount < expectedIceBreakers * 0.7) issues.push(`${state.iceBreakerCount}/${expectedIceBreakers} ice breakers`);
  if (fillerRate > maxFillerRate)                  issues.push(`${fillerRate.toFixed(2)} fillers/min`);

  let supervisorNote;
  if (total >= 90) {
    supervisorNote = `This is a strong performance. You demonstrate the core competencies of a good tour guide — accuracy, energy, storytelling, and audience engagement. Keep this preparation level and you will represent the program well. Don't get complacent.`;
  } else if (total >= 80) {
    supervisorNote = `Solid effort, but not yet polished. ${issues.length ? `Key issues: ${issues.join('; ')}. ` : ''}You have the foundation — now drill until delivery feels natural rather than rehearsed.`;
  } else if (total >= 70) {
    supervisorNote = `Not yet ready for a live audience. ${issues.length ? `Problems: ${issues.join('; ')}. ` : ''}You haven't fully internalized the material. Guests deserve a guide who is confident, engaging, and accurate — right now you're inconsistent on all three. Practice daily.`;
  } else if (total >= 60) {
    supervisorNote = `Below minimum standard. ${issues.length ? `Major issues: ${issues.join('; ')}. ` : ''}A weak orientation tour leaves a lasting negative impression on prospective students and families. You need significantly more preparation and focused work on each weak category above.`;
  } else {
    supervisorNote = `Not acceptable for a tour guide representing this institution. ${issues.length ? `Fundamental failures: ${issues.join('; ')}. ` : ''}You are not ready. Start from scratch, drill every section of the manual, build in stories and audience moments deliberately, and do not attempt a live tour until you consistently score above 80.`;
  }

  // ── Collect categories into a reorderable list ──
  const catsRaw = [
    { key: 'accuracy',    label: 'Accuracy of Information', score: aS, max: 20, grade: aG, feedback: aF, hasData: hasManual },
    { key: 'projection',  label: 'Voice Projection',        score: pS, max: 15, grade: pG, feedback: pF, hasData: true },
    { key: 'energy',      label: 'Energy',                  score: eS, max: 15, grade: eG, feedback: eF, hasData: true },
    { key: 'storytelling',label: 'Storytelling',            score: sS, max: 20, grade: sG, feedback: sF, hasData: true },
    { key: 'iceBreakers', label: 'Ice Breaker Questions',   score: iS, max: 15, grade: iG, feedback: iF, hasData: true },
    { key: 'fillers',     label: 'Filler Control',          score: fS, max: 15, grade: fG, feedback: fF, hasData: true },
  ];

  // Focus-first ordering: user-selected focus areas first (highlighted),
  // then everything else in their original order.
  const focusList = [...state.focusAreas];
  const focusCats    = focusList.map(k => catsRaw.find(c => c.key === k)).filter(Boolean);
  const nonFocusCats = catsRaw.filter(c => !state.focusAreas.has(c.key));

  const renderCat = (c, isFocus) => {
    if (c.key === 'accuracy' && !c.hasData) {
      return `
        <div class="grade-cat fair ${isFocus ? 'focus-cat' : ''}" style="opacity:0.85">
          ${isFocus ? '<div class="focus-badge">★ Focus</div>' : ''}
          <div class="cat-header">
            <span class="cat-name">${c.label}</span>
            <span class="cat-score" style="color:var(--muted)">N/A</span>
          </div>
          <div class="cat-feedback">${c.feedback}</div>
        </div>`;
    }
    return cat(c.label, c.score, c.max, c.grade, c.feedback, letterColor, isFocus);
  };

  const focusHtml    = focusCats.map(c => renderCat(c, true)).join('');
  const nonFocusHtml = nonFocusCats.map(c => renderCat(c, false)).join('');

  const scoreLabel = hasManual ? `${total} / 100` : `${total} / 100 (Accuracy skipped)`;

  // Build summary donut: one slice per category, size = score, color = tier
  const totalPossible = catsRaw.reduce((a, c) => a + (c.score != null ? c.max : 0), 0);
  const donutSvg = buildDonut(catsRaw, totalPossible);

  // Horizontal bar overview — one bar per category
  const barsHtml = catsRaw.map(c => {
    if (c.score == null) {
      return `<div class="score-bar-row">
        <span class="score-bar-label">${c.label}</span>
        <div class="score-bar"><div class="score-bar-fill" style="width:0%; background:var(--muted)"></div></div>
        <span class="score-bar-val" style="color:var(--muted)">N/A</span>
      </div>`;
    }
    const pct = Math.round((c.score / c.max) * 100);
    const color = c.grade === 'excellent' ? 'var(--green)'
                : c.grade === 'good'      ? 'var(--teal)'
                : c.grade === 'fair'      ? 'var(--amber)'
                                          : 'var(--red)';
    return `<div class="score-bar-row">
      <span class="score-bar-label">${c.label}</span>
      <div class="score-bar"><div class="score-bar-fill" style="width:${pct}%; background:${color}"></div></div>
      <span class="score-bar-val">${c.score}/${c.max}</span>
    </div>`;
  }).join('');

  const modeChip = `<span class="grade-mode-chip ${state.mode}">${state.mode.toUpperCase()} MODE</span>`;

  gradeContent.innerHTML = `
    <div class="grade-overall">
      ${modeChip}
      <div class="grade-letter" style="color:${letterColor}">${letter}</div>
      <div class="grade-score">${scoreLabel}</div>
      <div class="grade-verdict">${verdict}</div>
      <div class="grade-stats">
        ${fmt(state.elapsedSeconds)} elapsed &bull; ${state.totalFillers} fillers
        (${fillerRate.toFixed(2)}/min) &bull; ${state.storyCount} stories &bull;
        ${state.iceBreakerCount} ice breakers &bull; ${wpm.toFixed(0)} WPM &bull;
        ${goodPct.toFixed(0)}% good projection
        ${hasManual ? ` &bull; ${coveragePct.toFixed(0)}% manual coverage` : ''}
      </div>
    </div>

    <div class="grade-visual">
      <div class="grade-visual-donut">${donutSvg}</div>
      <div class="grade-visual-bars">${barsHtml}</div>
    </div>

    ${focusCats.length ? `
      <div class="grade-section-title"><span>&#x2605;</span> Your focus for this session</div>
      <div class="grade-cats">${focusHtml}</div>
      <div class="grade-section-title grade-section-title-muted">Everything else</div>
    ` : ''}

    <div class="grade-cats">
      ${nonFocusHtml}
    </div>

    ${rubricNotes ? `
      <div style="padding:0 22px 16px; font-size:0.78rem; color:var(--muted); line-height:1.6">
        <strong style="color:var(--text)">Custom Rubric Notes:</strong><br>${escapeHtml(rubricNotes)}
      </div>` : ''}

    <div class="supervisor-note">
      <strong>Supervisor's Assessment</strong>
      ${supervisorNote}
    </div>
  `;

  gradeModal.style.display = 'flex';

  // Animate bars
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.cat-bar-fill[data-w]').forEach(el => {
      el.style.width = el.dataset.w;
    });
  }));

  // Persist full session (including the rendered report HTML) so we can
  // replay it from the dashboard later.
  saveSession({
    date: new Date().toISOString(),
    durationSec: state.elapsedSeconds,
    totalScore: total,
    letter,
    categories: {
      accuracy: aS,
      projection: pS,
      energy: eS,
      storytelling: sS,
      iceBreakers: iS,
      fillers: fS,
    },
    fillerCount: state.totalFillers,
    fillerRate: +fillerRate.toFixed(2),
    storyCount: state.storyCount,
    iceBreakerCount: state.iceBreakerCount,
    wpm: Math.round(wpm),
    goodProjectionPct: Math.round(goodPct),
    coveragePct: hasManual ? Math.round(coveragePct) : null,
    hasManual,
    verdict,
    supervisorNote,
    reportHtml: gradeContent.innerHTML,   // full report for replay
  });
}

// ── Session history (localStorage) ─────────────────────────────────────────
const STORAGE_KEY = 'tourPracticeSessions';

function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveSession(s) {
  if (s.durationSec < 10) return; // skip accidental tiny sessions
  const all = loadSessions();
  all.push(s);
  // Cap to last 100 sessions
  if (all.length > 100) all.splice(0, all.length - 100);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('Could not persist session:', err);
  }
}

function clearSessions() {
  if (confirm('Delete ALL saved practice sessions? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY);
    renderDashboard();
  }
}

function renderDashboard() {
  const sessions = loadSessions().slice().reverse(); // newest first
  const el = $('dashContent');

  if (sessions.length === 0) {
    el.innerHTML = `
      <div class="dash-empty">
        <div class="dash-empty-art">${EMPTY_STATE_SVG}</div>
        <strong>No sessions yet.</strong><br>
        Complete a practice and grade it &mdash; your scores will be saved here automatically.
      </div>`;
    return;
  }

  const best = Math.max(...sessions.map(s => s.totalScore));
  const avg = Math.round(sessions.reduce((a,b) => a + b.totalScore, 0) / sessions.length);
  const last7 = sessions.slice(0, 7);
  const last7Avg = last7.length ? Math.round(last7.reduce((a,b) => a + b.totalScore, 0) / last7.length) : 0;

  // Build SVG trend chart (oldest left → newest right)
  const trendData = sessions.slice().reverse(); // chronological for chart
  const chartW = 720, chartH = 180, padL = 36, padR = 12, padT = 14, padB = 24;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const maxScore = 100;
  const n = trendData.length;
  const pointX = i => n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;
  const pointY = v => padT + plotH - (v / maxScore) * plotH;

  const pathD = trendData.map((s, i) => `${i === 0 ? 'M' : 'L'} ${pointX(i)} ${pointY(s.totalScore)}`).join(' ');
  const areaD = pathD + ` L ${pointX(n-1)} ${padT + plotH} L ${pointX(0)} ${padT + plotH} Z`;

  const yTicks = [0, 25, 50, 75, 100].map(v => `
    <line x1="${padL}" y1="${pointY(v)}" x2="${chartW - padR}" y2="${pointY(v)}" stroke="var(--border-2)" stroke-dasharray="2,3"/>
    <text x="${padL - 6}" y="${pointY(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${v}</text>`).join('');

  const dots = trendData.map((s, i) => `
    <circle cx="${pointX(i)}" cy="${pointY(s.totalScore)}" r="4" fill="var(--accent)" stroke="white" stroke-width="2">
      <title>${new Date(s.date).toLocaleString()} — ${s.totalScore}/100 (${s.letter})</title>
    </circle>`).join('');

  const chart = `
    <svg viewBox="0 0 ${chartW} ${chartH}" class="dash-chart">
      ${yTicks}
      <path d="${areaD}" fill="url(#grad)" opacity="0.25"/>
      <defs>
        <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#4338ca"/>
          <stop offset="100%" stop-color="#4338ca" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${pathD}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
      ${dots}
    </svg>`;

  const rows = sessions.slice(0, 25).map((s, idx) => {
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `
      <tr data-session-idx="${idx}" title="Click to view full feedback">
        <td>
          <div class="dash-date">${dateStr}</div>
          <div class="dash-time">${timeStr}</div>
        </td>
        <td><span class="dash-letter dash-letter-${letterTone(s.letter)}">${s.letter}</span> ${s.totalScore}</td>
        <td>${fmt(s.durationSec)}</td>
        <td>${s.fillerCount}<br><span class="dash-sub">${s.fillerRate}/min</span></td>
        <td>${s.storyCount}</td>
        <td>${s.iceBreakerCount}</td>
        <td>${s.wpm}<br><span class="dash-sub">WPM</span></td>
        <td>${s.goodProjectionPct}%</td>
        <td>${s.coveragePct != null ? s.coveragePct + '%' : '—'}</td>
        <td><span class="view-link">View &rarr;</span></td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="dash-stats">
      <div class="dash-stat"><div class="dash-stat-label">Sessions</div><div class="dash-stat-value">${sessions.length}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Best Score</div><div class="dash-stat-value">${best}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Lifetime Avg</div><div class="dash-stat-value">${avg}</div></div>
      <div class="dash-stat"><div class="dash-stat-label">Last 7 Avg</div><div class="dash-stat-value">${last7Avg}</div></div>
    </div>

    <div class="dash-chart-wrap">
      <div class="dash-chart-title">Total Score Trend</div>
      ${chart}
    </div>

    <div class="dash-table-wrap">
      <div class="dash-table-title">Recent Sessions &mdash; click any row for full feedback</div>
      <table class="dash-table">
        <thead>
          <tr>
            <th>When</th><th>Score</th><th>Duration</th><th>Fillers</th>
            <th>Stories</th><th>Ice Br.</th><th>Pace</th><th>Proj</th><th>Acc</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      ${sessions.length > 25 ? `<div class="dash-more">+ ${sessions.length - 25} earlier sessions</div>` : ''}
    </div>
  `;

  // Wire row clicks → open the saved report
  el.querySelectorAll('.dash-table tbody tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const idx = parseInt(tr.dataset.sessionIdx, 10);
      viewSession(sessions[idx]);
    });
  });
}

function viewSession(session) {
  if (!session) return;
  if (session.reportHtml) {
    gradeContent.innerHTML = session.reportHtml;
  } else {
    // Older session without saved HTML — render a stripped-down summary
    const cats = Object.entries(session.categories || {})
      .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('');
    gradeContent.innerHTML = `
      <div class="grade-overall">
        <div class="grade-letter">${session.letter || ''}</div>
        <div class="grade-score">${session.totalScore || 0} / 100</div>
        <div class="grade-verdict">${session.verdict || ''}</div>
      </div>
      <div style="padding:18px 24px"><ul>${cats}</ul></div>
      ${session.supervisorNote ? `
        <div class="supervisor-note">
          <strong>Supervisor's Assessment</strong>${session.supervisorNote}
        </div>` : ''}`;
  }
  gradeModal.style.display = 'flex';
  // Re-animate bars on the restored content
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('.cat-bar-fill[data-w]').forEach(el => {
      el.style.width = el.dataset.w;
    });
  }));
}

function letterTone(letter) {
  if (!letter) return 'mid';
  if (letter.startsWith('A')) return 'high';
  if (letter.startsWith('B')) return 'good';
  if (letter === 'C') return 'mid';
  return 'low';
}

function cat(name, score, max, grade, feedback, accentColor, isFocus = false) {
  const pct = Math.round((score / max) * 100);
  const colors = { excellent: 'var(--green)', good: 'var(--teal)', fair: 'var(--amber)', poor: 'var(--red)' };
  const c = colors[grade] || accentColor;
  return `
    <div class="grade-cat ${grade} ${isFocus ? 'focus-cat' : ''}">
      ${isFocus ? '<div class="focus-badge">&#x2605; Focus area</div>' : ''}
      <div class="cat-header">
        <span class="cat-name">${name}</span>
        <span class="cat-score" style="color:${c}">${score}/${max}</span>
      </div>
      <div class="cat-bar">
        <div class="cat-bar-fill" style="background:${c}" data-w="${pct}%"></div>
      </div>
      <div class="cat-feedback">${feedback}</div>
    </div>`;
}

// ── Donut-chart summary for Performance Report ────────────────────────────
function buildDonut(cats, totalPossible) {
  const scored = cats.filter(c => c.score != null);
  const totalScore = scored.reduce((a, c) => a + c.score, 0);
  const pct = totalPossible > 0 ? Math.round((totalScore / totalPossible) * 100) : 0;

  // Palette per category (muted / sophisticated from reference)
  const palette = {
    accuracy:    '#6E4F72',
    projection:  '#3F6E71',
    energy:      '#C19056',
    storytelling:'#6B8E5C',
    iceBreakers: '#A3637D',
    fillers:     '#8A6B91',
  };

  const size = 180;
  const r = 70;
  const sw = 22;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const sumAll = scored.reduce((a, c) => a + c.max, 0);
  const slices = scored.map(c => {
    const frac = c.max / sumAll;
    const dash = frac * circumference;
    const scoreFrac = c.score / c.max;
    const fillDash = dash * scoreFrac;
    // Background track slice
    const bgSlice = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="rgba(42,35,66,0.08)" stroke-width="${sw}"
        stroke-dasharray="${dash - 2} ${circumference}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 ${cx} ${cy})"/>`;
    // Filled slice (score portion)
    const fgSlice = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${palette[c.key] || '#6E4F72'}" stroke-width="${sw}"
        stroke-dasharray="${fillDash} ${circumference}" stroke-dashoffset="${-offset}"
        stroke-linecap="butt"
        transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += dash;
    return bgSlice + fgSlice;
  }).join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="donut-svg">
      ${slices}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut-pct">${pct}%</text>
      <text x="${cx}" y="${cy + 18}" text-anchor="middle" class="donut-lbl">overall</text>
    </svg>`;
}

// ── Modal close ────────────────────────────────────────────────────────────

function closeGradeAndReturn() {
  gradeModal.style.display = 'none';
  // If we just finished a real session (timer ran), return to dashboard
  // so the user immediately sees their new entry. Skip when viewing an
  // old session from the dashboard.
  if (state.elapsedSeconds > 0 && !state.running) {
    state.elapsedSeconds = 0;
    timerDisplay.textContent = '00:00';
    showDashboardView();
  }
}

$('closeGrade').addEventListener('click',  closeGradeAndReturn);
$('closeGrade2').addEventListener('click', closeGradeAndReturn);

// ── View switching (Dashboard ⇄ Practice) ─────────────────────────────────

function showDashboardView() {
  if (state.running) {
    if (!confirm('Practice is still running. Leave anyway? Your current run will be discarded.')) return;
    resetAll();
  }
  document.body.classList.remove('view-practice');
  document.body.classList.add('view-dashboard');
  renderDashboard();
}

function showPracticeView() {
  document.body.classList.remove('view-dashboard');
  document.body.classList.add('view-practice');
}

$('newSessionBtn').addEventListener('click', showPracticeView);
$('newSessionBtn2').addEventListener('click', showPracticeView);
$('backToDashBtn').addEventListener('click', showDashboardView);
$('clearHistory').addEventListener('click', clearSessions);

// ── Difficulty mode selector ───────────────────────────────────────────────

function applyMode(mode) {
  state.mode = mode;
  const preset = MODE_PRESETS[mode] || MODE_PRESETS.medium;
  for (const [id, val] of Object.entries(preset)) {
    const el = $(id);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  // Update visual state of mode pills
  document.querySelectorAll('#modePills .mode-pill').forEach(p =>
    p.classList.toggle('active', p.dataset.mode === mode)
  );
}

document.querySelectorAll('#modePills .mode-pill').forEach(p => {
  p.addEventListener('click', () => applyMode(p.dataset.mode));
});

// ── Focus-area chips ──────────────────────────────────────────────────────

document.querySelectorAll('#focusChips input[type="checkbox"]').forEach(cb => {
  cb.addEventListener('change', () => {
    const key = cb.value;
    if (cb.checked) {
      if (state.focusAreas.size >= 3) {
        cb.checked = false;
        return;    // enforce max 3
      }
      state.focusAreas.add(key);
    } else {
      state.focusAreas.delete(key);
    }
    cb.closest('.focus-chip').classList.toggle('checked', cb.checked);
  });
});

// Apply medium preset on load so inputs match UI
applyMode('medium');

// ── Interactive Help (Inspect + Tour, GarageBand-style) ───────────────────
//
// State machine:
//   off → inspect (1st click) → tour (2nd click) → off (3rd click or Esc)
//
// In INSPECT mode: hovering a tagged element outlines it; clicking shows
// an anchored popover with a short explanation. Click ? again or press
// Esc to leave. The page is still readable underneath.
//
// In TOUR mode: a spotlight darkens the page except for the current
// target, with a popover offering Prev / Next / Done. Walks through all
// [data-help-title] elements visible in the current view.

const help = {
  mode: 'off',   // 'off' | 'inspect' | 'tour'
  tourIndex: 0,
  popover: null,
  spotlight: null,
  banner: null,
  highlighted: null,
};

function helpBtnClick() {
  if (help.mode === 'off')         enterInspect();
  else if (help.mode === 'inspect') enterTour();
  else                              exitHelp();
}

function enterInspect() {
  help.mode = 'inspect';
  document.body.classList.add('help-inspect');
  showHelpBanner('Tap any highlighted area to learn what it does. Click <strong>?</strong> again for a guided tour. Press <kbd>Esc</kbd> to exit.');
}

function enterTour() {
  exitInspectVisuals();
  help.mode = 'tour';
  document.body.classList.remove('help-inspect');
  document.body.classList.add('help-tour');
  hideHelpBanner();
  help.tourIndex = 0;
  showTourStep();
}

function exitInspectVisuals() {
  hidePopover();
}

function exitHelp() {
  help.mode = 'off';
  document.body.classList.remove('help-inspect', 'help-tour');
  hidePopover();
  hideSpotlight();
  hideHelpBanner();
}

function showHelpBanner(html) {
  hideHelpBanner();
  const b = document.createElement('div');
  b.className = 'help-banner';
  b.innerHTML = `
    <span class="help-banner-icon">?</span>
    <span class="help-banner-text">${html}</span>
    <button class="help-banner-close" type="button" aria-label="Exit help">&times;</button>
  `;
  document.body.appendChild(b);
  help.banner = b;
  b.querySelector('.help-banner-close').addEventListener('click', exitHelp);
}
function hideHelpBanner() {
  if (help.banner) { help.banner.remove(); help.banner = null; }
}

function showPopover(target, { isTour = false, tourStep, tourTotal } = {}) {
  hidePopover();
  const title = target.dataset.helpTitle;
  const text  = target.dataset.helpText;

  const pop = document.createElement('div');
  pop.className = 'help-popover' + (isTour ? ' help-tour-popover' : '');
  pop.innerHTML = `
    ${isTour ? `<div class="help-tour-counter">Step ${tourStep} of ${tourTotal}</div>` : ''}
    <div class="help-popover-title">${title}</div>
    <div class="help-popover-text">${text}</div>
    ${isTour
      ? `<div class="help-tour-nav">
          <button class="help-tour-btn" id="helpTourPrev" ${tourStep === 1 ? 'disabled' : ''}>&larr; Prev</button>
          <button class="help-tour-btn primary" id="helpTourNext">${tourStep === tourTotal ? 'Done' : 'Next &rarr;'}</button>
         </div>`
      : `<button class="help-popover-close" type="button" aria-label="Close">&times;</button>`}
  `;
  document.body.appendChild(pop);
  help.popover = pop;

  positionPopover(pop, target);

  // Highlight the target
  if (help.highlighted) help.highlighted.classList.remove('help-highlight');
  target.classList.add('help-highlight');
  help.highlighted = target;

  // Wire popover buttons
  pop.querySelector('.help-popover-close')?.addEventListener('click', e => {
    e.stopPropagation();
    hidePopover();
  });
  pop.querySelector('#helpTourPrev')?.addEventListener('click', e => {
    e.stopPropagation();
    if (help.tourIndex > 0) { help.tourIndex--; showTourStep(); }
  });
  pop.querySelector('#helpTourNext')?.addEventListener('click', e => {
    e.stopPropagation();
    const targets = getTourTargets();
    if (help.tourIndex >= targets.length - 1) exitHelp();
    else { help.tourIndex++; showTourStep(); }
  });
}

function positionPopover(pop, target) {
  // Wait one frame so layout is settled
  requestAnimationFrame(() => {
    const r = target.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const margin = 14;

    let top = r.bottom + margin;
    let left = r.left + r.width / 2 - pw / 2;

    // If no room below, try above
    if (top + ph > window.innerHeight - 12) top = r.top - ph - margin;
    // If still off-screen (target is huge), pin to top
    if (top < 12) top = 12;

    // Clamp horizontally
    left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));

    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  });
}

function hidePopover() {
  if (help.popover) { help.popover.remove(); help.popover = null; }
  if (help.highlighted) {
    help.highlighted.classList.remove('help-highlight');
    help.highlighted = null;
  }
}

function getTourTargets() {
  // Only elements currently visible (in the active view)
  return [...document.querySelectorAll('[data-help-title]')].filter(el => {
    const r = el.getBoundingClientRect();
    return el.offsetParent !== null && r.width > 0 && r.height > 0;
  });
}

function showTourStep() {
  const targets = getTourTargets();
  if (targets.length === 0) { exitHelp(); return; }
  if (help.tourIndex >= targets.length) { exitHelp(); return; }

  const target = targets[help.tourIndex];
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Give scroll a beat to settle before measuring
  setTimeout(() => {
    showSpotlight(target);
    showPopover(target, {
      isTour: true,
      tourStep: help.tourIndex + 1,
      tourTotal: targets.length,
    });
  }, 220);
}

function showSpotlight(target) {
  hideSpotlight();
  const r = target.getBoundingClientRect();
  const pad = 8;
  const ring = document.createElement('div');
  ring.className = 'help-spotlight';
  ring.style.top    = `${r.top - pad}px`;
  ring.style.left   = `${r.left - pad}px`;
  ring.style.width  = `${r.width + pad * 2}px`;
  ring.style.height = `${r.height + pad * 2}px`;
  document.body.appendChild(ring);
  help.spotlight = ring;
}
function hideSpotlight() {
  if (help.spotlight) { help.spotlight.remove(); help.spotlight = null; }
}

// Wire the ? button
$('helpBtn').addEventListener('click', e => {
  e.stopPropagation();
  helpBtnClick();
});

// Escape always exits help
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && help.mode !== 'off') exitHelp();
});

// Inspect-mode capture: intercept clicks on tagged elements to show
// their popover instead of triggering their normal behavior.
document.addEventListener('click', e => {
  if (help.mode !== 'inspect') return;
  // Allow clicks INSIDE the popover or banner to behave normally
  if (e.target.closest('.help-popover, .help-banner, #helpBtn')) return;

  const target = e.target.closest('[data-help-title]');
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    showPopover(target);
  } else {
    // Click on empty space — just close any open popover
    hidePopover();
  }
}, true); // capture phase so we run before the element's own handlers

// Re-position popover on window resize while it's open
window.addEventListener('resize', () => {
  if (help.popover && help.highlighted) positionPopover(help.popover, help.highlighted);
  if (help.spotlight && help.highlighted) {
    // Recompute spotlight to follow scroll/resize
    showSpotlight(help.highlighted);
    // Re-attach popover ref since showSpotlight removes the existing
    // ring element but not the popover.
  }
});

// Render the dashboard on page load
renderDashboard();

// ── Expected stories label sync ────────────────────────────────────────────

$('expectedStories').addEventListener('input', () => {
  storyTargetEl.textContent = `Target: ${$('expectedStories').value} stories`;
});
$('expectedIceBreakers').addEventListener('input', () => {
  $('iceTarget').textContent = `Target: ${$('expectedIceBreakers').value} questions`;
});
$('targetWPM').addEventListener('input', () => {
  $('wpmLabel').textContent = `words/min • target ${$('targetWPM').value}`;
});
