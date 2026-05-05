// ==================== STORAGE LISTENER & POLLING ====================

function startStorageListener() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    let needsUpdate = false;
    if (changes.asr_fullTranscript) { fullTranscript = changes.asr_fullTranscript.newValue || ''; needsUpdate = true; }
    if (changes.asr_processedTranscript) { processedTranscript = changes.asr_processedTranscript.newValue || ''; needsUpdate = true; }
    if (changes.asr_isRecording) {
      const newState = changes.asr_isRecording.newValue;
      if (isRecording !== newState) { isRecording = newState; updateUI(); }
    }
    if (changes.asr_status) {
      const newConnected = (changes.asr_status.newValue === 'connected');
      if (isConnected !== newConnected) { isConnected = newConnected; updateConnectionStatus(isConnected ? 'connected' : 'disconnected'); updateUI(); }
    }
    if (needsUpdate) { updateDisplay(); enableActionButtons(); }
  });
}

function startStatusPolling() {
  if (statusPollingInterval) clearInterval(statusPollingInterval);
  statusPollingInterval = setInterval(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ command: 'get_status' });
      if (!response) return;
      if (response.isRecording !== undefined) isRecording = response.isRecording;
      if (response.socketConnected !== undefined) isConnected = response.socketConnected;
      if (response.serverUrl) currentServerUrl = response.serverUrl;
      if (response.fullTranscript && response.fullTranscript !== fullTranscript) {
        fullTranscript = response.fullTranscript;
        processedTranscript = response.processedTranscript || '';
        updateDisplay(); enableActionButtons();
      }
      updateUI(); updateConnectionStatus(isConnected ? 'connected' : 'disconnected'); updateServerButton();
    } catch (error) { console.error('[Popup] Status error:', error); }
  }, 2000);
}

async function refreshStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ command: 'get_status' });
    if (response) {
      isRecording = response.isRecording || false;
      isConnected = response.socketConnected || false;
      currentServerUrl = response.serverUrl || currentServerUrl;
      fullTranscript = response.fullTranscript || "";
      processedTranscript = response.processedTranscript || "";
      updateUI(); updateConnectionStatus(isConnected ? 'connected' : 'disconnected'); updateDisplay();
      if (fullTranscript.trim()) enableActionButtons();
    }
  } catch (error) { console.error('[Popup] Refresh error:', error); }
}

// ==================== SERVER CONNECTION ====================

async function connectToServer(silent = false) {
  const btn = document.getElementById('connectServerBtn');
  const originalText = btn?.textContent || 'Підключити';
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  updateConnectionStatus('connecting');
  try {
    const response = await chrome.runtime.sendMessage({ command: 'connect_server', url: currentServerUrl });
    if (response?.status === 'connected') {
      isConnected = true; updateConnectionStatus('connected'); updateUI();
      if (btn) { btn.textContent = 'Відключити'; btn.disabled = false; }
      return true;
    }
    throw new Error(response?.error || 'Невідома помилка');
  } catch (error) {
    if (!silent) alert('❌ ' + error.message);
    isConnected = false; updateConnectionStatus('disconnected'); updateUI();
    if (btn) { btn.textContent = originalText; btn.disabled = false; }
    return false;
  }
}

async function disconnectFromServer() {
  const btn = document.getElementById('connectServerBtn');
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    await chrome.runtime.sendMessage({ command: 'disconnect_server' });
    isConnected = false; updateConnectionStatus('disconnected'); updateUI();
    if (btn) { btn.textContent = 'Підключити'; btn.disabled = false; }
  } catch (error) {
    if (btn) { btn.textContent = 'Підключити'; btn.disabled = false; }
  }
}

async function toggleServerConnection() {
  if (isConnected) await disconnectFromServer(); else await connectToServer();
}

async function testServerConnection() {
  const serverUrl = document.getElementById('serverUrl')?.value || currentServerUrl;
  const btn = document.getElementById('testConnection');
  const orig = btn.innerHTML;
  btn.innerHTML = '⏳'; btn.disabled = true;
  updateConnectionStatus('connecting');
  try {
    const r = await chrome.runtime.sendMessage({ command: 'connect_server', url: serverUrl });
    if (r.status === 'connected') { alert('✅ Успішно!'); await chrome.runtime.sendMessage({ command: 'disconnect_server' }); }
    else alert('❌ ' + (r.error || 'Помилка'));
  } catch (e) { alert('❌ ' + e.message); }
  finally { btn.innerHTML = orig; btn.disabled = false; updateConnectionStatus('disconnected'); }
}

// ==================== RECORDING ====================

async function toggleRecording() {
  const startBtn = document.getElementById('start');
  if (!isRecording && !isConnected) { alert('⚠️ Спочатку підключіться до сервера!'); return; }
  if (startBtn) startBtn.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ command: 'toggle_recording' });
    if (response?.isRecording !== undefined) {
      isRecording = response.isRecording; updateUI();
      if (!isRecording) {
        const settings = await chrome.storage.local.get('manus_autoSend');
        if (settings.manus_autoSend && fullTranscript.trim()) setTimeout(() => sendToManus(), 1000);
      }
    }
    if (response?.error) alert('❌ ' + response.error);
  } catch (error) { alert('❌ ' + error.message); }
  finally { if (startBtn) startBtn.disabled = false; }
}

async function clearHistory() {
  if (confirm("Очистити весь текст?")) {
    await chrome.runtime.sendMessage({ command: 'clear_transcript' });
    fullTranscript = ""; processedTranscript = ""; updateDisplay(); enableActionButtons();
  }
}

// ==================== LLM ====================

async function processWithLLM() {
  const text = fullTranscript.trim();
  if (!text) { alert('Немає тексту для обробки.'); return; }
  const indicator = document.getElementById('processingIndicator');
  if (indicator) indicator.classList.add('active');
  try {
    const s = await chrome.storage.local.get(['llm_provider', 'llm_apiKey', 'llm_model', 'llm_endpoint', 'llm_prompt', 'llm_temp', 'llm_maxTokens']);
    const provider = s.llm_provider || 'openrouter';
    const apiKey = await decryptApiKey(s.llm_apiKey || '');
    if (!apiKey && provider !== 'local') { alert('Введіть API Key'); return; }
    let result = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      try { result = await callLLM(provider, apiKey, s.llm_model || 'gpt-4', s.llm_endpoint || '', s.llm_prompt || '', text, s.llm_temp ?? 0.3, s.llm_maxTokens || 1000); if (result) break; }
      catch (err) { if (!err.message.includes('429') && !err.message.includes('rate limit')) throw err; if (attempt < 3) await new Promise(r => setTimeout(r, 3000)); }
    }
    if (result) { processedTranscript = result; await chrome.storage.local.set({ asr_processedTranscript: result }); updateDisplay(); alert('✅ Оброблено!'); }
    else throw new Error('Не вдалося отримати відповідь');
  } catch (error) { alert('❌ ' + error.message); }
  finally { if (indicator) indicator.classList.remove('active'); }
}

async function callLLM(provider, apiKey, model, endpoint, prompt, text, temp, maxTokens) {
  const systemPrompt = prompt || 'Ти професійний редактор...';
  switch (provider) {
    case 'openrouter': return callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', apiKey, model, systemPrompt, text, temp, maxTokens);
    case 'openai': return callOpenAICompatible('https://api.openai.com/v1/chat/completions', apiKey, model, systemPrompt, text, temp, maxTokens);
    case 'anthropic': return callAnthropic(apiKey, model, systemPrompt, text, temp, maxTokens);
    case 'local': return callOllama(endpoint || 'http://localhost:11434', model || 'llama2', systemPrompt, text);
    case 'custom': if (!endpoint) throw new Error('Не вказано Endpoint'); return callOpenAICompatible(endpoint, apiKey, model, systemPrompt, text, temp, maxTokens);
    default: throw new Error('Невідомий провайдер');
  }
}

async function callOpenAICompatible(url, apiKey, model, systemPrompt, userText, temperature, maxTokens) {
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }], temperature, max_tokens: maxTokens })
  });
  if (!r.ok) { const e = await r.text(); throw new Error(`HTTP ${r.status}: ${e.slice(0,200)}`); }
  const d = await r.json();
  return d.choices?.[0]?.message?.content || '';
}

async function callAnthropic(apiKey, model, systemPrompt, userText, temperature, maxTokens) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model || 'claude-3-sonnet-20240229', max_tokens: maxTokens, temperature, system: systemPrompt, messages: [{ role: 'user', content: userText }] })
  });
  if (!r.ok) { const e = await r.text(); throw new Error(`HTTP ${r.status}: ${e.slice(0,200)}`); }
  const d = await r.json();
  return d.content?.[0]?.text || '';
}

async function callOllama(baseUrl, model, systemPrompt, userText) {
  const r = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }], stream: false })
  });
  if (!r.ok) { const e = await r.text(); throw new Error(`HTTP ${r.status}: ${e.slice(0,200)}`); }
  const d = await r.json();
  return d.message?.content || '';
}

async function saveLLMConfig() {
  const rawApiKey = document.getElementById('apiKey')?.value || '';
  const encryptedApiKey = await encryptApiKey(rawApiKey);
  const config = {
    llm_provider: document.getElementById('llmProvider')?.value || 'openrouter',
    llm_apiKey: encryptedApiKey,
    llm_model: document.getElementById('modelName')?.value || '',
    llm_endpoint: document.getElementById('apiEndpoint')?.value || '',
    llm_prompt: document.getElementById('systemPrompt')?.value || '',
    llm_temp: parseFloat(document.getElementById('temperature')?.value || '0.3'),
    llm_maxTokens: parseInt(document.getElementById('maxTokens')?.value || '1000'),
    llm_autoProcess: document.getElementById('autoProcess')?.checked ?? true,
    llm_saveHistory: document.getElementById('saveHistory')?.checked ?? false
  };
  await chrome.storage.local.set(config);
  const configs = (await chrome.storage.local.get('llm_configs')).llm_configs || [];
  configs.push({
    id: Date.now(),
    name: `${config.llm_provider} — ${config.llm_model || 'default'}`,
    ...config,
    apiKey: encryptedApiKey, // зберігаємо зашифрований ключ в конфігурації
    createdAt: new Date().toLocaleString()
  });
  await chrome.storage.local.set({ llm_configs: configs });
  await loadLLMConfigs();
  const btn = document.getElementById('saveConfig'); const orig = btn.innerHTML;
  btn.innerHTML = '✅ Збережено'; setTimeout(() => btn.innerHTML = orig, 1500);
}

async function testLLMConnection() {
  const provider = document.getElementById('llmProvider')?.value;
  const apiKey = document.getElementById('apiKey')?.value;
  const endpoint = document.getElementById('apiEndpoint')?.value;
  const btn = document.getElementById('testLLM'); const orig = btn.innerHTML;
  btn.innerHTML = '⏳'; btn.disabled = true;
  try {
    let url, headers = {};
    if (provider === 'openrouter') { url = 'https://openrouter.ai/api/v1/models'; headers = { Authorization: `Bearer ${apiKey}` }; }
    else if (provider === 'openai') { url = 'https://api.openai.com/v1/models'; headers = { Authorization: `Bearer ${apiKey}` }; }
    else if (provider === 'anthropic') { url = 'https://api.anthropic.com/v1/models'; headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }; }
    else if (provider === 'local') url = endpoint || 'http://localhost:11434/api/tags';
    else { url = endpoint || ''; if (apiKey) headers = { Authorization: `Bearer ${apiKey}` }; }
    if (!url) throw new Error('Не вказано endpoint');
    const r = await fetch(url, { headers });
    if (r.ok) alert('✅ З\'єднання успішне!'); else { const t = await r.text(); alert(`❌ HTTP ${r.status}: ${t.slice(0,200)}`); }
  } catch (e) { alert('❌ ' + e.message); }
  finally { btn.innerHTML = orig; btn.disabled = false; }
}

// ==================== INIT ====================

document.addEventListener('DOMContentLoaded', async () => {
  try { await initDatabase(); console.log('[Popup] DB initialized'); } catch (err) { console.error('[Popup] DB failed:', err); db = null; }
  
  initHistoryDelegation();
  initNavigation();
  initElements();
  initAgentPresets();
  
  await loadSettings();
  await loadLLMSettings();
  await loadLLMConfigs();
  await loadManusSettings();
  await loadDocumentsFromStorage();
  await loadTranscriptFromStorage();
  
  if (db) {
    try { await loadReceivedDocuments(); } catch (err) { console.error('Load received docs failed:', err); }
    try { await loadTaskHistory(); } catch (err) { console.error('Load task history failed:', err); }
  } else { receivedDocuments = []; manusTaskHistory = []; renderReceivedDocuments(); renderTaskHistory(); }
  
  await refreshStatus();
  startStatusPolling();
  startStorageListener();
  
  setTimeout(async () => {
    try {
      const s = await chrome.storage.local.get(['autoConnect', 'lastServerUrl']);
      if (s.autoConnect && !isConnected) await connectToServer(true);
    } catch (err) { console.error('Auto-connect error:', err); }
  }, 500);
});

console.log('[Popup] Popup завантажено');