import VideoGenerator from "@/components/VideoGenerator";

export default function Page() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-14">
        <header className="space-y-3 text-center md:text-left">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Image to Video Generator
          </h1>
          <p className="text-base text-slate-300 md:text-lg">
            Upload a still image and generate a smooth MP4 clip directly in
            your browser. Powered by FFmpeg WebAssembly—no uploads required.
          </p>
        </header>
        <VideoGenerator />
      </div>
    </main>
  );
}
