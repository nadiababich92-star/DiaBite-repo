import { GI_GL_WORDS } from '../lib/glWords'

/** "What are GI and GL?" as a folded card, for onboarding and You. The same words as the dialog on an answer. */
export default function GiGlExplainer() {
  return (
    <details className="recipe-more gi-gl">
      <summary>What are GI and GL?</summary>
      {GI_GL_WORDS.map((w) => <p key={w} className="muted">{w}</p>)}
    </details>
  )
}
