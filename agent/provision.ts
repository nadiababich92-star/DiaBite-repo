/**
 * Create the DiaBite agent in Foundry, or update it in place.
 *
 * The agent's definition — model, system prompt, the OpenAPI tool — lives in
 * this repository, not in the portal. Run this after changing the prompt or
 * the engine's spec so the two can never drift:
 *
 *   PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project> \
 *   PUBLIC_URL=https://<engine-fqdn> \
 *   ENGINE_CONNECTION_ID=<connection name> \
 *   npx tsx agent/provision.ts
 *
 * Authenticates as whoever is logged in to the Azure CLI.
 */
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { ensureKnowledgeBase, ensureMemoryStore, publishAgentVersion, systemPrompt, type Role } from '../server/agent'
import { openApiSpec } from '../server/openapi'

const spec = openApiSpec() as { servers: { url: string }[]; paths: Record<string, unknown> }

console.log('project   ', process.env.PROJECT_ENDPOINT || '(PROJECT_ENDPOINT not set)')

console.log('engine    ', spec.servers[0].url)
console.log('auth      ', process.env.ENGINE_CONNECTION_ID ? `connection "${process.env.ENGINE_CONNECTION_ID}"` : 'anonymous')
console.log('operations', Object.keys(spec.paths).length)
for (const role of ['triage', 'meal', 'advisor'] as Role[]) {
  console.log(`${role.padEnd(8)}`, String(systemPrompt(role).length).padStart(5), 'chars')
}

// The advisor's two extras, created once and reused: a knowledge base of our
// own documents, and a memory store holding food preferences and nothing else.
// fileURLToPath, not url.pathname: this repository lives in a directory whose
// name has a space in it, and pathname keeps it percent-encoded.
const KB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'kb')
const kbFiles = readdirSync(KB_DIR).filter((f) => f.endsWith('.md')).map((f) => join(KB_DIR, f))
const kbId = await ensureKnowledgeBase(kbFiles).catch((e: Error) => {
  console.log('knowledge base skipped:', e.message.slice(0, 120))
  return null
})
const memoryStore = await ensureMemoryStore().catch((e: Error) => {
  console.log('memory store skipped:', e.message.slice(0, 120))
  return undefined
})

const versions = await publishAgentVersion({ kbId: kbId ?? undefined, memoryStore })
console.log('\npublished:')
for (const [role, v] of Object.entries(versions)) console.log(`  ${role.padEnd(8)} version ${v}`)
