/**
 * Full-stack integration test for all 4 improvements.
 *
 * Tests (end-to-end, against a running backend + Python pipeline):
 *   1. Auto-greeting  — AI speaks first without any audio input
 *   2. Transcript DB  — every turn is saved to the Transcript table
 *   3. Auto-customer  — new caller → Customer record created automatically
 *   4. Post-call mem  — CustomerMemory facts extracted from transcript
 *
 * Prerequisites:
 *   - Node.js backend running:  npm run dev          (port 3000)
 *   - Python pipeline running:  python pipeline/server.py  (port 8765)
 *   - DB seeded:                npx prisma migrate dev
 *
 * Usage:
 *   npx ts-node src/scripts/testAllFeatures.ts [--team <teamId>]
 *
 * If no --team is provided the script auto-detects the first team in the DB.
 */

import WebSocket from 'ws';
import { prisma } from '../db/client';

const BACKEND_WS = 'ws://localhost:3000/streams';
// Unique test phone so we don't pollute real customer data
const TEST_CALLER  = `+91999${Date.now().toString().slice(-7)}`;
const TIMEOUT_MS   = 25_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(tag: string, msg: string) {
  console.log(`  [${tag}] ${msg}`);
}

function pass(msg: string) {
  console.log(`  \u2705 PASS: ${msg}`);
}

function warn(msg: string) {
  console.log(`  \u26a0\ufe0f  WARN: ${msg}`);
}

function fail(msg: string) {
  console.log(`  \u274c FAIL: ${msg}`);
  process.exitCode = 1;
}

function waitForMessage(
  ws: WebSocket,
  condition: (msg: Record<string, any>) => boolean,
  timeoutMs = TIMEOUT_MS,
  label = 'message',
): Promise<Record<string, any>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeoutMs);

    const handler = (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        if (condition(msg)) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch { /* ignore parse errors */ }
    };

    ws.on('message', handler);
  });
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main test runner ──────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '='.repeat(62));
  console.log('  Full-Stack Feature Test');
  console.log('  Backend: ' + BACKEND_WS);
  console.log('  Test caller: ' + TEST_CALLER);
  console.log('='.repeat(62) + '\n');

  // -- Find a real teamId from the DB -----------------------------------------
  const teamArg = process.argv.indexOf('--team');
  let teamId: string;

  if (teamArg !== -1 && process.argv[teamArg + 1]) {
    teamId = process.argv[teamArg + 1];
    log('Setup', `Using --team: ${teamId}`);
  } else {
    const team = await prisma.team.findFirst({ select: { id: true, name: true } });
    if (!team) {
      fail('No teams found in DB. Run: npx prisma db seed');
      await prisma.$disconnect();
      return;
    }
    teamId = team.id;
    log('Setup', `Auto-detected team: "${team.name}" (${teamId})`);
  }

  // -- Connect WebSocket --------------------------------------------------------
  log('Setup', 'Connecting to backend WebSocket...');
  const ws = new WebSocket(BACKEND_WS);

  await new Promise<void>((res, rej) => {
    ws.once('open', res);
    ws.once('error', rej);
    setTimeout(() => rej(new Error('WebSocket open timeout')), 5000);
  });
  log('Setup', 'Connected.\n');

  const streamSid  = `MXtest${Date.now()}`;
  const callSid    = `CAtest${Date.now()}`;

  // Collect all pipeline messages for later checks
  const allMessages: Array<Record<string, any>> = [];
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      allMessages.push(msg);
      const preview =
        msg.event === 'media'
          ? '<audio frame>'
          : JSON.stringify(msg).slice(0, 100);
      log('ws←', preview);
    } catch { /* ignore */ }
  });

  try {
    // ── TEST 1 & 2 setup: Send Twilio "start" event ────────────────────────────
    console.log('TEST 1+2: Auto-greeting + transcripts\n');

    const startEvent = {
      event: 'start',
      start: {
        streamSid,
        callSid,
        customParameters: {
          teamId,
          caller: TEST_CALLER,
          callType: 'inbound',
        },
      },
    };
    ws.send(JSON.stringify(startEvent));
    log('ws→', 'Sent Twilio "start" event');

    // ── TEST 1: Auto-greeting ──────────────────────────────────────────────────
    log('T1', 'Waiting for AI greeting (no audio sent)...');
    try {
      const greeting = await waitForMessage(
        ws,
        m => m.event === 'media',   // Twilio audio back from AI = greeting was generated
        TIMEOUT_MS,
        'AI greeting audio'
      );
      pass('Auto-greeting — AI sent audio without any user input');
    } catch {
      fail('Auto-greeting — no audio received from AI within timeout');
    }

    // ── Send a text utterance via test_input ──────────────────────────────────
    await sleep(2000); // let greeting audio drain
    const userText = `Hi, my name is Ravi. I have a peanut allergy. What do you recommend?`;
    ws.send(JSON.stringify({ event: 'test_input', text: userText }));
    log('ws→', `Sent text: "${userText}"`);

    // Wait for AI to respond with audio
    try {
      await waitForMessage(ws, m => m.event === 'media', TIMEOUT_MS, 'AI response audio');
      pass('LLM responded to text input');
    } catch {
      fail('LLM did not respond to text input within timeout');
    }

    await sleep(3000); // let response audio drain + DB writes settle

    // ── Send Twilio "stop" event ──────────────────────────────────────────────
    ws.send(JSON.stringify({ event: 'stop' }));
    log('ws→', 'Sent Twilio "stop" event');

    // Wait for all background async work (transcript saves, customer creation)
    log('DB', 'Waiting 5 s for background DB writes to complete...');
    await sleep(5000);

    // ── TEST 2: Transcripts saved to DB ───────────────────────────────────────
    console.log('\nTEST 2: Transcript DB persistence');
    const call = await prisma.call.findFirst({
      where: { streamSid },
      include: { transcripts: true },
    });

    if (!call) {
      fail('Transcript DB — Call record not found in DB');
    } else {
      log('DB', `Call found: id=${call.id}, status=${call.status}`);
      if (call.transcripts.length === 0) {
        fail('Transcript DB — no transcripts saved (0 rows in Transcript table for this call)');
      } else {
        pass(`Transcript DB — ${call.transcripts.length} transcript row(s) saved`);
        for (const t of call.transcripts) {
          log('DB', `  [${t.speaker.toUpperCase()}] ${t.text.slice(0, 80)}`);
        }
      }
    }

    // ── TEST 3: Auto-save new customer ────────────────────────────────────────
    console.log('\nTEST 3: Auto-save new customer');
    const customer = await prisma.customer.findFirst({
      where: { phone: TEST_CALLER, teamId },
    });

    if (!customer) {
      fail(`Auto-customer — no Customer record found for ${TEST_CALLER}`);
    } else {
      pass(`Auto-customer — Customer created: id=${customer.id}, name=${customer.name ?? '(not yet set)'}`);
    }

    // ── TEST 4: CustomerMemory (post-call analysis) ───────────────────────────
    console.log('\nTEST 4: Post-call memory extraction');
    if (customer) {
      const memories = await prisma.customerMemory.findMany({
        where: { customerId: customer.id },
      });

      if (memories.length === 0) {
        warn(`CustomerMemory — 0 facts found. This is OK if OPENAI_API_KEY is not set or the LLM is still processing.`);
        warn(`Check again in 10 s: npx prisma studio`);
      } else {
        pass(`CustomerMemory — ${memories.length} fact(s) extracted:`);
        for (const m of memories) {
          log('DB', `  [${m.factType}] ${m.factKey}: ${m.factValue} (confidence=${m.confidence})`);
        }
      }
    } else {
      warn('CustomerMemory — skipped (no customer record to check)');
    }

  } finally {
    ws.close();
    await prisma.$disconnect();
  }

  console.log('\n' + '='.repeat(62));
  if (process.exitCode === 1) {
    console.log('  Some tests FAILED — see above');
  } else {
    console.log('  All tests PASSED');
  }
  console.log('='.repeat(62) + '\n');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
