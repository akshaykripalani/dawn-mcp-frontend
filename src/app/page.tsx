"use client";

import AgentBlob from "@/components/agent-blob";
import { useEffect, useState, useRef } from "react";
import { transcribeAudio, fetchAndPlayTTS } from "@/lib/audioService";
import { useChat } from "@ai-sdk/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";

type AgentState = "idle" | "listening" | "thinking" | "speaking";

export default function Home() {
	const [agentState, setAgentState] = useState<AgentState>("idle");
	const lastMessageRef = useRef<string | null>(null);

	const chatHelpers = useChat({
		api: "/api/chat" as any,
		onFinish: async (message: any) => {
			// Skip TTS for tool-control messages
			if (message.content?.startsWith("TOOL_CALL:") || message.content?.startsWith("TOOL_RESULT:")) {
				return;
			}
			setAgentState("speaking");
			await fetchAndPlayTTS(message.content || "");
			setAgentState("idle");
		},
		onError: (error: any) => {
			toast.error(`AI Error: ${error.message}`);
			setAgentState("idle");
		},
	} as any);
	
	const { messages, append, isLoading } = chatHelpers as any;

	useEffect(() => {
		const lastMessage = messages[messages.length - 1] as any;
		if (!lastMessage || isLoading) return;
		if (lastMessage.content === lastMessageRef.current) return;
		lastMessageRef.current = lastMessage.content;

		if (lastMessage.role === "assistant" && lastMessage.content?.startsWith("TOOL_CALL:")) {
			try {
				const payload = JSON.parse(lastMessage.content.replace("TOOL_CALL:", ""));
				setAgentState("thinking");
				fetch("/api/execute-mcp-tool", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				})
					.then(async (res) => {
						if (!res.ok) {
							const text = await res.text();
							throw new Error(text || `HTTP ${res.status}`);
						}
						const data = await res.json();
						if (data.status === "ok") {
							toast.success("Tool operation successful");
							// Send TOOL_RESULT back to the model to continue conversation
							append({ role: "user", content: `TOOL_RESULT:${JSON.stringify(data)}` } as any);
						} else {
							toast.error(data.message || "Tool operation failed");
						}
					})
					.catch((err) => {
						toast.error(`Tool error: ${err.message}`);
					})
					.finally(() => {
						setAgentState("idle");
					});
			} catch (e) {
				toast.error("Invalid tool payload");
			}
		}
	}, [messages, isLoading, append]);

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
				if (text) append({ role: "user", content: text });
				else setAgentState("idle");
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
						size="lg"
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
