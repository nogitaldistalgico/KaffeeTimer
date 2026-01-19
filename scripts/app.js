import { EspressoTimer } from './timer-logic.js';
import { AudioMonitor } from './audio-monitor.js';

// DOM Elements
const viewSmart = document.getElementById('view-smart');
const viewManual = document.getElementById('view-manual');
const modeBtns = document.querySelectorAll('.mode-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');

// Smart View Elements
const smartTimeDisplay = document.getElementById('smart-time-display');
const visualizerOrb = document.getElementById('visualizer-orb');
const statusText = document.getElementById('status-text');
const smartActionBtn = document.getElementById('smart-action-btn');

// Manual View Elements
const manualTimeDisplay = document.getElementById('manual-time-display');
const manualToggleBtn = document.getElementById('manual-toggle-btn');
const manualResetBtn = document.getElementById('manual-reset-btn');

// Settings Elements
const stepperBtns = document.querySelectorAll('.stepper-btn');
const targetTimeVal = document.getElementById('target-time-val');
const startOffsetVal = document.getElementById('start-offset-val');
// const endOffsetVal is dynamically queried or add here if preferred, 
// strictly speaking I used dynamic query in previous step but simpler to add here if I want consistency.
// actually in previous step I did: const endValEl = document.getElementById('end-offset-val');
// So I don't technically need this, but good for completeness.

// State
let currentMode = 'smart';
let smartTimer = new EspressoTimer({
    onTick: (time) => updateSmartDisplay(time),
    onFinish: (finalTime) => handleSmartFinish(finalTime)
});
let manualTimer = new EspressoTimer({
    onTick: (time) => {
        manualTimeDisplay.textContent = time.formatted;
    }
});

let audioMonitor = new AudioMonitor({
    threshold: 0.08,
    onStatusChange: (status) => handleAudioStatus(status),
    onAudioData: (rms) => updateVisualizer(rms)
});

// Event Listeners
modeBtns.forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
});

settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    requestAnimationFrame(() => settingsModal.classList.add('visible'));
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('visible');
    setTimeout(() => settingsModal.classList.add('hidden'), 300);
});

// Smart Controls
smartActionBtn.addEventListener('click', () => {
    if (smartActionBtn.textContent === 'Starten') {
        // Go to listening mode
        startListening();
    } else if (smartActionBtn.textContent === 'Abbrechen') {
        stopListening();
    } else if (smartActionBtn.textContent === 'Reset') {
        resetSmart();
    }
});

// Manual Controls
manualToggleBtn.addEventListener('click', () => {
    if (manualTimer.state === 'running') {
        manualTimer.stop();
        manualToggleBtn.textContent = 'Start';
        manualToggleBtn.style.backgroundColor = 'var(--color-success)';
    } else {
        manualTimer.start();
        manualToggleBtn.textContent = 'Stop';
        manualToggleBtn.style.backgroundColor = 'var(--color-error)';
    }
});

manualResetBtn.addEventListener('click', () => {
    manualTimer.reset();
    manualToggleBtn.textContent = 'Start';
    manualToggleBtn.style.backgroundColor = ''; // Reset to default
});

// Settings Logic
let settings = {
    targetTime: 25,
    startOffset: 0.0
};

stepperBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const target = btn.dataset.target;

        if (target === 'target-time') {
            if (action === 'increase') settings.targetTime++;
            else settings.targetTime = Math.max(1, settings.targetTime - 1);
            targetTimeVal.textContent = settings.targetTime;
        } else if (target === 'start-offset') {
            if (action === 'increase') settings.startOffset += 0.5;
            else settings.startOffset -= 0.5;
            startOffsetVal.textContent = settings.startOffset.toFixed(1) + 's';
            smartTimer.updateSettings({ startOffset: settings.startOffset });
        } else if (target === 'end-offset') {
            if (action === 'increase') settings.endOffset += 0.5;
            else settings.endOffset -= 0.5;
            // Update display
            const endValEl = document.getElementById('end-offset-val');
            if (endValEl) endValEl.textContent = settings.endOffset.toFixed(1) + 's';
            smartTimer.updateSettings({ endOffset: settings.endOffset });
        }
    });
});


// Functions

function switchMode(mode) {
    currentMode = mode;
    modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

    if (mode === 'smart') {
        viewManual.classList.remove('active');
        viewSmart.classList.remove('hidden'); // Ensure display block first
        setTimeout(() => { // Then fade in
            viewManual.classList.add('hidden');
            viewSmart.classList.add('active');
        }, 50);
    } else {
        viewSmart.classList.remove('active');
        viewManual.classList.remove('hidden');
        setTimeout(() => {
            viewSmart.classList.add('hidden');
            viewManual.classList.add('active');
        }, 50);

        // Stop audio if switching away
        if (audioMonitor.isListening) stopListening();
    }
}

async function startListening() {
    statusText.textContent = 'Höre zu...';
    smartActionBtn.textContent = 'Abbrechen';
    visualizerOrb.classList.remove('idle');
    visualizerOrb.classList.add('listening');

    const success = await audioMonitor.start();
    if (!success) {
        statusText.textContent = 'Mikrofon Fehler';
        smartActionBtn.textContent = 'Starten';
        visualizerOrb.classList.add('idle');
    }
}

function stopListening() {
    audioMonitor.stop();
    smartTimer.stop(); // Just in case
    resetSmart();
}

function handleAudioStatus(status) {
    console.log('Audio Status:', status);

    if (status === 'noise_started') {
        if (smartTimer.state !== 'running') {
            smartTimer.start();
            statusText.textContent = 'Bezug läuft...';
            visualizerOrb.className = 'orb running';
            smartActionBtn.style.display = 'none'; // Hide cancel during run? Or allow manual stop?
        }
    } else if (status === 'silence_detected') {
        if (smartTimer.state === 'running') {
            smartTimer.stop();
            // Finish handled by callback
        }
    }
}

function handleSmartFinish(finalTimeMs) {
    audioMonitor.stop();
    visualizerOrb.className = 'orb finished';

    const seconds = finalTimeMs / 1000;
    const diff = Math.abs(seconds - settings.targetTime);

    let resultText = 'Perfekt!';
    if (seconds < settings.targetTime - 3) resultText = 'Zu kurz';
    else if (seconds > settings.targetTime + 3) resultText = 'Zu lang';

    statusText.textContent = resultText;
    smartActionBtn.textContent = 'Reset';
    smartActionBtn.style.display = 'block';
}

function resetSmart() {
    smartTimer.reset();
    statusText.textContent = 'Bereithalten';
    visualizerOrb.className = 'orb idle';
    smartActionBtn.textContent = 'Starten';
}

function updateSmartDisplay(timeObj) {
    smartTimeDisplay.textContent = timeObj.formatted;
}

function updateVisualizer(rms) {
    // rms is 0..1 theoretically, usually much lower for silence
    // amplify for visual
    const scale = 1 + (rms * 5); // Scale between 1 and ~2
    visualizerOrb.style.transform = `scale(${Math.min(scale, 1.8)})`;
}
