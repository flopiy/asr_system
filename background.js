let socket = null;

chrome.runtime.onMessage.addListener((request) => {
    if (request.command === "start_capture") {
        startCapture();
    }
});

async function startCapture() {
    // 1. Створюємо з'єднання
    socket = new WebSocket("ws://localhost:8765");

    socket.onopen = () => {
        console.log("✅ Підключено до ASR сервера");
        
        chrome.tabCapture.capture({ audio: true, video: false }, (stream) => {
            if (!stream) {
                console.error("❌ Помилка захоплення:", chrome.runtime.lastError);
                return;
            }

            const audioContext = new AudioContext({ sampleRate: 16000 }); // Примусово 16кГц
            const source = audioContext.createMediaStreamSource(stream);
            
            // Прокидаємо звук на колонки, щоб користувач чув, що захоплюється
            source.connect(audioContext.destination);

            // Створюємо процесор (буфер 4096 семплів)
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            source.connect(processor);
            processor.connect(audioContext.destination);

            processor.onaudioprocess = (e) => {
                if (socket.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    // Відправляємо Float32Array як двійкові дані
                    socket.send(inputData.buffer);
                }
            };
        });
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Виводимо транскрипцію в консоль браузера
        console.log("%c🎙 Whisper: " + data.text, "color: #00ff00; font-weight: bold;");
    };

    socket.onclose = () => console.log("🔴 З'єднання розірвано");
}