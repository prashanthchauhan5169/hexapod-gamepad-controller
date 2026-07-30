// websocket.js
// Handles connection to ESP32 and streams 18 servo angles continuously.

window.HexapodWS = (() => {
  const WS_URL = 'ws://192.168.4.1/ws';
  let ws = null;
  let isConnected = false;
  let frameCounter = 0;

  // We want to notify UI of status changes
  let statusCallback = null;

  function connect(onStatusChange) {
    if (onStatusChange) {
      statusCallback = onStatusChange;
    }
    
    // If already connecting or connected, ignore
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      return;
    }

    notifyStatus('connecting');
    
    try {
      ws = new WebSocket(WS_URL);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        isConnected = true;
        notifyStatus('connected');
        console.log(`[WebSocket] Connected to ${WS_URL}`);
      };

      ws.onclose = () => {
        isConnected = false;
        notifyStatus('disconnected');
        console.log('[WebSocket] Disconnected. Reconnecting in 2s...');
        ws = null;
        setTimeout(() => connect(), 2000);
      };

      ws.onerror = (err) => {
        isConnected = false;
        notifyStatus('error');
        console.error('[WebSocket] Error:', err);
      };

    } catch (e) {
      console.error('[WebSocket] Failed to construct WebSocket', e);
      setTimeout(() => connect(), 2000);
    }
  }

  function notifyStatus(status) {
    if (statusCallback) statusCallback(status);
  }

  function sendFrame(anglesArray) {
    if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // CRITICAL LATENCY FIX: 
    // If the ESP32 hasn't finished processing the last packet, DROP this frame.
    // This prevents a massive queue of old joystick positions from building up 
    // and causing the motors to lag seconds behind your actual movements.
    if (ws.bufferedAmount > 0) {
      return; 
    }

    if (!Array.isArray(anglesArray) || anglesArray.length !== 18) {
      console.error('[WebSocket] Invalid frame length, must be 18 angles');
      return;
    }

    // Frame format: [0xAA, counter, angle0..angle17]
    const buffer = new ArrayBuffer(20);
    const view = new Uint8Array(buffer);
    
    view[0] = 0xAA; // Sync byte
    view[1] = frameCounter;
    
    for (let i = 0; i < 18; i++) {
      view[2 + i] = Math.max(0, Math.min(255, Math.round(anglesArray[i])));
    }

    try {
      ws.send(buffer);
      frameCounter = (frameCounter + 1) % 256;
    } catch (e) {
      console.error('[WebSocket] Send failed', e);
    }
  }

  return { connect, sendFrame };
})();
