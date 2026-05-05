// popup-manus.js — Manus Agent + API Keys + Task History

let manusTaskId = null;
let manusPollingInterval = null;
let manusApiKey = "";
let manusIsRunning = false;
let manusLastCursor = null;
let manusApiKeys = [];
let attachedDocuments = [];
let receivedDocuments = [];
let manusTaskHistory = [];

// ==================== MANUS API KEYS ====================

async function loadManusApiKeys() {
  const res = await chrome.storage.local.get('manus_api_keys');
  const stored = res.manus_api_keys || [];
  manusApiKeys = await Promise.all(
    stored.map(async k => ({ ...k, key: await decryptApiKey(k.key) }))
  );
  renderManusApiKeys();
}

async function saveManusApiKeys() {
  const encrypted = await Promise.all(
    manusApiKeys.map(async k => ({ ...k, key: await encryptApiKey(k.key) }))
  );
  await chrome.storage.local.set({ manus_api_keys: encrypted });
  renderManusApiKeys();
}

function addManusApiKey() {
  const keyInput = document.getElementById('manusApiKey');
  const key = keyInput?.value?.trim();
  if (!key) { alert('Введіть API ключ'); return; }
  if (manusApiKeys.find(k => k.key === key)) { alert('Цей ключ вже збережено'); return; }
  const keyPreview = key.substring(0, 8) + '...' + key.substring(key.length - 4);
  manusApiKeys.push({ id: Date.now(), name: `Ключ ${manusApiKeys.length + 1} (${keyPreview})`, key, preview: keyPreview, createdAt: new Date().toISOString() });
  saveManusApiKeys();
  keyInput.value = '';
  selectManusApiKey(manusApiKeys[manusApiKeys.length - 1].id);
}

function removeManusApiKey(id) {
  if (!confirm('Видалити цей API ключ?')) return;
  manusApiKeys = manusApiKeys.filter(k => k.id !== id);
  const select = document.getElementById('manusApiKeySelect');
  if (select?.value === id.toString()) { select.value = ''; document.getElementById('manusApiKey').value = ''; manusApiKey = ''; }
  saveManusApiKeys();
}

function selectManusApiKey(id) {
  const key = manusApiKeys.find(k => k.id === id);
  if (!key) return;
  document.getElementById('manusApiKeySelect').value = id;
  document.getElementById('manusApiKey').value = key.key;
  manusApiKey = key.key;
  renderManusApiKeys();
}

function renderManusApiKeys() {
  const container = document.getElementById('manusApiKeysList');
  const select = document.getElementById('manusApiKeySelect');
  if (!container || !select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">Виберіть ключ...</option>';
  manusApiKeys.forEach(key => { const o = document.createElement('option'); o.value = key.id; o.textContent = key.name; select.appendChild(o); });
  if (currentValue && manusApiKeys.find(k => k.id.toString() === currentValue)) select.value = currentValue;
  if (!manusApiKeys.length) { container.innerHTML = ''; return; }
  const selectedId = select.value ? parseInt(select.value) : null;
  container.innerHTML = `<div class="keys-label">Збережені ключі (${manusApiKeys.length})</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${manusApiKeys.map(key => `<div class="api-key-tag ${key.id===selectedId?'selected':''}" data-id="${key.id}" title="${key.name}"><span class="key-name">${key.name}</span><button class="key-remove" data-id="${key.id}">×</button></div>`).join('')}</div>`;
  container.querySelectorAll('.api-key-tag').forEach(tag => {
    tag.addEventListener('click', (e) => {
      if (e.target.classList.contains('key-remove')) removeManusApiKey(parseInt(e.target.dataset.id));
      else selectManusApiKey(parseInt(tag.dataset.id));
    });
  });
}

// ==================== MANUS SEND & POLL ====================

async function sendToManus() {
  const text = fullTranscript.trim();
  if (!text) { alert('Немає тексту для аналізу.'); return; }
  const apiKey = document.getElementById('manusApiKey')?.value;
  if (!apiKey) { alert('Введіть Manus API Key'); return; }
  
  const profile = document.getElementById('manusProfile')?.value || 'manus-1.6';
  const locale = document.getElementById('manusLocale')?.value || '';
  const prompt = document.getElementById('manusPrompt')?.value || '';
  const interactive = document.getElementById('manusInteractive')?.checked ?? false;
  const validLocales = ['en-US', 'zh-CN', 'ja-JP', 'ko-KR', ''];
  const safeLocale = validLocales.includes(locale) ? locale : '';

  stopManusPolling();
  updateManusStatus('connecting', 'Створення задачі...');
  addAgentLog('system', 'Відправка транскрипту в Manus...');
  
  try {
    const body = { message: { content: `${prompt}\n\n---\n\n${text}` }, agent_profile: profile, interactive_mode: interactive, title: `ASR Analysis ${new Date().toLocaleString()}` };
    if (safeLocale) body.locale = safeLocale;
    
    const response = await fetch('https://api.manus.ai/v2/task.create', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-manus-api-key': apiKey }, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
    
    manusTaskId = data.task_id;
    const taskRecord = { id: manusTaskId, title: data.task_title || `Аналіз ${new Date().toLocaleTimeString()}`, status: 'created', createdAt: Date.now(), documents: [], response: '', apiKey };
    manusTaskHistory.unshift(taskRecord);
    saveTaskHistory();
    updateManusStatus('waiting', `Задача: ${manusTaskId.slice(0,12)}...`);
    addAgentLog('system', `Задача створена: ${taskRecord.title}`);
    renderTaskHistory();
    startManusPolling(apiKey);
  } catch (error) {
    updateManusStatus('error', 'Помилка'); addAgentLog('error', error.message); alert('❌ ' + error.message);
  }
}

function startManusPolling(apiKey) {
  if (!manusTaskId) return;
  if (manusPollingInterval) clearInterval(manusPollingInterval);
  manusIsRunning = true; manusLastCursor = null;
  addAgentLog('system', 'Відстеження задачі...');
  setTimeout(() => { if (manusIsRunning) pollManusMessages(apiKey); }, 3000);
  manusPollingInterval = setInterval(() => {
    if (!manusIsRunning || !manusTaskId) stopManusPolling();
    else pollManusMessages(apiKey);
  }, 5000);
}

function stopManusPolling() { if (manusPollingInterval) clearInterval(manusPollingInterval); manusPollingInterval = null; manusIsRunning = false; }

async function pollManusMessages(apiKey) {
  if (!manusTaskId) return;
  try {
    let url = `https://api.manus.ai/v2/task.listMessages?task_id=${manusTaskId}&order=asc&limit=50`;
    if (manusLastCursor) url += `&cursor=${manusLastCursor}`;
    const response = await fetch(url, { headers: { 'x-manus-api-key': apiKey } });
    if (!response.ok) { if (response.status === 404) return; throw new Error(`HTTP ${response.status}`); }
    const data = await response.json();
    if (!data.ok) throw new Error(data.error?.message || 'Помилка API');
    
    const messages = data.messages || [];
    let assistantContent = [], currentStatus = '', newDocuments = [];
    
    for (const msg of messages) {
      if (msg.type === 'assistant_message' && msg.assistant_message?.content) assistantContent.push(msg.assistant_message.content);
      const files = msg.assistant_message?.files || msg.assistant_message?.attachments || msg.tool_output?.files || msg.files || [];
      for (const file of files) {
        newDocuments.push({
          id: file.id || `manus_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
          name: file.name || file.filename || 'document',
          type: detectDocType(file.name || file.filename, file.mime_type || file.type),
          mimeType: file.mime_type || file.type || 'application/octet-stream',
          size: file.size || 0, url: file.url || file.download_url || null,
          content: file.content || file.data || null,
          description: file.description || 'Документ від Manus', timestamp: Date.now()
        });
      }
      if (msg.type === 'status_update') { currentStatus = msg.status_update?.agent_status || ''; if (msg.status_update?.brief) addAgentLog('system', `Статус: ${msg.status_update.brief}`); }
      if (msg.type === 'error_message') addAgentLog('error', msg.error_message?.content || 'Помилка');
    }
    
    if (assistantContent.length) {
      const fullResponse = assistantContent.join('\n\n---\n\n');
      const box = document.getElementById('agent-response');
      if (box) { box.value = fullResponse; box.scrollTop = box.scrollHeight; }
      updateTaskInHistory(manusTaskId, { response: fullResponse });
      if (manusIsRunning && !['stopped','error','completed'].includes(currentStatus)) showContinueDialog();
    }
    if (newDocuments.length) {
      receivedDocuments.push(...newDocuments);
      renderReceivedDocuments();
      const task = manusTaskHistory.find(t => t.id === manusTaskId);
      if (task) { task.documents.push(...newDocuments); saveTaskHistory(); }
      addAgentLog('system', `Отримано ${newDocuments.length} документів`);
    }
    
    updateManusTaskStatus(currentStatus);
    if (currentStatus) updateTaskInHistory(manusTaskId, { status: currentStatus });
    if (['stopped','error','completed'].includes(currentStatus)) {
      manusIsRunning = false;
      updateManusStatus(currentStatus === 'error' ? 'error' : 'connected', currentStatus === 'error' ? 'Помилка' : 'Аналіз завершено');
      addAgentLog('system', currentStatus === 'error' ? '❌ Помилка' : '✅ Задача завершена');
      stopManusPolling();
    }
    if (data.next_cursor) manusLastCursor = data.next_cursor;
  } catch (error) { addAgentLog('error', 'Poll: ' + error.message); }
}

function updateManusStatus(status, text) {
  const dot = document.getElementById('manusConnectionStatus');
  if (dot) dot.className = 'conn-dot ' + status;
  const label = document.getElementById('manusStatusText');
  if (label) label.textContent = text;
}

function updateManusTaskStatus(status) {
  const badge = document.getElementById('manusTaskStatus');
  if (!badge) return;
  if (!status) { badge.style.display = 'none'; return; }
  badge.style.display = 'inline-flex'; badge.className = 'task-status ' + status;
  const labels = { running: '⏳ Виконується', waiting: '⏸️ Очікує', stopped: '✅ Завершено', error: '❌ Помилка' };
  badge.textContent = labels[status] || status;
}

async function testManusConnection() {
  const apiKey = document.getElementById('manusApiKey')?.value;
  if (!apiKey) { alert('Введіть API Key'); return; }
  updateManusStatus('connecting', 'Тестування...');
  try {
    const r = await fetch('https://api.manus.ai/v2/task.list?limit=1', { headers: { 'x-manus-api-key': apiKey } });
    const d = await r.json();
    if (d.ok) { alert('✅ Успішно!'); updateManusStatus('connected', 'API доступний'); }
    else throw new Error(d.error?.message);
  } catch (e) { alert('❌ ' + e.message); updateManusStatus('error', 'Помилка'); }
}

async function saveManusConfig() {
  const rawApiKey = document.getElementById('manusApiKey')?.value || '';
  const config = {
    manus_apiKey: await encryptApiKey(rawApiKey),
    manus_profile: document.getElementById('manusProfile')?.value || 'manus-1.6',
    manus_locale: document.getElementById('manusLocale')?.value || '',
    manus_prompt: document.getElementById('manusPrompt')?.value || '',
    manus_autoSend: document.getElementById('manusAutoSend')?.checked ?? false,
    manus_interactive: document.getElementById('manusInteractive')?.checked ?? true,
    manus_preset: document.querySelector('.agent-preset-card.active')?.dataset.preset || 'meeting'
  };
  await chrome.storage.local.set(config);
  manusApiKey = rawApiKey; // в пам'яті зберігаємо plaintext
  if (rawApiKey && !manusApiKeys.find(k => k.key === rawApiKey)) {
    const prev = rawApiKey.substring(0,8) + '...' + rawApiKey.slice(-4);
    manusApiKeys.push({ id: Date.now(), name: `Ключ (${prev})`, key: rawApiKey, preview: prev, createdAt: new Date().toISOString() });
    await saveManusApiKeys();
  }
  const btn = document.getElementById('saveManusConfig'); const orig = btn.innerHTML;
  btn.innerHTML = '✅ Збережено'; setTimeout(() => btn.innerHTML = orig, 1500);
}


// ==================== CONTINUE DIALOG ====================

function showContinueDialog() {
  document.getElementById('continueDialogBlock').style.display = 'block';
  document.getElementById('agentReplyInput')?.focus();
}

function hideContinueDialog() {
  document.getElementById('continueDialogBlock').style.display = 'none';
  const input = document.getElementById('agentReplyInput');
  if (input) input.value = '';
  const status = document.getElementById('dialogSendStatus');
  if (status) { status.style.display = 'none'; status.className = 'dialog-status'; status.textContent = ''; }
}

async function continueManusDialog() {
  const input = document.getElementById('agentReplyInput');
  if (!input?.value.trim()) return;
  if (!manusTaskId) return;
  const apiKey = document.getElementById('manusApiKey')?.value;
  if (!apiKey) return;
  
  const status = document.getElementById('dialogSendStatus');
  status.style.display = 'block'; status.className = 'dialog-status'; status.textContent = 'Відправка...';
  
  try {
    const r = await fetch('https://api.manus.ai/v2/task.sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-manus-api-key': apiKey },
      body: JSON.stringify({ task_id: manusTaskId, message: { content: input.value.trim() } })
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error?.message);
    addAgentLog('user', input.value.trim());
    status.className = 'dialog-status success'; status.textContent = '✅ Відправлено';
    input.value = '';
    if (!manusIsRunning) { manusIsRunning = true; startManusPolling(apiKey); }
    setTimeout(hideContinueDialog, 2000);
  } catch (e) { status.className = 'dialog-status error'; status.textContent = '❌ ' + e.message; }
}

// ==================== TASK HISTORY ====================

function updateTaskInHistory(taskId, updates) {
  const task = manusTaskHistory.find(t => t.id === taskId);
  if (task) { Object.assign(task, updates); saveTaskHistory(); renderTaskHistory(); }
}

async function saveTaskHistory() {
  const meta = manusTaskHistory.map(t => ({ id: t.id, title: t.title, status: t.status, createdAt: t.createdAt, docCount: t.documents?.length || 0, hasResponse: !!t.response }));
  await chrome.storage.local.set({ manus_task_history: meta });
  if (!db) return;
  for (const task of manusTaskHistory) {
    if (task.documents?.length) {
      try { await saveToIndexedDB('received', { id: task.id, taskId: task.id, documents: task.documents, response: task.response || '', timestamp: task.createdAt }); }
      catch (err) { console.error('Save task docs failed:', err); }
    }
  }
}

async function loadTaskHistory() {
  const res = await chrome.storage.local.get('manus_task_history');
  const meta = res.manus_task_history || [];
  if (!meta.length) { manusTaskHistory = []; renderTaskHistory(); return; }
  if (!db) { manusTaskHistory = meta.map(m => ({ ...m, documents: [], response: '', apiKey: '' })); renderTaskHistory(); return; }
  manusTaskHistory = await Promise.all(meta.map(async m => {
    let docs = [], response = '';
    try { const dbData = await getFromIndexedDB('received', m.id); if (dbData) { docs = dbData.documents || []; response = dbData.response || ''; } }
    catch (e) {}
    return { ...m, documents: docs, response, apiKey: '' };
  }));
  renderTaskHistory();
}

function renderTaskHistory() {
  const container = document.getElementById('taskHistoryList');
  if (!container) return;
  if (!manusTaskHistory.length) { container.innerHTML = '<p style="text-align:center;opacity:0.5;padding:10px;">Історія порожня</p>'; return; }
  const colors = { created: '🟡', running: '🟢', waiting: '⏸️', stopped: '✅', completed: '✅', error: '❌' };
  container.innerHTML = manusTaskHistory.map(task => `
    <div class="task-history-item" id="task-row-${task.id}">
      <div class="task-history-info">
        <div class="task-history-title">${colors[task.status]||'⚪'} ${task.title}</div>
        <div class="task-history-meta">${new Date(task.createdAt).toLocaleString()} • ${task.documents?.length||0} документів • ${task.status}</div>
      </div>
      <div class="task-history-actions">
        ${(task.status==='running'||task.status==='waiting')?`<button class="btn-sm btn-primary" data-task="${task.id}" data-action="connect">🔌</button>`:''}
        ${task.documents?.length?`<button class="btn-sm btn-secondary" data-task="${task.id}" data-action="docs">📥</button>`:''}
        ${task.response?`<button class="btn-sm btn-secondary" data-task="${task.id}" data-action="view">👁</button>`:''}
        <button class="btn-sm btn-danger" data-task="${task.id}" data-action="delete">🗑</button>
      </div>
    </div>`).join('');
}

function initHistoryDelegation() {
  const container = document.getElementById('taskHistoryList');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-task]');
    if (!btn) return;
    handleHistoryAction(btn.dataset.task, btn.dataset.action, btn);
  });
}

async function handleHistoryAction(taskId, action, buttonEl) {
  const task = manusTaskHistory.find(t => t.id.toString() === taskId.toString());
  if (!task) return;
  switch (action) {
    case 'connect':
      const apiKey = document.getElementById('manusApiKey')?.value;
      if (!apiKey) { alert('Введіть API Key'); return; }
      manusTaskId = taskId; manusIsRunning = true;
      addAgentLog('system', `Підключення до ${taskId.slice(0,12)}...`);
      startManusPolling(apiKey);
      break;
    case 'docs':
      receivedDocuments = [...task.documents];
      renderReceivedDocuments();
      addAgentLog('system', `Завантажено ${task.documents.length} документів`);
      break;
    case 'view':
      const box = document.getElementById('agent-response');
      if (box && task.response) { box.value = task.response; box.scrollTop = box.scrollHeight; }
      break;
    case 'delete':
      if (!confirm('Видалити задачу?')) return;
      manusTaskHistory = manusTaskHistory.filter(t => t.id.toString() !== taskId.toString());
      const meta = manusTaskHistory.map(t => ({ id: t.id, title: t.title, status: t.status, createdAt: t.createdAt, docCount: t.documents?.length||0, hasResponse: !!t.response }));
      await chrome.storage.local.set({ manus_task_history: meta });
      await deleteFromIndexedDB('received', taskId).catch(() => {});
      renderTaskHistory();
      break;
  }
}