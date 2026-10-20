import Logo, { Wordmark } from './Logo'
import { LANDING, longDate } from '../data/landing'

interface Props {
  /** "Try DiaBite" and "Sign in": the parent shows the sign-in screen. */
  onEnter: () => void
}

const EMERGENCY =
  'If you have symptoms such as chest pain, confusion, vomiting or fainting, call emergency services. DiaBite does not give insulin or medication doses.'

const num = (n: number) => n.toFixed(1)
const shortDate = (iso: string) => longDate(iso).toUpperCase().replace(/(\d+) (\w{3})\w* (\d{4})/, '$1 $2 $3')

/**
 * What a signed-out visitor sees first (docs/specs/landing-screen.md): the concept of "the tape". The page is the
 * receipt the product prints: the question, the foods, the load, what is left. Static: it reads LANDING and writes
 * nothing, asks the network for nothing but its own clip, and sets no cookie. The receipt is a real answer of the
 * app, kept true by `npm run eval`; no number on this page comes from a model.
 */
export default function Landing({ onEnter }: Props) {
  const L = LANDING
  return (
    <div className="landing">
      <a className="skip" href="#landing-main">Skip to the page</a>
      <p className="lp-emergency" role="note">{EMERGENCY}</p>

      <header className="lp-in lp-top">
        <Logo />
        <Wordmark as="span" />
        <button className="lp-signin" type="button" onClick={onEnter}>Sign in</button>
      </header>

      <main id="landing-main">
        <section className="lp-in lp-hero" aria-labelledby="landing-h1">
          <div className="lp-hero-text">
            <p className="lp-label">For adults in the US with type 2 diabetes, prediabetes or insulin resistance</p>
            <h1 id="landing-h1" className="lp-title">Can I <span className="lp-mark">eat</span> this?</h1>
            <p className="lp-lede">Describe a meal in your own words. DiaBite prints the receipt: whether it fits what is left of your day, and every step of the arithmetic.</p>
            <div className="lp-cta-row">
              <button className="lp-key" type="button" onClick={onEnter}>Try DiaBite</button>
              <span className="lp-small">Free to try. You sign in with your email; there is no password.</span>
            </div>
            <p className="lp-small">Being prepared for its first user sessions. Some things will be wrong.</p>
          </div>

          <div className="lp-tape-wrap">
            <div className="lp-tape" aria-label="A real receipt">
              <div className="lp-tape-head"><span>DIABITE · THE CHECK</span><span>{shortDate(L.receiptAsOf)}</span></div>
              <p className="lp-question">“{L.question}”</p>
              <div className="lp-rule" />
              <div role="table" aria-label="Foods in the meal, with grams, available carbohydrate, glycemic index and load">
                {L.rows.map((r) => (
                  <div className="lp-row" role="row" key={r.foodId}>
                    <span role="cell">{r.name} <em>{r.grams} g</em></span>
                    <span className="lp-dots" aria-hidden="true" />
                    <span role="cell" aria-label={`available carbohydrate ${num(r.availableCarbs)} grams, glycemic index ${r.gi ?? 'not available'}, load ${num(r.gl)}`}>{num(r.gl)}</span>
                  </div>
                ))}
              </div>
              <div className="lp-rule" />
              <div className="lp-row lp-strong"><span>MEAL LOAD</span><span className="lp-dots" aria-hidden="true" /><span>{num(L.totalGl)}</span></div>
              <div className="lp-row"><span>DAY BUDGET</span><span className="lp-dots" aria-hidden="true" /><span>{L.budgetGl}</span></div>
              <div className="lp-left">
                <div>
                  <div className="lp-label-dark">LEFT AFTER</div>
                  <div className="lp-big"><span>{num(L.leftAfterGl)}</span></div>
                </div>
                <div className="lp-stamp">FITS<small>THIS FITS YOUR DAY</small></div>
              </div>
              <p className="lp-foot">Weights for the eggs and the avocado were the defaults because none were given, and the answer says so.</p>
            </div>
          </div>
        </section>

        <section className="lp-clip-band" aria-labelledby="landing-clip">
          <div className="lp-in">
            <h2 id="landing-clip">One minute, start to finish</h2>
            <video className="lp-video" controls preload="none" playsInline poster="/clip-poster.jpg"
                   aria-label="One-minute recording of DiaBite" width={1280} height={720}>
              <source src="/clip-how-it-works.mp4" type="video/mp4" />
              <track kind="captions" src="/clip-how-it-works.vtt" srcLang="en" label="English" default />
              Your browser cannot play this clip. The transcript is below.
            </video>
            <details className="lp-transcript">
              <summary>Read the transcript</summary>
              {L.transcript.map((line) => <p key={line}>{line}</p>)}
            </details>
          </div>
        </section>

        <section className="lp-band" aria-labelledby="landing-how">
          <div className="lp-in">
            <h2 id="landing-how">How the tape gets printed</h2>
            <div className="lp-slips">
              <div className="lp-slip lp-tilt-a">
                <span className="lp-slip-k">01 · YOU SAY IT</span>
                <p className="lp-slip-h">The way you would say it to a friend.</p>
                <p>No scanning, no weighing, no forms. A model reads the sentence and works out which foods you meant.</p>
              </div>
              <div className="lp-slip lp-tilt-b">
                <span className="lp-slip-k">02 · THE ENGINE COUNTS</span>
                <p className="lp-slip-h">A database and a calculator do the sums.</p>
                <p>Every food is matched against a database of {L.records.toLocaleString('en-US')} records. The engine adds up carbohydrate, fibre, glycemic index and glycemic load.</p>
              </div>
              <div className="lp-slip lp-tilt-c">
                <span className="lp-slip-k">03 · THE DAY ANSWERS</span>
                <p className="lp-slip-h">Fits, or does not, against what is left.</p>
                <p>The receipt shows each number. If DiaBite does not have a food, it says so and counts the rest, never a different food under its name. A dish it lacks is estimated from typical ingredients and labelled as an estimate.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-in lp-promise" aria-labelledby="landing-promise">
          <h2 id="landing-promise">Every number is <span className="lp-mark">computed.</span> None is made up.</h2>
          <p>A check confirms that every number in an answer appears in what the engine returned, before you see it.</p>
        </section>

        <section className="lp-paper" aria-labelledby="landing-not">
          <div className="lp-in lp-paper-in">
            <div className="lp-paper-head">
              <span className="lp-mono-label">THE FINE PRINT</span>
              <h2 id="landing-not">What it is not</h2>
            </div>
            <ul>
              <li>Not medical advice. It is a reference tool.</li>
              <li>It never gives an insulin or medication dose, and a question about one gets a fixed refusal.</li>
              <li>No clinician has signed it off yet.</li>
              <li>A glycemic index is a published average for a food, not a measurement of your body.</li>
            </ul>
          </div>
        </section>

        <section className="lp-band lp-review" aria-labelledby="landing-review">
          <div className="lp-in">
            <h2 id="landing-review">For clinicians and reviewers</h2>
            <p>A router sends each question either to a meal agent that can call the engine's tools, or to an advisor that has no tools and states no numbers. The rules for doses, red flags, prolonged fasting and referral run before any model. Every decision the product makes about a person is written down for review.</p>
            <p>{L.checks.passed} of {L.checks.of} behavioural checks passed on the live agent on {longDate(L.checks.on)}.</p>
            <p className="lp-links">
              <a href={L.links.safetyCase} rel="noopener">The safety case</a>
              <a href={L.links.dataSources} rel="noopener">Where the food numbers come from</a>
            </p>
            <p>If something in them is wrong, I would like to know. <a href={L.links.mail}>Write to me</a>.</p>
          </div>
        </section>

        <section className="lp-last">
          <p>Print your first receipt.</p>
          <button className="lp-key lp-key-dark" type="button" onClick={onEnter}>Try DiaBite</button>
        </section>
      </main>

      <footer className="lp-in lp-footer">
        <p>Built by Nadia Babich, an AI product manager who wants to make our lives easier. <a href={L.links.linkedin} rel="noopener">LinkedIn</a> · <a href={L.links.mail}>Write to me</a></p>
        <p>What DiaBite keeps about you: your email address, your answers about yourself and your diary, stored in Ireland. You can export or delete them at any time.</p>
      </footer>
    </div>
  )
}
