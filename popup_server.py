import os
import asyncio
import aiohttp
from aiohttp import web
import numpy as np
import torch
import json
from faster_whisper import WhisperModel

# === КОНФІГ ===
MODEL_SIZE = os.environ.get("MODEL_SIZE", "tiny")  # tiny для Render Free
DEVICE = "cpu"
COMPUTE_TYPE = "int8"
PORT = int(os.environ.get("PORT", 8765))

print(f"🚀 Render | {DEVICE} | {MODEL_SIZE} | Порт: {PORT}")

# === МОДЕЛЬ ===
print("⏳ Завантаження Whisper...")
whisper = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)

# === ЛОГІКА ===
SAMPLE_RATE = 16000
CHUNK_DURATION = 3
SILENCE_RMS = 0.01
speaker_counter = 1

def get_speaker():
    global speaker_counter
    name = f"Спікер {speaker_counter}"
    speaker_counter = (speaker_counter % 2) + 1
    return name

def clean_text(text):
    STOP_WORDS = ["дякую за перегляд", "дякую", "раді вас", "підписуйтесь"]
    t_lower = text.lower().strip()
    if len(t_lower) < 2:
        return ""
    for word in STOP_WORDS:
        if word in t_lower:
            return ""
    return text

def is_silence(audio_data):
    if len(audio_data) == 0:
        return True
    rms = np.sqrt(np.mean(audio_data ** 2))
    return rms < SILENCE_RMS

# === WEBSOCKET ===
async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    print("🔌 Клієнт підключився")
    
    buffer_chunks = []
    total_samples = 0
    
    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.BINARY:
            data = msg.data
            if len(data) % 2 != 0:
                data = data[:-1]
            
            chunk = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
            buffer_chunks.append(chunk)
            total_samples += len(chunk)
            
            if total_samples >= SAMPLE_RATE * CHUNK_DURATION:
                audio_buffer = np.concatenate(buffer_chunks)
                buffer_chunks = []
                total_samples = 0
                
                if is_silence(audio_buffer):
                    continue
                
                try:
                    segments, _ = whisper.transcribe(audio_buffer, beam_size=5, language="uk")
                    raw_text = "".join([s.text for s in segments]).strip()
                    text = clean_text(raw_text)
                    
                    if text:
                        speaker = get_speaker()
                        response = {"text": f"[{speaker}]: {text}", "speaker": speaker}
                        print(f"🎤 {response['text']}")
                        await ws.send_str(json.dumps(response))
                except Exception as e:
                    print(f"⚠️ Помилка: {e}")
                    
        elif msg.type == aiohttp.WSMsgType.ERROR:
            print(f"🔴 Помилка: {ws.exception()}")
    
    print("🔌 Клієнт відключився")
    return ws

# === HTTP ===
async def health_check(request):
    return web.Response(text="OK", status=200)

app = web.Application()
app.router.add_get('/ws', websocket_handler)
app.router.add_get('/', health_check)

if __name__ == "__main__":
    print(f"🚀 Сервер на порту {PORT}")
    web.run_app(app, host="0.0.0.0", port=PORT)
