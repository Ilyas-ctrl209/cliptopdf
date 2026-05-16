export default function LogoMark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "logo-mark small" : "logo-mark"} aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img">
        <rect x="10" y="8" width="34" height="44" rx="8" className="logo-paper-back" />
        <rect x="18" y="14" width="36" height="44" rx="9" className="logo-paper-front" />
        <path d="M27 26h18M27 34h15M27 42h19" className="logo-lines" />
        <path d="M18 18l-7 7v22c0 4 3 7 7 7h5V18h-5z" className="logo-clip" />
      </svg>
    </span>
  );
}
