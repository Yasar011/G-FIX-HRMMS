"use client";

/**
 * Y-BOT's face: a friendly robot head rendered as inline SVG.
 * - Idle: eyes blink on a loop, antenna tip pulses.
 * - thinking: eyes squint (looking up) and antenna pulses faster.
 * - speaking: mouth bars bob up and down like a soundwave.
 */
export function YBotAvatar({
  size = 40,
  state = "idle",
}: {
  size?: number;
  state?: "idle" | "thinking" | "speaking";
}) {
  const eyeStyle =
    state === "idle"
      ? { animation: "ybot-blink 4.2s infinite", transformOrigin: "center" }
      : undefined;
  const antennaStyle = {
    animation: `ybot-antenna ${state === "thinking" ? "0.7s" : "1.8s"} ease-in-out infinite`,
    transformOrigin: "center",
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Y-BOT"
    >
      <defs>
        <linearGradient id="ybot-face" x1="10" y1="8" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a78bfa" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <radialGradient id="ybot-eye" cx="0.5" cy="0.4" r="0.7">
          <stop stopColor="#f0abfc" />
          <stop offset="1" stopColor="#e879f9" />
        </radialGradient>
      </defs>

      {/* antenna */}
      <line x1="24" y1="6" x2="24" y2="12" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="5" r="2.6" fill="#22d3ee" style={antennaStyle} />

      {/* head */}
      <rect x="8" y="12" width="32" height="28" rx="10" fill="url(#ybot-face)" />
      <rect
        x="8"
        y="12"
        width="32"
        height="28"
        rx="10"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.25"
        strokeWidth="1"
      />

      {/* ears */}
      <rect x="4.5" y="21" width="3.5" height="10" rx="1.75" fill="#7c3aed" />
      <rect x="40" y="21" width="3.5" height="10" rx="1.75" fill="#7c3aed" />

      {/* screen inset */}
      <rect x="12.5" y="17" width="23" height="18" rx="7" fill="#1e1b3a" />

      {/* eyes */}
      <g style={eyeStyle}>
        <circle cx="19" cy="24.5" r="3" fill="url(#ybot-eye)" />
        <circle cx="29" cy="24.5" r="3" fill="url(#ybot-eye)" />
        <circle cx="20" cy="23.6" r="0.9" fill="#ffffff" />
        <circle cx="30" cy="23.6" r="0.9" fill="#ffffff" />
      </g>

      {/* mouth */}
      {state === "speaking" ? (
        <g fill="#22d3ee">
          <rect x="18" y="29" width="2" height="4" rx="1" style={{ animation: "ybot-wave 0.5s ease-in-out infinite" }} />
          <rect x="22" y="28" width="2" height="6" rx="1" style={{ animation: "ybot-wave 0.5s ease-in-out infinite 0.1s" }} />
          <rect x="26" y="29" width="2" height="4" rx="1" style={{ animation: "ybot-wave 0.5s ease-in-out infinite 0.2s" }} />
          <rect x="30" y="30" width="2" height="2.5" rx="1" style={{ animation: "ybot-wave 0.5s ease-in-out infinite 0.15s" }} />
        </g>
      ) : (
        <rect x="19" y="30" width="10" height="2" rx="1" fill="#22d3ee" opacity="0.85" />
      )}
    </svg>
  );
}
