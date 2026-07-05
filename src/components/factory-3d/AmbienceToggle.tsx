"use client";

import { useEffect, useRef, useState } from "react";

const AMBIENCE_SRC = "/audio/factory-ambience.mp3";

export function AmbienceToggle() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const audio = new Audio(AMBIENCE_SRC);
    audio.loop = true;
    audio.volume = 0.35;
    audio.addEventListener("error", () => setUnavailable(true));
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || unavailable) return;
    try {
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        await audio.play();
        setPlaying(true);
      }
    } catch {
      setUnavailable(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        unavailable
          ? "Add public/audio/factory-ambience.mp3 to enable sound"
          : playing
            ? "Mute factory ambience"
            : "Play factory ambience"
      }
      className="pointer-events-auto absolute top-6 right-6 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-amber-200 backdrop-blur transition hover:border-amber-400/60 hover:text-amber-100 disabled:opacity-40"
      disabled={unavailable}
    >
      {playing ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M4 9v6h4l5 5V4L8 9H4z" />
          <path d="M16.5 12c0-1.5-.8-2.8-2-3.4v6.9c1.2-.7 2-2 2-3.5z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
          <path d="M4 9v6h4l5 5V4L8 9H4z" />
          <path d="M18.5 8.5l-4 4m0-4l4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
