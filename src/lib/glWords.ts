/**
 * What GI and GL are, in plain words. One copy, used by the dialog behind "What are GI and GL?" on the answer and by
 * the card in onboarding and in Profile, so the three never say different things. No figure appears in it: every number
 * the person sees comes from the engine, and a number in an explanation would be one nobody computed.
 */
export const GI_GL_WORDS = [
  'The glycemic index (GI) ranks a food that contains carbohydrate from 0 to 100 by how fast it raises blood sugar, compared with pure glucose.',
  'The glycemic load (GL) adds the portion: it is the GI times the grams of carbohydrate you eat, divided by 100. A small portion of a high-GI food can weigh less than a large portion of a lower-GI one.',
  'Counting carbohydrate looks at grams only. DiaBite shows both, in grams and as a load, and puts first the one you said you use. The verdict is worked out from the load.',
  'Neither number is a dose. DiaBite never tells you how much medicine to take.',
] as const

/** How to read a receipt. Words only: a figure here would be one nobody computed. */
export const GI_GL_HOW = 'How to use it: on a receipt, read each food\'s portion and available carbohydrate first, then its GI, then its load. The load is the figure that adds up across a meal, and your day\'s budget is in the same unit.'

/**
 * The short film that shows it on a real answer (49 seconds, the engine's own numbers for one slice of rye bread and then two,
 * recorded by `GIGL=1 node scripts/demo-video/record.mjs`). Null would show no player rather than one that points at nothing.
 */
export const GI_GL_VIDEO: { src: string; captions: string; poster: string } | null = {
  src: '/gi-gl-explainer.mp4', captions: '/gi-gl-explainer.vtt', poster: '/gi-gl-poster.jpg',
}
