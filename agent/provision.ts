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
import { publishAgentVersion, systemPrompt, type Role } from '../server/agent'
import { openApiSpec } from '../server/openapi'

const spec = openApiSpec() as { servers: { url: string }[]; paths: Record<string, unknown> }

console.log('project   ', process.env.PROJECT_ENDPOINT || '(PROJECT_ENDPOINT not set)')
console.log('model     ', process.env.MODEL_DEPLOYMENT_NAME ?? 'gpt-5-mini')
console.log('engine    ', spec.servers[0].url)
console.log('auth      ', process.env.ENGINE_CONNECTION_ID ? `connection "${process.env.ENGINE_CONNECTION_ID}"` : 'anonymous')
console.log('operations', Object.keys(spec.paths).length)
for (const role of ['triage', 'meal', 'advisor'] as Role[]) {
  console.log(`prompt ${role.padEnd(8)}`, systemPrompt(role).length, 'chars')
}

const versions = await publishAgentVersion()
console.log('\npublished:')
for (const [role, v] of Object.entries(versions)) console.log(`  ${role.padEnd(8)} version ${v}`)
