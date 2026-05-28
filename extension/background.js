let currentServerUrl = "ws://localhost:8000";
let activeTabId = null;

let offscreenInitPromise = null;

async function ensureOffscreenDocument() {
  // Якщо ініціалізація вже йде — повертаємо той самий Promise
  if (offscreenInitPromise) return offscreenInitPromise;

  offscreenInitPromise = (async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });
    if (contexts.length > 0) return; // документ вже існує

    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['USER_MEDIA'],
      justification: 'Audio capture for ASR'
    });

    // ─── FIX: замість setTimeout(1000) чекаємо ping-підтвердження від offscreen.
    // offscreen.js надсилає { fromOffscreen: true, type: 'ready' } після завантаження.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('[Background] Offscreen не відповів на ping за 8с'));
      }, 8000);

      function onReady(msg) {
        if (msg?.fromOffscreen && msg?.type === 'ready') {
          clearTimeout(timer);
          chrome.runtime.onMessage.removeListener(onReady);
          resolve();
        }
      }
      chrome.runtime.onMessage.addListener(onReady);
    });
  })();

  try {
    await offscreenInitPromise;
  } catch (err) {
    // Скидаємо Promise, щоб наступна спроба могла повторити ініціалізацію
    offscreenInitPromise = null;
    throw err;
  }
}

function sendToOffscreen(message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Offscreen timeout'));
    }, 15000);

    chrome.runtime.sendMessage(
      { ...message, target: 'offscreen' },
      (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      }
    );
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.fromOffscreen) {
    handleOffscreenMessage(request);
    sendResponse({ received: true });
    return false;
  }

  if (request.target === 'offscreen') {
    return false;
  }

  if (request.command) {
    processCommand(request)
      .then(result => {
        try { sendResponse(result || {}); } catch (e) {}
      })
      .catch(err => {
        try { sendResponse({ error: err.message }); } catch (e) {}
      });
    return true;
  }
});

async function processCommand(request) {
  switch (request.command) {
    case 'get_status':
      return handleGetStatus();
    case 'connect_server':
      return handleConnectServer(request.url);
    case 'disconnect_server':
      return handleDisconnectServer();
    case 'start_recording':
      return handleStartRecording();
    case 'stop_recording':
      return handleStopRecording();
    case 'toggle_recording':
      return handleToggleRecording();
    case 'clear_transcript':
      await chrome.storage.local.set({
        asr_fullTranscript: "",
        asr_processedTranscript: ""
      });
      return { cleared: true };
    case 'get_transcript': {
      const t = await chrome.storage.local.get([
        'asr_fullTranscript', 'asr_processedTranscript'
      ]);
      return {
        full: t.asr_fullTranscript || "",
        processed: t.asr_processedTranscript || ""
      };
    }
    case 'get_audio_stream_id':
      return handleGetAudioStreamId();

    // ─── FIX: відсутній обробник — offscreen.js не міг отримати налаштування
    // reconnect, тому exponential backoff ніколи не запускався.
    case 'get_reconnect_config': {
      const res = await chrome.storage.local.get(['reconnectOnClose']);
      return { reconnectOnClose: res.reconnectOnClose ?? true };
    }

    default:
      return { error: 'Unknown command' };
  }
}

function handleOffscreenMessage(request) {
  if (request.type === 'status' && request.data) {
    chrome.storage.local.set(request.data);
  } else if (request.type === 'transcript' && request.data?.line) {
    chrome.storage.local.get(['asr_fullTranscript'], (res) => {
      const updated = (res.asr_fullTranscript || "") + request.data.line;
      chrome.storage.local.set({
        asr_fullTranscript: updated,
        asr_lastUpdate: Date.now()
      });
    });
  }
  // type: 'ready' обробляється в ensureOffscreenDocument через окремий listener
}

async function handleGetStatus() {
  try {
    const status = await sendToOffscreen({ command: 'get_status' });
    const storage = await chrome.storage.local.get([
      'asr_fullTranscript', 'asr_processedTranscript'
    ]);
    return {
      isRecording: status?.isRecording || false,
      socketConnected: status?.socketConnected || false,
      serverUrl: status?.serverUrl || currentServerUrl,
      fullTranscript: storage.asr_fullTranscript || "",
      processedTranscript: storage.asr_processedTranscript || ""
    };
  } catch (error) {
    const storage = await chrome.storage.local.get([
      'asr_fullTranscript', 'asr_processedTranscript',
      'asr_isRecording', 'asr_status'
    ]);
    return {
      error: error.message,
      isRecording: storage.asr_isRecording || false,
      socketConnected: storage.asr_status === 'connected',
      serverUrl: currentServerUrl,
      fullTranscript: storage.asr_fullTranscript || "",
      processedTranscript: storage.asr_processedTranscript || ""
    };
  }
}

async function handleGetAudioStreamId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('Не знайдено активну вкладку');
  activeTabId = tab.id;

  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(id);
      }
    });
  });

  return { streamId, tabId: tab.id };
}

async function handleConnectServer(url) {
  await ensureOffscreenDocument();
  currentServerUrl = url || currentServerUrl;
  await sendToOffscreen({ command: 'connect_websocket', url: currentServerUrl });
  await chrome.storage.local.set({ lastServerUrl: currentServerUrl });
  return { status: 'connected' };
}

async function handleDisconnectServer() {
  await sendToOffscreen({ command: 'disconnect_websocket' });
  return { status: 'disconnected' };
}

async function handleStartRecording() {
  // ─── FIX: перевіряємо стан WebSocket перед захопленням аудіо.
  // Без цього запис міг стартувати без активного з'єднання із сервером,
  // і PCM-дані просто губилися.
  let offscreenStatus;
  try {
    offscreenStatus = await sendToOffscreen({ command: 'get_status' });
  } catch {
    throw new Error('Offscreen недоступний. Спочатку підключіться до сервера.');
  }

  if (!offscreenStatus?.socketConnected) {
    throw new Error('WebSocket не підключено. Спочатку підключіться до сервера ASR.');
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('Не знайдено активну вкладку');
  activeTabId = tab.id;

  const streamId = await new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(id);
      }
    });
  });

  await ensureOffscreenDocument();
  await sendToOffscreen({
    command: 'start_capture',
    streamId,
    serverUrl: currentServerUrl
  });

  await chrome.storage.local.set({ asr_isRecording: true });
  return { isRecording: true };
}

async function handleStopRecording() {
  await sendToOffscreen({ command: 'stop_capture' });
  await chrome.storage.local.set({ asr_isRecording: false });
  return { isRecording: false };
}

async function handleToggleRecording() {
  // ─── FIX: ensureOffscreenDocument перед get_status,
  // щоб не кидати помилку якщо offscreen ще не існує при першому toggle.
  await ensureOffscreenDocument();
  const status = await sendToOffscreen({ command: 'get_status' });
  if (status.isRecording) {
    return handleStopRecording();
  } else {
    return handleStartRecording();
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    sendToOffscreen({ command: 'stop_capture' }).catch(console.error);
    chrome.storage.local.set({ asr_isRecording: false });
    activeTabId = null;
  }
});

chrome.runtime.onSuspend.addListener(() => {
  offscreenInitPromise = null;
  chrome.offscreen?.closeDocument?.().catch(() => {});
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle_recording') {
    handleToggleRecording().catch(err => {
      console.error('[Background] Hotkey toggle error:', err);
    });
  }
});

async function initBackground() {
  chrome.storage.local.get(['lastServerUrl', 'autoConnect'], async (res) => {
    if (res.lastServerUrl) {
      currentServerUrl = res.lastServerUrl;
    } else {
      await chrome.storage.local.set({ lastServerUrl: currentServerUrl });
    }

    if (res.autoConnect) {
      try {
        await ensureOffscreenDocument();
        await sendToOffscreen({ command: 'connect_websocket', url: currentServerUrl });
        console.log('[Background] Автопідключення виконано');
      } catch (error) {
        console.error('[Background] Помилка автопідключення:', error);
      }
    }
  });
}

setTimeout(initBackground, 500);

console.log('[Background] Service Worker завантажено');
