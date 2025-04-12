// == Memrise Speed Controller V2.2 (No Pause Overlay) ==
(function() {
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

   // --- UI Creation ---
   function createControls() {
      if (document.getElementById('memrise-controls-v2')) { return; }
      // console.log("[Debug] Creating UI controls...");
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

       if (!window.memriseKeysAdded) {
           document.addEventListener('keydown', handleKeydown);
           window.memriseKeysAdded = true;
       }
       uiControlsCreated = true;
       // console.log("[Debug] UI controls created and listeners attached.");
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
      // const overlayId = 'memrise-pause-overlay-v2'; // No longer needed

      if (isPaused) {
          // console.log("--- PAUSING ---");
          if (pauseButton) { pauseButton.textContent = 'Resume (Space)'; pauseButton.style.background = '#d9534f'; }
          if (statusEl) { statusEl.textContent = 'PAUSED'; statusEl.style.color = '#d9534f'; statusEl.style.fontWeight = 'bold'; }

          try {
              document.querySelectorAll('[class*="progress"], [class*="timer"], [style*="animation"]').forEach(el => {
                  el.style.setProperty('animation-play-state', 'paused', 'important');
              });
          } catch (e) { console.error("Error pausing animations:", e); }

          // console.log("[Debug] Pausing active JS timers...");
          for (const id in activeTimers) {
              const timer = activeTimers[id];
              if (timer.nativeId) {
                  const remainingTime = timer.type === 'timeout' ? Math.max(0, timer.expectedEndTime - now) : timer.adjustedInterval;
                  if (timer.type === 'timeout') { originalClearTimeout(timer.nativeId); } else { originalClearInterval(timer.nativeId); }
                  timer.pauseData = { remaining: remainingTime, pauseTime: now };
                  timer.nativeId = null;
              }
          }

          // --- OVERLAY CREATION REMOVED ---
          // if (!document.getElementById(overlayId)) {
          //     const overlay = document.createElement('div');
          //     overlay.id = overlayId;
          //     /* overlay styles */
          //     const pauseText = document.createElement('div');
          //     /* pauseText styles */
          //     overlay.appendChild(pauseText);
          //     document.body.appendChild(overlay);
          // }

      } else {
          // console.log("--- RESUMING ---");
          if (pauseButton) { pauseButton.textContent = 'Pause (Space)'; pauseButton.style.background = '#5cb85c'; }
          if (statusEl) { statusEl.textContent = 'Active'; statusEl.style.color = '#555'; statusEl.style.fontWeight = 'normal'; }

          // --- OVERLAY REMOVAL REMOVED ---
          // const overlay = document.getElementById(overlayId);
          // if (overlay) overlay.remove();

          try {
               document.querySelectorAll('[style*="animation-play-state: paused"]').forEach(el => {
                   el.style.removeProperty('animation-play-state');
               });
           } catch (e) { console.error("Error resuming animations:", e); }

          // console.log("[Debug] Resuming JS timers...");
          for (const id in activeTimers) {
              const timer = activeTimers[id];
              if (timer.pauseData || !timer.nativeId) {
                  let newDelay;
                  if (timer.type === 'timeout') {
                      newDelay = timer.pauseData ? Math.max(0, timer.pauseData.remaining / speedFactor) : Math.max(0, timer.requestedDelay / speedFactor);
                      const wrappedCallback = () => {
                           if (activeTimers[id]) delete activeTimers[id];
                           try { timer.callback(...timer.args); } catch(e){ console.error("Error in resumed timeout", e); }
                       };
                       timer.nativeId = originalSetTimeout(wrappedCallback, newDelay);
                       timer.adjustedDelay = newDelay;
                       timer.expectedEndTime = originalPerformanceNow() + newDelay;
                  } else if (timer.type === 'interval') {
                      newDelay = Math.max(1, timer.requestedInterval / speedFactor);
                       const wrappedCallback = () => {
                           if (!activeTimers[id]) { originalClearInterval(timer.nativeId); return; }
                           try { timer.callback(...timer.args); } catch(e){ console.error("Error in resumed interval", e); }
                       };
                      timer.nativeId = originalSetInterval(wrappedCallback, newDelay);
                      timer.adjustedInterval = newDelay;
                  }
                  timer.pauseData = null;
              }
          }
      }
      // console.log(`[Debug] togglePause finished. State: isPaused = ${isPaused}`);
  }

  // --- Handle Keyboard Shortcuts ---
  function handleKeydown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) { return; }
      let handled = false;
      switch (e.code) {
          case 'Space': togglePause(); handled = true; break;
          case 'ArrowUp': document.getElementById('speed-faster-v2')?.click(); handled = true; break;
          case 'ArrowDown': document.getElementById('speed-slower-v2')?.click(); handled = true; break;
          case 'KeyR': document.getElementById('reset-button-v2')?.click(); handled = true; break;
      }
      if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  // --- Mutation Observer to Keep UI ---
  function setupObserver() {
      observer = new MutationObserver((mutations) => {
          if (!document.getElementById('memrise-controls-v2')) {
              // console.log("[Debug] Controls UI removed, attempting to re-add...");
              createControls();
               if (isPaused) { // Re-apply paused UI state if controls are recreated while paused
                  const pauseButton = document.getElementById('pause-button-v2');
                  const statusEl = document.getElementById('status-indicator-v2');
                  if (pauseButton) { pauseButton.textContent = 'Resume (Space)'; pauseButton.style.background = '#d9534f'; }
                  if (statusEl) { statusEl.textContent = 'PAUSED'; statusEl.style.color = '#d9534f'; statusEl.style.fontWeight = 'bold'; }
               }
          }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      // console.log("[Debug] MutationObserver set up.");
  }

  // --- Cleanup Function ---
  function cleanup() {
      // console.log("[Debug] Cleaning up Memrise Speed Controller V2.2...");
      if (observer) { observer.disconnect(); }
      restoreTimers();
      const controls = document.getElementById('memrise-controls-v2');
      if (controls) controls.remove();
      // No overlay to remove
      if (window.memriseKeysAdded) { document.removeEventListener('keydown', handleKeydown); window.memriseKeysAdded = false; }
      isPaused = false; speedFactor = 1.0; activeTimers = {};
      if (window.resetMemriseControllerV2) { delete window.resetMemriseControllerV2; }
      console.log("Memrise controller cleaned up.");
  }

  // --- Initialize ---
  function init() {
      if (window.resetMemriseControllerV2) { console.warn("Controller already initialized. Call `window.resetMemriseControllerV2()` first."); return; }
      overrideTimers();
      createControls();
      setupObserver();
      window.resetMemriseControllerV2 = cleanup;
      console.log("Memrise Speed Controller V2.2 (No Overlay) initialized successfully!");
      console.log("Use UI, Arrows (speed), Space (pause), R (reset speed).");
      console.log("Call `window.resetMemriseControllerV2()` to remove & restore.");
  }

  // --- Start ---
  originalSetTimeout(init, 500);

})();
