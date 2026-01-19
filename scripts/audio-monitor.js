export class AudioMonitor {
    constructor(options = {}) {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.isListening = false;

        // Configuration
        // Configuration
        this.threshold = options.threshold || 0.03; // Lowered to 0.03 for filtered audio
        this.silenceDelay = options.silenceDelay || 1500; // Increased to 1.5s to bridge gaps
        this.callback = options.onStatusChange || (() => { });
        this.visualizerCallback = options.onAudioData || (() => { });

        // State
        this.silenceStartTime = null;
        this.hasTriggered = false;
    }

    async start() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            // Low-pass filter to isolate pump noise (usually low rumble)
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 600; // Cutoff reduced to 600Hz to ignore cups/clinking

            this.microphone.connect(filter);
            filter.connect(this.analyser);

            this.isListening = true;
            this.hasTriggered = false;
            this.monitorLoop();

            return { success: true };
        } catch (err) {
            console.error('Microphone access denied:', err);
            return { success: false, error: err };
        }
    }

    stop() {
        this.isListening = false;
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    monitorLoop() {
        if (!this.isListening) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(dataArray);

        // Calculate RMS (Root Mean Square) Amplitude
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128; // Normalize to -1..1
            sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        // Send data to visualizer
        this.visualizerCallback(rms);

        // Logic
        if (!this.hasTriggered) {
            // Waiting for noise
            if (rms > this.threshold) {
                this.hasTriggered = true;
                this.callback('noise_started');
                this.silenceStartTime = null;
            }
        } else {
            // Waiting for silence
            if (rms < this.threshold) {
                if (!this.silenceStartTime) {
                    this.silenceStartTime = Date.now();
                } else if (Date.now() - this.silenceStartTime > this.silenceDelay) {
                    // Confirmed silence
                    this.hasTriggered = false;
                    this.callback('silence_detected');
                }
            } else {
                // Noise returned, reset silence timer
                this.silenceStartTime = null;
            }
        }

        requestAnimationFrame(this.monitorLoop.bind(this));
    }

    get isNoisy() {
        return this.hasTriggered;
    }
}
