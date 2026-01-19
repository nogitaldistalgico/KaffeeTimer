export class EspressoTimer {
    constructor(options = {}) {
        this.startTime = 0;
        this.elapsedTime = 0;
        this.intervalId = null;
        this.state = 'idle'; // idle, running, finished
        this.onTick = options.onTick || (() => {});
        this.onFinish = options.onFinish || (() => {});
        
        // Settings
        this.startOffset = options.startOffset || 0; // seconds
        this.endOffset = options.endOffset || 0; // seconds
    }

    start() {
        if (this.state === 'running') return;

        this.state = 'running';
        // Adjust start time by the offset (negative offset means we started earlier)
        // If startOffset is -2.0, we want the timer to start at 2.0s?
        // Requirement: "Subtract usage-defined seconds (e.g., -2.0s) from start time to account for machine ramp-up delay."
        // Usually, if I press a button and want to account for delay, I might want to start at -2s?
        // Or if the machine takes time to ramp up, maybe I want to start at 0 but the *sound* started late?
        // Let's assume: If user sets -2.0s offset, it means when the timer triggers, it's essentially already at 2.0s.
        // Or wait, "Subtract ... from start time".
        // Let's implement it as: Initial elapsed time = -startOffset.
        // If offset is -2.0s, we start at 0 and count up? No, usually "start offset" in coffee apps means "Pre-infusion time correction".
        // Let's stick to: effectiveStartTime = Date.now() + (this.startOffset * 1000);
        // If offset is -2.0s, effective start was 2 seconds ago. So timer reads 2.0s immediately.
        
        this.startTime = Date.now() - (this.startOffset * 1000); 
        
        this.tick();
        this.intervalId = requestAnimationFrame(this.tick.bind(this));
    }

    stop() {
        if (this.state !== 'running') return;
        
        this.state = 'finished';
        cancelAnimationFrame(this.intervalId);
        
        // Apply end offset
        // "Add user-defined seconds to final time to account for post-drip."
        // If end offset is +2.0s, we add 2 seconds to the result.
        this.elapsedTime += (this.endOffset * 1000);
        
        // Provide final tick update
        this.onTick(this.formatTime(this.elapsedTime));
        this.onFinish(this.elapsedTime);
    }

    reset() {
        this.state = 'idle';
        cancelAnimationFrame(this.intervalId);
        this.elapsedTime = 0;
        this.onTick(this.formatTime(0));
    }

    tick() {
        if (this.state !== 'running') return;

        const now = Date.now();
        this.elapsedTime = now - this.startTime;
        
        this.onTick(this.formatTime(this.elapsedTime));
        
        this.intervalId = requestAnimationFrame(this.tick.bind(this));
    }

    formatTime(ms) {
        // Returns object { seconds, milliseconds, formattedString }
        // Ensure non-negative
        const time = Math.max(0, ms);
        const totalSeconds = time / 1000;
        const seconds = Math.floor(totalSeconds);
        // Display one decimal place
        const formatted = totalSeconds.toFixed(1);
        
        return {
            totalMs: time,
            formatted: formatted
        };
    }

    updateSettings(newSettings) {
        if (newSettings.startOffset !== undefined) this.startOffset = newSettings.startOffset;
        if (newSettings.endOffset !== undefined) this.endOffset = newSettings.endOffset;
    }
}
