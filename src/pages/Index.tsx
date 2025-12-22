"use client";

import AudioTransposer from "@/components/AudioTransposer";
import { MadeWithDyad } from "@/components/made-with-dyad";

const Index = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            Transposer Studio
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Professional real-time pitch shifting for musicians and producers.
          </p>
        </header>

        <main>
          <AudioTransposer />
        </main>

        <footer className="pt-8">
          <div className="max-w-xl mx-auto p-4 bg-white dark:bg-slate-900 rounded-lg border text-sm text-slate-500 text-center">
            <h3 className="font-semibold mb-2">How it works</h3>
            <p>
              We use <strong>Tone.js</strong> and the <strong>Web Audio API</strong> to process your audio 
              using a specialized pitch-shifting algorithm. This allows you to transpose any file by up to 12 semitones 
              in either direction without changing the playback speed.
            </p>
          </div>
          <MadeWithDyad />
        </footer>
      </div>
    </div>
  );
};

export default Index;