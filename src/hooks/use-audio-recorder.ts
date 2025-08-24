"use client";

import { useCallback, useRef, useState } from "react";

export type RecorderStatus = "idle" | "recording" | "stopped";

export function useAudioRecorder() {
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<BlobPart[]>([]);
	const [status, setStatus] = useState<RecorderStatus>("idle");

	function selectPreferredAudioMimeType(): string | undefined {
		const candidates = [
			"audio/ogg;codecs=opus",
			"audio/webm;codecs=opus",
			"audio/webm",
		];
		for (const mime of candidates) {
			if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
				return mime;
			}
		}
		return undefined;
	}

	const start = useCallback(async () => {
		if (status === "recording") return;
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		chunksRef.current = [];
		const preferred = selectPreferredAudioMimeType();
		const mr = preferred ? new MediaRecorder(stream, { mimeType: preferred }) : new MediaRecorder(stream);
		mediaRecorderRef.current = mr;
		mr.ondataavailable = (e) => {
			if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
		};
		mr.start();
		setStatus("recording");
	}, [status]);

	const stop = useCallback(async (): Promise<Blob | null> => {
		return new Promise((resolve) => {
			const mr = mediaRecorderRef.current;
			if (!mr) return resolve(null);
			mr.onstop = () => {
				const mimeType = (mr as any).mimeType || "audio/webm";
				const blob = new Blob(chunksRef.current, { type: mimeType });
				// Stop tracks
				mr.stream.getTracks().forEach((t) => t.stop());
				setStatus("stopped");
				resolve(blob);
			};
			mr.stop();
		});
	}, []);

	const getMimeType = () => {
		const mr = mediaRecorderRef.current as any;
		return mr?.mimeType as string | undefined;
	};

	return { status, start, stop, getMimeType };
}
