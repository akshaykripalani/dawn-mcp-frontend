import toast from "react-hot-toast";

const STT_URL = "http://localhost:8000/speech/stt";
const TTS_URL = "http://localhost:8000/speech/tts";

/**
 * Sends an audio blob to the STT backend and returns the transcribed text.
 * @param audioBlob The audio data to transcribe.
 * @returns A promise that resolves to the transcribed text.
 */
export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  const formData = new FormData();
  // Determine file extension from mime type to match backend expectations
  const mime = audioBlob.type || "audio/webm";
  const ext = mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mp3") ? "mp3" : mime.includes("flac") ? "flac" : mime.includes("aiff") ? "aiff" : mime.includes("aac") ? "aac" : "webm";
  // Backend expects the field name 'audio'
  formData.append("audio", audioBlob, `recording.${ext}`);

  try {
    const response = await fetch(STT_URL, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`STT request failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Error transcribing audio:", error);
    toast.error("Failed to transcribe audio. Please try again.");
    return "";
  }
};

/**
 * Sends text to the TTS backend and plays the returned audio stream.
 * @param text The text to synthesize into speech.
 * @returns A promise that resolves when the audio has finished playing.
 */
export const fetchAndPlayTTS = (text: string): Promise<void> => {
  console.log("[audioService.ts] fetchAndPlayTTS called with text:", text); // DEBUG
  // Don't make a request for empty or whitespace-only strings
  if (!text.trim()) {
    console.log("[audioService.ts] Text is empty, skipping TTS request."); // DEBUG
    return Promise.resolve();
  }

  return new Promise(async (resolve, reject) => {
    try {
      console.log("[audioService.ts] Making fetch request to TTS_URL:", TTS_URL); // DEBUG
      const response = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`TTS request failed with status ${response.status}`);
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(await response.arrayBuffer());
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start(0);

      source.onended = () => {
        audioContext.close();
        resolve();
      };

    } catch (error) {
      console.error("Error with TTS:", error);
      toast.error("Failed to play agent's response.");
      reject(error);
    }
  });
};

