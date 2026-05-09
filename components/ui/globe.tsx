export default function Globe() {
  return (
    <svg
      viewBox="0 0 320 320"
      role="img"
      aria-label="Decorative globe"
      className="h-[320px] w-[320px] max-w-none"
    >
      <defs>
        <linearGradient id="globe-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#171717" />
          <stop offset="100%" stopColor="#525252" />
        </linearGradient>
      </defs>
      <circle cx="160" cy="160" r="118" fill="url(#globe-fill)" />
      <circle cx="160" cy="160" r="118" fill="none" stroke="#e5e7eb" strokeWidth="2" opacity="0.7" />
      <ellipse cx="160" cy="160" rx="118" ry="42" fill="none" stroke="#d4d4d8" strokeWidth="1.5" opacity="0.55" />
      <ellipse cx="160" cy="160" rx="118" ry="78" fill="none" stroke="#d4d4d8" strokeWidth="1.5" opacity="0.55" />
      <ellipse cx="160" cy="160" rx="74" ry="118" fill="none" stroke="#d4d4d8" strokeWidth="1.5" opacity="0.55" />
      <path d="M42 160h236" stroke="#d4d4d8" strokeWidth="1.5" opacity="0.55" />
      <path d="M52 120c30 18 66 28 108 28s78-10 108-28" fill="none" stroke="#d4d4d8" strokeWidth="1.5" opacity="0.55" />
      <path d="M52 200c30-18 66-28 108-28s78 10 108 28" fill="none" stroke="#d4d4d8" strokeWidth="1.5" opacity="0.55" />
      <circle cx="160" cy="160" r="8" fill="#fafafa" />
    </svg>
  );
}
