import type { Profile } from '../types'
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from '../lib/profile'

type Body = Pick<Profile, 'units' | 'heightCm' | 'weightKg'>
type Set = <K extends 'units' | 'heightCm' | 'weightKg'>(key: K, value: Profile[K]) => void

/** The switch between feet and pounds and centimetres and kilograms. Storage stays metric; this is only what the screen shows. */
export function UnitsSwitch({ profile, set }: { profile: Pick<Profile, 'units'>; set: Set }) {
  const imperial = profile.units === 'imperial'
  return (
    <div className="row onb-units" role="group" aria-label="Units for height and weight">
      <span className="muted">Units</span>
      <button type="button" className={`ghost${imperial ? ' on' : ''}`} aria-pressed={imperial} onClick={() => set('units', 'imperial')}>ft / lb</button>
      <button type="button" className={`ghost${imperial ? '' : ' on'}`} aria-pressed={!imperial} onClick={() => set('units', 'metric')}>cm / kg</button>
    </div>
  )
}

/** Height and weight in the person's own units: feet and inches and pounds, or centimetres and kilograms. */
export function HeightWeight({ profile, set }: { profile: Body; set: Set }) {
  if (profile.units === 'imperial') {
    const { ft, in: inch } = cmToFtIn(profile.heightCm)
    return (
      <>
        <label className="field">
          <span>Height</span>
          <div className="row onb-height">
            <input type="number" inputMode="numeric" min={3} max={7} value={ft} aria-label="Feet"
              onChange={(e) => set('heightCm', ftInToCm(Number(e.target.value), inch))} />
            <span className="muted">ft</span>
            <input type="number" inputMode="numeric" min={0} max={11} value={inch} aria-label="Inches"
              onChange={(e) => set('heightCm', ftInToCm(ft, Number(e.target.value)))} />
            <span className="muted">in</span>
          </div>
        </label>
        <label className="field">
          <span>Weight, lb</span>
          <input type="number" inputMode="decimal" min={80} max={660} value={kgToLb(profile.weightKg)}
            onChange={(e) => set('weightKg', lbToKg(Number(e.target.value)))} />
        </label>
      </>
    )
  }
  return (
    <>
      <label className="field">
        <span>Height, cm</span>
        <input type="number" inputMode="decimal" min={120} max={220} value={profile.heightCm}
          onChange={(e) => set('heightCm', Number(e.target.value))} />
      </label>
      <label className="field">
        <span>Weight, kg</span>
        <input type="number" inputMode="decimal" min={35} max={250} step={0.5} value={profile.weightKg}
          onChange={(e) => set('weightKg', Number(e.target.value))} />
      </label>
    </>
  )
}
