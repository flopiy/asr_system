const DB_NAME = 'ASRTranscriberDocs';
const DB_VERSION = 1;
let db = null;

// ==================== INDEXEDDB ====================

function initDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains('attached')) {
        database.createObjectStore('attached', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('received')) {
        database.createObjectStore('received', { keyPath: 'id' });
      }
    };
  });
}

function saveToIndexedDB(storeName, data) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteFromIndexedDB(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getAllFromIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function getFromIndexedDB(storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function clearIndexedDB(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) { reject(new Error('Database not initialized')); return; }
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==================== CHROME STORAGE HELPERS ====================

async function loadSettings() {
  const result = await chrome.storage.local.get(['lastServerUrl', 'autoConnect', 'reconnectOnClose']);
  const serverUrl = document.getElementById('serverUrl');
  const autoConnect = document.getElementById('autoConnect');
  const reconnectOnClose = document.getElementById('reconnectOnClose');
  
  if (result.lastServerUrl && serverUrl) {
    serverUrl.value = result.lastServerUrl;
    currentServerUrl = result.lastServerUrl;
  }
  if (result.autoConnect !== undefined && autoConnect) autoConnect.checked = result.autoConnect;
  if (result.reconnectOnClose !== undefined && reconnectOnClose) reconnectOnClose.checked = result.reconnectOnClose;
}


async function loadTranscriptFromStorage() {
  const result = await chrome.storage.local.get(['asr_fullTranscript', 'asr_processedTranscript']);
  fullTranscript = result.asr_fullTranscript || '';
  processedTranscript = result.asr_processedTranscript || '';
  updateDisplay();
  if (fullTranscript.trim()) enableActionButtons();
}

async function loadLLMSettings() {
  const res = await chrome.storage.local.get([
    'llm_provider', 'llm_apiKey', 'llm_model', 'llm_endpoint',
    'llm_prompt', 'llm_temp', 'llm_maxTokens', 'llm_autoProcess', 'llm_saveHistory'
  ]);
  if (document.getElementById('llmProvider') && res.llm_provider) document.getElementById('llmProvider').value = res.llm_provider;
  if (document.getElementById('apiKey') && res.llm_apiKey) document.getElementById('apiKey').value = await decryptApiKey(res.llm_apiKey);
  if (document.getElementById('modelName') && res.llm_model) document.getElementById('modelName').value = res.llm_model;
  if (document.getElementById('apiEndpoint') && res.llm_endpoint) document.getElementById('apiEndpoint').value = res.llm_endpoint;
  if (document.getElementById('systemPrompt') && res.llm_prompt) document.getElementById('systemPrompt').value = res.llm_prompt;
  if (document.getElementById('temperature') && res.llm_temp !== undefined) document.getElementById('temperature').value = res.llm_temp;
  if (document.getElementById('maxTokens') && res.llm_maxTokens) document.getElementById('maxTokens').value = res.llm_maxTokens;
  if (document.getElementById('autoProcess') && res.llm_autoProcess !== undefined) document.getElementById('autoProcess').checked = res.llm_autoProcess;
  if (document.getElementById('saveHistory') && res.llm_saveHistory !== undefined) document.getElementById('saveHistory').checked = res.llm_saveHistory;
}

async function loadLLMConfigs() {
  const container = document.getElementById('configsList');
  if (!container) return;
  const res = await chrome.storage.local.get('llm_configs');
  const configs = res.llm_configs || [];
  if (configs.length === 0) {
    container.innerHTML = '<p style="font-size:12px; color:var(--text-secondary); text-align:center; padding: 10px;">Немає збережених конфігурацій</p>';
    return;
  }
  container.innerHTML = '';
  configs.forEach(cfg => {
    const item = document.createElement('div');
    item.className = 'config-item';
    item.innerHTML = `<span>${cfg.name} <small style="opacity:0.6">${cfg.createdAt}</small></span>
      <div><button class="btn-load" data-id="${cfg.id}">Завантажити</button>
      <button class="btn-delete" data-id="${cfg.id}">Видалити</button></div>`;
    container.appendChild(item);
  });
  container.querySelectorAll('.btn-load').forEach(btn => {
    btn.addEventListener('click', () => applyLLMConfig(parseInt(btn.dataset.id)));
  });
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteLLMConfig(parseInt(btn.dataset.id)));
  });
}

async function applyLLMConfig(id) {
  const res = await chrome.storage.local.get('llm_configs');
  const cfg = (res.llm_configs || []).find(c => c.id === id);
  if (!cfg) return;
  if (document.getElementById('llmProvider')) document.getElementById('llmProvider').value = cfg.provider;
  if (document.getElementById('apiKey')) document.getElementById('apiKey').value = await decryptApiKey(cfg.apiKey);
  if (document.getElementById('modelName')) document.getElementById('modelName').value = cfg.model;
  if (document.getElementById('apiEndpoint')) document.getElementById('apiEndpoint').value = cfg.endpoint;
  if (document.getElementById('systemPrompt')) document.getElementById('systemPrompt').value = cfg.prompt;
  if (document.getElementById('temperature')) document.getElementById('temperature').value = cfg.temp;
  if (document.getElementById('maxTokens')) document.getElementById('maxTokens').value = cfg.maxTokens;
  if (document.getElementById('autoProcess')) document.getElementById('autoProcess').checked = cfg.autoProcess;
  if (document.getElementById('saveHistory')) document.getElementById('saveHistory').checked = cfg.saveHistory;
}

async function deleteLLMConfig(id) {
  const res = await chrome.storage.local.get('llm_configs');
  const list = (res.llm_configs || []).filter(c => c.id !== id);
  await chrome.storage.local.set({ llm_configs: list });
  await loadLLMConfigs();
}

async function loadManusSettings() {
  const res = await chrome.storage.local.get([
    'manus_apiKey', 'manus_profile', 'manus_locale', 
    'manus_prompt', 'manus_autoSend', 'manus_interactive', 'manus_preset'
  ]);
  
  if (document.getElementById('manusApiKey') && res.manus_apiKey) 
    document.getElementById('manusApiKey').value = await decryptApiKey(res.manus_apiKey);
  if (document.getElementById('manusProfile') && res.manus_profile) 
    document.getElementById('manusProfile').value = res.manus_profile;
  if (document.getElementById('manusLocale')) 
    document.getElementById('manusLocale').value = res.manus_locale || 'auto';
  if (document.getElementById('manusPrompt') && res.manus_prompt) 
    document.getElementById('manusPrompt').value = res.manus_prompt;
  if (document.getElementById('manusAutoSend') && res.manus_autoSend !== undefined) 
    document.getElementById('manusAutoSend').checked = res.manus_autoSend;
  if (document.getElementById('manusInteractive') && res.manus_interactive !== undefined) 
    document.getElementById('manusInteractive').checked = res.manus_interactive;
  
  if (res.manus_preset) {
    document.querySelectorAll('.agent-preset-card').forEach(c => {
      c.classList.toggle('active', c.dataset.preset === res.manus_preset);
    });
  }
}


async function loadDocumentsFromStorage() {
  const res = await chrome.storage.local.get('manus_documents');
  const stored = res.manus_documents || [];
  attachedDocuments = stored.map(d => ({
    id: d.id, name: d.name, type: d.type, size: d.size,
    content: d.preview || '', timestamp: d.timestamp
  }));
  renderDocumentsList();
  updateDocumentButtons();
}

async function saveDocumentsToStorage() {
  const storageDocs = attachedDocuments.map(d => ({
    id: d.id, name: d.name, type: d.type, size: d.size,
    preview: d.content ? d.content.substring(0, 500) : '',
    timestamp: d.timestamp
  }));
  await chrome.storage.local.set({ manus_documents: storageDocs });
}

async function loadReceivedDocuments() {
  if (!db) { receivedDocuments = []; return; }
  try {
    const docs = await getAllFromIndexedDB('received');
    receivedDocuments = docs.sort((a, b) => b.timestamp - a.timestamp);
    renderReceivedDocuments();
  } catch (err) {
    console.error('Failed to load received docs:', err);
    receivedDocuments = [];
  }
}