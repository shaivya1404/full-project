import { prisma } from '../db/client';
import { logger } from '../utils/logger';

interface PromptParams {
  teamId: string;
  campaignId?: string;
  caller?: string;
  callType?: 'inbound' | 'outbound';
}

/**
 * Builds a rich system prompt for Qwen by fetching from the database:
 *   - Store info, menu, FAQs             (always, for inbound)
 *   - Customer profile, loyalty, prefs   (if phone matches a Customer record)
 *   - Customer order history             (last 5 orders with items)
 *   - AI-learned customer memories       (dietary, preferences, etc.)
 *   - Campaign script + contact info     (for outbound calls)
 *
 * Called by Node.js before sending the config to the Python pipeline.
 * Python has no DB access — this is the only way Qwen knows about the business.
 */
export async function buildSystemPrompt(params: PromptParams): Promise<string> {
  const { teamId, campaignId, caller, callType = 'inbound' } = params;

  const build =
    callType === 'outbound' && campaignId
      ? buildOutboundPrompt(campaignId, caller)
      : buildInboundPrompt(teamId, caller);

  // 8-second hard timeout — Neon DB cold-start can take 4-6s
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<string>((resolve) => {
    timer = setTimeout(() => {
      logger.warn('[SystemPrompt] DB timeout — using fallback prompt');
      resolve(buildFallbackPrompt(callType, caller));
    }, 8000);
  });

  try {
    const result = await Promise.race([build, timeout]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    logger.error('[SystemPrompt] Failed to build prompt, using fallback', err);
    return buildFallbackPrompt(callType, caller);
  }
}

// ---------------------------------------------------------------------------
// Inbound — order taking, support, general queries
// ---------------------------------------------------------------------------
async function buildInboundPrompt(teamId: string, caller?: string): Promise<string> {
  const [storeInfo, products, faqs, customer] = await Promise.all([
    // Store details + active delivery zones
    prisma.storeInfo.findUnique({
      where: { teamId },
      include: { deliveryZones: { where: { isActive: true } } },
    }),

    // Available menu items grouped by category
    prisma.product.findMany({
      where: { teamId, isAvailable: true },
      select: { name: true, description: true, price: true, category: true },
      orderBy: { category: 'asc' },
    }),

    // Top 10 frequently asked questions
    prisma.productFAQ.findMany({
      where: { teamId },
      select: { question: true, answer: true },
      orderBy: { helpfulCount: 'desc' },
      take: 10,
    }),

    // Full customer profile: loyalty, preferences, memories, last 5 orders
    caller
      ? prisma.customer.findFirst({
          where: { phone: caller, teamId },
          include: {
            customerLoyalty: {
              include: { loyaltyTier: { select: { name: true, benefits: true } } },
            },
            customerPreference: true,
            customerMemories: {
              where: { isActive: true },
              orderBy: { confidence: 'desc' },
              take: 10,
            },
            orders: {
              orderBy: { orderTime: 'desc' },
              take: 5,
              include: {
                items: {
                  select: {
                    productName: true,
                    quantity: true,
                    unitPrice: true,
                    specialInstructions: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const lines: string[] = [];
  const storeName = storeInfo?.storeName || 'our store';

  lines.push(
    `You are Aarav, a friendly voice AI assistant for ${storeName}. ` +
    `Speak naturally and concisely — this is a live phone call. No markdown, no bullet points in your replies. ` +
    `When asked your name, say your name is Aarav. You work for ${storeName} and help customers with orders, menu queries, and delivery.`,
  );

  // ── Customer profile ────────────────────────────────────────────────────
  if (customer) {
    const name = customer.name || 'the caller';
    const loyalty = customer.customerLoyalty;
    const prefs = customer.customerPreference;

    lines.push(`\nCUSTOMER PROFILE:`);
    lines.push(`  Name: ${name}`);
    lines.push(`  Phone: ${caller}`);
    if (customer.email) lines.push(`  Email: ${customer.email}`);
    if (customer.address) lines.push(`  Default address: ${customer.address}`);

    // Loyalty status
    if (loyalty) {
      lines.push(`  Loyalty: ${loyalty.currentPoints} points` +
        (loyalty.loyaltyTier ? ` | Tier: ${loyalty.loyaltyTier.name}` : '') +
        ` | Total orders: ${loyalty.totalOrders}` +
        ` | Lifetime spend: ₹${loyalty.lifetimeValue.toFixed(0)}`);
      if (loyalty.loyaltyTier?.benefits) {
        lines.push(`  Tier benefits: ${loyalty.loyaltyTier.benefits}`);
      }
    }

    // Preferences
    if (prefs) {
      if (prefs.favoriteItems) lines.push(`  Favourite items: ${prefs.favoriteItems}`);
      if (prefs.dietaryRestrictions) lines.push(`  Dietary restrictions: ${prefs.dietaryRestrictions}`);
      if (prefs.allergies) lines.push(`  Allergies: ${prefs.allergies}`);
      if (prefs.deliveryNotes) lines.push(`  Delivery notes: ${prefs.deliveryNotes}`);
    }

    // AI-learned memories (e.g. "likes extra cheese", "prefers evening delivery")
    if (customer.customerMemories.length) {
      lines.push(`  Known preferences:`);
      for (const mem of customer.customerMemories) {
        lines.push(`    - ${mem.factKey}: ${mem.factValue}`);
      }
    }

    // Order history
    if (customer.orders.length) {
      lines.push(`\nORDER HISTORY (last ${customer.orders.length}):`);
      for (const order of customer.orders) {
        const date = order.orderTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const itemList = order.items
          .map(i => `${i.quantity}× ${i.productName}${i.specialInstructions ? ` (${i.specialInstructions})` : ''}`)
          .join(', ');
        lines.push(`  #${order.orderNumber} | ${date} | ₹${order.totalAmount.toFixed(0)} | Status: ${order.status}`);
        if (itemList) lines.push(`    Items: ${itemList}`);
        if (order.deliveryAddress) lines.push(`    Delivered to: ${order.deliveryAddress}`);
      }
    }
  } else {
    lines.push(`\nCUSTOMER: ${caller || 'Unknown caller'} — new customer, no order history.`);
  }

  // ── Store details ────────────────────────────────────────────────────────
  if (storeInfo) {
    lines.push(`\nSTORE:`);
    lines.push(`  Name: ${storeInfo.storeName}`);
    lines.push(`  Address: ${storeInfo.address}`);
    if (storeInfo.phone) lines.push(`  Phone: ${storeInfo.phone}`);
    lines.push(`  Hours: ${storeInfo.operatingHours} (${storeInfo.timezone})`);

    if (storeInfo.deliveryEnabled) {
      lines.push(`  Delivery: Yes — min order ₹${storeInfo.minOrderAmount}, avg prep ${storeInfo.avgPrepTime} mins`);
      if (storeInfo.deliveryZones?.length) {
        const zoneList = storeInfo.deliveryZones
          .map(z => `${z.zoneName} (₹${z.deliveryFee} fee, ~${z.estimatedTime} mins)`)
          .join('; ');
        lines.push(`  Zones: ${zoneList}`);
      }
    } else {
      lines.push(`  Delivery: Not available. Pickup only.`);
    }
  }

  // ── Menu ─────────────────────────────────────────────────────────────────
  if (products.length) {
    lines.push(`\nMENU:`);
    const byCategory = products.reduce<Record<string, typeof products>>((acc, p) => {
      const cat = p.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});

    for (const [category, items] of Object.entries(byCategory)) {
      lines.push(`  ${category}:`);
      for (const item of items) {
        const price = item.price != null ? ` — ₹${item.price}` : '';
        const desc = item.description ? ` (${item.description})` : '';
        lines.push(`    • ${item.name}${price}${desc}`);
      }
    }
  }

  // ── FAQs ─────────────────────────────────────────────────────────────────
  if (faqs.length) {
    lines.push(`\nCOMMON QUESTIONS:`);
    for (const faq of faqs) {
      lines.push(`  Q: ${faq.question}`);
      lines.push(`  A: ${faq.answer}`);
    }
  }

  lines.push(`\nRULES:`);
  lines.push(`  - Keep every reply to 1-3 short sentences.`);
  lines.push(`  - Use the customer's name naturally in conversation.`);
  lines.push(`  - Order history is for context only — NEVER automatically add previous items to a new order. Only add items the customer explicitly asks for in this call.`);
  lines.push(`  - For reorders: ask "would you like the same as last time?" — only proceed after customer says yes.`);
  lines.push(`  - Confirm order details (items, quantity, address, payment) before ending.`);
  lines.push(`  - Respect dietary restrictions and allergies — never suggest restricted items.`);
  lines.push(`  - If you don't know something, say so honestly. Never invent prices or policies.`);
  lines.push(`  - NEVER promise SMS confirmations, WhatsApp messages, email receipts, or order tracking links — these are not available. Do not mention them.`);
  lines.push(`  - Never mix languages mid-sentence. If replying in Hindi, use only Hindi words — do not insert English words like "correct", "okay", "right" into a Hindi sentence.`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Outbound — sales campaigns, follow-ups
// ---------------------------------------------------------------------------
async function buildOutboundPrompt(
  campaignId: string,
  caller?: string,
): Promise<string> {
  const [campaign, contact, customer] = await Promise.all([
    // Campaign script and goal
    prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { name: true, description: true, script: true },
    }),
    // Lead / contact record (for sales context)
    caller
      ? prisma.contact.findFirst({
          where: { phone: caller },
          select: { name: true, leadTier: true, interestLevel: true },
        })
      : Promise.resolve(null),
    // Customer record (if they are an existing customer with orders)
    caller
      ? prisma.customer.findFirst({
          where: { phone: caller },
          include: {
            customerLoyalty: { select: { currentPoints: true, totalOrders: true } },
            orders: {
              orderBy: { orderTime: 'desc' },
              take: 3,
              select: {
                orderNumber: true,
                status: true,
                totalAmount: true,
                orderTime: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const lines: string[] = [];

  lines.push(
    `You are an outbound sales AI assistant. ` +
    `Speak naturally — this is a live phone call. No markdown, no bullet points in your replies.`,
  );

  // Who you are calling
  const name = contact?.name || customer?.name;
  if (name) {
    lines.push(`\nCALLING: ${name} (${caller})`);
  } else {
    lines.push(`\nCALLING: ${caller || 'a prospect'}`);
  }

  if (contact?.leadTier && contact.leadTier !== 'unknown') {
    lines.push(`  Lead tier: ${contact.leadTier}, Interest level: ${contact.interestLevel}/10`);
  }

  // Existing customer context (helps personalise the pitch)
  if (customer?.customerLoyalty || customer?.orders?.length) {
    lines.push(`  Existing customer:`);
    if (customer.customerLoyalty) {
      lines.push(`    Orders: ${customer.customerLoyalty.totalOrders}, Points: ${customer.customerLoyalty.currentPoints}`);
    }
    if (customer.orders?.length) {
      const last = customer.orders[0];
      const date = last.orderTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      lines.push(`    Last order: #${last.orderNumber} on ${date} (₹${last.totalAmount.toFixed(0)})`);
    }
  }

  // Campaign script
  if (campaign) {
    lines.push(`\nCAMPAIGN: ${campaign.name}`);
    if (campaign.description) lines.push(`GOAL: ${campaign.description}`);
    lines.push(`\nSCRIPT / INSTRUCTIONS:\n${campaign.script}`);
  }

  lines.push(`\nRULES:`);
  lines.push(`  - Keep every reply to 1-3 short sentences.`);
  lines.push(`  - Use the customer's name naturally in conversation.`);
  lines.push(`  - Be polite. Never pressure the prospect.`);
  lines.push(`  - If they ask to be removed from the list, confirm and end the call gracefully.`);
  lines.push(`  - If they say no twice, thank them and end the call.`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Fallback — when DB fetch fails or times out
// ---------------------------------------------------------------------------
function buildFallbackPrompt(callType?: string, caller?: string): string {
  if (callType === 'outbound') {
    return (
      `You are an outbound sales AI assistant calling ${caller || 'a customer'}. ` +
      `Be polite, professional, and concise. Keep replies to 1-3 short sentences.`
    );
  }
  return (
    `You are a helpful voice AI assistant. The caller is ${caller || 'a customer'}. ` +
    `Be concise and natural. Keep replies to 1-3 short sentences.`
  );
}
