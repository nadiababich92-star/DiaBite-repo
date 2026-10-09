import { Component, type ReactNode } from 'react'

interface State { failed: boolean }

/**
 * One bad value must not blank the whole app. What is saved on this device stays
 * where it is; the person can reload, or deliberately clear it if the saved data
 * is what keeps breaking the page.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State { return { failed: true } }

  componentDidCatch(error: unknown) { console.error('DiaBite render error', error) }

  clearAndReload = () => {
    if (!window.confirm('This deletes the profile and diary saved on this device. Continue?')) return
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('diabite.')) localStorage.removeItem(k)
    } catch { /* storage unavailable: reloading is all that is left */ }
    window.location.reload()
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="app" role="alert">
        <section className="card">
          <h2>Something went wrong on this page.</h2>
          <p className="muted">Nothing was sent anywhere. Reloading usually fixes it.</p>
          <div className="row">
            <button className="primary" onClick={() => window.location.reload()}>Reload</button>
            <button className="link" onClick={this.clearAndReload}>Clear what is saved on this device</button>
          </div>
        </section>
      </div>
    )
  }
}
