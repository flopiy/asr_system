// popup-ui.js — UI rendering & event binding

let isRecording = false;
let isConnected = false;
let fullTranscript = "";
let processedTranscript = "";
let currentServerUrl = "wss://asr-system-jcku.onrender.com/ws";
let statusPollingInterval = null;

// ==================== UI UPDATE ====================

function updateUI() {
  const startBtn = document.getElementById('start');
  const status = document.getElementById('status');
  if (startBtn) {
    if (isRecording) {
      startBtn.classList.add('recording');
      startBtn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/></svg>`;
    } else {
      startBtn.classList.remove('recording');
      startBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
    }
    startBtn.disabled = !isConnected;
  }
  if (status) {
    if (isRecording) { status.classList.add('recording'); status.innerHTML = '<span class="status-dot"></span>Recording...'; }
    else { status.classList.remove('recording'); status.innerHTML = '<span class="status-dot"></span>Ready'; }
  }
}

function updateConnectionStatus(status) {
  const dot = document.getElementById('serverConnectionStatus');
  const text = document.getElementById('serverStatusText');
  if (!dot) return;
  dot.className = 'conn-dot ' + status;
  if (text) {
    if (status === 'connected') text.textContent = 'Сервер підключений';
    else if (status === 'connecting') text.textContent = 'Підключення...';
    else text.textContent = 'Сервер відключений';
  }
  updateServerButton();
}

function updateServerButton() {
  const btn = document.getElementById('connectServerBtn');
  const startBtn = document.getElementById('start');
  if (!btn) return;
  if (isConnected) {
    btn.textContent = 'Відключити';
    btn.classList.remove('btn-primary'); btn.classList.add('btn-danger');
    if (startBtn) startBtn.disabled = false;
  } else {
    btn.textContent = 'Підключити';
    btn.classList.remove('btn-danger'); btn.classList.add('btn-primary');
    if (startBtn) startBtn.disabled = true;
  }
}

function updateDisplay() {
  const transcriptDisplay = document.getElementById('transcript-display');
  const transcriptHome = document.getElementById('transcript-home');
  const llmOutputTranscript = document.getElementById('llm-output');
  const displayText = processedTranscript 
    ? "📝 ОБРОБЛЕНИЙ ТЕКСТ:\n" + processedTranscript + "\n\n📋 ОРИГІНАЛ:\n" + fullTranscript
    : fullTranscript;
  if (transcriptDisplay) { transcriptDisplay.value = displayText; transcriptDisplay.scrollTop = transcriptDisplay.scrollHeight; }
  if (transcriptHome) { transcriptHome.value = displayText; transcriptHome.scrollTop = transcriptHome.scrollHeight; }
  const llmText = processedTranscript || '';
  if (llmOutputTranscript) { llmOutputTranscript.value = llmText; llmOutputTranscript.scrollTop = llmOutputTranscript.scrollHeight; }
}

function enableActionButtons() {
  const hasContent = fullTranscript.trim().length > 0;
  ['download-txt', 'download-doc', 'processText', 'sendToManusBtn',
   'download-txt2', 'download-doc2', 'processText2', 'sendToManusBtn2', 'sendToManusBtn3'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !hasContent;
  });
}

// ==================== NAVIGATION ====================

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const target = document.getElementById(`view-${item.dataset.view}`);
      if (target) target.classList.add('active');
    });
  });
}

// ==================== HELPERS ====================

function bindClick(id, handler) {
  const el = document.getElementById(id);
  if (el) { el.addEventListener('click', handler); console.log('[Bind] Click bound to', id); }
  else console.warn('[Bind] Element not found:', id);
}

function bindCheckbox(id, storageKey) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => chrome.storage.local.set({ [storageKey]: el.checked }));
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==================== INIT ELEMENTS ====================

function initElements() {
  bindClick('start', toggleRecording);
  bindClick('connectServerBtn', toggleServerConnection);
  bindClick('testConnection', testServerConnection);
  bindClick('sendToManusBtn', sendToManus);
  bindClick('sendToManusBtn2', sendToManus);
  bindClick('sendToManusBtn3', sendToManus);
  
  const serverUrl = document.getElementById('serverUrl');
  if (serverUrl) {
    serverUrl.addEventListener('input', () => {
      currentServerUrl = serverUrl.value;
      chrome.storage.local.set({ lastServerUrl: currentServerUrl });
    });
  }
  
  document.querySelectorAll('#view-server .preset').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('#view-server .preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (serverUrl) { serverUrl.value = btn.dataset.url; currentServerUrl = btn.dataset.url; chrome.storage.local.set({ lastServerUrl: currentServerUrl }); }
    });
  });

  bindCheckbox('autoConnect', 'autoConnect');
  bindCheckbox('reconnectOnClose', 'reconnectOnClose');
  bindCheckbox('manusAutoSend', 'manus_autoSend');
  bindCheckbox('manusInteractive', 'manus_interactive');
  bindCheckbox('autoProcess', 'llm_autoProcess');
  bindCheckbox('saveHistory', 'llm_saveHistory');
  
  bindClick('clear-history', clearHistory);
  bindClick('clear-history2', clearHistory);
  bindClick('download-txt', saveAsTXT);
  bindClick('download-txt2', saveAsTXT);
  bindClick('download-doc', saveAsDOC);
  bindClick('download-doc2', saveAsDOC);
  bindClick('processText', processWithLLM);
  bindClick('processText2', processWithLLM);
  bindClick('saveConfig', saveLLMConfig);
  bindClick('testLLM', testLLMConnection);
  bindClick('testManus', testManusConnection);
  bindClick('saveManusConfig', saveManusConfig);
  bindClick('continueDialogBtn', continueManusDialog);
  bindClick('cancelDialogBtn', hideContinueDialog);
  bindClick('addManusApiKey', addManusApiKey);
  bindClick('removeManusApiKey', () => {
    const select = document.getElementById('manusApiKeySelect');
    const selectedId = select?.value ? parseInt(select.value) : null;
    if (selectedId) removeManusApiKey(selectedId); else alert('Спочатку виберіть ключ');
  });
  
  const apiKeySelect = document.getElementById('manusApiKeySelect');
  if (apiKeySelect) {
    apiKeySelect.addEventListener('change', () => {
      const selectedId = apiKeySelect.value ? parseInt(apiKeySelect.value) : null;
      const keyInput = document.getElementById('manusApiKey');
      if (selectedId) {
        const key = manusApiKeys.find(k => k.id === selectedId);
        if (key && keyInput) { keyInput.value = key.key; manusApiKey = key.key; }
      } else {
        if (keyInput) keyInput.value = '';
        manusApiKey = '';
      }
      renderManusApiKeys();
    });
  }
  
  initDocumentUpload();
  bindClick('clearDocs', clearAllDocuments);
  bindClick('exportDocs', exportDocumentsJSON);
  bindClick('closePreview', closeDocPreview);
}

function initAgentPresets() {
  document.querySelectorAll('.agent-preset-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.agent-preset-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      applyManusPresetPrompt(card.dataset.preset);
    });
  });
}

function applyManusPresetPrompt(preset) {
  const promptEl = document.getElementById('manusPrompt');
  if (!promptEl) return;
  const prompts = {
    meeting: 'Проаналізуй надану транскрипцію розмови. Виділи ключові моменти: прийняті рішення, поставлені задачі, відповідальні особи, дедлайни та питання без відповіді. Відповідай українською мовою.',
    research: 'Проаналізуй текст як дослідницький агент. Виділи ключові факти, гіпотези, джерела, протиріччя та пропозиції для подальшого вивчення. Структуруй відповідь маркованими списками.',
    coding: 'Проаналізуй текст як senior розробник. Якщо це обговорення коду — поясни логіку, знайди потенційні баги, запропонуй оптимізації. Відповідай технічною мовою з прикладами.',
    custom: promptEl.value
  };
  if (preset !== 'custom' && prompts[preset]) promptEl.value = prompts[preset];
}

function addAgentLog(type, text) {
  const log = document.getElementById('agentLog');
  if (!log) return;
  if (log.children.length === 1 && log.children[0].textContent.includes('порожній')) log.innerHTML = '';
  const entry = document.createElement('div');
  entry.className = 'agent-log-entry';
  const time = new Date().toLocaleTimeString();
  let prefix = type === 'agent' ? '🤖 ' : type === 'user' ? '👤 ' : type === 'error' ? '⚠️ ' : 'ℹ️ ';
  entry.innerHTML = `<span class="ts">[${time}]</span>${prefix}${text}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

// ==================== FILE SAVE ====================

function saveAsTXT() {
  const text = processedTranscript || fullTranscript;
  if (!text.trim()) return;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `transcript_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.txt`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function saveAsDOC() {
  const text = processedTranscript || fullTranscript;
  if (!text.trim()) return;
  const header = "<html><head><meta charset='utf-8'><style>body{font-family:'Segoe UI',sans-serif;padding:24px;background:#fff;color:#111} .ts{color:#4f46e5;font-weight:700}</style></head><body>";
  const footer = "</body></html>";
  const content = text.split('\n').map(line => {
    if (line.match(/^\[\d{2}:\d{2}:\d{2}\]/)) return `<p><span class="ts">${line.substring(0, 11)}</span>${line.substring(11)}</p>`;
    return `<p>${line}</p>`;
  }).join('');
  const blob = new Blob([header + content + footer], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `transcript_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.doc`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// ==================== DOCUMENT UI ====================

function getFileIconClass(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { txt: 'txt', md: 'md', doc: 'doc', docx: 'doc', pdf: 'pdf', json: 'json', csv: 'csv', py: 'code', js: 'code', html: 'code', css: 'code', xml: 'code', yaml: 'code', yml: 'code' };
  return map[ext] || 'txt';
}

function getFileIconSymbol(type) {
  const map = { txt: '📄', md: '📝', doc: '📘', pdf: '📕', json: '📋', csv: '📊', code: '💻' };
  return map[type] || '📄';
}

function initDocumentUpload() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('docImport');
  if (!dropZone || !fileInput) return;
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); fileInput.value = ''; });
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

async function handleFiles(fileList) {
  const files = Array.from(fileList);
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) { addAgentLog('error', `Файл "${file.name}" перевищує 5MB ліміт`); continue; }
    try {
      const content = await readFileAsText(file);
      attachedDocuments.push({
        id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: file.name, type: getFileIconClass(file.name), size: file.size,
        content: content, timestamp: Date.now()
      });
      addAgentLog('system', `Імпортовано: ${file.name} (${formatFileSize(file.size)})`);
    } catch (err) { addAgentLog('error', `Помилка читання ${file.name}: ${err.message}`); }
  }
  await saveDocumentsToStorage();
  renderDocumentsList();
  enableActionButtons();
}

function renderDocumentsList() {
  const container = document.getElementById('attachedDocs');
  const list = document.getElementById('docsList');
  if (!container || !list) return;
  if (attachedDocuments.length === 0) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  list.innerHTML = '';
  attachedDocuments.forEach(doc => {
    const item = document.createElement('div');
    item.className = 'doc-item';
    item.innerHTML = `<div class="doc-item-info">
        <div class="doc-icon ${doc.type}">${getFileIconSymbol(doc.type)}</div>
        <div class="doc-meta"><div class="doc-name" title="${doc.name}">${doc.name}</div>
        <div class="doc-size">${formatFileSize(doc.size)} • ${new Date(doc.timestamp).toLocaleTimeString()}</div></div>
      </div>
      <div class="doc-actions">
        <button class="doc-btn" data-id="${doc.id}" data-action="view">👁</button>
        <button class="doc-btn delete" data-id="${doc.id}" data-action="delete">🗑</button></div>`;
    list.appendChild(item);
  });
  list.querySelectorAll('.doc-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btn.dataset.action === 'view') previewDocument(btn.dataset.id);
      if (btn.dataset.action === 'delete') deleteDocument(btn.dataset.id);
    });
  });
}

function previewDocument(id) {
  const doc = attachedDocuments.find(d => d.id === id);
  if (!doc) return;
  document.getElementById('previewName').textContent = doc.name;
  const contentEl = document.getElementById('previewContent');
  if (contentEl) contentEl.value = doc.content?.length > 10000 ? doc.content.substring(0, 10000) + '\n\n... [Обрізано]' : (doc.content || '');
  document.getElementById('docPreview').style.display = 'block';
}

function closeDocPreview() { document.getElementById('docPreview').style.display = 'none'; }

function deleteDocument(id) {
  attachedDocuments = attachedDocuments.filter(d => d.id !== id);
  saveDocumentsToStorage(); renderDocumentsList(); updateDocumentButtons();
}

function clearAllDocuments() {
  if (!attachedDocuments.length) return;
  if (!confirm(`Видалити всі ${attachedDocuments.length} документів?`)) return;
  attachedDocuments = []; saveDocumentsToStorage(); renderDocumentsList(); closeDocPreview(); updateDocumentButtons();
}

function exportDocumentsJSON() {
  if (!attachedDocuments.length) { alert('Немає документів'); return; }
  const data = { exportedAt: new Date().toISOString(), count: attachedDocuments.length, documents: attachedDocuments.map(d => ({ name: d.name, type: d.type, size: d.size, content: d.content, timestamp: d.timestamp })) };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `manus_documents_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function updateDocumentButtons() {
  const hasDocs = attachedDocuments.length > 0;
  if (document.getElementById('exportDocs')) document.getElementById('exportDocs').disabled = !hasDocs;
  if (document.getElementById('clearDocs')) document.getElementById('clearDocs').disabled = !hasDocs;
}

function detectDocType(filename, mimeType) {
  const name = (filename || '').toLowerCase();
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (mime.includes('csv') || name.endsWith('.csv') || mime.includes('excel') || name.endsWith('.xlsx')) return 'spreadsheet';
  if (mime.includes('image') || /\.(png|jpg|jpeg|gif|svg|webp)$/.test(name)) return 'image';
  if (/\.(py|js|html|css|json|xml|yaml|yml|ts|jsx|tsx|java|cpp|c|go|rs)$/.test(name)) return 'code';
  if (/\.(md|txt|doc|docx|rtf)$/.test(name)) return 'report';
  return 'other';
}

function getReceivedDocIcon(type) {
  const icons = { pdf: '📕', spreadsheet: '📊', image: '🖼️', code: '💻', report: '📄', other: '📎' };
  return icons[type] || '📎';
}

function getReceivedDocBadge(type) {
  const badges = { pdf: 'PDF', spreadsheet: 'Таблиця', image: 'Зображення', code: 'Код', report: 'Звіт', other: 'Файл' };
  return badges[type] || 'Файл';
}

function renderReceivedDocuments() {
  const card = document.getElementById('receivedDocsCard');
  const list = document.getElementById('receivedDocsList');
  if (!card || !list) return;
  list.innerHTML = '';
  if (!receivedDocuments.length) { card.style.display = 'none'; return; }
  card.style.display = 'block';
  receivedDocuments.forEach((doc, index) => {
    const item = document.createElement('div');
    item.className = 'received-doc-item';
    item.innerHTML = `<div class="received-doc-info">
        <div class="received-doc-icon">${getReceivedDocIcon(doc.type)}</div>
        <div class="received-doc-meta"><div class="received-doc-name">${doc.name} <span class="doc-badge ${doc.type}">${getReceivedDocBadge(doc.type)}</span></div>
        <div class="received-doc-desc">${doc.description || 'Документ від Manus'} • ${formatFileSize(doc.size || 0)}</div></div>
      </div>
      <div class="received-doc-actions">
        ${doc.content ? `<button class="btn-preview-doc" data-idx="${index}">👁</button>` : ''}
        <button class="btn-download" data-idx="${index}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Завантажити</button></div>`;
    list.appendChild(item);
  });
  list.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', () => downloadReceivedDocument(parseInt(btn.dataset.idx)));
  });
  list.querySelectorAll('.btn-preview-doc').forEach(btn => {
    btn.addEventListener('click', () => previewReceivedDocument(parseInt(btn.dataset.idx)));
  });
}

function downloadReceivedDocument(index) {
  const doc = receivedDocuments[index];
  if (!doc) return;
  let blob, mimeType = doc.mimeType || 'application/octet-stream';
  if (doc.content && typeof doc.content === 'string') {
    const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(doc.content.replace(/\s/g, ''));
    if (isBase64 && doc.content.length > 100) {
      const byteChars = atob(doc.content);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      blob = new Blob([new Uint8Array(byteNums)], { type: mimeType });
    } else { blob = new Blob([doc.content], { type: mimeType }); }
  } else if (doc.url) { window.open(doc.url, '_blank'); return; }
  else { blob = new Blob([''], { type: mimeType }); }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = doc.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function previewReceivedDocument(index) {
  const doc = receivedDocuments[index];
  if (!doc?.content) return;
  document.getElementById('previewName').textContent = doc.name;
  const contentEl = document.getElementById('previewContent');
  if (contentEl) contentEl.value = doc.content.length > 15000 ? doc.content.substring(0, 15000) + '\n\n... [Обрізано]' : doc.content;
  document.getElementById('docPreview').style.display = 'block';
}