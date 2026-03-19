let socket = null;
let audioContext = null;
let isRecording = false;
let fullTranscript = "";
let processedTranscript = "";
let llmConfigs = [];

// Динамічні змінні для API (зберігаються в storage)
let currentApiUrl = "";
let currentApiKey = "";

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Скрипт ініціалізовано");
    
    // 1. Спочатку завантажуємо всі збережені дані
    await loadSavedData();
    
    // 2. Ініціалізуємо елементи інтерфейсу (безпечно)
    initElements();
    
    // 3. Завантажуємо конфігурації ШІ
    loadLLMConfigs();
    
    // 4. Оновлюємо текст на екрані
    updateDisplay();
});

// ========== БЕЗПЕЧНА ІНІЦІАЛІЗАЦІЯ ==========

function initElements() {
    // Основні елементи керування
    const startBtn = document.getElementById('start');
    const display = document.getElementById('transcript-display');
    const status = document.getElementById('status');
    const downloadTxtBtn = document.getElementById('download-txt');
    const downloadDocBtn = document.getElementById('download-doc');
    const openFullBtn = document.getElementById('open-full');
    const clearBtn = document.getElementById('clear-history');
    const processBtn = document.getElementById('processText');

    // Елементи налаштувань ШІ (можуть бути відсутні на деяких сторінках)
    const apiUrlInput = document.getElementById('apiEndpoint'); // у вас в HTML id="apiEndpoint"
    const apiKeyInput = document.getElementById('apiKey');
    const aiFixBtn = document.getElementById('processText');
    const toggleLLM = document.getElementById('toggleLLM');
    const saveConfigBtn = document.getElementById('saveConfig');
    const testLLMBtn = document.getElementById('testLLM');

    // --- Прив'язка подій з перевіркою на існування (щоб код не падав) ---

    if (startBtn) {
        startBtn.addEventListener('click', toggleRecording);
    }

    if (toggleLLM) {
        const llmContent = document.getElementById('llmContent');
        const toggleIcon = toggleLLM.querySelector('.toggle-icon');
        toggleLLM.addEventListener('click', () => {
            if (llmContent) llmContent.classList.toggle('expanded');
            if (toggleIcon) toggleIcon.classList.toggle('expanded');
        });
    }

    if (openFullBtn) {
        openFullBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: "dashboard.html" });
        });
    }

    if (processBtn) {
        processBtn.addEventListener('click', processTextWithLLM);
        processBtn.disabled = !fullTranscript.trim();
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearHistory);
    }

    if (downloadTxtBtn) {
        downloadTxtBtn.addEventListener('click', saveAsTXT);
        downloadTxtBtn.disabled = !fullTranscript.trim();
    }

    if (downloadDocBtn) {
        downloadDocBtn.addEventListener('click', saveAsDOC);
        downloadDocBtn.disabled = !fullTranscript.trim();
    }

    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', saveLLMConfig);
    }

    if (testLLMBtn) {
        testLLMBtn.addEventListener('click', testLLMConnection);
    }

    // Логіка збереження API полів "на льоту"
    if (apiUrlInput) {
        apiUrlInput.addEventListener('input', () => {
            currentApiUrl = apiUrlInput.value;
            chrome.storage.local.set({ lastUrl: currentApiUrl });
        });
    }

    if (apiKeyInput) {
        apiKeyInput.addEventListener('input', () => {
            currentApiKey = apiKeyInput.value;
            chrome.storage.local.set({ lastKey: currentApiKey });
        });
    }
}

// ========== РОБОТА ЗІ STORAGE ==========

async function loadSavedData() {
    return new Promise((resolve) => {
        chrome.storage.local.get([
            'fullTranscript', 
            'processedTranscript', 
            'lastUrl', 
            'lastKey'
        ], (result) => {
            if (result.fullTranscript) fullTranscript = result.fullTranscript;
            if (result.processedTranscript) processedTranscript = result.processedTranscript;
            
            // Відновлюємо значення полів для ШІ
            const apiUrlInput = document.getElementById('apiEndpoint');
            const apiKeyInput = document.getElementById('apiKey');
            
            if (result.lastUrl && apiUrlInput) {
                apiUrlInput.value = result.lastUrl;
                currentApiUrl = result.lastUrl;
            }
            if (result.lastKey && apiKeyInput) {
                apiKeyInput.value = result.lastKey;
                currentApiKey = result.lastKey;
            }
            resolve();
        });
    });
}

function saveTranscript() {
    chrome.storage.local.set({ 
        fullTranscript: fullTranscript,
        processedTranscript: processedTranscript
    });
}

// ========== КЕРУВАННЯ ЗАПИСОМ ==========

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    const startBtn = document.getElementById('start');
    const status = document.getElementById('status');
    
    socket = new WebSocket("ws://localhost:8765");

    socket.onopen = () => {
        chrome.tabCapture.capture({ audio: true }, (stream) => {
            if (!stream) {
                console.error("Помилка захоплення:", chrome.runtime.lastError);
                return;
            }

            audioContext = new AudioContext({ sampleRate: 16000 });
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(audioContext.destination);

            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            source.connect(processor);
            processor.connect(audioContext.destination);

            processor.onaudioprocess = (e) => {
                if (socket?.readyState === WebSocket.OPEN) {
                    socket.send(e.inputBuffer.getChannelData(0).buffer);
                }
            };

            isRecording = true;
            if (startBtn) {
                startBtn.innerText = "🛑 Stop Transcription";
                startBtn.classList.add('recording');
            }
            if (status) {
                status.innerText = "Recording...";
                status.style.background = "#e74c3c";
            }
        });
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        fullTranscript += `[${new Date().toLocaleTimeString()}] ${data.text}\n`;
        
        saveTranscript();
        updateDisplay();
        
        // Активація кнопок після появи тексту
        const btns = ['download-txt', 'download-doc', 'processText'];
        btns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = false;
        });
    };

    socket.onclose = () => stopRecording();
}

function stopRecording() {
    if (socket) socket.close();
    if (audioContext) audioContext.close();
    isRecording = false;
    
    const startBtn = document.getElementById('start');
    const status = document.getElementById('status');
    
    if (startBtn) {
        startBtn.innerText = "▶ Start Transcription";
        startBtn.classList.remove('recording');
    }
    if (status) {
        status.innerText = "Ready";
        status.style.background = "#ddd";
    }
}

// ========== ВІДОБРАЖЕННЯ ТА ІНШЕ ==========

function updateDisplay() {
    const display = document.getElementById('transcript-display');
    if (!display) return;
    
    if (processedTranscript) {
        display.innerText = "📝 ОБРОБЛЕНИЙ ТЕКСТ:\n" + processedTranscript + 
                           (fullTranscript ? "\n\n📋 ОРИГІНАЛ:\n" + fullTranscript : "");
    } else {
        display.innerText = fullTranscript || "Тут з'явиться текст...";
    }
}

function clearHistory() {
    if (confirm("Очистити весь текст?")) {
        fullTranscript = "";
        processedTranscript = "";
        saveTranscript();
        updateDisplay();
        
        const btns = ['download-txt', 'download-doc', 'processText'];
        btns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.disabled = true;
        });
    }
}

// Тут мають йти ваші функції: processTextWithLLM, callLLMAPI, saveAsTXT, saveAsDOC тощо.
// Вони залишаються без змін, як у вашому попередньому коді.

// ========== LLM ФУНКЦІЇ ==========

async function processTextWithLLM() {
    if (!fullTranscript.trim()) {
        alert("Немає тексту для обробки");
        return;
    }

    const indicator = document.getElementById('processingIndicator');
    indicator.classList.add('active');

    try {
        const config = getCurrentConfig();
        const processed = await callLLMAPI(fullTranscript, config);
        
        if (processed) {
            processedTranscript = processed;
            
            // Зберігаємо оброблений текст
            saveTranscript();
            
            // Оновлюємо відображення
            updateDisplay();
        }
    } catch (error) {
        console.error("LLM Error:", error);
        alert("Помилка обробки: " + error.message);
    } finally {
        indicator.classList.remove('active');
    }
}

// ... (решта функцій LLM, getCurrentConfig, callLLMAPI, testLLMConnection без змін)

// ========== ЗБЕРЕЖЕННЯ КОНФІГУРАЦІЙ ==========

function saveLLMConfig() {
    const config = getCurrentConfig();
    const name = prompt("Введіть назву конфігурації:", `Config ${llmConfigs.length + 1}`);
    
    if (!name) return;
    
    const configWithName = { ...config, name, id: Date.now() };
    llmConfigs.push(configWithName);
    
    // Зберігаємо в chrome.storage.local
    chrome.storage.local.set({ llmConfigs: llmConfigs }, () => {
        renderConfigsList();
        
        // Зберігаємо як останній використаний
        chrome.storage.local.set({ lastConfig: configWithName });
        
        alert("✅ Конфігурацію збережено");
    });
}

function loadLLMConfigs() {
    chrome.storage.local.get(['llmConfigs'], (result) => {
        if (result.llmConfigs) {
            llmConfigs = result.llmConfigs;
            renderConfigsList();
        }
    });
}

function loadLastConfig() {
    chrome.storage.local.get(['lastConfig'], (result) => {
        if (result.lastConfig) {
            applyConfig(result.lastConfig);
        }
    });
}

function applyConfig(config) {
    document.getElementById('llmProvider').value = config.provider || 'openrouter';
    document.getElementById('apiKey').value = config.apiKey || '';
    document.getElementById('modelName').value = config.model || '';
    document.getElementById('apiEndpoint').value = config.endpoint || '';
    document.getElementById('systemPrompt').value = config.systemPrompt || '';
    document.getElementById('temperature').value = config.temperature || '0.3';
    document.getElementById('maxTokens').value = config.maxTokens || '1000';
}

function renderConfigsList() {
    const container = document.getElementById('configsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    llmConfigs.slice().reverse().forEach(config => {
        const div = document.createElement('div');
        div.className = 'config-item';
        div.innerHTML = `
            <span>${config.name}</span>
            <div>
                <button class="load-config" data-id="${config.id}">📂</button>
                <button class="delete-config" data-id="${config.id}">🗑️</button>
            </div>
        `;
        
        container.appendChild(div);
        
        div.querySelector('.load-config').addEventListener('click', () => {
            applyConfig(config);
            chrome.storage.local.set({ lastConfig: config });
        });
        
        div.querySelector('.delete-config').addEventListener('click', () => {
            if (confirm(`Видалити конфігурацію "${config.name}"?`)) {
                llmConfigs = llmConfigs.filter(c => c.id !== config.id);
                chrome.storage.local.set({ llmConfigs: llmConfigs }, renderConfigsList);
            }
        });
    });
}

// ========== ФУНКЦІЇ ЗБЕРЕЖЕННЯ ==========

function saveAsTXT() {
    const text = processedTranscript || fullTranscript;
    if (!text.trim()) return;
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function saveAsDOC() {
    const text = processedTranscript || fullTranscript;
    if (!text.trim()) return;
    
    const header = "<html><head><meta charset='utf-8'><style>body { font-family: 'Segoe UI', sans-serif; padding: 20px; } .timestamp { color: #4a90e2; }</style></head><body>";
    const footer = "</body></html>";
    
    const content = text.split('\n').map(line => {
        if (line.match(/^\[\d{2}:\d{2}:\d{2}\]/)) {
            return `<p><span class="timestamp">${line.substring(0, 11)}</span>${line.substring(11)}</p>`;
        }
        return `<p>${line}</p>`;
    }).join('');
    
    const blob = new Blob([header + content + footer], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.doc`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearHistory() {
    if (confirm("Очистити весь текст?")) {
        clearStorage();
        document.getElementById('download-txt').disabled = true;
        document.getElementById('download-doc').disabled = true;
        document.getElementById('processText').disabled = true;
    }
}

// ========== ДОДАТКОВІ ФУНКЦІЇ ДЛЯ LLM ==========

function getCurrentConfig() {
    return {
        provider: document.getElementById('llmProvider')?.value || 'openrouter',
        apiKey: document.getElementById('apiKey')?.value || '',
        model: document.getElementById('modelName')?.value || '',
        endpoint: document.getElementById('apiEndpoint')?.value || '',
        systemPrompt: document.getElementById('systemPrompt')?.value || '',
        temperature: parseFloat(document.getElementById('temperature')?.value || '0.3'),
        maxTokens: parseInt(document.getElementById('maxTokens')?.value || '1000')
    };
}

async function callLLMAPI(text, config) {
    const { provider, apiKey, model, endpoint, systemPrompt, temperature, maxTokens } = config;
    
    if (!apiKey && provider !== 'local') {
        throw new Error("API Key обов'язковий");
    }

    let url, headers, body;
    
    switch(provider) {
        case 'openrouter':
            url = 'https://openrouter.ai/api/v1/chat/completions';
            headers = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            };
            body = {
                model: model || 'openai/gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                temperature,
                max_tokens: maxTokens
            };
            break;
            
        case 'openai':
            url = 'https://api.openai.com/v1/chat/completions';
            headers = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            };
            body = {
                model: model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                temperature,
                max_tokens: maxTokens
            };
            break;
            
        case 'local':
            url = endpoint || 'http://localhost:11434/api/chat';
            headers = { 'Content-Type': 'application/json' };
            body = {
                model: model || 'llama2',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                options: {
                    temperature,
                    num_predict: maxTokens
                }
            };
            break;
            
        case 'custom':
            if (!endpoint) throw new Error("Endpoint обов'язковий для custom провайдера");
            url = endpoint;
            headers = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            };
            body = {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text }
                ],
                temperature,
                max_tokens: maxTokens
            };
            break;
            
        default:
            throw new Error("Невідомий провайдер");
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content;
    } else if (data.message?.content) {
        return data.message.content;
    } else if (data.response) {
        return data.response;
    } else {
        return JSON.stringify(data);
    }
}

async function testLLMConnection() {
    const indicator = document.getElementById('processingIndicator');
    indicator.classList.add('active');
    
    try {
        const config = getCurrentConfig();
        const testText = "Це тестове речення для перевірки роботи API. Воно містить граматичні помилки.";
        
        const result = await callLLMAPI(testText, config);
        
        if (result) {
            alert("✅ Підключення працює!\n\nРезультат:\n" + result.substring(0, 200));
        }
    } catch (error) {
        alert("❌ Помилка: " + error.message);
    } finally {
        indicator.classList.remove('active');
    }
}