"use client";

import { useEffect, useRef } from "react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";

type AgentState = "idle" | "listening" | "thinking" | "speaking";

interface AgentBlobProps {
  state: AgentState;
}

export default function AgentBlob({ state }: AgentBlobProps) {
  const { status } = useAudioRecorder();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);

  // Smoothing variables that persist across frames
  const currentHeightsRef = useRef([20, 20, 20]);
  const targetHeightsRef = useRef([20, 20, 20]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 200;
    canvas.height = 200;

    const setupMicrophoneAnalysis = async () => {
      try {
        console.log("[AgentBlob] Requesting microphone access...");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        });
        streamRef.current = stream;

        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        analyserRef.current = analyser;
        console.log("[AgentBlob] Microphone analyser setup complete");

      } catch (error) {
        console.error("[AgentBlob] Error accessing microphone:", error);
      }
    };

    const setupOutputAnalysis = async () => {
      try {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyser.connect(audioContext.destination);
        outputAnalyserRef.current = analyser;
        outputContextRef.current = audioContext;
      } catch (error) {
        console.error("Error setting up output analysis:", error);
      }
    };

    const smoothingFactor = 0.08; // Very smooth transitions

    const drawFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let normalizedLevel = 0;

      // Get audio level based on state
      if (analyserRef.current && (state === "listening" || status === "recording")) {
        try {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          // Use a broader range for better voice detection
          const voiceRange = dataArray.slice(5, 50);
          const average = voiceRange.reduce((sum, value) => sum + value, 0) / voiceRange.length;
          normalizedLevel = Math.min(average / 80, 1); // More sensitive

          // Boost the signal for better visibility
          if (normalizedLevel < 0.05) {
            normalizedLevel = 0.15 + Math.random() * 0.1; // Minimum visible movement
          } else {
            normalizedLevel = Math.max(0.3, normalizedLevel * 1.8); // Amplify voice
          }
        } catch (error) {
          console.error("[AgentBlob] Error reading microphone data:", error);
          normalizedLevel = 0.4 + Math.random() * 0.3;
        }
      } else if (state === "speaking") {
        // Much more visible animation for AI output - faster and larger movement
        normalizedLevel = 0.4 + Math.sin(Date.now() * 0.004) * 0.3 + Math.sin(Date.now() * 0.001) * 0.2;
      } else if (state === "thinking") {
        // Thinking state - moderate continuous animation
        normalizedLevel = 0.25 + Math.sin(Date.now() * 0.002) * 0.15 + Math.random() * 0.1;
      } else if (state === "listening") {
        normalizedLevel = 0.2 + Math.random() * 0.15;
      } else {
        // Idle state - much more visible continuous animation
        normalizedLevel = 0.25 + Math.sin(Date.now() * 0.002) * 0.2 + Math.random() * 0.1;
      }

      // Draw 3 bars
      const barWidth = 20;
      const barSpacing = 8;
      const maxHeight = 100; // Slightly taller for more visible movement
      const baseSize = 20;

      for (let i = 0; i < 3; i++) {
        // Calculate target height - always animate, never static
        if (state === "idle") {
          // Much more visible idle animation with breathing effect
          const idleVariation = 0.85 + Math.sin(Date.now() * 0.0015 + i * 1.8) * 0.4;
          targetHeightsRef.current[i] = Math.max(baseSize, baseSize * idleVariation);
        } else {
          // More pronounced variation for active states
          const variation = 0.6 + Math.sin(Date.now() * 0.001 + i * 0.8) * 0.35;
          targetHeightsRef.current[i] = Math.max(baseSize, normalizedLevel * maxHeight * variation);
        }

        // Very smooth transition to target height
        currentHeightsRef.current[i] += (targetHeightsRef.current[i] - currentHeightsRef.current[i]) * smoothingFactor;

        // Calculate position - center the bars vertically
        const x = (canvas.width - (3 * barWidth + 2 * barSpacing)) / 2 + i * (barWidth + barSpacing);
        const y = (canvas.height - currentHeightsRef.current[i]) / 2 + 10; // Center vertically with small offset

        // Set color based on state
        let color = '#ccc';
        if (state === "listening") color = '#2196F3';
        else if (state === "speaking") color = '#FF9800';
        else if (state === "thinking") color = '#9C27B0';

        // Draw rounded rectangle
        ctx.fillStyle = color;
        const radius = barWidth / 2;

        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, currentHeightsRef.current[i], radius);
        ctx.fill();

        // Very subtle glow for active states only
        if (state !== "idle") {
          ctx.shadowColor = color;
          ctx.shadowBlur = 3;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    const cleanup = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      analyserRef.current = null;
      outputAnalyserRef.current = null;
      if (outputContextRef.current) {
        outputContextRef.current.close();
        outputContextRef.current = null;
      }
    };

    // Start animation and setup based on state
    if (state === "listening" || status === "recording") {
      console.log("[AgentBlob] Starting canvas animation for state:", state);
      drawFrame();
      setupMicrophoneAnalysis();
    } else if (state === "speaking") {
      console.log("[AgentBlob] Starting output analysis for speaking state");
      drawFrame();
      setupOutputAnalysis();
    } else {
      // Always animate for idle and thinking states
      console.log("[AgentBlob] Starting idle animation for state:", state);
      drawFrame();
    }

    return cleanup;
  }, [state, status]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '200px',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          borderRadius: '8px',
        }}
      />
    </div>
  );
}