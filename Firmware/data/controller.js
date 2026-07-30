/* ══════════════════════════════════════════════════════
   ESP32 VIRTUAL GAMEPAD — CONTROLLER LOGIC
   All inputs log to console for verification.
   Connection / ESP32 setup is intentionally omitted.
   ══════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // ─── Logger ───────────────────────────────
  function logToConsole(message, type = 'action') {
    console.log(`[Gamepad] ${message}`);
  }


  // ═══════════════════════════════════════════════════
  // COMPONENT: Standard Buttons (D-Pad, Face, Menu, Bumpers)
  // ═══════════════════════════════════════════════════

  /**
   * Sets up press/release handlers on a button element.
   * Logs the press and release events.
   */
  function setupButton(element) {
    if (!element) return;
    const name = element.dataset.button;

    function onPress(e) {
      e.preventDefault();
      element.classList.add('pressed');
      logToConsole(`🔘 Button ${name} PRESSED`, 'action');
    }

    function onRelease(e) {
      e.preventDefault();
      if (element.classList.contains('pressed')) {
        element.classList.remove('pressed');
        logToConsole(`⚪ Button ${name} RELEASED`, 'action');
      }
    }

    // Mouse events
    element.addEventListener('mousedown', onPress);
    element.addEventListener('mouseup', onRelease);
    element.addEventListener('mouseleave', onRelease);

    // Touch events (for mobile)
    element.addEventListener('touchstart', onPress, { passive: false });
    element.addEventListener('touchend', onRelease, { passive: false });
    element.addEventListener('touchcancel', onRelease, { passive: false });
  }

  // Gather all buttons with data-button attribute
  const allButtons = document.querySelectorAll('[data-button]');
  allButtons.forEach(setupButton);


  // ═══════════════════════════════════════════════════
  // COMPONENT: Trigger Buttons (LT / RT) — Analog Fill
  // ═══════════════════════════════════════════════════

  /**
   * Triggers behave like analog buttons.
   * On press, they fill to 100%; on release, they return to 0%.
   * In a real setup these could map to PWM-style servo speed.
   */
  function setupTrigger(btnId, fillId) {
    const btn = document.getElementById(btnId);
    const fill = document.getElementById(fillId);
    if (!btn || !fill) return;

    const name = btn.dataset.button;

    function onPress(e) {
      e.preventDefault();
      btn.classList.add('pressed');
      fill.style.height = '100%';
      logToConsole(`🎚️ Trigger ${name} → 100%`, 'trigger');
    }

    function onRelease(e) {
      e.preventDefault();
      if (btn.classList.contains('pressed')) {
        btn.classList.remove('pressed');
        fill.style.height = '0%';
        logToConsole(`🎚️ Trigger ${name} → 0%`, 'trigger');
      }
    }

    btn.addEventListener('mousedown', onPress);
    btn.addEventListener('mouseup', onRelease);
    btn.addEventListener('mouseleave', onRelease);
    btn.addEventListener('touchstart', onPress, { passive: false });
    btn.addEventListener('touchend', onRelease, { passive: false });
    btn.addEventListener('touchcancel', onRelease, { passive: false });
  }

  setupTrigger('btnLT', 'ltFill');
  setupTrigger('btnRT', 'rtFill');


  // ═══════════════════════════════════════════════════
  // COMPONENT: Analog Joystick (LLS / RLS)
  // ═══════════════════════════════════════════════════

  // Global joystick state
  const GamepadState = {
    lsX: 0,
    lsY: 0,
    rsX: 0,
    rsY: 0
  };

  function createJoystick({ containerId, thumbId, xReadoutId, yReadoutId, label, stateKeyX, stateKeyY }) {
    const container = document.getElementById(containerId);
    const thumb = document.getElementById(thumbId);
    const xDisplay = document.getElementById(xReadoutId);
    const yDisplay = document.getElementById(yReadoutId);

    if (!container || !thumb) return;

    let isDragging = false;
    let activeTouchId = null; 
    let containerRect = null;
    let centerX = 0;
    let centerY = 0;
    let maxRadius = 0;

    let lastLogTime = 0;
    const LOG_INTERVAL_MS = 150;

    function updateContainerMetrics() {
      containerRect = container.getBoundingClientRect();
      centerX = containerRect.left + containerRect.width / 2;
      centerY = containerRect.top + containerRect.height / 2;
      maxRadius = (containerRect.width / 2) - (thumb.offsetWidth / 2);
    }

    function setThumbPosition(normX, normY) {
      const pixelX = normX * maxRadius;
      const pixelY = normY * maxRadius;

      thumb.style.transform = `translate(calc(-50% + ${pixelX}px), calc(-50% + ${pixelY}px))`;

      const displayX = Math.round(normX * 100);
      const displayY = Math.round(-normY * 100);

      xDisplay.textContent = `X: ${displayX}`;
      yDisplay.textContent = `Y: ${displayY}`;

      // Update global state
      if (stateKeyX) GamepadState[stateKeyX] = displayX;
      if (stateKeyY) GamepadState[stateKeyY] = displayY;

      const now = Date.now();
      if (now - lastLogTime > LOG_INTERVAL_MS) {
        lastLogTime = now;
        logToConsole(`🕹️ ${label} Stick → X:${displayX} Y:${displayY}`, 'stick');
      }
    }

    function onPointerMove(clientX, clientY) {
      if (!isDragging) return;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      setThumbPosition(dx / maxRadius, dy / maxRadius);
    }

    function resetStick() {
      if (!isDragging) return;
      isDragging = false;
      activeTouchId = null;
      thumb.classList.remove('active');

      thumb.style.transition = 'transform .25s cubic-bezier(.34,1.56,.64,1)';
      thumb.style.transform = 'translate(-50%, -50%)';

      xDisplay.textContent = 'X: 0';
      yDisplay.textContent = 'Y: 0';

      if (stateKeyX) GamepadState[stateKeyX] = 0;
      if (stateKeyY) GamepadState[stateKeyY] = 0;

      setTimeout(() => { thumb.style.transition = ''; }, 260);
      logToConsole(`🕹️ ${label} Stick RELEASED → X:0 Y:0`, 'stick');
    }

    // ─── Mouse events (desktop) ───
    container.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      thumb.classList.add('active');
      updateContainerMetrics();
      onPointerMove(e.clientX, e.clientY);
      logToConsole(`🕹️ ${label} Stick ENGAGED`, 'stick');
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging && activeTouchId === null) {
        onPointerMove(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => {
      if (activeTouchId === null) resetStick();
    });

    // ─── Touch events (mobile, multi-touch safe) ───
    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (isDragging) return; // Already tracking a finger

      const touch = e.changedTouches[0];
      activeTouchId = touch.identifier;
      isDragging = true;
      thumb.classList.add('active');
      updateContainerMetrics();
      onPointerMove(touch.clientX, touch.clientY);
      logToConsole(`🕹️ ${label} Stick ENGAGED`, 'stick');
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging || activeTouchId === null) return;

      // Find OUR specific touch among all active touches
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
          e.preventDefault();
          onPointerMove(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
          return;
        }
      }
    }, { passive: false });

    function handleTouchEnd(e) {
      if (activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
          resetStick();
          return;
        }
      }
    }

    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  }

  // Initialize both sticks
  createJoystick({
    containerId: 'leftStickContainer',
    thumbId: 'leftStickThumb',
    xReadoutId: 'leftStickX',
    yReadoutId: 'leftStickY',
    label: 'LEFT',
    stateKeyX: 'lsX',
    stateKeyY: 'lsY'
  });

  createJoystick({
    containerId: 'rightStickContainer',
    thumbId: 'rightStickThumb',
    xReadoutId: 'rightStickX',
    yReadoutId: 'rightStickY',
    label: 'RIGHT',
    stateKeyX: 'rsX',
    stateKeyY: 'rsY'
  });


  // ─── Startup Message ─────────────────────────────
  logToConsole('✅ All components registered. Touch or click to interact.', 'info');
  logToConsole('ℹ️  Connection setup placeholder — ESP32 link not yet configured.', 'info');

  // ═══════════════════════════════════════════════════
  // COMPONENT: Layout Editor (Move & Resize)
  // ═══════════════════════════════════════════════════
  const btnEditMode = document.getElementById('btnEditMode');
  const btnResetLayout = document.getElementById('btnResetLayout');
  const editActions = document.getElementById('editActions');
  const componentGroups = document.querySelectorAll('.component-group');
  
  let isEditMode = false;
  const LAYOUT_STORAGE_KEY = 'esp32_gamepad_layout_v1';

  // Toggle Edit Mode
  btnEditMode.addEventListener('click', () => {
    isEditMode = !isEditMode;
    document.body.classList.toggle('edit-mode', isEditMode);
    
    if (isEditMode) {
      btnEditMode.classList.add('pressed');
      editActions.classList.remove('hidden');
      logToConsole('✏️ Edit Mode ENABLED. Drag to move, use bottom-right handle to scale.', 'info');
    } else {
      btnEditMode.classList.remove('pressed');
      editActions.classList.add('hidden');
      loadLayout(); // Revert unsaved changes
      logToConsole('✏️ Edit Mode DISABLED. Changes reverted.', 'info');
    }
  });

  // Auto Save Layout
  function saveLayout() {
    const layoutConfig = {};
    componentGroups.forEach(group => {
      layoutConfig[group.id] = {
        left: group.style.left,
        top: group.style.top,
        transform: group.style.transform,
        hidden: group.classList.contains('user-hidden')
      };
    });
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutConfig));
  }

  // Reset Layout
  btnResetLayout.addEventListener('click', () => {
    if (!confirm('Are you sure you want to reset the layout to default?')) return;
    
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
    
    componentGroups.forEach(group => {
      group.style.position = '';
      group.style.left = '';
      group.style.top = '';
      group.style.transform = '';
      group.style.margin = '';
      group.classList.remove('user-hidden');
      const toggle = group.querySelector('.hide-toggle');
      if (toggle) toggle.textContent = '👁️';
    });
    
    logToConsole('🔄 Layout RESET to defaults.', 'info');
    // Exit edit mode
    btnEditMode.click();
  });

  // Load Layout on Startup
  function loadLayout() {
    const saved = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!saved) return;
    
    try {
      const layoutConfig = JSON.parse(saved);
      componentGroups.forEach(group => {
        const config = layoutConfig[group.id];
        if (config) {
          group.style.position = 'absolute';
          group.style.left = config.left || '';
          group.style.top = config.top || '';
          group.style.transform = config.transform || '';
          group.style.margin = '0'; // Remove any centering margins
          
          if (config.hidden) {
            group.classList.add('user-hidden');
            const toggle = group.querySelector('.hide-toggle');
            if (toggle) toggle.textContent = '🚫';
          } else {
            group.classList.remove('user-hidden');
            const toggle = group.querySelector('.hide-toggle');
            if (toggle) toggle.textContent = '👁️';
          }
        }
      });
      // Do not log this on every startup to avoid spam, but apply it silently.
    } catch (e) {
      console.error('Failed to parse layout config', e);
    }
  }

  // Drag, Resize, and Hide Handlers
  componentGroups.forEach(group => {
    let isDragging = false;
    let isResizing = false;
    
    // Setup hide toggle
    const hideToggle = group.querySelector('.hide-toggle');
    if (hideToggle) {
      hideToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = group.classList.toggle('user-hidden');
        hideToggle.textContent = isHidden ? '🚫' : '👁️';
        saveLayout(); // Auto-save on visibility change
      });
    }
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    
    let startScale = 1;
    let startWidth = 0;

    function getPointerPos(e) {
      if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      return { x: e.clientX, y: e.clientY };
    }

    // Determine current scale from transform string
    function getCurrentScale() {
      const transform = group.style.transform;
      if (transform && transform.includes('scale(')) {
        const match = transform.match(/scale\(([^)]+)\)/);
        if (match && match[1]) {
          return parseFloat(match[1]);
        }
      }
      return 1;
    }

    // Pointer Down
    group.addEventListener('mousedown', handlePointerDown);
    group.addEventListener('touchstart', handlePointerDown, { passive: false });

    function handlePointerDown(e) {
      if (!isEditMode) return;
      
      const target = e.target;

      // Don't start drag when clicking interactive controls
      if (target.closest('#btnEditMode') || target.closest('#btnFullscreen') || target.closest('.hide-toggle') || target.closest('#btnStart')) {
        return; // Let the button's own click handler fire instead
      }

      // Is it a resize handle?
      if (target.classList.contains('resize-handle')) {
        isResizing = true;
      } else {
        // Dragging the overlay
        isDragging = true;
      }
      
      e.preventDefault(); // prevent scrolling/selection

      const pos = getPointerPos(e);
      startX = pos.x;
      startY = pos.y;
      
      // If element is not yet absolute, make it absolute where it currently is visually
      if (group.style.position !== 'absolute') {
        const rect = group.getBoundingClientRect();
        group.style.position = 'absolute';
        group.style.margin = '0';
        group.style.left = rect.left + 'px';
        group.style.top = rect.top + 'px';
      }

      startLeft = parseFloat(group.style.left) || group.getBoundingClientRect().left;
      startTop = parseFloat(group.style.top) || group.getBoundingClientRect().top;
      startScale = getCurrentScale();
      startWidth = group.offsetWidth;

      // Ensure dragged element is on top
      componentGroups.forEach(g => g.style.zIndex = '1');
      group.style.zIndex = '100';

      document.addEventListener('mousemove', handlePointerMove);
      document.addEventListener('touchmove', handlePointerMove, { passive: false });
      document.addEventListener('mouseup', handlePointerUp);
      document.addEventListener('touchend', handlePointerUp);
    }

    function handlePointerMove(e) {
      if (!isDragging && !isResizing) return;
      e.preventDefault();

      const pos = getPointerPos(e);
      const dx = pos.x - startX;
      const dy = pos.y - startY;

      if (isDragging) {
        group.style.left = (startLeft + dx) + 'px';
        group.style.top = (startTop + dy) + 'px';
      } else if (isResizing) {
        // More convenient scaling: moving pointer down or right increases scale
        const scaleDelta = (dx + dy) / (startWidth * 1.5);
        let newScale = startScale + scaleDelta;
        
        // Clamp scale
        if (newScale < 0.5) newScale = 0.5;
        if (newScale > 2.5) newScale = 2.5;

        group.style.transform = `scale(${newScale})`;
      }
    }

    function handlePointerUp() {
      if (isDragging || isResizing) {
        saveLayout(); // Auto-save on layout adjustment
      }
      isDragging = false;
      isResizing = false;
      document.removeEventListener('mousemove', handlePointerMove);
      document.removeEventListener('touchmove', handlePointerMove);
      document.removeEventListener('mouseup', handlePointerUp);
      document.removeEventListener('touchend', handlePointerUp);
    }
  });

  // ═══════════════════════════════════════════════════
  // FULLSCREEN TOGGLE
  // ═══════════════════════════════════════════════════
  const btnFullscreen = document.getElementById('btnFullscreen');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const svgPaths = {
        expand: "M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zm5 14h-5v-2h3v-3h2v5zm-14 0v-5h2v3h3v2H5z",
        collapse: "M10 10V5H8v3H5v2h5zm4 0h5V8h-3V5h-2v5zm0 9v-5h5v2h-3v3h-2zm-4 0v-3H5v-2h5v5h-2z"
      };
      
      const svgEl = btnFullscreen.querySelector('svg path');
      if (document.fullscreenElement) {
        if (svgEl) svgEl.setAttribute('d', svgPaths.collapse);
        btnFullscreen.title = 'Exit Fullscreen';
      } else {
        if (svgEl) svgEl.setAttribute('d', svgPaths.expand);
        btnFullscreen.title = 'Toggle Fullscreen';
      }
    });
  }

  // Init layout on load
  loadLayout();

  // ═══════════════════════════════════════════════════
  // HEXAPOD ENGINE AND WEBSOCKET LOOP
  // ═══════════════════════════════════════════════════
  if (window.HexapodWS && window.Hexapod) {
    const connStatus = document.getElementById('connStatus');
    
    // Connect WebSocket
    HexapodWS.connect((status) => {
      if (!connStatus) return;
      connStatus.className = 'connection-badge'; // Reset classes
      if (status === 'connecting') {
        connStatus.classList.add('status-connecting');
      } else if (status === 'connected') {
        connStatus.classList.add('status-connected');
      } else {
        connStatus.classList.add('status-disconnected');
      }
    });

    // 15Hz Control Loop (more than enough for smooth servo movement, prevents TCP queue flooding)
    let lastTime = performance.now();
    let lastAnglesStr = "";
    
    setInterval(() => {
      let now = performance.now();
      let dt = (now - lastTime) / 1000;
      lastTime = now;
      
      const lsX = GamepadState.lsX;
      const lsY = GamepadState.lsY;
      const rsX = GamepadState.rsX;
      
      const servoAngles = Hexapod.update(dt, lsX, lsY, rsX);
      
      // CRITICAL TCP QUEUE FIX:
      // Convert to a quick string to check if the angles actually changed
      // If the sticks are idle and the robot is standing still, DO NOT spam the network!
      const currentAnglesStr = servoAngles.join(',');
      
      if (currentAnglesStr !== lastAnglesStr) {
        HexapodWS.sendFrame(servoAngles);
        lastAnglesStr = currentAnglesStr;
      }
      
    }, 1000 / 15);
  }

})();
