/**
 * Seed demo data for the Oolix Pizza demo team.
 * Run: npx ts-node src/scripts/seedDemoData.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEAM_ID = '28a96cd1-4866-41fb-85a3-e2171393838e';

async function main() {
  console.log('Seeding demo data for team:', TEAM_ID);

  // ── 1. Store Info ─────────────────────────────────────────
  const storeInfo = await prisma.storeInfo.upsert({
    where: { teamId: TEAM_ID },
    update: {},
    create: {
      teamId: TEAM_ID,
      storeName: 'Oolix Pizza',
      address: '12, MG Road, Sector 14, Gurugram, Haryana 122001',
      phone: '+911244567890',
      timezone: 'Asia/Kolkata',
      operatingHours: 'Mon-Sun 10:00 AM - 11:00 PM',
      deliveryEnabled: true,
      minOrderAmount: 199,
      avgPrepTime: 30,
    },
  });
  console.log('✓ Store info:', storeInfo.storeName);

  // ── 2. Delivery Zones (linked via storeId) ────────────────
  const zones = [
    { zoneName: 'Sector 14', deliveryFee: 30, estimatedTime: 20, minOrder: 199, postalCodes: '122001' },
    { zoneName: 'Sector 15', deliveryFee: 40, estimatedTime: 25, minOrder: 299, postalCodes: '122001' },
    { zoneName: 'DLF Phase 1', deliveryFee: 50, estimatedTime: 30, minOrder: 399, postalCodes: '122002' },
    { zoneName: 'Sushant Lok', deliveryFee: 60, estimatedTime: 40, minOrder: 499, postalCodes: '122003' },
  ];
  const existingZones = await prisma.deliveryZone.count({ where: { storeId: storeInfo.id } });
  if (existingZones === 0) {
    for (const zone of zones) {
      await prisma.deliveryZone.create({
        data: {
          storeId: storeInfo.id,
          zoneName: zone.zoneName,
          deliveryFee: zone.deliveryFee,
          estimatedTime: zone.estimatedTime,
          minOrderAmount: zone.minOrder,
          postalCodes: zone.postalCodes,
          isActive: true,
        },
      });
    }
    console.log(`✓ Delivery zones (${zones.length})`);
  } else {
    console.log(`✓ Delivery zones already exist (${existingZones}), skipping`);
  }

  // ── 3. Products (Menu) ────────────────────────────────────
  const products = [
    { name: 'Margherita Pizza', category: 'Pizza', price: 299, description: 'Classic tomato sauce, mozzarella, fresh basil', sku: 'PIZ-001', stock: 50 },
    { name: 'Paneer Tikka Pizza', category: 'Pizza', price: 399, description: 'Spicy paneer tikka, capsicum, onion, special sauce', sku: 'PIZ-002', stock: 40 },
    { name: 'Chicken Supreme Pizza', category: 'Pizza', price: 449, description: 'Grilled chicken, mushroom, olives, jalapeños', sku: 'PIZ-003', stock: 35 },
    { name: 'BBQ Chicken Pizza', category: 'Pizza', price: 429, description: 'BBQ sauce, pulled chicken, caramelized onions', sku: 'PIZ-004', stock: 30 },
    { name: 'Veggie Delight Pizza', category: 'Pizza', price: 349, description: 'Bell peppers, mushroom, olives, sweetcorn, tomato', sku: 'PIZ-005', stock: 45 },
    { name: 'Pepperoni Pizza', category: 'Pizza', price: 479, description: 'Classic pepperoni with mozzarella and tomato sauce', sku: 'PIZ-006', stock: 25 },
    { name: 'Garlic Bread', category: 'Sides', price: 99, description: 'Toasted garlic butter bread, 4 pieces', sku: 'SID-001', stock: 60 },
    { name: 'Stuffed Garlic Bread', category: 'Sides', price: 149, description: 'Garlic bread stuffed with cheese and herbs', sku: 'SID-002', stock: 50 },
    { name: 'Cheesy Dips (3pcs)', category: 'Sides', price: 79, description: 'Cheese dip, ranch, and marinara', sku: 'SID-003', stock: 80 },
    { name: 'Chicken Wings (6pcs)', category: 'Sides', price: 249, description: 'Crispy buffalo chicken wings', sku: 'SID-004', stock: 40 },
    { name: 'Coca-Cola (500ml)', category: 'Drinks', price: 60, description: 'Chilled Coca-Cola', sku: 'DRK-001', stock: 100 },
    { name: 'Sprite (500ml)', category: 'Drinks', price: 60, description: 'Chilled Sprite', sku: 'DRK-002', stock: 100 },
    { name: 'Fresh Lime Soda', category: 'Drinks', price: 80, description: 'Fresh lime with soda water, sweet or salted', sku: 'DRK-003', stock: 60 },
    { name: 'Choco Lava Cake', category: 'Desserts', price: 129, description: 'Warm chocolate cake with molten center', sku: 'DES-001', stock: 30 },
    { name: 'Vanilla Ice Cream', category: 'Desserts', price: 99, description: '2 scoops of creamy vanilla ice cream', sku: 'DES-002', stock: 40 },
  ];

  const createdProducts: { id: string; name: string }[] = [];
  for (const p of products) {
    // Check if product with this sku+teamId already exists
    const existing = await prisma.product.findFirst({ where: { teamId: TEAM_ID, sku: p.sku } });
    if (!existing) {
      const prod = await prisma.product.create({
        data: {
          teamId: TEAM_ID,
          name: p.name,
          category: p.category,
          price: p.price,
          description: p.description,
          sku: p.sku,
          stockQuantity: p.stock,
          reorderLevel: 10,
          isAvailable: true,
        },
      });
      createdProducts.push({ id: prod.id, name: prod.name });
    } else {
      createdProducts.push({ id: existing.id, name: existing.name });
    }
  }
  console.log(`✓ Products (${createdProducts.length})`);

  // ── 4. FAQs ───────────────────────────────────────────────
  const faqs = [
    { q: 'What are your delivery hours?', a: 'We deliver from 10 AM to 11 PM every day including weekends and holidays.' },
    { q: 'What is the minimum order for delivery?', a: 'Minimum order is ₹199 for Sector 14. Higher minimums apply for farther zones.' },
    { q: 'Do you offer vegetarian options?', a: 'Yes! We have Margherita, Paneer Tikka, and Veggie Delight pizzas, plus garlic bread — all fully vegetarian.' },
    { q: 'How long does delivery take?', a: 'Typically 20-40 minutes depending on your zone and order size.' },
    { q: 'Can I customize my pizza?', a: 'Yes, you can add or remove toppings. Extra toppings may have a small charge.' },
    { q: 'Do you accept online payment?', a: 'Yes, we accept UPI, credit/debit cards, and net banking. Cash on delivery is also available.' },
    { q: 'What are your pizza sizes?', a: 'We offer Medium (8 inch) and Large (12 inch) sizes for all our pizzas.' },
    { q: 'Is there a delivery charge?', a: 'Delivery fee ranges from ₹30 to ₹60 depending on your area.' },
    { q: 'Can I reorder my last order?', a: 'Yes, just tell our assistant and we can place the same order for you after confirming.' },
    { q: 'Do you have combo deals?', a: 'Yes! Ask our assistant about current combos — we have pizza + drink + garlic bread deals.' },
  ];
  let faqCount = 0;
  for (const faq of faqs) {
    const existing = await prisma.productFAQ.findFirst({ where: { teamId: TEAM_ID, question: faq.q } });
    if (!existing) {
      await prisma.productFAQ.create({
        data: { teamId: TEAM_ID, question: faq.q, answer: faq.a, helpfulCount: Math.floor(Math.random() * 50) },
      });
      faqCount++;
    }
  }
  console.log(`✓ FAQs (${faqCount} new, ${faqs.length - faqCount} existing)`);

  // ── 5. Customers ──────────────────────────────────────────
  const customerData = [
    { name: 'Rahul Sharma', phone: '+919711883007', email: 'rahul.sharma@gmail.com', address: 'A-42, Sector 14, Gurugram' },
    { name: 'Priya Verma', phone: '+919810001234', email: 'priya.verma@gmail.com', address: 'B-15, DLF Phase 1, Gurugram' },
    { name: 'Amit Singh', phone: '+919871112233', email: 'amit.singh@yahoo.com', address: 'C-7, Sushant Lok, Gurugram' },
    { name: 'Neha Gupta', phone: '+919999887766', email: 'neha.gupta@gmail.com', address: 'Sector 15, Gurugram' },
  ];

  const createdCustomers: { id: string; name: string | null; phone: string | null; address: string | null }[] = [];
  for (const c of customerData) {
    const existing = await prisma.customer.findFirst({ where: { phone: c.phone, teamId: TEAM_ID } });
    if (existing) {
      createdCustomers.push({ id: existing.id, name: existing.name, phone: existing.phone, address: existing.address });
    } else {
      const cust = await prisma.customer.create({
        data: { teamId: TEAM_ID, name: c.name, phone: c.phone, email: c.email, address: c.address },
      });
      createdCustomers.push({ id: cust.id, name: cust.name, phone: cust.phone, address: cust.address });
    }
  }
  console.log(`✓ Customers (${createdCustomers.length})`);

  // ── 6. Orders ─────────────────────────────────────────────
  const existingOrderCount = await prisma.order.count({ where: { teamId: TEAM_ID } });
  if (existingOrderCount < 5) {
    const orderRows = [
      { cIdx: 0, items: [{ name: 'Paneer Tikka Pizza', qty: 1, price: 399 }, { name: 'Coca-Cola (500ml)', qty: 2, price: 60 }], status: 'delivered', daysAgo: 1 },
      { cIdx: 1, items: [{ name: 'Margherita Pizza', qty: 2, price: 299 }, { name: 'Garlic Bread', qty: 1, price: 99 }], status: 'delivered', daysAgo: 4 },
      { cIdx: 2, items: [{ name: 'BBQ Chicken Pizza', qty: 1, price: 429 }, { name: 'Chicken Wings (6pcs)', qty: 1, price: 249 }], status: 'delivered', daysAgo: 7 },
      { cIdx: 3, items: [{ name: 'Veggie Delight Pizza', qty: 1, price: 349 }, { name: 'Choco Lava Cake', qty: 2, price: 129 }], status: 'cancelled', daysAgo: 10 },
      { cIdx: 0, items: [{ name: 'Chicken Supreme Pizza', qty: 1, price: 449 }, { name: 'Stuffed Garlic Bread', qty: 1, price: 149 }], status: 'delivered', daysAgo: 13 },
      { cIdx: 1, items: [{ name: 'Pepperoni Pizza', qty: 2, price: 479 }, { name: 'Fresh Lime Soda', qty: 2, price: 80 }], status: 'delivered', daysAgo: 16 },
      { cIdx: 2, items: [{ name: 'Margherita Pizza', qty: 1, price: 299 }, { name: 'Paneer Tikka Pizza', qty: 1, price: 399 }], status: 'delivered', daysAgo: 20 },
      { cIdx: 3, items: [{ name: 'BBQ Chicken Pizza', qty: 1, price: 429 }, { name: 'Coca-Cola (500ml)', qty: 1, price: 60 }], status: 'processing', daysAgo: 0 },
    ];

    for (let i = 0; i < orderRows.length; i++) {
      const row = orderRows[i];
      const customer = createdCustomers[row.cIdx];
      const subtotal = row.items.reduce((sum, it) => sum + it.price * it.qty, 0);
      const orderDate = new Date(Date.now() - row.daysAgo * 24 * 3600 * 1000);

      const order = await prisma.order.create({
        data: {
          teamId: TEAM_ID,
          customerId: customer.id,
          orderNumber: `ORD-${String(1001 + i).padStart(5, '0')}`,
          status: row.status,
          totalAmount: subtotal,
          deliveryAddress: customer.address || '',
          phone: customer.phone || '',
          orderTime: orderDate,
          items: {
            create: row.items.map(it => ({
              productName: it.name,
              quantity: it.qty,
              unitPrice: it.price,
            })),
          },
        },
      });
      console.log(`  Order ${order.orderNumber} — ₹${subtotal} — ${row.status}`);
    }
    console.log('✓ Orders (8)');
  } else {
    console.log(`✓ Orders already exist (${existingOrderCount}), skipping`);
  }

  // ── 7. Customer Loyalty ───────────────────────────────────
  const loyaltyData = [
    { points: 420, earned: 1200, orders: 8, lifetime: 4800 },
    { points: 150, earned: 400, orders: 3, lifetime: 1500 },
    { points: 310, earned: 800, orders: 6, lifetime: 3200 },
    { points: 90, earned: 250, orders: 2, lifetime: 900 },
  ];
  for (let i = 0; i < createdCustomers.length; i++) {
    const cust = createdCustomers[i];
    const ld = loyaltyData[i];
    const existing = await prisma.customerLoyalty.findFirst({ where: { customerId: cust.id } });
    if (!existing) {
      await prisma.customerLoyalty.create({
        data: {
          customerId: cust.id,
          teamId: TEAM_ID,
          currentPoints: ld.points,
          totalPointsEarned: ld.earned,
          totalOrders: ld.orders,
          lifetimeValue: ld.lifetime,
        },
      });
    }
  }
  console.log('✓ Customer loyalty records');

  console.log('\n✅ Demo data seeded successfully!');
}

main()
  .catch(err => { console.error('Seed failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
