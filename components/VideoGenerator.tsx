"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

type GenerationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "processing" }
  | { status: "error"; message: string };

const CORE_VERSION = "0.12.9";
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

const useFFmpeg = () => {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [state, setState] = useState<GenerationState>({ status: "idle" });

  const load = useCallback(async () => {
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }

    if (ffmpegRef.current.loaded) {
      return ffmpegRef.current;
    }

    setState({ status: "loading" });
    const ffmpegInstance = ffmpegRef.current;

    try {
      await ffmpegInstance.load({
        coreURL: `${CORE_BASE_URL}/ffmpeg-core.js`,
        wasmURL: `${CORE_BASE_URL}/ffmpeg-core.wasm`,
        workerURL: `${CORE_BASE_URL}/ffmpeg-core.worker.js`
      });
      setState({ status: "idle" });
      return ffmpegInstance;
    } catch (error) {
      console.error(error);
      setState({
        status: "error",
        message: "Failed to load FFmpeg. Please refresh and try again."
      });
      throw error;
    }
  }, []);

  return {
    state,
    ffmpegRef,
    load
  };
};

export default function VideoGenerator() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(5);
  const [fps, setFps] = useState(30);
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const { load, state: ffmpegState, ffmpegRef } = useFFmpeg();

  useEffect(() => {
    const prepare = async () => {
      try {
        await load();
      } catch {
        // Error state handled in hook.
      }
    };
    prepare();
  }, [load]);

  useEffect(
    () => () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    },
    [imagePreview]
  );

  useEffect(
    () => () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    },
    [videoUrl]
  );

  const ready =
    ffmpegState.status !== "error" && (ffmpegRef.current?.loaded ?? false);

  const handleImageSelection = useCallback((file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setState({
        status: "error",
        message: "Unsupported file. Please select an image."
      });
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(previewUrl);
    setState({ status: "idle" });
  }, [imagePreview]);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      handleImageSelection(file);
    },
    [handleImageSelection]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0] ?? null;
      handleImageSelection(file);
    },
    [handleImageSelection]
  );

  const resetVideo = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
  }, [videoUrl]);

  const generateVideo = useCallback(async () => {
    if (!imageFile) {
      setState({
        status: "error",
        message: "Please choose an image before generating."
      });
      return;
    }

    try {
      setState({ status: "processing" });
      resetVideo();
      const ffmpegInstance = await load();

      if (!ffmpegInstance) {
        throw new Error("FFmpeg failed to initialize.");
      }

      const inputName = `input${Date.now()}.png`;
      const outputName = `output${Date.now()}.mp4`;

      await ffmpegInstance.writeFile(
        inputName,
        await fetchFile(imageFile)
      );

      await ffmpegInstance.exec([
        "-loop",
        "1",
        "-i",
        inputName,
        "-c:v",
        "libx264",
        "-t",
        duration.toString(),
        "-vf",
        `fps=${fps},fade=t=in:st=0:d=0.5,fade=t=out:st=${Math.max(
          duration - 0.5,
          0
        )}:d=0.5,format=yuv420p`,
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputName
      ]);

      const fileData = await ffmpegInstance.readFile(outputName);
      await ffmpegInstance.deleteFile(inputName);
      await ffmpegInstance.deleteFile(outputName);

      const binaryData =
        fileData instanceof Uint8Array
          ? fileData
          : new TextEncoder().encode(fileData);
      const blob = new Blob([binaryData], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setState({ status: "idle" });
    } catch (error) {
      console.error(error);
      setState({
        status: "error",
        message:
          "Something went wrong while generating the video. Please try again."
      });
    }
  }, [duration, fps, imageFile, load, resetVideo]);

  const isProcessing = state.status === "processing";

  const statusMessage =
    state.status === "error"
      ? state.message
      : state.status === "processing"
        ? "Generating video with FFmpeg…"
        : ffmpegState.status === "loading"
          ? "Loading FFmpeg core (runs locally in your browser)…"
          : !ready
            ? "Initializing FFmpeg…"
            : "";

  return (
    <section className="grid gap-8 md:grid-cols-[minmax(0,360px)_1fr] md:gap-10">
      <div className="flex flex-col gap-6">
        <label
          htmlFor="image-upload"
          className="group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-10 text-center transition hover:border-slate-500 hover:bg-slate-900"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800/80 text-3xl font-semibold">
            +
          </div>
          <div className="space-y-1">
            <p className="text-lg font-medium text-slate-100">
              Drop an image or browse
            </p>
            <p className="text-sm text-slate-400">
              PNG, JPG, or WebP up to 10MB
            </p>
          </div>
          <p className="text-xs text-slate-500">
            The conversion runs entirely on-device, nothing is uploaded.
          </p>
        </label>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Clip settings
          </h2>
          <div className="mt-4 space-y-5 text-sm text-slate-200">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="duration" className="text-slate-300">
                Duration (seconds)
              </label>
              <span className="font-mono text-base">{duration}s</span>
            </div>
            <input
              id="duration"
              type="range"
              min={2}
              max={12}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="w-full accent-sky-400"
              disabled={!ready || isProcessing}
            />

            <div className="flex items-center justify-between gap-4">
              <label htmlFor="fps" className="text-slate-300">
                Frames per second
              </label>
              <select
                id="fps"
                value={fps}
                onChange={(event) => setFps(Number(event.target.value))}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200"
                disabled={!ready || isProcessing}
              >
                {[24, 30, 60].map((value) => (
                  <option key={value} value={value}>
                    {value} fps
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={generateVideo}
          disabled={!ready || isProcessing}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {isProcessing ? "Generating…" : "Generate MP4"}
        </button>

        {statusMessage && (
          <p className="text-sm text-slate-400">{statusMessage}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Preview
        </h2>
        <div className="mt-4 aspect-square w-full overflow-hidden rounded-xl bg-slate-950/80">
          {videoUrl ? (
            <video
              key={videoUrl}
              src={videoUrl}
              controls
              autoPlay
              loop
              className="h-full w-full object-contain"
            />
          ) : imagePreview ? (
            <img
              src={imagePreview}
              alt="Selected preview"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-600">
              Your generated video will appear here.
            </div>
          )}
        </div>

        {videoUrl && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href={videoUrl}
              download="image-video.mp4"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            >
              Download MP4
            </a>
            <button
              type="button"
              onClick={() => {
                resetVideo();
                setState({ status: "idle" });
              }}
              className="rounded-lg border border-transparent px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-slate-200"
            >
              Clear video
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
