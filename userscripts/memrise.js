// ==UserScript==
// @name         Memrise Speed Controller V2.2 (No Overlay)
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Speed control + pause/resume for Memrise
// @match        https://*.memrise.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';
  
  // == Memrise Speed Controller V2.2 (No Pause Overlay) ==
  console.log("Initializing Memrise Speed Controller V2.2 (No Overlay)...");

  // --- State Variables ---
  let speedFactor = 1.0;
  let isPaused = false;
  let originalSetTimeout;
  let originalSetInterval;
  let originalClearTimeout;
  let originalClearInterval;
  let activeTimers = {}; // Store details of timers managed by our overrides
  let nextTimerId = 1; // Simple ID counter for our managed timers
  let observer; // MutationObserver instance
  let uiControlsCreated = false; // Flag to prevent multiple UI initializations
  const originalDateNow = Date.now.bind(Date);
  const originalPerformanceNow = window.performance ? window.performance.now.bind(window.performance) : originalDateNow;

  // --- Store Original Functions ---
  originalSetTimeout = window.setTimeout;
  originalSetInterval = window.setInterval;
  originalClearTimeout = window.clearTimeout;
  originalClearInterval = window.clearInterval;

  // --- Timer Override Functions ---
  function overrideTimers() {
      // console.log("[Debug] Overriding timers..."); // Keep logs minimal now

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
      // console.log("[Debug] Timer overrides applied.");
  }

  // --- Restore Original Timer Functions ---
  function restoreTimers() {
      // console.log("[Debug] Restoring original timers...");
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
      // console.log("[Debug] Original timers restored.");
  }

   // --- Device Detection ---
   function isSmartphone() {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  // --- UI Creation ---
  function createControls() {
    if (document.getElementById('memrise-controls-v2')) { return; }
    // console.log("[Debug] Creating UI controls...");
    
    if (isSmartphone()) {
      createSmartphoneControls();
    } else {
      createDesktopControls();
    }
    
    if (!window.memriseKeysAdded) {
      document.addEventListener('keydown', handleKeydown);
      window.memriseKeysAdded = true;
    }
    uiControlsCreated = true;
    // console.log("[Debug] UI controls created and listeners attached.");
  }
  
  // --- Desktop UI Creation ---
  function createDesktopControls() {
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
  }
  
  // --- Smartphone UI Creation ---
  function createSmartphoneControls() {
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'memrise-controls-v2';
    
    // Position at bottom of screen with safe area consideration for Safari
    // Use env(safe-area-inset-bottom) for Safari and fallback for other browsers
    controlsContainer.style.cssText = `
      position: fixed; bottom: max(10px, env(safe-area-inset-bottom, 10px)); left: 0; right: 0;
      margin: 0 10px;
      background: rgba(255, 255, 255, 0.95); border: 1px solid #ccc;
      border-radius: 6px; padding: 8px;
      box-shadow: 0 3px 12px rgba(0,0,0,0.25); z-index: 10001;
      display: flex; flex-direction: row; align-items: center;
      font-family: sans-serif; color: #333;
    `;
    
    // Single row layout with all controls
    // Speed minus button
    const minusButton = document.createElement('button');
    minusButton.id = 'speed-slower-v2';
    minusButton.textContent = '-';
    minusButton.style.cssText = `
      flex: 0 0 auto; width: 30px; height: 30px; padding: 0;
      font-size: 16px; font-weight: bold; cursor: pointer;
      border: 1px solid #ccc; border-radius: 4px;
      background: #f8f8f8; color: #333;
      margin-right: 5px;
    `;
    
    // Speed display
    const speedDisplay = document.createElement('div');
    speedDisplay.style.cssText = `
      flex: 0 0 auto; text-align: center; font-weight: bold; padding: 0 5px;
      font-size: 14px;
    `;
    speedDisplay.innerHTML = `<span id="speed-value-v2">1.00x</span>`;
    
    // Speed plus button
    const plusButton = document.createElement('button');
    plusButton.id = 'speed-faster-v2';
    plusButton.textContent = '+';
    plusButton.style.cssText = `
      flex: 0 0 auto; width: 30px; height: 30px; padding: 0;
      font-size: 16px; font-weight: bold; cursor: pointer;
      border: 1px solid #ccc; border-radius: 4px;
      background: #f8f8f8; color: #333;
      margin-right: 10px;
    `;
    
    // Pause button
    const pauseButton = document.createElement('button');
    pauseButton.id = 'pause-button-v2';
    pauseButton.textContent = 'Pause';
    pauseButton.style.cssText = `
      flex: 1; padding: 8px 6px; background: #5cb85c; color: white;
      border: none; border-radius: 4px; cursor: pointer;
      font-weight: bold; text-align: center; font-size: 14px;
      margin-right: 8px;
    `;
    
    // Reset button
    const resetButton = document.createElement('button');
    resetButton.id = 'reset-button-v2';
    resetButton.textContent = 'Reset';
    resetButton.style.cssText = `
      flex: 1; padding: 8px 6px; background: #337ab7; color: white;
      border: none; border-radius: 4px; cursor: pointer;
      text-align: center; font-size: 14px;
    `;
    
    // Add all elements to the container in a single row
    controlsContainer.appendChild(minusButton);
    controlsContainer.appendChild(speedDisplay);
    controlsContainer.appendChild(plusButton);
    controlsContainer.appendChild(pauseButton);
    controlsContainer.appendChild(resetButton);
    document.body.appendChild(controlsContainer);
    
    // Add viewport meta tag for proper mobile rendering and to enable env() variables
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewportMeta = document.createElement('meta');
      viewportMeta.name = 'viewport';
      viewportMeta.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
      document.head.appendChild(viewportMeta);
    }
    
    // Add event listeners
    document.getElementById('speed-slower-v2').addEventListener('click', () => { adjustSpeed(Math.max(0.1, speedFactor - 0.1)); });
    document.getElementById('speed-faster-v2').addEventListener('click', () => { adjustSpeed(Math.min(4.0, speedFactor + 0.1)); });
    document.getElementById('pause-button-v2').addEventListener('click', togglePause);
    document.getElementById('reset-button-v2').addEventListener('click', () => { adjustSpeed(1.0); });
  }
  
  // --- Adjust Speed ---
  function adjustSpeed(factor) {
      speedFactor = Math.round(factor * 100) / 100;
      // console.log(`[Debug] Speed set to ${speedFactor}x`);
      const speedValueEl = document.getElementById('speed-value-v2');
      if (speedValueEl) { speedValueEl.textContent = `${speedFactor.toFixed(2)}x`; }
  }

  // --- Toggle Pause / Resume ---
  function togglePause() {
      // console.log(`[Debug] togglePause called. Current state: isPaused = ${isPaused}`);
      isPaused = !isPaused;
      const now = originalPerformanceNow();

      const pauseButton = document.getElementById('pause-button-v2');
      const statusEl = document.getElementById('status-indicator-v2');

      if (isPaused) {
          // console.log("--- PAUSING ---");
          if (pauseButton) { pauseButton.textContent = 'Resume'; pauseButton.style.background = '#d9534f'; }
          if (statusEl) { statusEl.textContent = 'PAUSED'; statusEl.style.color = '#d9534f'; statusEl.style.fontWeight = 'bold'; }

          try {
              document.querySelectorAll('[class*="progress"], [class*="timer"], [style*="animation"]').forEach(el => {
                  el.style.setProperty('animation-play-state', 'paused', 'important');
              });
          } catch (e) { console.error("Error pausing animations:", e); }

          // For each active timer, pause it by clearing the native timer and storing data needed to resume
          for (const id in activeTimers) {
              const timer = activeTimers[id];
              if (timer.nativeId) {
                  if (timer.type === 'timeout') {
                      originalClearTimeout(timer.nativeId);
                      // Calculate remaining time
                      const elapsedTime = now - timer.scheduledTime;
                      const remainingTime = Math.max(0, timer.adjustedDelay - elapsedTime);
                      timer.pauseData = { remainingTime: remainingTime };
                  } else if (timer.type === 'interval') {
                      originalClearInterval(timer.nativeId);
                      timer.pauseData = { interval: timer.adjustedInterval };
                  }
                  timer.nativeId = null;
              }
          }
      } else {
          // console.log("--- RESUMING ---");
          if (pauseButton) { pauseButton.textContent = 'Pause'; pauseButton.style.background = '#5cb85c'; }
          if (statusEl) { statusEl.textContent = 'Active'; statusEl.style.color = '#555'; statusEl.style.fontWeight = 'normal'; }

          try {
              document.querySelectorAll('[class*="progress"], [class*="timer"], [style*="animation"]').forEach(el => {
                  el.style.setProperty('animation-play-state', 'running', 'important');
              });
          } catch (e) { console.error("Error resuming animations:", e); }

          // For each paused timer, resume it
          for (const id in activeTimers) {
              const timer = activeTimers[id];
              if (!timer.nativeId && timer.pauseData) {
                  if (timer.type === 'timeout') {
                      const wrappedCallback = () => {
                          if (activeTimers[id]) { delete activeTimers[id]; }
                          try { timer.callback(...timer.args); } catch (e) { console.error("Error in resumed timeout callback:", e); }
                      };
                      timer.nativeId = originalSetTimeout(wrappedCallback, timer.pauseData.remainingTime);
                      timer.scheduledTime = now;
                      timer.expectedEndTime = now + timer.pauseData.remainingTime;
                  } else if (timer.type === 'interval') {
                      const wrappedCallback = () => {
                          if (!activeTimers[id]) { originalClearInterval(timer.nativeId); return; }
                          try { timer.callback(...timer.args); } catch (e) { console.error("Error in resumed interval callback:", e); }
                      };
                      timer.nativeId = originalSetInterval(wrappedCallback, timer.pauseData.interval);
                  }
                  timer.pauseData = null;
              }
          }
      }
  }

  // --- Handle Keyboard Shortcuts ---
  function handleKeydown(e) {
      // Only handle shortcuts if we're on a Memrise page
      if (document.getElementById('memrise-controls-v2')) {
          if (e.code === 'Space' && !e.target.matches('input, textarea, [contenteditable]')) {
              e.preventDefault();
              togglePause();
          } else if (e.code === 'KeyR' && !e.target.matches('input, textarea, [contenteditable]')) {
              e.preventDefault();
              adjustSpeed(1.0);
          }
      }
  }

  // --- Mutation Observer to Keep UI ---
  function setupObserver() {
      if (observer) { observer.disconnect(); }
      observer = new MutationObserver((mutations) => {
          // Check if our controls are still in the DOM
          if (!document.getElementById('memrise-controls-v2') && uiControlsCreated) {
              createControls();
          }
          
          // Check for new animations that might need to be paused if we're in paused state
          if (isPaused) {
              try {
                  mutations.forEach(mutation => {
                      if (mutation.type === 'childList') {
                          mutation.addedNodes.forEach(node => {
                              if (node.nodeType === 1) { // Element node
                                  node.querySelectorAll('[class*="progress"], [class*="timer"], [style*="animation"]').forEach(el => {
                                      el.style.setProperty('animation-play-state', 'paused', 'important');
                                  });
                              }
                          });
                      }
                  });
              } catch (e) { console.error("Error in observer:", e); }
          }
      });
      observer.observe(document.body, { childList: true, subtree: true });
  }

  // --- Cleanup Function ---
  function cleanup() {
      // console.log("[Debug] Cleaning up...");
      if (observer) { observer.disconnect(); observer = null; }
      
      const controlsElement = document.getElementById('memrise-controls-v2');
      if (controlsElement) { controlsElement.remove(); }
      
      document.removeEventListener('keydown', handleKeydown);
      window.memriseKeysAdded = false;
      
      restoreTimers();
      // console.log("[Debug] Cleanup complete.");
  }

  // --- Initialize ---
  function init() {
      // console.log("[Debug] Initializing...");
      if (document.body) {
          overrideTimers();
          createControls();
          setupObserver();
          // console.log("[Debug] Initialization complete.");
      } else {
          // console.log("[Debug] Document body not ready, retrying in 100ms...");
          originalSetTimeout(init, 100);
      }
  }

  // --- Start ---
  originalSetTimeout(init, 500);
})();
