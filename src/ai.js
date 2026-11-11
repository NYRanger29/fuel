// ai.js: everything that talks to Claude (the AI that reads photos and
// invents meals). Requests go straight from this device to Anthropic using
// the key saved in Settings. No other server is involved.

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getApiKey, settings } from './store.js';

export const PANTRY_CATEGORIES = [
  'Produce',
  'Meat & fish',
  'Dairy & eggs',
  'Grains & bread',
  'Canned & jarred',
  'Frozen',
  'Snacks',
  'Drinks',
  'Spices & sauces',
  'Other',
];

// An error with a message that is safe and useful to show on screen.
export class AiError extends Error {
  constructor(message, kind = 'other') {
    super(message);
    this.kind = kind;
  }
}

export const hasKey = () => Boolean(getApiKey());

// ---------- The shapes we ask Claude to answer in ----------

const FoodItem = z.object({
  name: z.string().describe('Short plain name, e.g. "Grilled chicken breast"'),
  portion: z.string().describe('Estimated amount, e.g. "6 oz" or "1 cup"'),
  calories: z.number(),
  protein: z.number().describe('grams'),
  carbs: z.number().describe('grams'),
  fat: z.number().describe('grams'),
});

const FoodAnswer = z.object({
  is_food: z.boolean().describe('false if there is no food or drink to estimate'),
  title: z.string().describe('Short name for the whole meal, e.g. "Chicken burrito bowl"'),
  items: z.array(FoodItem),
  confidence: z.enum(['low', 'medium', 'high']),
  note: z.string().describe('One short sentence on the biggest uncertainty, or empty'),
});

const ReceiptAnswer = z.object({
  found_items: z.boolean().describe('false if no food items could be read'),
  store: z.string().describe('Store name if visible, else empty'),
  items: z.array(
    z.object({
      name: z.string().describe('Plain food name with abbreviations expanded, e.g. "Chicken thighs"'),
      quantity: z.number(),
      unit: z.string().describe('e.g. "lb", "oz", "count", "bag", "carton", "can"'),
      category: z.enum(PANTRY_CATEGORIES),
    }),
  ),
});

const MealsAnswer = z.object({
  meals: z.array(
    z.object({
      title: z.string(),
      summary: z.string().describe('One appetizing sentence'),
      minutes: z.number().describe('Total time in minutes'),
      servings: z.number(),
      uses: z.array(z.string()).describe('Pantry items used, written exactly as they appear in the pantry list'),
      missing: z.array(z.string()).describe('Ingredients needed that are not in the pantry, excluding salt, pepper, water, and cooking oil'),
      ingredients: z.array(z.string()).describe('Every ingredient with its amount'),
      steps: z.array(z.string()),
      calories: z.number().describe('per serving'),
      protein: z.number().describe('grams per serving'),
      carbs: z.number().describe('grams per serving'),
      fat: z.number().describe('grams per serving'),
    }),
  ),
});

// ---------- One function that does the actual asking ----------

async function ask(schema, system, content) {
  const apiKey = getApiKey();
  if (!apiKey) throw new AiError('Add your Claude API key in Settings to use this.', 'no-key');
  if (!navigator.onLine) throw new AiError('You are offline. Connect to the internet and try again.', 'offline');

  // "dangerouslyAllowBrowser" is needed because the key lives on this device
  // instead of on a server. That is fine for a personal app that only you use.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  let response;
  try {
    response = await client.messages.parse({
      model: settings.model || 'claude-opus-5-5',
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content }],
      output_config: { format: zodOutputFormat(schema) },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiError('Claude did not accept the API key. Check it in Settings.', 'bad-key');
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      throw new AiError('This API key is not allowed to do that. Check the key and your account in the Claude Console.', 'bad-key');
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiError('Too many requests right now. Wait a minute and try again.', 'busy');
    }
    if (error instanceof Anthropic.BadRequestError) {
      const text = String(error.message || '');
      if (/credit|billing/i.test(text)) {
        throw new AiError('Your Claude account is out of credit. Add credit in the Claude Console.', 'billing');
      }
      throw new AiError(`Claude could not process that request. ${text}`, 'bad-request');
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new AiError('Could not reach Claude. Check your internet connection and try again.', 'offline');
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiError(`Claude had a problem (error ${error.status ?? 'unknown'}). Try again in a moment.`, 'server');
    }
    throw new AiError('Something went wrong reading the answer. Try again.', 'other');
  }

  if (response.stop_reason === 'refusal') {
    throw new AiError('Claude declined to answer that one. Try a different photo or wording.', 'refusal');
  }
  if (!response.parsed_output) {
    throw new AiError('The answer came back incomplete. Try again.', 'other');
  }
  return response.parsed_output;
}

const image = (base64) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } });

const dietLine = () => (settings.diet ? `\nThe user's dietary notes and allergies: ${settings.diet}` : '');

// ---------- The four things the app asks for ----------

const FOOD_SYSTEM = `You estimate nutrition for a personal food log. The user is an athlete tracking calories and protein.
Break the meal into its separate foods. For each, estimate the portion from visual cues (plate size, utensils, hands, packaging) and give calories, protein, carbs, and fat for that portion.
Be realistic rather than cautious: include cooking oil, butter, sauces, and dressings when the food looks like it has them. If a nutrition label or brand is visible, use it.
Use whole numbers. If the picture or text has no food or drink, set is_food to false and leave items empty.`;

export function analyzeFoodPhoto(base64, hint = '') {
  return ask(FoodAnswer, FOOD_SYSTEM, [
    image(base64),
    { type: 'text', text: `Estimate this meal.${hint ? `\nThe user adds: ${hint}` : ''}` },
  ]);
}

export function analyzeFoodText(description) {
  return ask(FoodAnswer, FOOD_SYSTEM, [
    { type: 'text', text: `Estimate this meal from the user's description. Assume typical portions where none are given.\n\n${description}` },
  ]);
}

const RECEIPT_SYSTEM = `You read grocery receipts and photos of groceries to keep a home pantry list up to date.
List every food and drink item. Expand store abbreviations into plain names ("BNLS CHKN THGH" becomes "Chicken thighs"). Drop brand names unless they are how people name the food.
Skip everything that is not food or drink: bags, tax, deposits, discounts, cleaning supplies, toiletries, totals.
Set quantity and unit from the receipt (weight, count, or package). If the same item appears more than once, combine it. If unsure of quantity, use 1 and "count".
If the photo shows groceries, a fridge, or a shelf instead of a receipt, list the foods you can see.
If no food can be read, set found_items to false and leave items empty.`;

export function analyzeReceipt(base64) {
  return ask(ReceiptAnswer, RECEIPT_SYSTEM, [image(base64), { type: 'text', text: 'Read the food items from this photo.' }]);
}

const MEALS_SYSTEM = `You are a practical cook helping a high-school athlete who is trying to build muscle. You suggest meals from what is in their pantry.
Rules:
- Build each meal mostly from the pantry list. Assume salt, pepper, water, and cooking oil are always available.
- Recipes must be realistic for a beginner cook in a home kitchen: clear steps, common equipment, accurate times and safe cooking temperatures for meat.
- In "uses", copy pantry item names exactly as written in the list so the app can match them.
- Give honest nutrition per serving. Favor meals with solid protein.
- Make the options different from each other, not three versions of one dish.
- Respect dietary notes and allergies completely.`;

export function suggestMeals({ pantry, request, mealType, remaining, strict, count = 3 }) {
  const pantryText = pantry.length
    ? pantry.map((p) => `- ${p.name}${p.quantity ? ` (${p.quantity} ${p.unit || ''})`.replace(' )', ')') : ''}`).join('\n')
    : '(the pantry list is empty)';
  const text = `Pantry:
${pantryText}

Suggest ${count} ${mealType && mealType !== 'Any' ? mealType.toLowerCase() : 'meal'} ideas.
${request ? `What the user is in the mood for: ${request}` : ''}
${remaining ? `Left to eat today to hit their targets: about ${Math.max(0, Math.round(remaining.calories))} calories and ${Math.max(0, Math.round(remaining.protein))} g protein.` : ''}
${strict ? 'Use only pantry items (plus salt, pepper, water, oil). "missing" must be empty.' : 'A meal may need one or two extra ingredients; list those in "missing".'}${dietLine()}`;
  return ask(MealsAnswer, MEALS_SYSTEM, [{ type: 'text', text }]);
}

// Used by the "Test key" button in Settings.
export async function testKey() {
  const answer = await ask(z.object({ ok: z.boolean() }), 'Reply with ok set to true.', [{ type: 'text', text: 'Connection test.' }]);
  return answer.ok === true;
}
