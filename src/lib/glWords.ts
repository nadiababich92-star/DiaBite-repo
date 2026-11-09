/**
 * What GI and GL are, in plain words. One copy, used by the dialog behind "What are GI and GL?" on the answer and by
 * the card in onboarding and in You, so the three never say different things. No figure appears in it: every number
 * the person sees comes from the engine, and a number in an explanation would be one nobody computed.
 */
export const GI_GL_WORDS = [
  'The glycemic index (GI) ranks a food that contains carbohydrate from 0 to 100 by how fast it raises blood sugar, compared with pure glucose.',
  'The glycemic load (GL) adds the portion: it is the GI times the grams of carbohydrate you eat, divided by 100. A small portion of a high-GI food can weigh less than a large portion of a lower-GI one.',
  'Counting carbohydrate looks at grams only. DiaBite shows both, in grams and as a load, and puts first the one you said you use. The verdict is worked out from the load.',
  'Neither number is a dose. DiaBite never tells you how much medicine to take.',
] as const
