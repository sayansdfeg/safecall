/**
 * SafeCall Guardian - Main Application
 * Anti-scam protection app with real-time speech analysis
 */

// ==================== CONFIGURATION ====================
const CONFIG = {
  // Scam detection keywords (Russian)
  scamKeywords: [
    'код', 'подтверждения', 'банк', 'перевод', 'безопасность',
    'срочно', 'операция', 'деньги', 'карта', 'счет', 'личный',
    'пароль', 'пин', 'смс', 'подтвердить', 'безопасный'
  ],
  // Risk increment per keyword match
  riskIncrement: 20,
  // Maximum risk level
  maxRisk: 100,
  // Alert threshold
  alertThreshold: 80,
  // Demo mode messages
  demoMessages: [
    { text: 'Здравствуйте, это служба безопасности банка', risk: 0 },
    { text: 'Назовите код подтверждения из смс', risk: 30 },
    { text: 'Срочно подтвердите операцию перевода', risk: 60 },
    { text: 'Назовите полные данные вашей карты', risk: 85 }
  ]
};

// ==================== STATE ====================
let state = {
  currentScreen: 'incoming-call',
  riskLevel: 0,
  isDemoMode: false,
  recognition: null,
  isListening: false,
  transcript: [],
  alertTriggered: false
};

// ==================== DOM ELEMENTS ====================
const screens = {
  'incoming-call': document.getElementById('incoming-call'),
  'in-call': document.getElementById('in-call'),
  'alert-screen': document.getElementById('alert-screen')
};

const elements = {
  acceptBtn: document.getElementById('accept-btn'),
  declineBtn: document.getElementById('decline-btn'),
  transcript: document.getElementById('transcript'),
  riskValue: document.getElementById('risk-value'),
  demoBadge: document.getElementById('demo-badge')
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', init);

function init() {
  console.log('SafeCall Guardian initializing...');
  
  // Register service worker
  registerServiceWorker();
  
  // Setup event listeners
  setupEventListeners();
  
  // Check speech recognition support
  checkSpeechRecognitionSupport();
  
  // FIX 1 — AUTO START (без клика)
  setTimeout(() => {
    handleAcceptCall();
  }, 1200);
}

// ==================== SERVICE WORKER ====================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.log('Service Worker registration failed:', err));
  }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Accept call button
  elements.acceptBtn.addEventListener('click', handleAcceptCall);
  
  // Decline call button
  elements.declineBtn.addEventListener('click', handleDeclineCall);
  
  // Handle visibility change (background/foreground)
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

// ==================== SCREEN TRANSITIONS ====================
function showScreen(screenName) {
  // Hide all screens
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  
  // Show target screen
  const targetScreen = screens[screenName];
  if (targetScreen) {
    targetScreen.classList.add('active');
    state.currentScreen = screenName;
  }
}

// ==================== CALL HANDLING ====================
function handleAcceptCall() {
  console.log('Call accepted');
  
  // Trigger haptic feedback
  triggerHaptic('medium');
  
  // Transition to in-call screen
  showScreen('in-call');
  
  // Start protection
  startProtection();
}

function handleDeclineCall() {
  console.log('Call declined');
  
  // Trigger haptic feedback
  triggerHaptic('light');
  
  // Reset app
  resetApp();
}

// ==================== PROTECTION ====================
function startProtection() {
  console.log('Starting protection...');
  
  // Reset state
  state.riskLevel = 0;
  state.alertTriggered = false;
  state.transcript = [];
  
  // Update UI
  updateRiskDisplay(0);
  
  // Check if speech recognition is available
  if (state.isDemoMode) {
    startDemoMode();
  } else {
    startSpeechRecognition();
  }
}

// ==================== SPEECH RECOGNITION ====================
function checkSpeechRecognitionSupport() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.log('Speech recognition not supported, enabling demo mode');
    state.isDemoMode = true;
    return;
  }
  
  // Test microphone access
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      console.log('Microphone access granted');
      stream.getTracks().forEach(track => track.stop());
      state.isDemoMode = false;
    })
    .catch(err => {
      console.log('Microphone access denied, enabling demo mode:', err);
      state.isDemoMode = true;
    });
}

function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  state.recognition = new SpeechRecognition();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = 'ru-RU';
  
  // Handle results
  state.recognition.onresult = (event) => {
    let transcriptText = '';
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        transcriptText += result[0].transcript;
        processSpeech(result[0].transcript);
      }
    }
    
    if (transcriptText) {
      updateTranscript(transcriptText);
    }
  };
  
  // Handle errors
  state.recognition.onerror = (event) => {
    console.log('Speech recognition error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'no-speech') {
      switchToDemoMode();
    }
  };
  
  // Handle end
  state.recognition.onend = () => {
    if (state.isListening && !state.alertTriggered) {
      // Restart if still listening and not alert
      try {
        state.recognition.start();
      } catch (e) {
        console.log('Recognition restart failed:', e);
      }
    }
  };
  
  // Start recognition
  try {
    state.recognition.start();
    state.isListening = true;
    console.log('Speech recognition started');
  } catch (e) {
    console.log('Failed to start speech recognition:', e);
    switchToDemoMode();
  }
}

function switchToDemoMode() {
  console.log('Switching to demo mode');
  state.isDemoMode = true;
  state.isListening = false;
  
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {}
  }
  
  startDemoMode();
}

// ==================== DEMO MODE ====================
function startDemoMode() {
  console.log('Starting demo mode');
  
  // Show demo badge
  elements.demoBadge.classList.remove('hidden');
  
  // Simulate scam call
  let messageIndex = 0;
  
  const showNextMessage = () => {
    if (messageIndex >= CONFIG.demoMessages.length || state.alertTriggered) {
      return;
    }
    
    const message = CONFIG.demoMessages[messageIndex];
    
    // Update transcript
    updateTranscript(message.text);
    
    // Update risk
    updateRiskDisplay(message.risk);
    
    // Check for alert
    if (message.risk >= CONFIG.alertThreshold) {
      triggerAlert();
      return;
    }
    
    messageIndex++;
    
    // Show next message after delay
    setTimeout(showNextMessage, 2500);
  };
  
  // Start after short delay
  setTimeout(showNextMessage, 1500);
}

// ==================== SMART AI DETECTION ====================
function analyzeText(text) {
  let score = 0;
  const lower = text.toLowerCase();
  
  // Базовые ключевые слова с разным весом
  if (lower.includes('банк')) score += 15;
  if (lower.includes('код')) score += 30;
  if (lower.includes('срочно')) score += 20;
  if (lower.includes('подтверждение')) score += 25;
  if (lower.includes('перевод')) score += 20;
  if (lower.includes('деньги')) score += 15;
  if (lower.includes('карта')) score += 20;
  if (lower.includes('счет')) score += 15;
  if (lower.includes('смс')) score += 25;
  if (lower.includes('пароль')) score += 25;
  if (lower.includes('пин')) score += 30;
  if (lower.includes('безопасность')) score += 20;
  
  // Комбинации (контекстный анализ)
  if (lower.includes('код') && lower.includes('подтверждение')) score += 30;
  if (lower.includes('банк') && lower.includes('безопасность')) score += 25;
  if (lower.includes('срочно') && lower.includes('перевод')) score += 25;
  if (lower.includes('карта') && lower.includes('данные')) score += 30;
  if (lower.includes('смс') && lower.includes('код')) score += 35;
  
  return Math.min(score, 100);
}

// ==================== SPEECH PROCESSING ====================
function processSpeech(text) {
  console.log('Processing speech:', text);
  
  // FIX 6 — "AI думает" (задержка для ощущения нейросети)
  setTimeout(() => {
    // FIX 2 — Умный AI анализ
    const aiScore = analyzeText(text);
    
    if (aiScore > 0) {
      console.log('AI Risk Score:', aiScore);
      const newRisk = Math.min(state.riskLevel + aiScore, CONFIG.maxRisk);
      updateRiskDisplay(newRisk);
      
      // Check for alert
      if (newRisk >= CONFIG.alertThreshold && !state.alertTriggered) {
        triggerAlert();
      }
    }
  }, 300);
}

// ==================== UI UPDATES ====================
function updateTranscript(text) {
  // Add to transcript array
  state.transcript.push(text);
  
  // Keep only last 3 entries
  if (state.transcript.length > 3) {
    state.transcript.shift();
  }
  
  // Update display
  const transcriptHtml = state.transcript
    .map(t => `<div>${escapeHtml(t)}</div>`)
    .join('');
  
  elements.transcript.innerHTML = transcriptHtml || '<span class="transcript-placeholder">Listening...</span>';
}

function updateRiskDisplay(risk) {
  state.riskLevel = risk;
  
  // Update value
  elements.riskValue.textContent = `${risk}%`;
  
  // Update color class
  elements.riskValue.classList.remove('risk-low', 'risk-medium', 'risk-high');
  
  if (risk < 40) {
    elements.riskValue.classList.add('risk-low');
  } else if (risk < 70) {
    elements.riskValue.classList.add('risk-medium');
  } else {
    elements.riskValue.classList.add('risk-high');
  }
}

// ==================== ALERT ====================
function triggerAlert() {
  if (state.alertTriggered) return;
  
  console.log('ALERT TRIGGERED!');
  state.alertTriggered = true;
  state.isListening = false;
  
  // Stop speech recognition
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {}
  }
  
  // FIX 4 — SUPER ALERT (паника)
  // Body shake
  document.body.style.animation = 'shake 0.3s infinite';
  document.body.style.background = 'linear-gradient(180deg, #FF3B30 0%, #cc2a20 100%)';
  
  // Intense vibration pattern
  let vibrateInterval;
  vibrateInterval = setInterval(() => {
    navigator.vibrate([100, 50, 100]);
  }, 500);
  
  // Store interval to clear later
  state.vibrateInterval = vibrateInterval;
  
  // Trigger haptic feedback
  triggerHaptic('heavy');
  
  // Play alarm sound
  playAlarmSound();
  
  // Speak warning (FIX 5 — голос сильнее)
  speakWarning();
  
  // Show alert screen
  showScreen('alert-screen');
  
  // Auto-dismiss after 10 seconds (for demo)
  setTimeout(() => {
    console.log('Alert auto-dismissed');
    // Clear vibration
    if (vibrateInterval) clearInterval(vibrateInterval);
    document.body.style.animation = '';
    document.body.style.background = '';
    resetApp();
  }, 10000);
}

function playAlarmSound() {
  // Create alarm using Web Audio API
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create oscillator for alarm
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime + 0.2);
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.4);
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime + 0.6);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 1);
  } catch (e) {
    console.log('Audio not available');
  }
}

function speakWarning() {
  if ('speechSynthesis' in window) {
    // FIX 5 — голос сильнее
    const utterance = new SpeechSynthesisUtterance(
      'Внимание! Это может быть мошенник. Не сообщайте код.'
    );
    utterance.lang = 'ru-RU';
    utterance.rate = 1;
    utterance.pitch = 0.8;
    utterance.volume = 1;
    
    speechSynthesis.speak(utterance);
  }
}

// ==================== HAPTIC FEEDBACK ====================
function triggerHaptic(intensity) {
  if (!navigator.vibrate) return;
  
  const patterns = {
    light: [10],
    medium: [20],
    heavy: [50, 50, 50, 50]
  };
  
  const pattern = patterns[intensity] || patterns.medium;
  navigator.vibrate(pattern);
}

// ==================== UTILITIES ====================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function handleVisibilityChange() {
  if (document.hidden) {
    console.log('App hidden');
  } else {
    console.log('App visible');
  }
}

function resetApp() {
  console.log('Resetting app...');
  
  // Stop speech recognition
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {}
  }
  
  // Reset state
  state = {
    currentScreen: 'incoming-call',
    riskLevel: 0,
    isDemoMode: false,
    recognition: null,
    isListening: false,
    transcript: [],
    alertTriggered: false
  };
  
  // Check mic support again
  checkSpeechRecognitionSupport();
  
  // Reset UI
  elements.transcript.innerHTML = '<span class="transcript-placeholder">Listening...</span>';
  elements.demoBadge.classList.add('hidden');
  updateRiskDisplay(0);
  
  // Show incoming call screen
  showScreen('incoming-call');
}

// ==================== PWA INSTALL ====================
// Handle beforeinstallprompt
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.addEventListener('appinstalled', () => {
  console.log('PWA installed');
  deferredPrompt = null;
});