// Memrise Speed Controller - Page Script
// This script runs directly in the page context

(function() {
  console.log("Memrise Speed Controller: Page script injected");
  
  // --- State Variables ---
  let speedFactor = 1.0;
  let isPaused = false;
  let originalSetTimeout = window.setTimeout;
  let originalSetInterval = window.setInterval;
  let originalClearTimeout = window.clearTimeout;
  let originalClearInterval = window.clearInterval;
  let activeTimers = {};
  let nextTimerId = 1;
  let observer;
  const originalDateNow = Date.now.bind(Date);
  const originalPerformanceNow = window.performance ? window.performance.now.bind(window.performance) : originalDateNow;

  // --- Timer Override Functions ---
  function overrideTimers() {
    console.log("[Debug] Overriding timers...");

    window.setTimeout = function(callback, delay, ...args) {
      if (typeof callback !== 'function') { return originalSetTimeout(callback, delay); }
      const requestedDelay = (typeof delay === 'number' && delay > 0) ? delay : 0;
      const scheduledTime = originalPerformanceNow();

      if (isPaused) {
        const timerId = `timeout_${nextTimerId++}`;
        activeTimers[timerId] = { type: 'timeout', callback: callback, args: args, requestedDelay: requestedDelay, scheduledTime: scheduledTime, nativeId: null, pauseData: null };
        return timerId;
      }

      const adjustedDelay = Math.max(0, requestedDelay / speedFactor);
      let nativeTimerId;
      const timerId = `timeout_${nextTimerId++}`;
      const wrappedCallback = () => {
        if (activeTimers[timerId]) { delete activeTimers[timerId]; }
        try { callback(...args); } catch (e) { console.error("Error in setTimeout callback:", e); }
      };
      nativeTimerId = originalSetTimeout(wrappedCallback, adjustedDelay);
      activeTimers[timerId] = { type: 'timeout', nativeId: nativeTimerId, callback: callback, args: args, requestedDelay: requestedDelay, adjustedDelay: adjustedDelay, scheduledTime: scheduledTime, expectedEndTime: scheduledTime + adjustedDelay };
      return timerId;
    };

    window.setInterval = function(callback, interval, ...args) {
      if (typeof callback !== 'function') { return originalSetInterval(callback, interval); }
      const requestedInterval = (typeof interval === 'number' && interval > 0) ? interval : 1;

      if (isPaused) {
        const timerId = `interval_${nextTimerId++}`;
        activeTimers[timerId] = { type: 'interval', callback: callback, args: args, requestedInterval: requestedInterval, nativeId: null, pauseData: null };
        return timerId;
      }

      const adjustedInterval = Math.max(1, requestedInterval / speedFactor);
      let nativeTimerId;
      const timerId = `interval_${nextTimerId++}`;
      const wrappedCallback = () => {
        if (!activeTimers[timerId]) { originalClearInterval(nativeTimerId); return; }
        try { callback(...args); } catch (e) { console.error("Error in setInterval callback:", e); }
      };
      nativeTimerId = originalSetInterval(wrappedCallback, adjustedInterval);
      activeTimers[timerId] = { type: 'interval', nativeId: nativeTimerId, callback: callback, args: args, requestedInterval: requestedInterval, adjustedInterval: adjustedInterval };
      return timerId;
    };

    window.clearTimeout = function(timerId) {
      if (timerId && activeTimers[timerId] && activeTimers[timerId].type === 'timeout') {
        const timerDetails = activeTimers[timerId];
        if (timerDetails.nativeId) { originalClearTimeout(timerDetails.nativeId); }
        delete activeTimers[timerId];
      } else { originalClearTimeout(timerId); }
    };

    window.clearInterval = function(timerId) {
      if (timerId && activeTimers[timerId] && activeTimers[timerId].type === 'interval') {
        const timerDetails = activeTimers[timerId];
        if (timerDetails.nativeId) { originalClearInterval(timerDetails.nativeId); }
        delete activeTimers[timerId];
      } else { originalClearInterval(timerId); }
    };
    
    console.log("[Debug] Timer overrides applied.");
    return true;
  }

  // --- Restore Original Timer Functions ---
  function restoreTimers() {
    console.log("[Debug] Restoring original timers...");
    for (const id in activeTimers) {
      if (activeTimers[id].nativeId) {
        if (activeTimers[id].type === 'timeout') { originalClearTimeout(activeTimers[id].nativeId); }
        else if (activeTimers[id].type === 'interval') { originalClearInterval(activeTimers[id].nativeId); }
      }
    }
    activeTimers = {};
    window.setTimeout = originalSetTimeout;
    window.setInterval = originalSetInterval;
    window.clearTimeout = originalClearTimeout;
    window.clearInterval = originalClearInterval;
    console.log("[Debug] Original timers restored.");
  }

  // --- UI Creation ---
  function createControls() {
    if (document.getElementById('memrise-controls-v2')) { 
      console.log("[Debug] UI controls already exist, skipping creation");
      return; 
    }
    console.log("[Debug] Creating UI controls...");
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'memrise-controls-v2';
    controlsContainer.style.cssText = `
      position: fixed; top: 10px; right: 10px;
      background: rgba(255, 255, 255, 0.95); border: 1px solid #ccc;
      border-radius: 6px; padding: 12px;
      box-shadow: 0 3px 12px rgba(0,0,0,0.25); z-index: 10001;
      display: flex; flex-direction: column; gap: 10px;
      width: 200px; font-family: sans-serif; color: #333;
    `;
    const speedControls = document.createElement('div');
    speedControls.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 6px; text-align: center;">Speed: <span id="speed-value-v2">1.00x</span></div>
      <div style="display: flex; justify-content: space-between; gap: 5px;">
        <button id="speed-slower-v2" style="flex: 1; padding: 4px 8px; font-size: 16px; cursor: pointer;">-</button>
        <button id="speed-faster-v2" style="flex: 1; padding: 4px 8px; font-size: 16px; cursor: pointer;">+</button>
      </div>
    `;
    const pauseButton = document.createElement('button');
    pauseButton.id = 'pause-button-v2';
    pauseButton.textContent = 'Pause (Space)';
    pauseButton.style.cssText = `
      padding: 6px 12px; background: #5cb85c; color: white;
      border: none; border-radius: 4px; cursor: pointer;
      font-weight: bold; text-align: center;
    `;
    const resetButton = document.createElement('button');
    resetButton.id = 'reset-button-v2';
    resetButton.textContent = 'Reset Speed (R)';
    resetButton.style.cssText = `
      padding: 6px 12px; background: #337ab7; color: white;
      border: none; border-radius: 4px; cursor: pointer; text-align: center;
    `;
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'status-indicator-v2';
    statusIndicator.textContent = 'Active';
    statusIndicator.style.cssText = `
      font-size: 11px; text-align: center; color: #555;
      margin-top: 5px; font-style: italic;
    `;
    controlsContainer.appendChild(speedControls);
    controlsContainer.appendChild(pauseButton);
    controlsContainer.appendChild(resetButton);
    controlsContainer.appendChild(statusIndicator);
    document.body.appendChild(controlsContainer);

    document.getElementById('speed-slower-v2').addEventListener('click', () => { adjustSpeed(Math.max(0.1, speedFactor - 0.1)); });
    document.getElementById('speed-faster-v2').addEventListener('click', () => { adjustSpeed(Math.min(4.0, speedFactor + 0.1)); });
    document.getElementById('pause-button-v2').addEventListener('click', togglePause);
    document.getElementById('reset-button-v2').addEventListener('click', () => { adjustSpeed(1.0); });

    document.addEventListener('keydown', handleKeydown);
    console.log("[Debug] UI controls created and listeners attached.");
  }

  // --- Adjust Speed ---
  function adjustSpeed(factor) {
    console.log(`[Debug] Speed set to ${factor}x`);
    speedFactor = Math.round(factor * 100) / 100;
    const speedValueEl = document.getElementById('speed-value-v2');
    if (speedValueEl) { speedValueEl.textContent = `${speedFactor.toFixed(2)}x`; }
    return speedFactor;
  }

  // --- Toggle Pause / Resume ---
  function togglePause() {
    console.log(`[Debug] togglePause called. Current state: isPaused = ${isPaused}`);
    isPaused = !isPaused;

    const pauseButton = document.getElementById('pause-button-v2');
    const statusEl = document.getElementById('status-indicator-v2');

    if (isPaused) {
      console.log("--- PAUSING ---");
      if (pauseButton) { pauseButton.textContent = 'Resume (Space)'; pauseButton.style.background = '#d9534f'; }
      if (statusEl) { statusEl.textContent = 'PAUSED'; statusEl.style.color = '#d9534f'; statusEl.style.fontWeight = 'bold'; }
    } else {
      console.log("--- RESUMING ---");
      if (pauseButton) { pauseButton.textContent = 'Pause (Space)'; pauseButton.style.background = '#5cb85c'; }
      if (statusEl) { statusEl.textContent = 'Active'; statusEl.style.color = '#555'; statusEl.style.fontWeight = 'normal'; }
    }
    return isPaused;
  }

  // --- Handle Keyboard Shortcuts ---
  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { return; } // Don't intercept typing
    if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); togglePause(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); adjustSpeed(Math.min(4.0, speedFactor + 0.1)); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); adjustSpeed(Math.max(0.1, speedFactor - 0.1)); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); adjustSpeed(1.0); }
  }

  // --- Mutation Observer to Keep UI ---
  function setupObserver() {
    if (observer) { observer.disconnect(); }
    observer = new MutationObserver(function(mutations) {
      if (!document.getElementById('memrise-controls-v2')) {
        console.log("[Debug] UI was removed, recreating...");
        createControls();
      }
    });
    observer.observe(document.body, { childList: true });
  }

  // --- Cleanup Function ---
  function cleanup() {
    console.log("[Debug] Cleaning up controller...");
    if (observer) { observer.disconnect(); observer = null; }
    const controlsEl = document.getElementById('memrise-controls-v2');
    if (controlsEl) { controlsEl.remove(); }
    document.removeEventListener('keydown', handleKeydown);
    restoreTimers();
    delete window.memriseSpeedController;
    console.log("Memrise controller cleaned up.");
  }

  // --- Time Control Functions ---
  function setupTimeOverrides() {
    // Patch Date.now and performance.now for more complete time control
    let timeOffset = 0;
    let lastRealNow = originalDateNow();
    
    Date.now = function() {
      if (isPaused) return lastRealNow;
      
      const realNow = originalDateNow();
      const elapsed = realNow - lastRealNow;
      lastRealNow = realNow;
      
      if (speedFactor !== 1.0 && elapsed > 0) {
        timeOffset += elapsed * (1 - 1/speedFactor);
      }
      
      return realNow - timeOffset;
    };
    
    if (window.performance && window.performance.now) {
      const originalNow = window.performance.now.bind(window.performance);
      let lastRealPerformanceNow = originalNow();
      
      window.performance.now = function() {
        if (isPaused) return lastRealPerformanceNow;
        
        const realNow = originalNow();
        const elapsed = realNow - lastRealPerformanceNow;
        lastRealPerformanceNow = realNow;
        
        if (speedFactor !== 1.0 && elapsed > 0) {
          timeOffset += elapsed * (1 - 1/speedFactor);
        }
        
        return realNow - timeOffset;
      };
    }
  }

  // --- Initialize ---
  function init() {
    console.log("[Debug] Initializing Memrise Speed Controller...");
    
    // Create the controller object
    window.memriseSpeedController = {
      adjustSpeed: adjustSpeed,
      togglePause: togglePause,
      getStatus: function() {
        return {
          speedFactor: speedFactor,
          isPaused: isPaused,
          uiCreated: !!document.getElementById('memrise-controls-v2')
        };
      },
      cleanup: cleanup
    };
    
    // Apply overrides
    overrideTimers();
    setupTimeOverrides();
    
    // Create UI when document is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        createControls();
        setupObserver();
      });
    } else {
      createControls();
      setupObserver();
    }
    
    console.log("Memrise Speed Controller initialized successfully!");
  }

  // Start initialization
  init();
})();
