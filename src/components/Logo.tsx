/**
 * The mark: a receipt with a bite out of its corner and one highlighted line.
 * Below 24px only the slip and the highlight remain, so it still reads in a tab.
 * Colours come from tokens, so it follows Paper and Night (docs/design.md).
 */
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="DiaBite">
      <path className="logo-slip" d="M12 6H41A11 11 0 0 0 52 17V52L48 58L44 52L40 58L36 52L32 58L28 52L24 58L20 52L16 58L12 52Z" />
      <rect className="logo-hl" x="14" y="24" width="36" height="14" rx="3" />
    </svg>
  )
}

/** "Dia" and a marker-highlighted "Bite", in the serif. */
export function Wordmark() {
  return <h1 className="wordmark">Dia<b>Bite</b></h1>
}
