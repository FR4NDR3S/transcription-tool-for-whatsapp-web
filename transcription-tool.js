// ==UserScript==
// @name         WhatsApp Web Audio Transcriber (Groq Whisper) - Fix Captura
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Transcribe notas de voz enviando el formato correcto a Groq Whisper.
// @match        https://web.whatsapp.com/*
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// @connect      api.groq.com
// ==/UserScript==

(function () {
    'use strict';

    const GROQ_API_KEY = "TU_API_KEY_AQUI";
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;

    function log(...args) {
        console.log("%c[TRANSCRIPT-TOOL-LOG]", "background: #681da8; color: white; font-weight: bold; padding: 2px 5px; border-radius: 3px;", ...args);
    }

    win.__audioBlobsMap = win.__audioBlobsMap || new Map();
    win.__lastCapturedBlob = win.__lastCapturedBlob || null;
    win.__lastAudioSrc = win.__lastAudioSrc || null;

    const origCreateObjectURL = win.URL.createObjectURL;
    win.URL.createObjectURL = function (obj) {
        const url = origCreateObjectURL.apply(this, arguments);
        if (obj instanceof Blob) {
            log("Blob detectado en createObjectURL:", url, obj.type, obj.size);
            if (obj.type.includes('audio') || obj.type.includes('ogg') || obj.type.includes('opus') || obj.size > 1000) {
                win.__audioBlobsMap.set(url, obj);
                win.__lastCapturedBlob = obj;
            }
        }
        return url;
    };

    const origRevokeObjectURL = win.URL.revokeObjectURL;
    win.URL.revokeObjectURL = function (url) {
        return origRevokeObjectURL.apply(this, arguments);
    };

    const srcDescriptor = Object.getOwnPropertyDescriptor(win.HTMLMediaElement.prototype, 'src');
    if (srcDescriptor && srcDescriptor.set) {
        Object.defineProperty(win.HTMLMediaElement.prototype, 'src', {
            set: function (val) {
                if (typeof val === 'string' && val.startsWith('blob:')) {
                    log("Asignación de src detectada:", val);
                    win.__lastAudioSrc = val;
                }
                return srcDescriptor.set.call(this, val);
            },
            get: function () {
                return srcDescriptor.get.call(this);
            },
            configurable: true
        });
    }

    const origPlay = win.HTMLMediaElement.prototype.play;
    win.HTMLMediaElement.prototype.play = function () {
        const src = this.currentSrc || this.src;
        if (src && src.startsWith('blob:')) {
            log("Reproducción detectada en Audio en memoria:", src);
            win.__lastAudioSrc = src;
            if (win.__audioBlobsMap.has(src)) {
                win.__lastCapturedBlob = win.__audioBlobsMap.get(src);
            }
        }
        return origPlay.apply(this, arguments);
    };

    async function fetchBlobFromUrl(blobUrl) {
        if (!blobUrl) return null;
        if (win.__audioBlobsMap.has(blobUrl)) {
            return win.__audioBlobsMap.get(blobUrl);
        }
        try {
            const res = await fetch(blobUrl);
            const blob = await res.blob();
            if (blob.size > 500) {
                win.__audioBlobsMap.set(blobUrl, blob);
                return blob;
            }
        } catch (e) {
            log("No se pudo hacer fetch del blobUrl:", e);
        }
        return null;
    }

    async function getAudioBlob(playBtn) {
        const previousBlob = win.__lastCapturedBlob;
        const previousSrc = win.__lastAudioSrc;

        win.__lastCapturedBlob = null;
        win.__lastAudioSrc = null;

        playBtn.click();

        let capturedBlob = null;
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 100));

            if (win.__lastCapturedBlob) {
                capturedBlob = win.__lastCapturedBlob;
                break;
            }
            if (win.__lastAudioSrc) {
                capturedBlob = await fetchBlobFromUrl(win.__lastAudioSrc);
                if (capturedBlob) break;
            }
        }

        const pauseBtn = playBtn.closest('div[role="row"], div[data-testid="msg-container"]')?.querySelector('button[aria-label*="Pause"], button[aria-label*="Pausar"]') || playBtn;
        pauseBtn.click();

        if (capturedBlob) return capturedBlob;

        if (previousSrc) {
            const fromPrevSrc = await fetchBlobFromUrl(previousSrc);
            if (fromPrevSrc) return fromPrevSrc;
        }
        if (previousBlob) return previousBlob;

        return null;
    }

    async function sendToGroq(blob, btn) {
        btn.innerText = '⏳ Transcribiendo...';
        log("Procesando Blob. Tamaño:", blob.size, "Tipo:", blob.type);

        const arrayBuffer = await blob.arrayBuffer();
        const cleanFile = new File([arrayBuffer], "voice_note.ogg", { type: "audio/ogg" });

        const formData = new FormData();
        formData.append("file", cleanFile);
        formData.append("model", "whisper-large-v3");
        formData.append("temperature", "0.0");
        formData.append("language", "es");
        formData.append("prompt", "Nota de voz de WhatsApp. Hola, esta es una transcripción exacta, conversacional, con puntuación perfecta, comas, signos de interrogación y ortografía impecable.");
        
        GM_xmlhttpRequest({
            method: "POST",
            url: "https://api.groq.com/openai/v1/audio/transcriptions",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            data: formData,
            onload: function (res) {
                log("Respuesta Groq:", res.status, res.responseText);
                if (res.status === 200) {
                    try {
                        const data = JSON.parse(res.responseText);
                        showResult(btn, data.text);
                    } catch (e) {
                        showError(btn, "Error al procesar JSON");
                    }
                } else {
                    let detailMsg = `HTTP ${res.status}`;
                    try {
                        const errJson = JSON.parse(res.responseText);
                        if (errJson.error && errJson.error.message) {
                            detailMsg = errJson.error.message;
                        }
                    } catch (e) {}
                    showError(btn, `Groq ${res.status}: ${detailMsg}`);
                }
            },
            onerror: function (err) {
                log("Error de red:", err);
                showError(btn, "Error de Red/CORS");
            }
        });
    }

    function showResult(btn, text) {
        const container = btn.closest('div[class*="message-in"], div[class*="message-out"]') || btn.parentElement;
        let box = container.querySelector('.transcript-tool-box');
        if (!box) {
            box = document.createElement('div');
            box.className = 'transcript-tool-box';
            container.appendChild(box);
        }
        box.style.cssText = `
            background: rgba(104, 29, 168, 0.1);
            border-left: 3px solid #681da8;
            padding: 6px 10px;
            margin-top: 6px;
            border-radius: 4px;
            font-size: 12px;
            color: inherit;
            word-break: break-word;
        `;
        box.innerHTML = `<strong>Transcripción:</strong><br>${text}`;
        btn.innerText = '📝 Transcribir';
        btn.disabled = false;
    }

    function showError(btn, msg) {
        const container = btn.closest('div[class*="message-in"], div[class*="message-out"]') || btn.parentElement;
        let box = container.querySelector('.transcript-tool-box');
        if (!box) {
            box = document.createElement('div');
            box.className = 'transcript-tool-box';
            container.appendChild(box);
        }
        box.style.cssText = `
            background: rgba(220, 38, 38, 0.1);
            border-left: 3px solid #dc2626;
            padding: 6px 10px;
            margin-top: 6px;
            border-radius: 4px;
            font-size: 11px;
            color: #dc2626;
            word-break: break-word;
        `;
        box.innerHTML = `<strong>Error:</strong> ${msg}`;
        btn.innerText = '📝 Reintentar';
        btn.disabled = false;
    }

    function scanAndInject() {
        if (!document.body) return;
        const playButtons = document.querySelectorAll('button[aria-label*="Play"], button[aria-label*="Reproducir"], button[aria-label*="Reproduzir"], span[data-icon="audio-play"]');

        playButtons.forEach((el) => {
            const playBtn = el.tagName === 'BUTTON' ? el : el.closest('button') || el;
            const msgRow = playBtn.closest('div[role="row"]') || playBtn.closest('div[data-testid="msg-container"]');
            if (!msgRow) return;

            const bubbleContainer = playBtn.closest('div[class*="message-in"], div[class*="message-out"]') || playBtn.parentElement?.parentElement;
            if (!bubbleContainer) return;

            if (bubbleContainer.querySelector('.transcribe-btn')) return;

            const btn = document.createElement('button');
            btn.className = 'transcribe-btn';
            btn.innerText = '📝 Transcribir';
            btn.style.cssText = `
                background-color: #681da8;
                color: white;
                border: none;
                padding: 4px 10px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 11px;
                font-weight: bold;
                margin-top: 6px;
                margin-bottom: 4px;
                display: block;
                z-index: 999;
                clear: both;
            `;

            btn.onclick = async (e) => {
                e.stopPropagation();
                e.preventDefault();
                btn.innerText = '⏳ Buscando...';
                btn.disabled = true;

                const blob = await getAudioBlob(playBtn);
                if (!blob) {
                    showError(btn, "No se pudo interceptar el audio. Recarga la página (F5) e intenta de nuevo.");
                    return;
                }
                sendToGroq(blob, btn);
            };

            bubbleContainer.appendChild(btn);
        });
    }

    function initObserver() {
        if (!document.body) {
            requestAnimationFrame(initObserver);
            return;
        }
        const observer = new MutationObserver(() => scanAndInject());
        observer.observe(document.body, { childList: true, subtree: true });
        setInterval(scanAndInject, 2000);
        log("Transcript-tool v29 listo.");
    }

    initObserver();
})();
