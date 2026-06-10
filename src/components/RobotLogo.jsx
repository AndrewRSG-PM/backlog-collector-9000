export default function RobotLogo({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Antenna left */}
      <line x1="22" y1="4" x2="22" y2="12" stroke="#dde6f5" strokeWidth="2.5" strokeLinecap="square" />
      <rect x="18" y="1" width="8" height="4" fill="#dde6f5" />

      {/* Antenna right */}
      <line x1="42" y1="4" x2="42" y2="12" stroke="#dde6f5" strokeWidth="2.5" strokeLinecap="square" />
      <rect x="38" y="1" width="8" height="4" fill="#dde6f5" />

      {/* Head */}
      <rect x="10" y="12" width="44" height="30" fill="#1a2336" stroke="#dde6f5" strokeWidth="2" />

      {/* Evil eyes — red slanted */}
      {/* Left eye */}
      <rect x="16" y="20" width="12" height="8" fill="#ff2222" />
      <polygon points="16,20 28,20 16,23" fill="#550000" />

      {/* Right eye */}
      <rect x="36" y="20" width="12" height="8" fill="#ff2222" />
      <polygon points="48,20 36,20 48,23" fill="#550000" />

      {/* Angry brow lines */}
      <line x1="16" y1="18" x2="28" y2="20" stroke="#dde6f5" strokeWidth="2.5" strokeLinecap="square" />
      <line x1="36" y1="20" x2="48" y2="18" stroke="#dde6f5" strokeWidth="2.5" strokeLinecap="square" />

      {/* Mouth — grimace */}
      <rect x="18" y="34" width="28" height="4" fill="#1a2336" stroke="#dde6f5" strokeWidth="1.5" />
      <line x1="24" y1="34" x2="24" y2="38" stroke="#dde6f5" strokeWidth="1.5" />
      <line x1="32" y1="34" x2="32" y2="38" stroke="#dde6f5" strokeWidth="1.5" />
      <line x1="40" y1="34" x2="40" y2="38" stroke="#dde6f5" strokeWidth="1.5" />

      {/* Neck */}
      <rect x="27" y="42" width="10" height="5" fill="#1a2336" stroke="#dde6f5" strokeWidth="2" />

      {/* Body */}
      <rect x="14" y="47" width="36" height="16" fill="#1a2336" stroke="#dde6f5" strokeWidth="2" />

      {/* Body detail — power indicator */}
      <circle cx="32" cy="55" r="4" fill="#ff2222" />
      <circle cx="32" cy="55" r="2" fill="#ff6666" />

      {/* Arms stubs */}
      <rect x="4" y="49" width="10" height="6" fill="#1a2336" stroke="#dde6f5" strokeWidth="2" />
      <rect x="50" y="49" width="10" height="6" fill="#1a2336" stroke="#dde6f5" strokeWidth="2" />
    </svg>
  )
}
