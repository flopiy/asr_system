import asyncio
import websockets
import numpy as np
import torch
import json
from faster_whisper import WhisperModel
from speechbrain.inference.speaker import EncoderClassifier

# === 1. КОНФІГУРАЦІЯ ===
MODEL_SIZE = "large-v3"
# Автоматично визначаємо пристрій
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"

print(f"PyTorch CUDA доступна: {torch.cuda.is_available()}")
print(f"Використовується пристрій: {DEVICE}")

STOP_WORDS = ["дякую за перегляд", "дякую", "раді вас", "підписуйтесь", "поставити лайк"]
BAD_WORDS = ["бля", "піздець", "нахуй", "хуй", "сука"]

SIMILARITY_THRESHOLD = 0.58
SAMPLE_RATE = 16000
CHUNK_DURATION = 3  # секунди
SILENCE_RMS = 0.01  # поріг тиші

print(f"Завантаження Whisper {MODEL_SIZE} на {DEVICE}...")
try:
    if DEVICE == "cuda":
        whisper = WhisperModel(
            MODEL_SIZE, 
            device=DEVICE, 
            device_index=0, 
            compute_type=COMPUTE_TYPE
        )
    else:
        whisper = WhisperModel(
            MODEL_SIZE, 
            device=DEVICE, 
            compute_type=COMPUTE_TYPE
        )
except Exception as e:
    print(f"❌ Помилка при завантаженні моделі: {e}")
    print("🔄 Спроба завантажити модель 'base' на CPU...")
    MODEL_SIZE = "base"
    DEVICE = "cpu"
    COMPUTE_TYPE = "int8"
    whisper = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)

print("Завантаження моделі ідентифікації спікерів...")
classifier = EncoderClassifier.from_hparams(
    source="speechbrain/spkrec-ecapa-voxceleb",
    run_opts={"device": DEVICE}
)

# === ДОДАЙТЕ ЦЕЙ РЯДОК ===
known_speakers = {}

# === 2. ДОПОМІЖНІ ФУНКЦІЇ ===

def clean_text(text):
    t_lower = text.lower().strip()
    if len(t_lower) < 2:
        return ""
    for word in STOP_WORDS:
        if word in t_lower:
            return ""
    if t_lower in BAD_WORDS:
        return ""
    return text

def is_silence(audio_data):
    """Перевіряє, чи є аудіо тишею за RMS енергією"""
    if len(audio_data) == 0:
        return True
    rms = np.sqrt(np.mean(audio_data ** 2))
    return rms < SILENCE_RMS

def get_speaker_name(audio_data):
    if len(audio_data) < int(SAMPLE_RATE * 1.2):
        return "Unknown"
    
    signal = torch.tensor(audio_data).unsqueeze(0).float()
    
    with torch.no_grad():
        embeddings = classifier.encode_batch(signal).flatten().cpu()

    if not known_speakers:
        known_speakers["Спікер 1"] = embeddings
        return "Спікер 1"

    best_score = -1
    best_name = "Unknown"

    for name, saved_emb in known_speakers.items():
        similarity = torch.nn.functional.cosine_similarity(
            embeddings.unsqueeze(0),
            saved_emb.unsqueeze(0)
        ).item()
        
        if similarity > best_score:
            best_score = similarity
            best_name = name

    if best_score > SIMILARITY_THRESHOLD:
        known_speakers[best_name] = 0.9 * known_speakers[best_name] + 0.1 * embeddings
        return best_name
            
    if len(known_speakers) >= 8:
        return best_name

    new_name = f"Спікер {len(known_speakers) + 1}"
    known_speakers[new_name] = embeddings
    return new_name

# === 3. ОБРОБКА WEBSOCKET ===

async def handle_audio(websocket):
    print("🔌 Клієнт підключився")
    # Використовуємо list замість np.append для ефективності
    buffer_chunks = []
    total_samples = 0
    
    try:
        async for message in websocket:
            # Конвертуємо Int16 PCM (з браузера) у Float32 нормалізований
            if len(message) % 2 != 0:
                message = message[:-1]
            
            chunk = np.frombuffer(message, dtype=np.int16).astype(np.float32) / 32768.0
            buffer_chunks.append(chunk)
            total_samples += len(chunk)

            # Обробляємо кожні CHUNK_DURATION секунд
            if total_samples >= SAMPLE_RATE * CHUNK_DURATION:
                audio_buffer = np.concatenate(buffer_chunks)
                buffer_chunks = []
                total_samples = 0
                
                # Пропускаємо тишу
                if is_silence(audio_buffer):
                    continue

                try:
                    segments, _ = whisper.transcribe(audio_buffer, beam_size=5, language="uk")
                    raw_text = "".join([s.text for s in segments]).strip()
                    text = clean_text(raw_text)

                    if text:
                        speaker = get_speaker_name(audio_buffer)
                        response = {
                            "text": f"[{speaker}]: {text}",
                            "speaker": speaker
                        }
                        print(f"🎤 {response['text']}")
                        await websocket.send(json.dumps(response))
                except Exception as e:
                    print(f"⚠️ Помилка транскрипції: {e}")

    except websockets.exceptions.ConnectionClosed as e:
        print(f"🔴 З'єднання закрите: {e}")
    except Exception as e:
        print(f"❌ Помилка в обробнику: {e}")
    finally:
        print("🔌 Клієнт відключений")

async def main():
    # ping_interval=None вимикає keepalive ping, щоб уникнути timeout
    # або ping_interval=20, ping_timeout=20 для стабільності
    async with websockets.serve(
        handle_audio, 
        "localhost", 
        8765,
        ping_interval=20,
        ping_timeout=20
    ):
        print("🚀 ASR Сервер запущено на ws://localhost:8765")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())