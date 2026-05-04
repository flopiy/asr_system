let audioContext = null;
let mediaStream = null;
let source = null;
let workletNode = null;
let socket = null;
let isRecording = false;
let currentServerUrl = "ws://localhost:8000";
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectTimeout = null;
let isManualClose = false;

console.log('[Offscreen] Script loaded');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;
  
  if (message.command === 'ping') {
    sendResponse({ pong: true });
    return false;
  }
  
  (async () => {
    try {
      let result;
      switch (message.command) {
        case 'start_capture':
          await startCapture(message.streamId, message.serverUrl);
          result = { success: true };
          break;
        case 'stop_capture':
          stopCapture();
          result = { success: true };
          break;
        case 'connect_websocket':
          await connectWebSocket(message.url);
          result = { success: true };
          break;
        case 'disconnect_websocket':
          disconnectWebSocket();
          result = { success: true };
          break;
        case 'get_status':
          result = {
            isRecording,
            socketConnected: socket?.readyState === WebSocket.OPEN,
            serverUrl: currentServerUrl
          };
          break;
        default:
          result = { error: 'Unknown command' };
      }
      sendResponse(result);
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();
  
  return true;
});

function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    if (socket?.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    
    currentServerUrl = url || currentServerUrl;
    isManualClose = false;
    let resolved = false;
    
    try {
      socket = new WebSocket(currentServerUrl);
      socket.binaryType = 'arraybuffer';
      
      socket.onopen = () => {
        resolved = true;
        reconnectAttempts = 0;
        notifyBackground('status', { asr_status: 'connected' });
        resolve();
      };
      
      socket.onclose = (event) => {
        notifyBackground('status', { asr_status: 'disconnected' });
        if (!resolved) {
          reject(new Error(`WebSocket закрито з кодом ${event.code}`));
          return;
        }
        if (!isManualClose) {
          scheduleReconnect();
        }
      };
      
      socket.onerror = () => {
        // Помилка WebSocket
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const line = `[${new Date().toLocaleTimeString()}] ${data.text}\n`;
          notifyBackground('transcript', { line });
        } catch (e) {
          console.error('[Offscreen] Помилка парсингу:', e);
        }
      };
    } catch (err) {
      reject(err);
    }
  });
}

function disconnectWebSocket() {
  isManualClose = true;
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (socket) {
    socket.close();
    socket = null;
  }
  notifyBackground('status', { asr_status: 'disconnected' });
}

function scheduleReconnect() {
  chrome.runtime.sendMessage(
    { command: 'get_reconnect_config' }, 
    (res) => {
      if (chrome.runtime.lastError) return;
      if (res?.reconnectOnClose && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectTimeout = setTimeout(() => {
          connectWebSocket(currentServerUrl).catch(console.error);
        }, delay);
      }
    }
  );
}

async function startCapture(streamId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      }
    });

    mediaStream = stream;
    audioContext = new AudioContext({ sampleRate: 16000 });
    source = audioContext.createMediaStreamSource(stream);

    source.connect(audioContext.destination);

    await audioContext.audioWorklet.addModule('audio-processor.js');
    workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
    
    source.connect(workletNode);

    workletNode.port.onmessage = (event) => {
      if (socket?.readyState === WebSocket.OPEN) {
        const float32Data = event.data;
        const pcm16Data = floatTo16BitPCM(float32Data);
        socket.send(pcm16Data);
      }
    };

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    isRecording = true;
    notifyBackground('status', { asr_isRecording: true });
    console.log('[Offscreen] Потік активовано: звук дублюється на сервер та динаміки');

  } catch (err) {
    console.error('[Offscreen] Помилка захоплення:', err);
    notifyBackground('error', { message: err.message });
  }
}

function floatTo16BitPCM(input) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output.buffer;
}

function stopCapture() {
  console.log('[Offscreen] Зупинка запису');
  
  if (workletNode) {
    try {
      workletNode.disconnect();
    } catch(e) {}
    workletNode.port.onmessage = null;
    workletNode = null;
  }
  if (source) {
    try {
      source.disconnect();
    } catch(e) {}
    source = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  
  isRecording = false;
  notifyBackground('status', { asr_isRecording: false });
  console.log('[Offscreen] Запис зупинено');
}

function notifyBackground(type, data) {
  try {
    chrome.runtime.sendMessage({ fromOffscreen: true, type, data });
  } catch (e) {
    // Помилка відправки
  }
}