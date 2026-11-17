import { createContext, useContext } from 'react'

/**
 * Opens "What are GI and GL?". App provides it; a screen that is drawn without it (a test, a static render) shows no button
 * rather than one that does nothing.
 */
export const GlHelpContext = createContext<(() => void) | null>(null)

/**
 * The small footnote beside a mention of glycemic load or index: what it is and how to read it, one tap away. It is the same
 * dialog everywhere, so the words never differ between screens.
 */
export default function GlHelp({ label = 'What is GL?' }: { label?: string }) {
  const open = useContext(GlHelpContext)
  if (!open) return null
  return <button type="button" className="link gl-help" aria-haspopup="dialog" onClick={open}>{label}</button>
}
