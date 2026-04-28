/**
 * SafeCall Guardian - Complete Application
 * Anti-scam protection app with real-time speech analysis
 */

// ==================== CONFIGURATION ====================
const CONFIG = {
  maxRisk: 100,
  alertThreshold: 80,
  demoMessages: [
    { text: 'Здравствуйте, это служба безопасности банка', risk: 0 },
    { text: 'Назовите код подтверждения из смс', risk: 30 },
    { text: 'Срочно подтвердите операцию перевода', risk: 60 },
    { text: 'Назовите полные данные вашей карты', risk: 85 }
  ]
};

// ==================== STATE ====================
let state = {
  currentScreen: 'onboarding',
  riskLevel: 0,
  isDemoMode: false,
  recognition: null,
  isListening: false,
  transcript: [],
  alertTriggered: false,
  vibrateInterval: null,
  hasOnboarded: localStorage.getItem('safecall_onboarded') === 'true'
};

// ==================== DOM ELEMENTS ====================
const screens = {
  'onboarding': document.getElementById('onboarding'),
  'home': document.getElementById('home'),
  'incoming-call': document.getElementById('incoming-call'),
  'in-call': document.getElementById('in-call'),
  'alert-screen': document.getElementById('alert-screen'),
  'contacts': document.getElementById('contacts'),
  'history': document.getElementById('history')
};

const elements = {
  startBtn: document.getElementById('start-btn'),
  simulateCallBtn: document.getElementById('simulate-call-btn'),
  contactsBtn: document.getElementById('contacts-btn'),
  historyBtn: document.getElementById('history-btn'),
  acceptBtn: document.getElementById('accept-btn'),
  declineBtn: document.getElementById('decline-btn'),
  sosBtn: document.getElementById('sos-btn'),
  transcript: document.getElementById('transcript'),
  riskValue: document.getElementById('risk-value'),
  demoBadge: document.getElementById('demo-badge'),
  contactInput: document.getElementById('contact-input'),
  addContactBtn: document.getElementById('add-contact-btn'),
  contactsList: document.getElementById('contacts-list'),
  historyList: document.getElementById('history-list'),
  contactsBackBtn: document.getElementById('contacts-back-btn'),
  historyBackBtn: document.getElementById('history-back-btn')
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
  
  // Load saved data
  loadContacts();
  loadHistory();
  
  // Show appropriate screen
  if (state.hasOnboarded) {
    showScreen('home');
  } else {
    showScreen('onboarding');
  }
}

// ==================== SERVICE WORKER ====================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker registered'))
      .catch(err => console.log('Service Worker registration failed:', err));
  }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Onboarding
  elements.startBtn.addEventListener('click', handleStart);
  
  // Home
  elements.simulateCallBtn.addEventListener('click', () => showScreen('incoming-call'));
  elements.contactsBtn.addEventListener('click', () => { loadContacts(); showScreen('contacts'); });
  elements.historyBtn.addEventListener('click', () => { loadHistory(); showScreen('history'); });
  
  // Incoming call
  elements.acceptBtn.addEventListener('click', handleAcceptCall);
  elements.declineBtn.addEventListener('click', handleDeclineCall);
  
  // SOS
  elements.sosBtn.addEventListener('click', handleSOS);
  
  // Back buttons
  elements.contactsBackBtn.addEventListener('click', () => showScreen('home'));
  elements.historyBackBtn.addEventListener('click', () => showScreen('home'));
  
  // Contacts
  elements.addContactBtn.addEventListener('click', addContact);
}

// ==================== SCREEN TRANSITIONS ====================
function showScreen(screenName) {
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  
  const targetScreen = screens[screenName];
  if (targetScreen) {
    targetScreen.classList.add('active');
    state.currentScreen = screenName;
  }
}

// ==================== ONBOARDING ====================
function handleStart() {
  localStorage.setItem('safecall_onboarded', 'true');
  state.hasOnboarded = true;
  showScreen('home');
}

// ==================== CALL HANDLING ====================
function handleAcceptCall() {
  console.log('Call accepted');
  triggerHaptic('medium');
  showScreen('in-call');
  startProtection();
}

function handleDeclineCall() {
  console.log('Call declined');
  triggerHaptic('light');
  showScreen('home');
}

// ==================== PROTECTION ====================
function startProtection() {
  console.log('Starting protection...');
  
  state.riskLevel = 0;
  state.alertTriggered = false;
  state.transcript = [];
  
  updateRiskDisplay(0);
  
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
  
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      console.log('Microphone access granted');
      stream.getTracks().forEach(track => track.stop());
      state.isDemoMode = false;
    })
    .catch(err => {
      console.log('Microphone access denied, enabling demo mode');
      state.isDemoMode = true;
    });
}

function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  state.recognition = new SpeechRecognition();
  state.recognition.continuous = true;
  state.recognition.interimResults = true;
  state.recognition.lang = 'ru-RU';
  
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
  
  state.recognition.onerror = (event) => {
    console.log('Speech recognition error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'no-speech') {
      switchToDemoMode();
    }
  };
  
  state.recognition.onend = () => {
    if (state.isListening && !state.alertTriggered) {
      try {
        state.recognition.start();
      } catch (e) {}
    }
  };
  
  try {
    state.recognition.start();
    state.isListening = true;
    console.log('Speech recognition started');
  } catch (e) {
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
  elements.demoBadge.classList.remove('hidden');
  
  let messageIndex = 0;
  
  const showNextMessage = () => {
    if (messageIndex >= CONFIG.demoMessages.length || state.alertTriggered) {
      return;
    }
    
    const message = CONFIG.demoMessages[messageIndex];
    updateTranscript(message.text);
    updateRiskDisplay(message.risk);
    
    if (message.risk >= CONFIG.alertThreshold) {
      triggerAlert();
      return;
    }
    
    messageIndex++;
    setTimeout(showNextMessage, 2500);
  };
  
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
  
  setTimeout(() => {
    const aiScore = analyzeText(text);
    
    if (aiScore > 0) {
      console.log('AI Risk Score:', aiScore);
      const newRisk = Math.min(state.riskLevel + aiScore, CONFIG.maxRisk);
      updateRiskDisplay(newRisk);
      
      if (newRisk >= CONFIG.alertThreshold && !state.alertTriggered) {
        triggerAlert();
      }
    }
  }, 300);
}

// ==================== UI UPDATES ====================
function updateTranscript(text) {
  state.transcript.push(text);
  
  if (state.transcript.length > 3) {
    state.transcript.shift();
  }
  
  const transcriptHtml = state.transcript
    .map(t => `<div>${escapeHtml(t)}</div>`)
    .join('');
  
  elements.transcript.innerHTML = transcriptHtml || '<span class="transcript-placeholder">Listening...</span>';
}

function updateRiskDisplay(risk) {
  state.riskLevel = risk;
  elements.riskValue.textContent = `${risk}%`;
  
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
  
  if (state.recognition) {
    try {
      state.recognition.stop();
    } catch (e) {}
  }
  
  // Save to history
  saveAlertToHistory();
  
  // Body shake
  document.body.style.animation = 'shake 0.3s infinite';
  document.body.style.background = 'linear-gradient(180deg, #FF3B30 0%, #cc2a20 100%)';
  
  // Intense vibration
  state.vibrateInterval = setInterval(() => {
    navigator.vibrate([100, 50, 100]);
  }, 500);
  
  triggerHaptic('heavy');
  playAlarmSound();
  speakWarning();
  
  showScreen('alert-screen');
  
  // Auto trigger SOS after 2 seconds
  setTimeout(() => {
    handleSOS();
  }, 2000);
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    clearAlert();
    showScreen('home');
  }, 10000);
}

function clearAlert() {
  if (state.vibrateInterval) {
    clearInterval(state.vibrateInterval);
    state.vibrateInterval = null;
  }
  document.body.style.animation = '';
  document.body.style.background = '';
}

function playAlarmSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

// ==================== SOS ====================
function handleSOS() {
  console.log('Sending SOS...');
  
  if (!navigator.geolocation) {
    alert('Geolocation is not supported');
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const mapUrl = `https://maps.google.com/?q=${lat},${lon}`;
      const message = `I might be in danger. My location: ${mapUrl}`;
      
      // Try native share first
      if (navigator.share) {
        navigator.share({
          title: 'SafeCall Guardian SOS',
          text: message
        }).catch(err => console.log('Share cancelled'));
      } else {
        // Fallback to SMS
        const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
        window.location.href = smsUrl;
      }
    },
    (error) => {
      console.log('Geolocation error:', error);
      alert('Could not get location. Please try again.');
    }
  );
}

// ==================== CONTACTS ====================
function loadContacts() {
  const contacts = JSON.parse(localStorage.getItem('safecall_contacts') || '[]');
  
  elements.contactsList.innerHTML = contacts.map((contact, index) => `
    <div class="contact-item">
      <span>${escapeHtml(contact)}</span>
      <button class="delete-btn" onclick="deleteContact(${index})">Delete</button>
    </div>
  `).join('');
}

function addContact() {
  const phone = elements.contactInput.value.trim();
  
  if (!phone) {
    alert('Please enter a phone number');
    return;
  }
  
  const contacts = JSON.parse(localStorage.getItem('safecall_contacts') || '[]');
  contacts.push(phone);
  localStorage.setItem('safecall_contacts', JSON.stringify(contacts));
  
  elements.contactInput.value = '';
  loadContacts();
}

function deleteContact(index) {
  const contacts = JSON.parse(localStorage.getItem('safecall_contacts') || '[]');
  contacts.splice(index, 1);
  localStorage.setItem('safecall_contacts', JSON.stringify(contacts));
  loadContacts();
}

// ==================== HISTORY ====================
function saveAlertToHistory() {
  const history = JSON.parse(localStorage.getItem('safecall_history') || '[]');
  
  history.unshift({
    text: 'Scam detected',
    risk: state.riskLevel,
    time: new Date().toLocaleString()
  });
  
  // Keep only last 20 entries
  if (history.length > 20) {
    history.pop();
  }
  
  localStorage.setItem('safecall_history', JSON.stringify(history));
}

function loadHistory() {
  const history = JSON.parse(localStorage.getItem('safecall_history') || '[]');
  
  if (history.length === 0) {
    elements.historyList.innerHTML = '<p style="color: var(--ios-gray); text-align: center;">No alerts yet</p>';
    return;
  }
  
  elements.historyList.innerHTML = history.map(item => `
    <div class="history-item">
      <span>${escapeHtml(item.text)}</span>
      <span class="history-risk" style="color: ${item.risk >= 80 ? 'var(--ios-red)' : 'var(--ios-orange)'}">Risk: ${item.risk}%</span>
      <span class="history-time">${item.time}</span>
    </div>
  `).join('');
}

// ==================== UTILITIES ====================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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

// Make deleteContact available globally
window.deleteContact = deleteContact;