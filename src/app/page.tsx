"use client";

import AgentBlob from "@/components/agent-blob";
import { useEffect, useState } from "react";
import { transcribeAudio, fetchAndPlayTTS } from "@/lib/audioService";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";

type AgentState = "idle" | "listening" | "thinking" | "speaking";

// Define a type for our messages
type Message = {
	id: string;
	role: "user" | "assistant";
	content: string;
};

export default function Home() {
	const [agentState, setAgentState] = useState<AgentState>("idle");
	const [messages, setMessages] = useState<Message[]>([]);

	const sendMessage = async (text: string) => {
		const newUserMessage: Message = {
			id: `user-${Date.now()}`,
			role: "user",
			content: text,
		};
		setMessages((prev) => [...prev, newUserMessage]);
		setAgentState("thinking");

		try {
			const response = await fetch("/api/chat", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				// Send the whole conversation history
				body: JSON.stringify({ messages: [...messages, newUserMessage] }),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(errorText || `HTTP ${response.status}`);
			}

			const { text: assistantText, toolCalls } = await response.json();
			console.log("[page.tsx] Received from /api/chat:", assistantText); // DEBUG

			// Show a toast for each tool call
			if (toolCalls && toolCalls.length > 0) {
				for (const toolCall of toolCalls) {
					toast.success(`Using tool: ${toolCall.toolName}`);
				}
			}

			const newAssistantMessage: Message = {
				id: `assistant-${Date.now()}`,
				role: "assistant",
				content: assistantText,
			};
			setMessages((prev) => [...prev, newAssistantMessage]);

			// TTS will now be called for all non-empty responses.
			// The backend now handles the entire tool lifecycle.
			console.log("[page.tsx] Condition met. Calling fetchAndPlayTTS..."); // DEBUG
			setAgentState("speaking");
			await fetchAndPlayTTS(assistantText || "");
		} catch (error: any) {
			toast.error(`AI Error: ${error.message}`);
		} finally {
			setAgentState("idle");
		}
	};

	const recorder = useAudioRecorder();

	const handleRecordClick = async () => {
		if (recorder.status !== "recording") {
			await recorder.start();
			setAgentState("listening");
		} else {
			setAgentState("thinking");
			const blob = await recorder.stop();
			if (blob) {
				const text = await transcribeAudio(blob);
				if (text) {
					sendMessage(text);
				} else {
					setAgentState("idle");
				}
			}
		}
	};

	return (
		<div className="min-h-screen bg-gradient-warm text-[var(--dark-moss-green)] flex flex-col overflow-x-hidden">
			<main className="flex-1 flex items-center justify-center">
				<div className="flex flex-col items-center space-y-6 text-center">
					<h1 className="text-5xl font-bold mb-2">Dawn AI</h1>
					<p className="text-lg font-medium mb-10">
						Your intelligent voice assistant
					</p>
					<AgentBlob state={agentState} />
					<p className="text-xl font-semibold capitalize">
						{agentState === "idle" ? "Ready" : agentState}
					</p>
					<Button
						onClick={handleRecordClick}
						variant="default"
						style={{
							padding: '16px 32px',
							minHeight: '56px',
							border: 'none',
							borderRadius: '8px',
							fontSize: '16px',
							fontWeight: '500'
						}}
						disabled={agentState === "thinking" || agentState === "speaking"}
					>
						{recorder.status === "recording"
							? "⏹ Stop Recording"
							: agentState === "thinking" || agentState === "speaking"
							? "🤔 Processing..."
							: "🎤 Start Recording"}
					</Button>
				</div>
			</main>
		</div>
	);
}
