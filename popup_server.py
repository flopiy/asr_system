import os
import asyncio
import aiohttp
from aiohttp import web
import numpy as np
import json

# === КОНФІГ ===
PORT = int(os.environ.get("PORT", 8765))

print(f"🚀 Render | Порт: {PORT}")

# === ЛОГІКА (без ML, тестовий сервер) ===
SAMPLE_RATE = 16000
CHUNK_DURATION = 3
SILENCE_RMS = 0.01

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
                
                # Тимчасово без Whisper — просто ехо
                response = {"text": "[Тест]: Аудіо отримано"}
                print(f"🎤 {response['text']}")
                await ws.send_str(json.dumps(response))
                    
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
