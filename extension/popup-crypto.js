const CRYPTO_KEY_STORAGE = 'aes_gcm_master_key';

// Повертає CryptoKey; при першому запуску генерує ключ і зберігає у storage
async function ensureCryptoKey() {
  const res = await chrome.storage.local.get(CRYPTO_KEY_STORAGE);
  if (res[CRYPTO_KEY_STORAGE]) {
    const raw = _b64ToBuffer(res[CRYPTO_KEY_STORAGE]);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const exported = await crypto.subtle.exportKey('raw', key);
  await chrome.storage.local.set({ [CRYPTO_KEY_STORAGE]: _bufferToB64(exported) });
  return key;
}

// Шифрує рядок → base64-JSON {iv, ct}
async function encryptApiKey(plaintext) {
  if (!plaintext) return '';
  const key = await ensureCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return JSON.stringify({ iv: _bufferToB64(iv), ct: _bufferToB64(ciphertext) });
}

// Дешифрує base64-JSON {iv, ct} → рядок; якщо значення не зашифроване — повертає як є (міграція)
async function decryptApiKey(encrypted) {
  if (!encrypted) return '';
  if (!encrypted.startsWith('{')) return encrypted; // legacy plaintext — міграція
  try {
    const { iv, ct } = JSON.parse(encrypted);
    const key = await ensureCryptoKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: _b64ToBuffer(iv) },
      key,
      _b64ToBuffer(ct)
    );
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    console.warn('[Crypto] Не вдалося дешифрувати — повертаємо оригінал:', e);
    return encrypted;
  }
}

function _bufferToB64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function _b64ToBuffer(b64) {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}
