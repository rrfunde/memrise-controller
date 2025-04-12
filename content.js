// == Memrise Speed Controller Extension - content.js ==
(function() {
  // --- Early Initialization: Store originals immediately ---
  const originalSetTimeout = window.setTimeout;
  const originalSetInterval = window.setInterval;
  const originalClearTimeout = window.clearTimeout;
  const originalClearInterval = window.clearInterval;
  const originalPerformanceNow = window.performance ? window.performance.now.bind(window.performance) : Date.now.bind(Date);

  // --- State Variables (scoped within IIFE) ---
  let speedFactor = 1.0; // Default value, will be overwritten by storage
  let isPaused = false;
  let activeTimers = {};
  let nextTimerId = 1;
  let observer;
  let uiControlsCreated = false;
  let memriseKeysAdded = false; // Track keyboard listener attachment

  // --- Flag to ensure initialization runs only once ---
  let initialized = false;

  // --- Check if already initialized (due to potential multiple injections/race conditions) ---
   if (window.memriseControllerInitialized) {
       console.log("Memrise Controller: Already initialized on this page.");
       return;
   }
   window.memriseControllerInitialized = true;
   console.log("Memrise Speed Controller: Initializing...");


  // --- Timer Override Functions (must be defined early) ---
  function overrideTimers() {
      // console.log("Memrise Controller: Overriding timers..."); // Keep console clean

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
              try { callback(...args); } catch (e) { console.error("Memrise Controller Error (setTimeout):", e); }
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
              try { callback(...args); } catch (e) { console.error("Memrise Controller Error (setInterval):", e); }
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
      // console.log("Memrise Controller: Timer overrides applied.");
  }

  // --- Restore Original Timer Functions (kept for potential disable toggle later) ---
  function restoreTimers() {
      // console.log("Memrise Controller: Restoring original timers...");
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
      // console.log("Memrise Controller: Original timers restored.");
  }

   // --- UI Creation ---
   function createControls() {
      if (document.getElementById('memrise-controls-ext')) { return; } // Use unique ID for extension
      // console.log("Memrise Controller: Creating UI controls...");
      const controlsContainer = document.createElement('div');
       controlsContainer.id = 'memrise-controls-ext'; // Unique ID
       controlsContainer.style.cssText = `
         position: fixed; top: 10px; right: 10px;
         background: rgba(255, 255, 255, 0.95); border: 1px solid #ccc;
         border-radius: 6px; padding: 12px;
         box-shadow: 0 3px 12px rgba(0,0,0,0.25); z-index: 2147483647; /* Max z-index */
         display: flex; flex-direction: column; gap: 10px;
         width: 200px; font-family: sans-serif; color: #333;
         line-height: 1.4; /* Improve readability */
       `;
       const speedControls = document.createElement('div');
       // Display speed factor loaded from storage
       speedControls.innerHTML = `
         <div style="font-weight: bold; margin-bottom: 6px; text-align: center;">Speed: <span id="speed-value-ext">${speedFactor.toFixed(2)}x</span></div>
         <div style="display: flex; justify-content: space-between; gap: 5px;">
           <button id="speed-slower-ext" style="flex: 1; padding: 4px 8px; font-size: 16px; cursor: pointer;">-</button>
           <button id="speed-faster-ext" style="flex: 1; padding: 4px 8px; font-size: 16px; cursor: pointer;">+</button>
         </div>
       `;
       const pauseButton = document.createElement('button');
       pauseButton.id = 'pause-button-ext';
       pauseButton.textContent = 'Pause (Space)';
       pauseButton.style.cssText = `
         padding: 6px 12px; background: #5cb85c; color: white;
         border: none; border-radius: 4px; cursor: pointer;
         font-weight: bold; text-align: center;
       `;
       const resetButton = document.createElement('button');
       resetButton.id = 'reset-button-ext';
       resetButton.textContent = 'Reset Speed (R)';
       resetButton.style.cssText = `
         padding: 6px 12px; background: #337ab7; color: white;
         border: none; border-radius: 4px; cursor: pointer; text-align: center;
       `;
       const statusIndicator = document.createElement('div');
       statusIndicator.id = 'status-indicator-ext';
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

       // Add event listeners with unique IDs
       document.getElementById('speed-slower-ext').addEventListener('click', () => { adjustSpeed(Math.max(0.1, speedFactor - 0.1)); });
       document.getElementById('speed-faster-ext').addEventListener('click', () => { adjustSpeed(Math.min(4.0, speedFactor + 0.1)); });
       document.getElementById('pause-button-ext').addEventListener('click', togglePause);
       document.getElementById('reset-button-ext').addEventListener('click', () => { adjustSpeed(1.0); }); // Reset calls adjustSpeed which saves 1.0

       // Add keyboard shortcuts (only once per page load)
       if (!memriseKeysAdded) {
           document.addEventListener('keydown', handleKeydown);
           memriseKeysAdded = true;
       }
       uiControlsCreated = true;
       // console.log("Memrise Controller: UI controls created.");

        // Re-apply paused state visuals if controls are created while paused
        if (isPaused) {
            updatePauseUI(true);
        }
   }

  // --- Adjust Speed (Handles Saving) ---
  function adjustSpeed(factor) {
      speedFactor = Math.round(factor * 100) / 100;
      // Update UI immediately
      const speedValueEl = document.getElementById('speed-value-ext');
      if (speedValueEl) { speedValueEl.textContent = `${speedFactor.toFixed(2)}x`; }

      // Save to chrome.storage.sync
      chrome.storage.sync.set({ memriseSpeedFactor: speedFactor }, () => {
          if (chrome.runtime.lastError) {
              console.error("Memrise Controller: Error saving speed factor:", chrome.runtime.lastError);
          } else {
              // console.log(`Memrise Controller: Speed factor ${speedFactor} saved.`);
          }
      });
  }

  // --- Update Pause UI Helper ---
  function updatePauseUI(pausedState) {
       const pauseButton = document.getElementById('pause-button-ext');
       const statusEl = document.getElementById('status-indicator-ext');
       if (pausedState) {
           if (pauseButton) { pauseButton.textContent = 'Resume (Space)'; pauseButton.style.background = '#d9534f'; }
           if (statusEl) { statusEl.textContent = 'PAUSED'; statusEl.style.color = '#d9534f'; statusEl.style.fontWeight = 'bold'; }
       } else {
           if (pauseButton) { pauseButton.textContent = 'Pause (Space)'; pauseButton.style.background = '#5cb85c'; }
           if (statusEl) { statusEl.textContent = 'Active'; statusEl.style.color = '#555'; statusEl.style.fontWeight = 'normal'; }
       }
  }

  // --- Toggle Pause / Resume ---
  function togglePause() {
      // console.log(`Memrise Controller: togglePause called. Current state: isPaused = ${isPaused}`);
      isPaused = !isPaused;
      const now = originalPerformanceNow();

      updatePauseUI(isPaused); // Update button text/style/status

      if (isPaused) {
          // --- PAUSING ---
          try {
              document.querySelectorAll('[class*="progress"], [class*="timer"], [style*="animation"]').forEach(el => {
                  el.style.setProperty('animation-play-state', 'paused', 'important');
              });
          } catch (e) { console.error("Memrise Controller Error (pausing animations):", e); }

          for (const id in activeTimers) {
              const timer = activeTimers[id];
              if (timer.nativeId) {
                  const remainingTime = timer.type === 'timeout' ? Math.max(0, timer.expectedEndTime - now) : timer.adjustedInterval;
                  if (timer.type === 'timeout') { originalClearTimeout(timer.nativeId); } else { originalClearInterval(timer.nativeId); }
                  timer.pauseData = { remaining: remainingTime, pauseTime: now };
                  timer.nativeId = null;
              }
          }
      } else {
          // --- RESUMING ---
          try {
               document.querySelectorAll('[style*="animation-play-state: paused"]').forEach(el => {
                   el.style.removeProperty('animation-play-state');
               });
           } catch (e) { console.error("Memrise Controller Error (resuming animations):", e); }

          for (const id in activeTimers) {
              const timer = activeTimers[id];
              if (timer.pauseData || !timer.nativeId) {
                  let newDelay;
                  if (timer.type === 'timeout') {
                      newDelay = timer.pauseData ? Math.max(0, timer.pauseData.remaining / speedFactor) : Math.max(0, timer.requestedDelay / speedFactor);
                      const wrappedCallback = () => {
                           if (activeTimers[id]) delete activeTimers[id];
                           try { timer.callback(...timer.args); } catch(e){ console.error("Memrise Controller Error (resumed timeout):", e); }
                       };
                       timer.nativeId = originalSetTimeout(wrappedCallback, newDelay);
                       timer.adjustedDelay = newDelay;
                       timer.expectedEndTime = originalPerformanceNow() + newDelay;
                  } else if (timer.type === 'interval') {
                      newDelay = Math.max(1, timer.requestedInterval / speedFactor);
                       const wrappedCallback = () => {
                           if (!activeTimers[id]) { originalClearInterval(timer.nativeId); return; }
                           try { timer.callback(...timer.args); } catch(e){ console.error("Memrise Controller Error (resumed interval):", e); }
                       };
                      timer.nativeId = originalSetInterval(wrappedCallback, newDelay);
                      timer.adjustedInterval = newDelay;
                  }
                  timer.pauseData = null;
              }
          }
      }
      // console.log(`Memrise Controller: togglePause finished. State: isPaused = ${isPaused}`);
  }

  // --- Handle Keyboard Shortcuts ---
  function handleKeydown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) { return; }
      let handled = false;
      switch (e.code) {
          case 'Space': togglePause(); handled = true; break;
          case 'ArrowUp': document.getElementById('speed-faster-ext')?.click(); handled = true; break;
          case 'ArrowDown': document.getElementById('speed-slower-ext')?.click(); handled = true; break;
          case 'KeyR': document.getElementById('reset-button-ext')?.click(); handled = true; break;
      }
      if (handled) { e.preventDefault(); e.stopPropagation(); }
  }

  // --- Mutation Observer to Keep UI ---
  function setupObserver() {
      if (observer) observer.disconnect(); // Disconnect previous if any

      observer = new MutationObserver((mutations) => {
           // Check if the specific speed review container exists. If not, maybe remove controls?
           // Or simply re-add if missing.
          if (!document.getElementById('memrise-controls-ext') && document.querySelector('#speed-review, .speed-review-container')) { // Added check for speed review element
              // console.log("Memrise Controller: Controls UI removed, re-adding...");
              createControls(); // Recreate the UI if it vanished on a speed review page
          }
           // Optional: Auto-remove controls if not on a speed review page?
           // else if (document.getElementById('memrise-controls-ext') && !document.querySelector('#speed-review, .speed-review-container')) {
           //     removeControls();
           // }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      // console.log("Memrise Controller: MutationObserver set up.");
  }

  // --- Function to Remove UI and Listeners (Optional) ---
  function removeControls() {
       if (observer) observer.disconnect();
       const controls = document.getElementById('memrise-controls-ext');
       if (controls) controls.remove();
       if (memriseKeysAdded) {
           document.removeEventListener('keydown', handleKeydown);
           memriseKeysAdded = false;
       }
       uiControlsCreated = false;
       // console.log("Memrise Controller: UI controls removed.");
  }


  // --- Main Initialization Logic ---
  function mainInit() {
      if (initialized) return; // Already ran
      initialized = true;

      // 1. Apply timer overrides immediately
      overrideTimers();

      // 2. Load speed factor from storage
      chrome.storage.sync.get(['memriseSpeedFactor'], (result) => {
          if (chrome.runtime.lastError) {
              console.error("Memrise Controller: Error loading speed factor:", chrome.runtime.lastError);
              // Proceed with default speedFactor = 1.0
          } else if (result.memriseSpeedFactor !== undefined) {
              speedFactor = result.memriseSpeedFactor;
              console.log(`Memrise Controller: Loaded speed factor ${speedFactor} from storage.`);
          } else {
              // console.log("Memrise Controller: No speed factor in storage, using default 1.0.");
              speedFactor = 1.0; // Ensure default if not found
          }

           // 3. Now that speed is loaded, check if we are likely on a speed review page
           // We delay UI creation slightly OR wait for DOM ready, because run_at=document_start
           const checkAndCreateUI = () => {
               // Check for elements common in speed review to decide whether to add controls
               // This querySelector might need adjustment based on Memrise structure
               if (document.querySelector('#speed-review, .speed-review-container, [data-testid="SpeedReviewScreen"]')) {
                   if (!uiControlsCreated) {
                       createControls(); // Create UI elements
                       setupObserver(); // Start observer to keep UI persistent
                   }
               } else {
                   // If controls exist but we are not on a speed review page, remove them (optional)
                   // removeControls();
               }
           };

          // Wait for DOM content or just use a timeout
          if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', checkAndCreateUI);
          } else {
               // DOM is already ready or use timeout for safety
               originalSetTimeout(checkAndCreateUI, 100); // Small delay after storage load
          }
      });
  }

  // --- Trigger Initialization ---
  // Since run_at is document_start, mainInit() runs early.
  // Storage is async, UI creation is delayed inside its callback.
   mainInit();

})(); // End of IIFE
