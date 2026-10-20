# WhatsApp Web Audio Transcriber (via Groq Whisper) 🎙️📝

A Tampermonkey userscript that integrates seamlessly into WhatsApp Web, allowing you to transcribe voice notes accurately and blazingly fast using the [Groq API](https://console.groq.com/) and the Whisper-large-v3 model.

## ✨ Features
- **Native UI Integration:** Adds a clean "Transcribe" button directly under WhatsApp Web voice notes.
- **Advanced Audio Interception:** Bypasses WhatsApp's hidden audio players by dynamically intercepting `Blob` URLs and memory objects to guarantee the audio is always captured.
- **High Accuracy:** Tuned with a specific context prompt, `0.0` temperature, and fixed language parameters to eliminate AI hallucinations and guarantee perfect punctuation.
- **Lightning Fast:** Powered by Groq's LPU inference engine for near-instant transcription.

## 🚀 Installation

1. **Install a Userscript Manager:** Install [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey) for your web browser.
2. **Get a Groq API Key:**
   - Go to [Groq Cloud](https://console.groq.com/keys) and create a free account.
   - Generate a new API Key.
3. **Add the Script:**
   - Open the Tampermonkey dashboard and click **"Create a new script"**.
   - Copy the entire code from the userscript file and paste it into the editor.
   - **Important:** Locate the line `const GROQ_API_KEY = "TU_API_KEY_AQUI";` and replace `"TU_API_KEY_AQUI"` with your actual Groq API key.
   - Save the script (`Ctrl+S` / `Cmd+S`).
4. **Reload WhatsApp Web:** Refresh your WhatsApp Web tab (`F5`).

## 💡 Usage

1. Open any chat in WhatsApp Web containing a voice note.
2. You will see a purple **"📝 Transcribir"** (Transcribe) button right under the audio player.
3. Click the button. The script will intercept the audio file and send it to Groq.
4. Within seconds, the exact transcription will appear in a customized, neat box inside the chat bubble.

## ⚠️ Privacy & Security
- **Local Execution:** This script runs entirely locally in your browser.
- **Data Processing:** The audio blobs are sent directly to the official Groq API for transcription. No middleman servers are involved. 
- **Keep your Key Safe:** Never share your userscript file with others if it contains your active API key, and never commit your key to public GitHub repositories.
