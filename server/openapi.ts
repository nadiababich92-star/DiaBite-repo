/**
 * The OpenAPI 3.0 spec Foundry Agent Service reads to call the engine.
 *
 * Foundry's requirements (learn.microsoft.com/azure/foundry/agents/how-to/tools/openapi):
 * every operation needs an `operationId` of letters, `-` and `_` only, and the
 * request body must be application/json. The `description` fields are not
 * documentation — they are the prompt the model reads when deciding which tool
 * to call and what to put in it, so they carry the rules the n8n tool
 * descriptions used to carry.
 *
 * Served at GET /openapi.json so the spec can never drift from the service:
 * paste that URL into the portal, or download and upload it.
 */

const SERVER_URL = process.env.PUBLIC_URL ?? 'http://localhost:8787'


export function openApiSpec() {
  const spec: Record<string, unknown> = {
    openapi: '3.0.3',
    info: {
      title: 'DiaBite engine',
      version: '1.0.0',
      description:
        'The deterministic nutrition engine behind DiaBite. Every number the agent states about food — carbohydrate, glycemic load, calories, remaining budget — must come from one of these operations. The agent never calculates.',
    },
    servers: [{ url: SERVER_URL }],
    paths: {
      '/tools/resolve_foods': {
        post: {
          operationId: 'resolve_foods',
          summary: 'Look up foods in the verified database',
          description:
            'Resolve the food phrases from the user\'s message to database records. Always call this first, and pass every food from the message in one call. For each phrase you get back: `confidence` (high / medium / low), `unknown` (true means the food is not in the database — say so plainly and never substitute a similar food), an optional `clarify` question to ask when the match is ambiguous, and `candidates`. Use `candidates[0].id` as the `foodId` for the other operations, and `candidates[0].defaultPortion` with `candidates[0].unit` (g for ingredients, serving for recipes) when the user gave no portion.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['phrases'],
                  properties: {
                    phrases: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Short food phrases taken from the user message, for example ["oatmeal", "banana"].',
                    },
                    topK: { type: 'integer', description: 'Candidates per phrase. Default 5.' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Resolved phrases with candidates.' } },
        },
      },

      '/tools/compute_meal': {
        post: {
          operationId: 'compute_meal',
          summary: 'Compute the nutrition and glycemic load of a meal',
          description:
            'Compute calories, carbohydrate, fibre, available carbohydrate, glycemic index and glycemic load for a set of portions. This is the only source of numbers for a meal. Give `grams` for ingredients and `servings` for recipes, using the ids from resolve_foods.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['items'],
                  properties: {
                    items: {
                      type: 'array',
                      minItems: 1,
                      description: 'The portions eaten or considered.',
                      items: {
                        type: 'object',
                        required: ['foodId'],
                        properties: {
                          foodId: { type: 'string', description: 'Id from resolve_foods, for example "seed:oats".' },
                          grams: { type: 'number', description: 'Weight in grams. For ingredients.' },
                          servings: { type: 'number', description: 'Number of servings. For recipes.' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Per-item numbers and totals.' } },
        },
      },

      '/tools/get_day_state': {
        post: {
          operationId: 'get_day_state',
          summary: 'Get what is left of the daily budget',
          description:
            'Return what the user has already eaten today and how much of their daily budget is left (glycemic load, carbohydrate, calories). Call this before judging whether a meal fits. The only argument is the session id given to you in the conversation — the budget itself is held server-side, so never type budget numbers yourself.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['sessionId'],
                  properties: {
                    sessionId: {
                      type: 'string',
                      description: 'The session id provided in the conversation. Pass it through unchanged.',
                    },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Consumed totals, remaining budget and the day level.' } },
        },
      },

      '/tools/find_alternatives': {
        post: {
          operationId: 'find_alternatives',
          summary: 'Find lower-glycemic-load alternatives to a food',
          description:
            'Return alternatives whose glycemic load is at or under `maxGL`. Use it when a meal does not fit the remaining budget. Pass the `foodId` of the item with the largest glycemic load, its `grams` so alternatives are costed at the same weight, and the remaining glycemic load as `maxGL`.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['maxGL'],
                  properties: {
                    foodId: { type: 'string', description: 'The food being replaced. Use this or `query`.' },
                    query: { type: 'string', description: 'Free text describing what the user wants instead, when there is no specific food to replace.' },
                    maxGL: { type: 'number', description: 'Highest acceptable glycemic load — usually the remaining budget from get_day_state.' },
                    grams: { type: 'number', description: 'Portion of the food being replaced, so alternatives are compared at the same weight.' },
                    sameCategory: { type: 'boolean', description: 'Keep alternatives in the same food category. Usually true.' },
                    topK: { type: 'integer', description: 'How many to return. Default 3.' },
                  },
                },
              },
            },
          },
          responses: { '200': { description: 'Ranked alternatives with their glycemic load.' } },
        },
      },
    },
  }

  // Declared unconditionally, and on purpose. Foundry only attaches the key
  // from its project connection when the spec both defines the scheme and
  // requires it; making that conditional on this process holding the key is
  // how you ship a spec that silently gets 401s. An unprotected engine simply
  // ignores the header.
  spec.components = {
    securitySchemes: { apiKeyHeader: { type: 'apiKey', name: 'x-api-key', in: 'header' } },
  }
  spec.security = [{ apiKeyHeader: [] }]
  return spec
}
