/**
 * How to put DiaBite on the home screen of a phone or computer. A folded card inside Help in Settings (moved from Profile on
 * 23 November 2026, docs/engineering/navigation.md): it is about the app, not about the person. The words are unchanged.
 */
export function HomeScreenCard() {
  return (
    <details className="recipe-more">
      <summary>Put DiaBite on your home screen</summary>
      <p className="muted" style={{ marginTop: 0 }}>It then opens like an app, with no address to type.</p>
      <h3>iPhone or iPad</h3>
      <ol className="recipe-steps">
        <li>Open diabite.pro in Safari.</li>
        <li>Tap the Share button, the square with an arrow.</li>
        <li>Choose Add to Home Screen, then Add.</li>
      </ol>
      <h3>Android</h3>
      <ol className="recipe-steps">
        <li>Open diabite.pro in Chrome.</li>
        <li>Tap the menu, the three dots at the top right.</li>
        <li>Choose Add to Home screen (or Install app), then confirm.</li>
      </ol>
      <h3>Computer</h3>
      <ol className="recipe-steps">
        <li>In Chrome or Edge, look for the install icon at the right end of the address bar.</li>
        <li>Click it, then Install.</li>
      </ol>
    </details>
  )
}
