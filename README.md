# Prosodiscribe

Chrome-розширення для розпізнавання мови в реальному часі з локальним сервером на базі Whisper та інтеграцією з LLM.

![Python](https://img.shields.io/badge/python-3.8+-blue)
![Chrome](https://img.shields.io/badge/chrome-extension-yellow)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Зміст

- [Опис](#опис)
- [Особливості](#особливості)
- [Архітектура](#архітектура)
- [Вимоги](#вимоги)
- [Локальний запуск](#локальний-запуск)
- [Налаштування](#налаштування)
- [Використання](#використання)
- [API](#api)
- [Структура проєкту](#структура-проєкту)
- [Розробка](#розробка)
- [Ліцензія](#ліцензія)

---

## Опис

**Prosodiscribe** — система для транскрипції аудіо з браузера в реальному часі. Розширення захоплює аудіо з вкладок Chrome, відправляє його через WebSocket на локальний сервер, де відбувається розпізнавання мови за допомогою [faster-whisper](https://github.com/SYSTRAN/faster-whisper) та ідентифікація спікерів через SpeechBrain. Підтримує інтеграцію з LLM-провайдерами та Manus AI Agent для аналізу транскрипцій.

### Ключові можливості

- **Захоплення аудіо** — з будь-якої вкладки браузера через `tabCapture` API
- **Розпізнавання в реальному часі** — через Whisper (faster-whisper)
- **Ідентифікація спікерів** — до 8 унікальних голосів (SpeechBrain ECAPA-TDNN)
- **AI-аналіз** — через LLM (OpenAI, Anthropic, OpenRouter, Ollama)
- **Manus Agent** — інтеграція з Manus AI для глибокого аналізу транскрипцій
- **Експорт результатів** — у TXT та HTML/DOC формати
- **WebSocket-з'єднання** — стрімінг аудіо з автоматичним перепідключенням
- **Автоскейлінг** — динамічна зміна кількості воркерів залежно від навантаження
- **Гарячі клавіші** — `Alt+Shift+R` для швидкого старту/зупинки запису

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

### Компоненти розширення

| Компонент | Призначення |
|-----------|-------------|
| `manifest.json` | Маніфест Chrome Extension v3 |
| `background.js` | Service Worker — маршрутизація команд, управління offscreen |
| `offscreen.html/js` | Offscreen документ для захоплення аудіо та WebSocket-комунікації |
| `audio-processor.js` | AudioWorklet — конвертація Float32 → PCM 16-bit |
| `popup.html/css` | Головний UI розширення |
| `popup-main.js` | Основна логіка: з'єднання, запис, LLM, налаштування |
| `popup-ui.js` | Рендеринг UI, навігація, робота з файлами |
| `popup-manus.js` | Інтеграція з Manus Agent, історія задач, API-ключі |
| `popup-db.js` | IndexedDB + Chrome Storage операції |

---

## Вимоги

### Серверна частина

- **Python** 3.8+
- **CUDA**-сумісна GPU (опціонально, для прискорення)
- Мінімум **4GB RAM** (8GB+ для моделі `large`)

### Клієнтська частина

- **Google Chrome** 88+ (Manifest V3)
- Доступ до мікрофону/вкладок для захоплення аудіо

---

## Локальний запуск

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

**Основні залежності:**
- `fastapi` + `uvicorn` — API сервер
- `faster-whisper` — ASR модель
- `speechbrain` — ідентифікація спікерів
- `torch` + `numpy` — обчислення

### Крок 3: Запуск ASR сервера

```bash
cd server
python popup_server.py
```

Сервер стартує на:
- HTTP API: `http://localhost:8000`
- WebSocket: `ws://localhost:8000/ws`

**З кастомними параметрами:**
```bash
WHISPER_MODEL_SIZE=medium NUM_WORKERS=2 python popup_server.py
```

**З GPU-прискоренням:**
```bash
WHISPER_MODEL_SIZE=large-v3 DEVICE=cuda python popup_server.py
```

**Повний приклад:**
```bash
cd server
API_PORT=8000 \
  WHISPER_MODEL_SIZE=large \
  DEVICE=cuda \
  COMPUTE_TYPE=float16 \
  NUM_WORKERS=4 \
  python popup_server.py
```

### Крок 4: Встановлення розширення Chrome

1. Відкрий Chrome → `chrome://extensions/`
2. Увімкни **"Режим розробника"** (перемикач вгорі праворуч)
3. Натисни **"Завантажити розпаковане розширення"**
4. Вибери папку `asr_system/extension` (де знаходиться `manifest.json`)
5. Закріпи іконку розширення на панелі інструментів

### Крок 5: Підключення до сервера

1. Натисни іконку розширення в Chrome
2. Перейди на вкладку **Сервер** (🌐)
3. В полі "Адреса сервера" введи: `ws://localhost:8000/ws`
4. Натисни **"Підключити"**
5. Статус має змінитися на 🟢 "Сервер підключений"

---

## Налаштування

### Змінні середовища сервера

| Змінна | Опис | За замовчуванням |
|--------|------|------------------|
| `WHISPER_MODEL_SIZE` | Розмір моделі (`tiny`/`base`/`small`/`medium`/`large`/`large-v3`) | `large` |
| `DEVICE` | Пристрій (`cuda`/`cpu`) | авто-визначення |
| `COMPUTE_TYPE` | Тип обчислень (`float16`/`int8`/`float32`) | `float16` |
| `NUM_WORKERS` | Початкова кількість воркерів | `4` |
| `API_PORT` | Порт API сервера | `8000` |

### Налаштування розширення

#### Сервер
- Вкладка **Сервер** → вкажи адресу WebSocket
- Увімкни "Автопідключення" для автоматичного з'єднання при старті
- Увімкни "Перепідключення при розриві" для стійкості з'єднання

#### LLM (опціонально)
- Вкладка **LLM** → вибери провайдера (OpenAI, Anthropic, OpenRouter, Ollama, Custom)
- Введи API-ключ та налаштуй модель
- Налаштуй системний промпт, температуру та ліміт токенів
- Увімкни "Автообробка" для автоматичної обробки після транскрибації

#### Manus Agent (опціонально)
- Вкладка **Manus Agent** → введи `x-manus-api-key`
- Вибери профіль агента (`manus-1.6`, `manus-1.6-lite`, `manus-1.6-max`)
- Налаштуй системний промпт або вибери пресет (Meeting Assistant, Research Agent, Code Reviewer, Custom)
- Увімкни "Автоматично відправляти в Manus після зупинки запису"
- Увімкни "Інтерактивний режим" для можливості продовження діалогу

---

## Використання

### Базовий сценарій

1. **Запусти сервер** — `cd server && python popup_server.py`
2. **Підключись** — натисни "Підключити" в розширенні
3. **Почни запис** — кнопка мікрофона або `Alt+Shift+R`
4. **Дозвіл на аудіо** — Chrome запросить дозвіл на захоплення аудіо з вкладки
5. **Спостерігай транскрипцію** — текст з'являється в реальному часі з таймкодами
6. **Зупини запис** — натисни кнопку ще раз або `Alt+Shift+R`
7. **Проаналізуй** — використай LLM або Manus Agent для обробки тексту
8. **Експортуй** — збережи результат у TXT або DOC

### Гарячі клавіші

| Комбінація | Дія |
|-----------|-----|
| `Alt+Shift+R` | Увімкнути/вимкнути запис |

### Формати експорту

- **TXT** — чистий текст з таймкодами
- **DOC** — форматований HTML-документ з кольоровими таймкодами

### Робота з документами (Manus Agent)

- **Імпорт** — перетягни файли (TXT, MD, DOC, PDF, JSON, CSV, код) у зону завантаження
- **Експорт** — збережи прикріплені документи у форматі JSON
- **Отримані документи** — завантаж файли, згенеровані агентом під час виконання задачі
- **Історія задач** — переглядай, продовжуй та видаляй попередні сесії аналізу

---

## API

### WebSocket Audio Stream

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
| `GET` | `/health` | Перевірка здоров'я сервера |
| `GET` | `/stats` | Статистика (сесії, черга, воркери) |
| `GET` | `/scale-stats` | Статистика автоскейлінгу |
| `WS` | `/ws` | Автоматична сесія (генерується UUID) |
| `WS` | `/ws/audio/{session_id}` | Кастомна сесія |

---

## Структура проєкту

```
asr_system/
├── server/
│   ├── popup_server.py          # ASR сервер (FastAPI + Whisper)
│   └── requirements.txt         # Python-залежності
│
└── extension/
    ├── manifest.json              # Маніфест Chrome Extension v3
    ├── background.js              # Service Worker — маршрутизація команд
    ├── offscreen.html             # Offscreen документ для аудіо
    ├── offscreen.js               # Логіка захоплення аудіо + WebSocket
    ├── audio-processor.js         # AudioWorklet процесор (PCM 16-bit)
    ├── popup.html                 # Головний UI розширення
    ├── popup.css                  # Стилі інтерфейсу
    ├── popup-main.js              # Основна логіка (з'єднання, запис, LLM)
    ├── popup-ui.js                # Рендеринг UI, навігація, файли
    ├── popup-manus.js             # Інтеграція з Manus Agent + історія
    └── popup-db.js                # IndexedDB + Chrome Storage
```

---

## Розробка

### Запуск сервера в режимі розробки

```bash
cd server
uvicorn popup_server:app --reload --port 8000
```

### Відлагодження розширення

| Компонент | Як відкрити |
|-----------|-------------|
| **Popup** | Правий клік по іконці → "Перевірити" (Inspect popup) |
| **Background** | `chrome://extensions/` → "Service Worker" (посилання "service worker") |
| **Offscreen** | `chrome://extensions/` → "Offscreen Document" |

### Моніторинг сервера

```bash
# Логи сервера
tail -f logs/asr_server.log

# Статистика
curl http://localhost:8000/stats
curl http://localhost:8000/scale-stats
```

### Тестування WebSocket

```bash
# Перевірка з'єднання
wscat -c ws://localhost:8000/ws
```

---

## Технічні деталі

### Аудіопотік

- **Sample rate:** 16000 Hz
- **Формат:** 16-bit PCM, mono
- **Буферизація:** 3-секундні чанки
- **Кодування:** Float32 → Int16 (AudioWorklet)

### Ідентифікація спікерів

- **Модель:** SpeechBrain ECAPA-TDNN (spkrec-ecapa-voxceleb)
- **Поріг схожості:** 0.58 (cosine similarity)
- **Максимум спікерів:** 8
- **Оновлення ембеддингів:** експоненційне згладжування (α=0.1)

### Автоскейлінг

- **Мінімум воркерів:** 1
- **Максимум воркерів:** 8
- **Поріг масштабування вгору:** черга > 3 задачі
- **Поріг масштабування вниз:** черга = 0
- **Cooldown:** 5 секунд між змінами
- **Перевірка:** кожні 3 секунди

---

## Подяки

- [OpenAI Whisper](https://github.com/openai/whisper) — модель розпізнавання мови
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — оптимізована імплементація
- [SpeechBrain](https://speechbrain.github.io/) — ідентифікація спікерів
- [FastAPI](https://fastapi.tiangolo.com/) — веб-фреймворк

---

## Ліцензія

Цей проєкт ліцензовано під [MIT License](LICENSE).

---

**Створено для покращення комунікації та продуктивності.**

*Якщо у вас є питання або пропозиції — відкривайте [Issue](https://github.com/flopiy/asr_system/issues).*
