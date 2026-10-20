/**
 * The mark: a stamp. A ring with a bite out of its top-right corner and a tick in the marker colour, the
 * way the product stamps FITS on a receipt. At 16px it is still a ring and a tick.
 * Colours come from tokens, so it follows Tape and Paper (docs/design.md).
 */
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="DiaBite">
      <defs>
        <mask id="logo-bite">
          <rect width="64" height="64" fill="#fff" />
          <circle cx="53" cy="11" r="12" fill="#000" />
        </mask>
      </defs>
      <circle className="logo-ring" cx="32" cy="32" r="24" fill="none" strokeWidth="6" mask="url(#logo-bite)" />
      <path className="logo-tick" d="M21 33l8 8 14-16" fill="none" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** "Dia" and a marker-highlighted "Bite", in the serif. */
export function Wordmark({ as = 'h1' }: { as?: 'h1' | 'span' } = {}) {
  // The landing page has its own h1, so there the wordmark is plain text with the same look.
  const Tag = as
  // As a span it sits beside the logo, which already says "DiaBite": hidden from a screen reader so the name is not read twice.
  return as === 'span'
    ? <span className="wordmark" aria-hidden="true">Dia<b>Bite</b></span>
    : <Tag className="wordmark" aria-label="DiaBite">Dia<b>Bite</b></Tag>
}
