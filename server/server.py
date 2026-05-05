#!/usr/bin/env python3
"""
ASR Server – ізольована обробка аудіопотоків з інтелектуальною маршрутизацією.
Спільна модель Whisper для всіх воркерів.
"""

import asyncio
import json
import logging
import os
import sys
import time
import signal
from uuid import uuid4
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional

import redis.asyncio as redis
import numpy as np
import torch
from faster_whisper import WhisperModel
from speechbrain.inference.speaker import EncoderClassifier
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ----------------------------------------------------------------------
# Налаштування логування
# ----------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("ASR_Server")

# ----------------------------------------------------------------------
# Конфігурація
# ----------------------------------------------------------------------
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "large")  # tiny, base, small, medium, large, large-v2
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"
SPEECHBRAIN_RUN_OPTS = {"device": "cuda:0" if DEVICE == "cuda" else "cpu"}

SAMPLE_RATE = 16000
CHUNK_DURATION = 3
SILENCE_RMS = 0.01
SIMILARITY_THRESHOLD = 0.58
MAX_SPEAKERS = 8

SKIP_PHRASES = [
    "дякую за перегляд", "дякую", "раді вас", "підписуйтесь", "поставити лайк"
]
FILTERED_WORDS = ["example", "test"]

NUM_WORKERS = int(os.getenv("NUM_WORKERS", 4))
API_PORT = int(os.getenv("API_PORT", 8000))

# ----------------------------------------------------------------------
# Допоміжні функції
# ----------------------------------------------------------------------
def clean_text(text: str) -> str:
    t_lower = text.lower().strip()
    if len(t_lower) < 2:
        return ""
    for phrase in SKIP_PHRASES:
        if phrase in t_lower:
            return ""
    if t_lower in FILTERED_WORDS:
        return ""
    return text

def is_silence(audio_data: np.ndarray) -> bool:
    if len(audio_data) == 0:
        return True
    return np.sqrt(np.mean(audio_data ** 2)) < SILENCE_RMS

# ----------------------------------------------------------------------
# Моделі даних
# ----------------------------------------------------------------------
@dataclass
class WorkerInfo:
    worker_id: str
    active_sessions: int = 0
    queue_length: int = 0
    gpu_available: bool = False
    last_heartbeat: float = 0.0
    total_processed: int = 0
    errors_count: int = 0

@dataclass
class SessionContext:
    session_id: str
    user_id: str
    known_speakers: Dict = None
    buffer_chunks: List = None
    total_samples: int = 0
    created_at: float = 0.0
    last_activity: float = 0.0

    def __post_init__(self):
        if self.known_speakers is None:
            self.known_speakers = {}
        if self.buffer_chunks is None:
            self.buffer_chunks = []

# ----------------------------------------------------------------------
# Ідентифікація спікерів
# ----------------------------------------------------------------------
class SpeakerIdentifier:
    def __init__(self):
        self.classifier = None

    async def load_model(self):
        logger.info("Завантаження моделі ідентифікації спікерів (SpeechBrain)...")
        self.classifier = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            run_opts=SPEECHBRAIN_RUN_OPTS
        )
        logger.info("Модель спікерів завантажено.")

    def identify(self, audio_data: np.ndarray, known_speakers: Dict) -> tuple:
        if len(audio_data) < int(SAMPLE_RATE * 1.2):
            return "Unknown", known_speakers

        signal = torch.tensor(audio_data).unsqueeze(0).float()
        if DEVICE == "cuda":
            signal = signal.to("cuda")

        with torch.no_grad():
            embeddings = self.classifier.encode_batch(signal).flatten().cpu()

        if not known_speakers:
            known_speakers["Спікер 1"] = embeddings
            return "Спікер 1", known_speakers

        best_score = -1.0
        best_name = "Unknown"
        for name, saved_emb in known_speakers.items():
            sim = torch.nn.functional.cosine_similarity(
                embeddings.unsqueeze(0), saved_emb.unsqueeze(0)
            ).item()
            if sim > best_score:
                best_score = sim
                best_name = name

        if best_score > SIMILARITY_THRESHOLD:
            known_speakers[best_name] = 0.9 * known_speakers[best_name] + 0.1 * embeddings
            return best_name, known_speakers

        if len(known_speakers) >= MAX_SPEAKERS:
            return best_name, known_speakers

        new_name = f"Спікер {len(known_speakers) + 1}"
        known_speakers[new_name] = embeddings
        return new_name, known_speakers

# ----------------------------------------------------------------------
# ASR Worker (без власного завантаження моделі)
# ----------------------------------------------------------------------
class ASRWorker:
    def __init__(self, worker_id: str, redis_client, speaker_id: SpeakerIdentifier, whisper_model):
        self.worker_id = worker_id
        self.redis = redis_client
        self.speaker_id = speaker_id
        self.whisper_model = whisper_model
        self.running = False
        self.sessions: Dict[str, SessionContext] = {}
        self.processed_count = 0
        self.error_count = 0

    async def send_heartbeat(self):
        while self.running:
            try:
                worker_key = f"worker:{self.worker_id}"
                # Сумісність з Redis 3.x – окремі hset
                await self.redis.hset(worker_key, "active_sessions", str(len(self.sessions)))
                await self.redis.hset(worker_key, "queue_length", str(await self.redis.llen(f"worker_queue:{self.worker_id}")))
                await self.redis.hset(worker_key, "gpu_available", str(DEVICE == "cuda"))
                await self.redis.hset(worker_key, "last_heartbeat", str(time.time()))
                await self.redis.hset(worker_key, "total_processed", str(self.processed_count))
                await self.redis.hset(worker_key, "errors_count", str(self.error_count))
                await self.redis.expire(worker_key, 15)
            except Exception as e:
                logger.error("[Worker %s] Heartbeat error: %s", self.worker_id, e)
            await asyncio.sleep(5)

    async def process_task(self, task: dict):
        session_id = task["session_id"]
        task_id = task["task_id"]
        try:
            audio = np.array(task["audio_data"], dtype=np.float32)
            if is_silence(audio):
                return

            segments, _ = await asyncio.to_thread(
                self.whisper_model.transcribe,
                audio,
                beam_size=5,
                language="uk"
            )
            raw_text = "".join([s.text for s in segments]).strip()
            text = clean_text(raw_text)
            if not text:
                return

            if session_id not in self.sessions:
                self.sessions[session_id] = SessionContext(
                    session_id=session_id,
                    user_id=task.get("user_id", "unknown"),
                    created_at=time.time()
                )
            sess = self.sessions[session_id]
            sess.last_activity = time.time()

            speaker, sess.known_speakers = self.speaker_id.identify(audio, sess.known_speakers)
            result = {
                "session_id": session_id,
                "task_id": task_id,
                "text": f"[{speaker}]: {text}",
                "speaker": speaker,
                "status": "transcribed",
                "timestamp": time.time()
            }
            await self.redis.publish("asr_results", json.dumps(result, ensure_ascii=False))
            self.processed_count += 1
            logger.info("[Worker %s] %s", self.worker_id, result["text"][:80])
        except Exception as e:
            logger.error("[Worker %s] Processing error: %s", self.worker_id, e)
            self.error_count += 1
            await self.redis.publish("asr_results", json.dumps({
                "session_id": session_id,
                "task_id": task_id,
                "status": "error",
                "error_message": str(e)
            }, ensure_ascii=False))

    async def run(self):
        self.running = True
        asyncio.create_task(self.send_heartbeat())
        logger.info("[Worker %s] Started.", self.worker_id)

        while self.running:
            try:
                msg = await self.redis.blpop(f"worker_queue:{self.worker_id}", timeout=1)
                if msg:
                    _, task_json = msg
                    await self.process_task(json.loads(task_json))

                now = time.time()
                stale = [sid for sid, s in self.sessions.items() if now - s.last_activity > 300]
                for sid in stale:
                    del self.sessions[sid]
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("[Worker %s] Loop error: %s", self.worker_id, e)
                await asyncio.sleep(1)
        logger.info("[Worker %s] Stopped.", self.worker_id)

    async def stop(self):
        self.running = False


# ----------------------------------------------------------------------
# Інтелектуальний маршрутизатор
# ----------------------------------------------------------------------
class IntelligentRouter:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.workers: Dict[str, WorkerInfo] = {}
        self.session_map: Dict[str, str] = {}
        self.running = False
        self.lock = asyncio.Lock()

    async def update_workers(self):
        while self.running:
            try:
                keys = await self.redis.keys("worker:*")
                async with self.lock:
                    active = set()
                    for key in keys:
                        # key уже строка (decode_responses=True)
                        wid = key.split(":")[1]
                        data = await self.redis.hgetall(key)
                        if not data:
                            continue
                        self.workers[wid] = WorkerInfo(
                            worker_id=wid,
                            active_sessions=int(data.get("active_sessions", 0)),
                            queue_length=int(data.get("queue_length", 0)),
                            gpu_available=data.get("gpu_available", "False") == "True",
                            last_heartbeat=float(data.get("last_heartbeat", 0)),
                            total_processed=int(data.get("total_processed", 0)),
                            errors_count=int(data.get("errors_count", 0))
                        )
                        active.add(wid)
                    for wid in set(self.workers.keys()) - active:
                        del self.workers[wid]
                        for s, w in list(self.session_map.items()):
                            if w == wid:
                                del self.session_map[s]
            except Exception as e:
                logger.error("Router worker update error: %s", e)
            await asyncio.sleep(3)

    def _cost(self, wid: str, sid: str, is_new: bool) -> float:
        w = self.workers.get(wid)
        if not w:
            return float('inf')
        cost = w.queue_length * 1000 + w.active_sessions * 500 + w.errors_count * 100
        if not is_new and self.session_map.get(sid) == wid:
            cost -= 5000
        if is_new:
            cost += 2000
        return cost

    async def select_worker(self, session_id: str) -> Optional[str]:
        async with self.lock:
            if not self.workers:
                return None
            if session_id in self.session_map:
                wid = self.session_map[session_id]
                if wid in self.workers and self._cost(wid, session_id, False) < 10000:
                    return wid
            best = min(self.workers, key=lambda w: self._cost(w, session_id, True))
            self.session_map[session_id] = best
            logger.info("Session %s → Worker %s", session_id[:8], best)
            return best

    async def run(self):
        self.running = True
        asyncio.create_task(self.update_workers())
        logger.info("Router started.")
        while self.running:
            try:
                msg = await self.redis.blpop("audio_tasks", timeout=1)
                if msg:
                    _, task_json = msg
                    task = json.loads(task_json)
                    wid = await self.select_worker(task["session_id"])
                    if wid:
                        await self.redis.rpush(f"worker_queue:{wid}", task_json)
                    else:
                        logger.error("No workers available!")
                        await self.redis.rpush("audio_tasks", task_json)
                        await asyncio.sleep(1)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Router error: %s", e)
                await asyncio.sleep(1)
        logger.info("Router stopped.")

    async def stop(self):
        self.running = False

# ----------------------------------------------------------------------
# API Gateway
# ----------------------------------------------------------------------
class APIGateway:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.app = FastAPI(title="ASR Gateway")
        self.app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
        self.ws_clients: Dict[str, WebSocket] = {}
        self.buffers: Dict[str, SessionContext] = {}
        self._setup_routes()

    def _setup_routes(self):
        @self.app.websocket("/ws")
        async def ws_auto(websocket: WebSocket):
            await self._handle(websocket, str(uuid4()))

        @self.app.websocket("/ws/audio/{session_id}")
        async def ws_session(websocket: WebSocket, session_id: str):
            await self._handle(websocket, session_id)

        @self.app.get("/health")
        async def health():
            try:
                await self.redis.ping()
                return {"status": "ok", "sessions": len(self.ws_clients)}
            except Exception as e:
                return {"status": "error", "detail": str(e)}

        @self.app.get("/stats")
        async def stats():
            qlen = await self.redis.llen("audio_tasks")
            workers = []
            for key in await self.redis.keys("worker:*"):
                data = await self.redis.hgetall(key)
                if data:
                    workers.append({
                        "id": key.split(":")[1],          # key вже str (decode_responses=True)
                        "sessions": int(data.get("active_sessions", 0)),   # виправлено: str-ключ
                        "queue": int(data.get("queue_length", 0))          # виправлено: str-ключ
                    })
            return {"active_sessions": len(self.ws_clients), "pending": qlen, "workers": workers}

    async def _handle(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.ws_clients[session_id] = websocket
        buf = SessionContext(session_id=session_id, user_id="user_" + session_id[:8],
                             created_at=time.time(), last_activity=time.time())
        self.buffers[session_id] = buf
        logger.info("Connected: %s", session_id[:8])
        try:
            while True:
                data = await websocket.receive_bytes()
                if len(data) % 2: data = data[:-1]
                chunk = np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0
                if is_silence(chunk):
                    continue
                buf.buffer_chunks.append(chunk)
                buf.total_samples += len(chunk)
                buf.last_activity = time.time()
                if buf.total_samples >= SAMPLE_RATE * CHUNK_DURATION:
                    audio = np.concatenate(buf.buffer_chunks)
                    buf.buffer_chunks.clear()
                    buf.total_samples = 0
                    task = {
                        "task_id": str(uuid4()),
                        "session_id": session_id,
                        "user_id": buf.user_id,
                        "audio_data": audio.tolist(),
                        "timestamp": time.time()
                    }
                    await self.redis.rpush("audio_tasks", json.dumps(task))
        except WebSocketDisconnect:
            logger.info("Disconnected: %s", session_id[:8])
        except Exception as e:
            logger.error("WebSocket error: %s", e)
        finally:
            self.ws_clients.pop(session_id, None)
            self.buffers.pop(session_id, None)

    async def listen_results(self):
        pubsub = self.redis.pubsub()
        await pubsub.subscribe("asr_results")
        logger.info("Listening for results...")
        while True:
            try:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1)
                if msg and msg["type"] == "message":
                    data = json.loads(msg["data"])
                    sid = data.get("session_id")
                    if sid and sid in self.ws_clients:
                        await self.ws_clients[sid].send_json(data)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("listen_results error: %s", e)
                await asyncio.sleep(1)
        await pubsub.unsubscribe("asr_results")

    async def run(self):
        config = uvicorn.Config(self.app, host="0.0.0.0", port=API_PORT, log_level="info")
        server = uvicorn.Server(config)
        asyncio.create_task(self.listen_results())
        logger.info("API Gateway on port %d", API_PORT)
        await server.serve()


# ============================================
# AUTO SCALER
# ============================================
class AutoScaler:
    """
    Автоматично масштабує кількість воркерів залежно від навантаження.
    """
    def __init__(self, server: 'ASRServer'):
        self.server = server
        self.running = False
        self.min_workers = 1
        self.max_workers = 8
        self.scale_up_threshold = 3    # додаємо воркер якщо черга > 3
        self.scale_down_threshold = 0  # видаляємо якщо черга = 0
        self.check_interval = 3        # секунди між перевірками
        self.cooldown = 5              # секунд між змінами
        self.last_scale_time = 0
        self.stats = {
            "scale_up_events": 0,
            "scale_down_events": 0,
            "max_workers_reached": 0,
            "history": []  # (timestamp, queue_length, num_workers)
        }
    
    async def run(self):
        self.running = True
        logger.info("📊 AutoScaler started (min=%d, max=%d)", 
                     self.min_workers, self.max_workers)
        
        while self.running:
            try:
                queue_length = await self.server.redis.llen("audio_tasks")
                current_workers = len(self.server.workers)
                
                # Записуємо історію
                self.stats["history"].append({
                    "timestamp": time.time(),
                    "queue_length": queue_length,
                    "num_workers": current_workers
                })
                # [FIX] Memory leak protection: обрізаємо стару історію
                if len(self.stats["history"]) > 1000:
                    self.stats["history"] = self.stats["history"][-500:]
                
                now = time.time()
                if now - self.last_scale_time < self.cooldown:
                    await asyncio.sleep(self.check_interval)
                    continue
                
                # Масштабування вгору
                if queue_length > self.scale_up_threshold and current_workers < self.max_workers:
                    # [FIX] UUID запобігає колізіям після scale down → up
                    unique_id = str(uuid4())[:8]
                    new_worker_id = f"worker_{unique_id}"
                    worker = ASRWorker(
                        new_worker_id, 
                        self.server.redis, 
                        self.server.speaker_id,
                        self.server.whisper_model
                    )
                    self.server.workers.append(worker)
                    asyncio.create_task(worker.run())
                    self.last_scale_time = now
                    self.stats["scale_up_events"] += 1
                    logger.info("⬆️ AutoScaler: +1 worker (queue=%d, workers=%d)", 
                               queue_length, len(self.server.workers))
                
                # Масштабування вниз
                elif queue_length <= self.scale_down_threshold and current_workers > self.min_workers:
                    worker = self.server.workers.pop()
                    await worker.stop()
                    self.last_scale_time = now
                    self.stats["scale_down_events"] += 1
                    logger.info("⬇️ AutoScaler: -1 worker (queue=%d, workers=%d)", 
                               queue_length, len(self.server.workers))
                
                # Оновлюємо максимум
                if current_workers >= self.max_workers:
                    self.stats["max_workers_reached"] += 1
                
            except Exception as e:
                logger.error("AutoScaler error: %s", e)
            
            await asyncio.sleep(self.check_interval)
        
        logger.info("AutoScaler stopped.")
    
    async def stop(self):
        self.running = False
    
    def get_report(self) -> dict:
        """Генерує звіт про масштабування."""
        if not self.stats["history"]:
            return {"error": "no data"}
        
        history = self.stats["history"]
        queue_lengths = [h["queue_length"] for h in history]
        worker_counts = [h["num_workers"] for h in history]
        timestamps = [h["timestamp"] for h in history]
        
        return {
            "scale_up_events": self.stats["scale_up_events"],
            "scale_down_events": self.stats["scale_down_events"],
            "max_workers_reached": self.stats["max_workers_reached"],
            "avg_queue_length": np.mean(queue_lengths),
            "max_queue_length": max(queue_lengths),
            "avg_workers": np.mean(worker_counts),
            "max_workers_used": max(worker_counts),
            "total_observations": len(history),
            "duration_seconds": timestamps[-1] - timestamps[0] if len(timestamps) > 1 else 0
        }

# ----------------------------------------------------------------------
# Головний клас сервера
# ----------------------------------------------------------------------
class ASRServer:
    def __init__(self):
        self.redis = None
        self.speaker_id = None
        self.whisper_model = None
        self.workers: List[ASRWorker] = []
        self.router: Optional[IntelligentRouter] = None
        self.gateway: Optional[APIGateway] = None
        self.scaler: Optional[AutoScaler] = None  # ← ДОДАЙТЕ ЦЕ

    async def start(self):
        self.redis = await redis.from_url(
            f"redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}",
            encoding="utf8", decode_responses=True
        )
        await self.redis.ping()
        self.speaker_id = SpeakerIdentifier()
        await self.speaker_id.load_model()

        # Завантаження ОДНІЄЇ моделі Whisper для всіх воркерів
        logger.info("Loading Whisper %s...", MODEL_SIZE)
        try:
            if DEVICE == "cuda":
                self.whisper_model = WhisperModel(MODEL_SIZE, device=DEVICE, device_index=0, compute_type=COMPUTE_TYPE)
            else:
                self.whisper_model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        except Exception as e:
            logger.error("Whisper loading failed: %s. Falling back to base on CPU.", e)
            self.whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
        logger.info("✅ Whisper ready (shared across all workers)")

        # Створюємо початковий пул з 1 воркера
        for i in range(1):  # Починаємо з 1
            worker = ASRWorker(f"worker_{i}", self.redis, self.speaker_id, self.whisper_model)
            self.workers.append(worker)
        
        # Створюємо AutoScaler
        self.scaler = AutoScaler(self)
        
        self.router = IntelligentRouter(self.redis)
        self.gateway = APIGateway(self.redis)
        
        # Додаємо ендпоінт для статистики масштабування
        self.gateway.app.add_api_route("/scale-stats", self.get_scale_stats)
        
        tasks = [asyncio.create_task(w.run()) for w in self.workers]
        tasks.append(asyncio.create_task(self.router.run()))
        tasks.append(asyncio.create_task(self.gateway.run()))
        tasks.append(asyncio.create_task(self.scaler.run()))  # НОВЕ
        
        logger.info("Server started (workers=%d, port=%d, auto-scaling ENABLED)", 
                     len(self.workers), API_PORT)
        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            pass
        finally:
            await self.stop()
    
    async def get_scale_stats(self):
        """Повертає статистику авто-масштабування."""
        if self.scaler:
            report = self.scaler.get_report()
            return {"auto_scaling": report}
        return {"auto_scaling": "not available"}
    
    async def stop(self):
        if self.scaler:
            await self.scaler.stop()
        for w in self.workers:
            await w.stop()
        if self.router:
            await self.router.stop()
        if self.redis:
            await self.redis.close()
        logger.info("Server stopped.")

async def main():
    server = ASRServer()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, lambda: asyncio.create_task(server.stop()))
        except NotImplementedError:
            pass
    await server.start()

if __name__ == "__main__":
    print("ASR Server запускається...")
    asyncio.run(main())
