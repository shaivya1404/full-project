/**
 * Post-call analysis service.
 *
 * After a call ends, uses an LLM to extract structured facts from the transcript
 * (customer name, dietary restrictions, preferences, etc.) and upserts them into
 * the CustomerMemory table so future calls are more personalised.
 *
 * Runs entirely in the background — never blocks the call teardown path.
 */

import axios from 'axios';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { config } from '../config/env';

interface TranscriptEntry {
  role: string;
  text: string;
}

interface PostCallParams {
  transcript: TranscriptEntry[];
  caller?: string;
  teamId?: string;
  callType?: string;
}

interface ExtractedFact {
  factType: string;   // e.g. "preference", "dietary", "personal"
  factKey: string;    // e.g. "name", "allergies", "favorite_item"
  factValue: string;  // e.g. "John", "peanuts", "Margherita pizza"
  confidence: number; // 0.0 – 1.0
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export async function runPostCallAnalysis(params: PostCallParams): Promise<void> {
  const { transcript, caller, teamId, callType } = params;

  // Only analyse inbound calls where we know the caller's phone number
  if (callType === 'outbound' || !caller || caller === 'Inbound Call' || !teamId) return;

  // Find the Customer record (created by twilioStream auto-save if new, or pre-existing)
  const customer = await prisma.customer.findFirst({
    where: { phone: caller, teamId },
    select: { id: true },
  });

  if (!customer) {
    logger.warn(`[PostCall] No customer record found for ${caller} — skipping memory extraction`);
    return;
  }

  const facts = await extractFacts(transcript);
  if (!facts.length) {
    logger.info(`[PostCall] No facts extracted for ${caller}`);
    return;
  }

  logger.info(`[PostCall] Saving ${facts.length} extracted facts for customer ${customer.id}`);

  // Upsert each fact (update value if same factType+factKey already exists)
  for (const fact of facts) {
    try {
      await prisma.customerMemory.upsert({
        where: {
          customerId_factType_factKey: {
            customerId: customer.id,
            factType: fact.factType,
            factKey: fact.factKey,
          },
        },
        update: {
          factValue: fact.factValue,
          confidence: fact.confidence,
          source: 'call_transcript',
          isActive: true,
        },
        create: {
          customerId: customer.id,
          teamId,
          factType: fact.factType,
          factKey: fact.factKey,
          factValue: fact.factValue,
          confidence: fact.confidence,
          source: 'call_transcript',
        },
      });
    } catch (err) {
      logger.error(`[PostCall] Failed to upsert memory: ${fact.factKey}`, err);
    }
  }

  // Update customer name if extracted and not already set
  const nameFact = facts.find(f => f.factKey === 'name' && f.confidence >= 0.8);
  if (nameFact) {
    const existing = await prisma.customer.findUnique({
      where: { id: customer.id },
      select: { name: true },
    });
    if (!existing?.name) {
      await prisma.customer.update({
        where: { id: customer.id },
        data: { name: nameFact.factValue },
      }).catch(err => logger.error('[PostCall] Failed to update customer name', err));
    }
  }
}

// ---------------------------------------------------------------------------
// LLM extraction
// ---------------------------------------------------------------------------
async function extractFacts(transcript: TranscriptEntry[]): Promise<ExtractedFact[]> {
  const apiKey = config.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('[PostCall] No OPENAI_API_KEY — skipping fact extraction');
    return [];
  }

  const transcriptText = transcript
    .map(t => `${t.role === 'user' ? 'Customer' : 'AI'}: ${t.text}`)
    .join('\n');

  const systemPrompt = `You extract structured facts about a customer from a call transcript.
Return ONLY a JSON array of fact objects. Each object must have:
  - factType: one of "personal", "dietary", "preference", "delivery", "other"
  - factKey: a snake_case key (e.g. "name", "allergies", "favorite_item", "delivery_time_preference")
  - factValue: the extracted value as a short string
  - confidence: 0.0–1.0 (how certain you are from context)

Only extract facts the customer explicitly stated. Do not infer or guess.
If no facts can be extracted, return an empty array [].
Return valid JSON only — no explanation, no markdown fences.`;

  const userMessage = `Extract customer facts from this call transcript:\n\n${transcriptText}`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      },
    );

    const content: string = response.data.choices[0].message.content.trim();
    const facts: ExtractedFact[] = JSON.parse(content);

    if (!Array.isArray(facts)) return [];
    return facts.filter(
      f =>
        typeof f.factType === 'string' &&
        typeof f.factKey === 'string' &&
        typeof f.factValue === 'string' &&
        typeof f.confidence === 'number',
    );
  } catch (err) {
    logger.error('[PostCall] Fact extraction LLM call failed', err);
    return [];
  }
}
