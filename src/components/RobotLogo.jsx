export default function RobotLogo({ size = 40 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Antenna */}
      <line x1="32" y1="6" x2="32" y2="13" stroke="#93a2c2" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="32" cy="5" r="3.5" fill="#38bdf8" />
      <circle cx="32" cy="5" r="1.5" fill="#bae6fd" />

      {/* Head — rounded */}
      <rect x="11" y="13" width="42" height="30" rx="10" fill="#1d2740" stroke="#93a2c2" strokeWidth="2.5" />

      {/* Eyes — big friendly */}
      <circle cx="23" cy="26" r="5.5" fill="#38bdf8" />
      <circle cx="41" cy="26" r="5.5" fill="#38bdf8" />
      {/* Eye sparkles */}
      <circle cx="24.8" cy="24.2" r="1.8" fill="#e0f2fe" />
      <circle cx="42.8" cy="24.2" r="1.8" fill="#e0f2fe" />

      {/* Smile */}
      <path d="M 24 34 Q 32 39.5 40 34" stroke="#93a2c2" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Ears */}
      <rect x="6" y="23" width="5" height="9" rx="2.5" fill="#1d2740" stroke="#93a2c2" strokeWidth="2" />
      <rect x="53" y="23" width="5" height="9" rx="2.5" fill="#1d2740" stroke="#93a2c2" strokeWidth="2" />

      {/* Neck */}
      <rect x="28" y="43" width="8" height="4" fill="#1d2740" stroke="#93a2c2" strokeWidth="2" />

      {/* Body — rounded */}
      <rect x="15" y="47" width="34" height="15" rx="6" fill="#1d2740" stroke="#93a2c2" strokeWidth="2.5" />

      {/* Body detail — friendly power light */}
      <circle cx="32" cy="54.5" r="3.5" fill="#34d399" />
      <circle cx="32" cy="54.5" r="1.5" fill="#a7f3d0" />
    </svg>
  )
}
