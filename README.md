# Prosodiscribe — Real-time Speech Recognition System

Chrome-розширення для розпізнавання мови в реальному часі з локальним сервером на базі Whisper та інтеграцією з LLM.

![Python](https://img.shields.io/badge/python-3.8+-blue)
![Chrome](https://img.shields.io/badge/chrome-extension-yellow)

---

## Зміст

- [Опис](#опис)
- [Особливості](#особливості)
- [Архітектура](#архітектура)
- [Локальний запуск](#локальний-запуск)
- [Налаштування](#налаштування)
- [Використання](#використання)
- [API](#api)
- [Структура проєкту](#структура-проєкту)
- [Розробка](#розробка)

---

## Опис

**Prosodiscribe** — це система для транскрипції аудіо з браузера в реальному часі. Розширення захоплює аудіо з вкладок Chrome, відправляє його через WebSocket на локальний сервер, де відбувається розпізнавання мови за допомогою Whisper (faster-whisper) та ідентифікація спікерів через SpeechBrain. Підтримує інтеграцію з LLM-провайдерами та Manus AI Agent для аналізу транскрипцій.

### Ключові можливості

- **Захоплення аудіо** з будь-якої вкладки браузера
- **Розпізнавання в реальному часі** через Whisper
- **Ідентифікація спікерів** (до 8 унікальних голосів)
- **AI-аналіз** через LLM (OpenAI, Anthropic, OpenRouter, Ollama)
- **Експорт результатів** у TXT, HTML/DOC
- **WebSocket-з'єднання** для стрімінгу аудіо

---

## Архітектура

```
┌──────────────────┐      WebSocket        ┌──────────────────┐
│  Chrome Extension│ ◄──────────────────►  │   ASR Server     │
│                  │    (PCM 16kHz mono)   │   (FastAPI)      │
│  ┌────────────┐  │                       │  ┌────────────┐  │
│  │ Popup UI   │  │                       │  │ API Gateway│  │
│  ├────────────┤  │                       │  ├────────────┤  │
│  │ Background │  │                       │  │ Workers    │  │
│  │  Worker    │  │                       │  │ (Whisper + │  │
│  ├────────────┤  │                       │  │ SpeakerID) │  │
│  │ Offscreen  │  │                       │  ├────────────┤  │
│  │ Document   │  │                       │  │ Router     │  │
│  └────────────┘  │                       │  ├────────────┤  │
└──────────────────┘                       │  │ AutoScaler │  │
                                           │  └────────────┘  │
                                           └──────────────────┘
                                                     │
                                            ┌────────▼────────┐
                                            │  LLM Providers  │
                                            │ • OpenAI        │
                                            │ • Anthropic     │
                                            │ • OpenRouter    │
                                            │ • Ollama        │
                                            └─────────────────┘
```

---

## Локальний запуск

### Передумови

- **Python** 3.8+
- **Redis** Server 3.x+
- **Google Chrome** 88+
- **CUDA**-сумісна GPU (опціонально, для прискорення)
- Мінімум **4GB RAM** (8GB+ для моделі `large`)

### Крок 1: Клонування репозиторію

```bash
git clone https://github.com/flopiy/asr_system.git
cd asr_system
```

### Крок 2: Встановлення залежностей сервера

```bash
cd server
pip install -r requirements.txt
cd ..
```

### Крок 3: Запуск Redis (локально)

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

**Windows (через Docker):**
```bash
docker run -d -p 6379:6379 redis:latest
```

**Перевірка:**
```bash
redis-cli ping  # має повернути PONG
```

### Крок 4: Запуск ASR сервера (локально)

```bash
cd server
python server.py
```
Сервер стартує на `http://localhost:8000`, WebSocket на `ws://localhost:8000/ws`

**З кастомними параметрами:**
```bash
WHISPER_MODEL_SIZE=medium NUM_WORKERS=2 python server.py
```

**З GPU-прискоренням:**
```bash
WHISPER_MODEL_SIZE=large-v3 DEVICE=cuda python server.py
```

**Повний приклад з усіма параметрами:**
```bash
cd server
API_PORT=8000 REDIS_HOST=localhost REDIS_PORT=6379 WHISPER_MODEL_SIZE=large DEVICE=cuda COMPUTE_TYPE=float16 NUM_WORKERS=4 python server.py
```

### Крок 5: Встановлення розширення Chrome (локально)

1. Відкрий Chrome → `chrome://extensions/`
2. Увімкни **"Режим розробника"** (перемикач вгорі праворуч)
3. Натисни **"Завантажити розпаковане розширення"**
4. Вибери папку `asr_system/extension` (де знаходиться `manifest.json`)
5. Розширення з'явиться в панелі інструментів → закріпи його

### Крок 6: Підключення розширення до локального сервера

1. Натисни іконку розширення в Chrome
2. Перейди на вкладку **Сервер** (🌐)
3. В полі "Адреса сервера" введи: `ws://localhost:8000/ws`
4. Натисни **"Підключити"**
5. Статус має змінитися на 🟢 "Підключено"

---

## Налаштування

### Змінні середовища сервера

| Змінна | Опис | За замовчуванням |
|--------|------|------------------|
| `REDIS_HOST` | Хост Redis | `localhost` |
| `REDIS_PORT` | Порт Redis | `6379` |
| `REDIS_DB` | База даних Redis | `0` |
| `WHISPER_MODEL_SIZE` | Розмір моделі Whisper (`tiny`/`base`/`small`/`medium`/`large`/`large-v3`) | `large` |
| `DEVICE` | Пристрій (`cuda`/`cpu`) | авто |
| `COMPUTE_TYPE` | Тип обчислень (`float16`/`int8`/`float32`) | `float16` |
| `NUM_WORKERS` | Кількість воркерів | `4` |
| `API_PORT` | Порт API сервера | `8000` |

### Налаштування розширення

1. Натисни іконку розширення → вкладка **Сервер**
2. Вкажи адресу WebSocket (`ws://localhost:8000/ws`)
3. Увімкни "Автопідключення" для автоматичного з'єднання при старті

### Налаштування LLM (опціонально)

1. Вкладка **LLM** → вибери провайдера
2. Введи API-ключ
3. Налаштуй модель та параметри генерації

---

## Використання

### Базовий сценарій

1. **Запусти сервер** — `cd server && python popup_server.py`
2. **Підключись до сервера** — натисни "Підключити" в розширенні
3. **Почни запис** — кнопка мікрофона або `Alt+Shift+R`
4. **Вибери вкладку** — Chrome запросить дозвіл на захоплення аудіо
5. **Спостерігай транскрипцію** — текст з'являється в реальному часі
6. **Зупини запис** — натисни кнопку ще раз
7. **Проаналізуй** — використай LLM або Manus Agent

### Гарячі клавіші

| Комбінація | Дія |
|-----------|-----|
| `Alt+Shift+R` | Увімкнути/вимкнути запис |

### Формати експорту

- **TXT** — чистий текст
- **HTML/DOC** — форматований документ з таймкодами

---

## API

### WebSocket Audio Stream (локальний)

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/audio/{session_id}');

// Відправка аудіо (16-bit PCM, 16kHz, mono)
ws.send(audioBuffer);

// Отримання результатів
ws.onmessage = (event) => {
  const result = JSON.parse(event.data);
  console.log(result.text); // "[Спікер 1]: Розпізнаний текст"
};
```

### REST API Endpoints

| Метод | Ендпоінт | Опис |
|-------|----------|------|
| `GET` | `http://localhost:8000/health` | Перевірка здоров'я сервера |
| `GET` | `http://localhost:8000/stats` | Статистика сервера (сесії, черга, воркери) |
| `GET` | `http://localhost:8000/scale-stats` | Статус автоскейлінгу |

---

## Структура проєкту

```
asr_system/
├── server/
│   ├── server.py                  # ASR сервер (FastAPI + Whisper + Redis)
│   └── requirements.txt           # Python-залежності
│
└── extension/
    ├── manifest.json              # Маніфест Chrome-розширення (v3)
    ├── background.js              # Service Worker — маршрутизація команд
    ├── offscreen.html             # Offscreen документ для аудіо
    ├── offscreen.js               # Логіка захоплення аудіо + WebSocket
    ├── audio-processor.js         # AudioWorklet процесор (PCM 16-bit)
    ├── popap.html                 # Головний UI розширення
    ├── popup.css                  # Стилі інтерфейсу
    ├── popup-main.js              # Основна логіка (з'єднання, запис, LLM)
    ├── popup-ui.js                # Рендеринг UI та навігація
    ├── popup-manus.js             # Інтеграція з Manus Agent + історія задач
    └── popup-db.js                # IndexedDB + Chrome Storage операції
```

---

## Розробка та відлагодження

### Запуск сервера в режимі розробки

```bash
cd server
uvicorn server:app --reload --port 8000
```

### Відлагодження розширення

- **Popup**: Правий клік по іконці → "Перевірити"
- **Background**: `chrome://extensions/` → "Service Worker"
- **Offscreen**: `chrome://extensions/` → "Offscreen Document"

### Моніторинг локального сервера

```bash
# Логи сервера
tail -f logs/asr_server.log

# Redis
redis-cli monitor

# Статистика
curl http://localhost:8000/stats
curl http://localhost:8000/scale-stats
```

---

## Подяки

- [OpenAI Whisper](https://github.com/openai/whisper) — модель розпізнавання мови
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — оптимізована імплементація

---

**Створено для покращення комунікації та продуктивності.**

*Якщо у вас є питання або пропозиції — відкривайте Issue.*
