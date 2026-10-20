import Logo, { Wordmark } from './Logo'
import { StatusDot } from './AskPage'
import { LANDING, longDate } from '../data/landing'

interface Props {
  /** "Try DiaBite" and "Sign in": the parent shows the sign-in screen. */
  onEnter: () => void
}

const EMERGENCY =
  'If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services. DiaBite does not give insulin or medication doses.'

const num = (n: number) => n.toFixed(1)

/**
 * What a signed-out visitor sees first (docs/specs/landing-screen.md). Static: it reads LANDING and writes nothing,
 * asks the network for nothing but its own clip, and sets no cookie. The receipt is a real answer of the engine,
 * kept true by `npm run eval`; no number on this page comes from a model.
 */
export default function Landing({ onEnter }: Props) {
  const L = LANDING
  return (
    <div className="app landing">
      <a className="skip" href="#landing-main">Skip to the page</a>
      <p className="signin-emergency landing-emergency" role="note">{EMERGENCY}</p>

      <header className="masthead">
        <Logo />
        <Wordmark as="span" />
        <button className="link landing-signin" type="button" onClick={onEnter}>Sign in</button>
      </header>

      <main id="landing-main">
        <section className="landing-hero" aria-labelledby="landing-h1">
          <p className="label">For adults in the US with type 2 diabetes, prediabetes or insulin resistance</p>
          <h1 id="landing-h1" className="landing-title">Can I eat this?</h1>
          <p className="landing-lede">Describe a meal in your own words. DiaBite says whether it fits what is left of your day, and shows the arithmetic.</p>
          <button className="primary landing-cta" type="button" onClick={onEnter}>Try DiaBite</button>
          <p className="muted">Free to try. You sign in with your email; there is no password.</p>
          <p className="muted">Being prepared for its first user sessions. Some things will be wrong.</p>
        </section>

        <section className="landing-section" aria-labelledby="landing-clip">
          <h2 id="landing-clip">One minute, start to finish</h2>
          <video className="landing-video" controls preload="none" playsInline poster="/clip-poster.jpg"
                 aria-label="One-minute recording of DiaBite" width={1280} height={720}>
            <source src="/clip-how-it-works.mp4" type="video/mp4" />
            <track kind="captions" src="/clip-how-it-works.vtt" srcLang="en" label="English" default />
            Your browser cannot play this clip. The transcript is below.
          </video>
          <details className="landing-transcript">
            <summary>Read the transcript</summary>
            {L.transcript.map((line) => <p key={line}>{line}</p>)}
          </details>
        </section>

        <section className="landing-section" aria-labelledby="landing-receipt">
          <h2 id="landing-receipt">A real answer, with the receipt</h2>
          <p className="muted landing-intro">
            Asked of the running service on {longDate(L.receiptAsOf)}, with a daily budget of {L.budgetGl} glycemic load.
            The numbers come from the database, the engine adds them up, and a check confirms every number in the answer
            appears in what the engine returned.
          </p>
          <div className="card answer tone-good landing-slip">
            <p className="landing-question">“{L.question}”</p>
            <div className="eyebrow-line"><StatusDot tone="good" />Fits</div>
            <div className="answer-text"><p className="a-verdict">{L.verdict}</p></div>
            <div className="figures">
              <div className="fig"><span className="fig-k">this meal</span><span className="fig-v">{num(L.totalGl)}</span></div>
              <div className="fig"><span className="fig-k">before</span><span className="fig-v">{L.budgetGl}</span></div>
              <div className="fig fig-lead ok"><span className="fig-k">left after</span><span className="fig-v">{num(L.leftAfterGl)}</span></div>
            </div>
            <div className="receipt" role="table" aria-label="Foods in the meal, with grams, available carbohydrate, glycemic index and load">
              <div className="receipt-head" role="row"><span role="columnheader">food · portion</span><span role="columnheader">avail carbs · GI · GL</span></div>
              {L.rows.map((r) => (
                <div className="receipt-line" role="row" key={r.foodId}>
                  <span role="cell">{r.name} <em>{r.grams} g</em></span>
                  <span role="cell" aria-label={`available carbohydrate ${num(r.availableCarbs)} grams, glycemic index ${r.gi ?? 'not available'}, load ${num(r.gl)}`}>
                    {num(r.availableCarbs)} · {r.gi ?? '—'} · <b>{num(r.gl)}</b>
                  </span>
                </div>
              ))}
              <div className="receipt-total" role="row"><span role="cell">Meal glycemic load</span><span role="cell">{num(L.totalGl)}</span></div>
            </div>
            <p className="receipt-foot">
              Weights for the eggs and the avocado were the defaults because none were given, and the answer says so.
              A dash means the database holds no glycemic index for that food.
            </p>
          </div>
        </section>

        <section className="landing-section landing-prose" aria-labelledby="landing-promise">
          <h2 id="landing-promise">Every number is computed, never made up</h2>
          <p><strong>A model reads the sentence.</strong> It never does the sums.</p>
          <p><strong>A database and a calculator do.</strong> Every food is matched against a database of {L.records.toLocaleString('en-US')} records, and the engine adds up carbohydrate, fibre, glycemic index and glycemic load.</p>
          <p><strong>Every number is checked</strong> against the calculation before you see it.</p>
          <p>When DiaBite does not have a food, it says so and counts the rest. It never counts a different food under its name. A dish it lacks is estimated from typical ingredients and labelled as an estimate.</p>
        </section>

        <section className="landing-section landing-prose" aria-labelledby="landing-not">
          <h2 id="landing-not">What it is not</h2>
          <ul>
            <li>Not medical advice. It is a reference tool.</li>
            <li>It never gives an insulin or medication dose, and a question about one gets a fixed refusal.</li>
            <li>No clinician has signed it off yet.</li>
            <li>A glycemic index is a published average for a food, not a measurement of your body.</li>
          </ul>
        </section>

        <section className="landing-section landing-prose" aria-labelledby="landing-who">
          <h2 id="landing-who">Built by Nadia Babich</h2>
          <p>I live with insulin resistance and PCOS, and I got tired of doing the arithmetic at every meal. I work in AI, so I built the tool I wanted.</p>
          <p className="landing-links">
            <a href={L.links.linkedin} rel="noopener">LinkedIn</a>
            <a href={L.links.mail}>Write to me</a>
          </p>
        </section>

        <section className="landing-section landing-prose" aria-labelledby="landing-review">
          <h2 id="landing-review">For clinicians and reviewers</h2>
          <p>A router sends each question either to a meal agent that can call the engine's tools, or to an advisor that has no tools and states no numbers. The rules for doses, red flags, prolonged fasting and referral run before any model. Every decision the product makes about a person is written down for review.</p>
          <p>{L.checks.passed} of {L.checks.of} behavioural checks passed on the live agent on {longDate(L.checks.on)}.</p>
          <p className="landing-links">
            <a href={L.links.safetyCase} rel="noopener">The safety case</a>
            <a href={L.links.dataSources} rel="noopener">Where the food numbers come from</a>
          </p>
          <p>If something in them is wrong, I would like to know. <a href={L.links.mail}>Write to me</a>.</p>
        </section>
      </main>

      <footer className="landing-footer">
        <button className="primary landing-cta" type="button" onClick={onEnter}>Try DiaBite</button>
        <p className="muted">What DiaBite keeps about you: your email address, your answers about yourself and your diary, stored in Ireland. You can export or delete them at any time.</p>
      </footer>
    </div>
  )
}
