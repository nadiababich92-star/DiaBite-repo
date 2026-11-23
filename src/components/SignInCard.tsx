/**
 * The card a signed-out visitor sees where a signed-in person has a screen of their own (docs/specs/anon-screen.md, section 5):
 * one heading, one plain sentence, one primary key. Nothing of the real screen sits behind it. Built from the existing card
 * rule, so it adds no colour, size or font. Not on a screen yet: the gate that shows it comes with the anonymous mode.
 */
export function SignInCard({ title, body, line, className = 'signin-card', onSignIn }: {
  title: string
  body: string
  /** A quieter line under the body, such as when another free answer comes. */
  line?: string
  className?: string
  onSignIn: () => void
}) {
  return (
    <section className={`card ${className}`}>
      <h2>{title}</h2>
      <p className="muted">{body}</p>
      {line ? <p className="muted">{line}</p> : null}
      <button type="button" className="primary" onClick={onSignIn}>Sign in</button>
    </section>
  )
}
