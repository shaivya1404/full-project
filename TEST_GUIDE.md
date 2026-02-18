# Voice AI Dashboard — Testing Guide (Plain English)

Open your browser and go to: **http://localhost:5173**

---

## BEFORE YOU START

Make sure both servers are running:
- Backend running on port 3000
- Frontend running on port 5173

Login credentials:
- **Email:** demo@example.com
- **Password:** demo123

---

## TEST 1 — Login & Registration

**Goal:** Make sure you can get into the app.

1. Open **http://localhost:5173**
2. You should automatically land on the **Login page**
3. Type `demo@example.com` in the Email field
4. Type `demo123` in the Password field
5. Click **Login**
6. ✅ You should land on the **Dashboard** page with charts and numbers visible

**Also test registration:**
1. Click the **Register** link on the login page
2. Fill in: First Name, Last Name, Email (use a new email), Password (min 8 chars)
3. Click **Register**
4. ✅ Should take you to the Dashboard automatically

---

## TEST 2 — Dashboard Home

**Goal:** Check the main overview screen works.

1. After login, you're on the Dashboard
2. ✅ Check that you see summary cards (total calls, campaigns, orders, revenue)
3. ✅ Check there is a chart or graph visible
4. ✅ Check the notification bell icon at the top right is visible
5. ✅ Check the left sidebar has menu items (Campaigns, Leads, Orders, etc.)

---

## TEST 3 — Your Profile

**Goal:** View and update your personal info.

1. In the left sidebar, scroll to the bottom and click **Profile**
2. ✅ Your name and email should be visible
3. Try changing your first name and click **Save**
4. ✅ The name should update

---

## TEST 4 — Team

**Goal:** Check team management works.

1. Click **Team** in the left sidebar (it will expand)
2. Click **Overview** — ✅ team name and info should show
3. Click **Members** — ✅ list of team members should show
4. Look for an **Add Member** or **Invite** button — click it
5. Fill in a name and email, assign a role (Agent, Viewer, etc.) and save
6. ✅ New member should appear in the list
7. Click **Settings** under Team — ✅ team settings form should open
8. Click **Audit Log** under Team — ✅ a history of team actions should show

---

## TEST 5 — Users

**Goal:** Check the users management screen.

1. Click **Users** in the left sidebar
2. ✅ A list of users/accounts should appear
3. Look for a search bar — type a name and verify results filter
4. ✅ Clicking a user should show their details or open an edit panel

---

## TEST 6 — Agents

**Goal:** Add and view call center agents.

1. Click **Agents** in the left sidebar
2. ✅ You should see a list of agents with their status (Available, Busy, Offline)
3. Click **Add Agent** or **Create Agent** button
4. Fill in: Name, Email, Phone number
5. Save the agent
6. ✅ New agent should appear in the list
7. Click on any agent's name or card
8. ✅ Their detail page should open showing performance stats, skills, schedule

---

## TEST 7 — Campaigns (Outbound Calling)

**Goal:** Create and manage a call campaign.

1. Click **Campaigns** in the left sidebar
2. ✅ List of campaigns should show (may be empty)
3. Click **Create Campaign** or **New Campaign**
4. Fill in:
   - Campaign Name: e.g. "Insurance Feb Test"
   - Script: any text like "Hi, I'm calling about insurance..."
   - Start Date and End Date
   - Daily Call Limit: e.g. 50
5. Click **Save** or **Create**
6. ✅ New campaign should appear in the list
7. Click the campaign to open it
8. ✅ Detail page should show campaign info, call stats, contact list
9. Look for a **Start** button — click it
10. ✅ Campaign status should change to "Active"
11. Click **Stop** — ✅ status should go back to paused/stopped

---

## TEST 8 — Leads (Hot/Warm/Cold)

**Goal:** View and filter potential customer leads.

1. Click **Leads** in the left sidebar
2. ✅ A list of leads/contacts should show with a score or tier label (Hot, Warm, Cold)
3. Look for filter buttons at the top — click **Hot**
4. ✅ Only hot leads should show
5. Click **Warm** — ✅ only warm leads show
6. Click **Cold** — ✅ only cold leads show
7. Click on a lead's name
8. ✅ Should show their details — score, call history, notes

---

## TEST 9 — Callbacks (Follow-up Schedule)

**Goal:** Schedule a callback for a customer.

1. Click **Callbacks** in the left sidebar
2. ✅ You should see a list of scheduled callbacks (upcoming calls to make)
3. Click **Schedule Callback** or **Add Callback**
4. Fill in:
   - Customer/Contact
   - Date and Time for the callback
   - Reason (e.g. "Follow up on quote")
   - Priority: High / Medium / Low
5. Click **Save**
6. ✅ The callback should appear in the upcoming list
7. Click a callback and look for **Mark Complete** — click it
8. ✅ The callback should move out of the upcoming queue or be marked done

---

## TEST 10 — Live Calls

**Goal:** See the real-time call monitoring screen.

1. Click **Live Calls** in the left sidebar
2. ✅ A call monitoring screen should open
3. ✅ If there are active calls, you should see caller info, duration, agent name
4. ✅ If no active calls, the screen should show an empty state (no calls currently)
5. Click on any active call if visible
6. ✅ A monitor view should open showing call details and transcript

---

## TEST 11 — Orders (Inbound)

**Goal:** Create and track a customer order.

1. Click **Orders** in the left sidebar
2. ✅ List of orders should show with status tags (Pending, Confirmed, Delivered)
3. Click **Create Order** or **New Order**
4. Fill in:
   - Customer Name: e.g. "Ravi Kumar"
   - Phone: any phone number
   - Add an item (product, quantity, price)
   - Delivery Address: any address
5. Click **Save**
6. ✅ Order appears in the list with "Pending" status
7. Open the order — click **Confirm Order**
8. ✅ Status changes to "Confirmed"
9. Advance the status: Processing → Ready → Delivered
10. ✅ Each step should update the status tag
11. Try creating another order and click **Cancel** — ✅ status should show "Cancelled"

---

## TEST 12 — Inventory (Stock Management)

**Goal:** View and update product stock levels.

1. Click **Inventory** in the left sidebar
2. ✅ A list of products with their current stock quantities should show
3. ✅ Products with low stock should be highlighted or have a warning badge
4. Click on any product
5. Look for **Adjust Stock** or **Update** button
6. Enter a quantity change (e.g. add 50 units) and a reason (e.g. "Restock")
7. ✅ The stock number should update
8. Click **Stock History** or **Movements** if visible
9. ✅ Should show a log of all past stock changes

---

## TEST 13 — Payments

**Goal:** View payment history and details.

1. Click **Payments** in the left sidebar
2. ✅ A list of payments should show — with amount, date, status (Completed, Failed, Pending)
3. Look for a **Filter** or **Search** option — try filtering by "Failed"
4. ✅ Only failed payments should show
5. Click on any payment
6. ✅ Payment detail page should open showing amount, order info, method used
7. Look for a **Refund** button on a completed payment
8. ✅ Clicking it should show a refund confirmation dialog

---

## TEST 14 — Invoices

**Goal:** View and download invoices.

1. Click **Invoices** in the left sidebar
2. ✅ A list of invoices should show with invoice numbers and amounts
3. Click on any invoice
4. ✅ Invoice details page should show customer info, items, tax, total
5. Look for **Download** button — click it
6. ✅ A PDF should download to your computer

---

## TEST 15 — Knowledge Base

**Goal:** Add and search help articles.

1. Click **Knowledge Base** in the left sidebar
2. ✅ A list of articles should show
3. Click **Add Article** or **New Article**
4. Fill in:
   - Title: e.g. "Return Policy"
   - Content: any paragraph of text
   - Category: e.g. "Policies"
5. Click **Save**
6. ✅ Article appears in the list
7. Use the search bar — type "return"
8. ✅ Your new article should appear in the results
9. Click the article — ✅ full content should display
10. Click **Edit** — change something — **Save** — ✅ change should persist
11. Click **Delete** on an article — ✅ it should be removed from the list

---

## TEST 16 — Analytics

**Goal:** View charts and reports.

1. Click **Analytics** in the left sidebar
2. ✅ Charts and graphs should load (calls chart, revenue chart, etc.)
3. Look for a **Date Range** picker — change it to "Last 7 days"
4. ✅ Charts should refresh with updated data
5. Look for tabs or sections: Calls, Orders, Payments — click each one
6. ✅ Each tab should show relevant data
7. Look for an **Export** button — click it
8. ✅ A CSV or PDF file should download

---

## TEST 17 — Store Settings

**Goal:** Set up the store info, opening hours, and delivery areas.

1. Click **Store Settings** in the left sidebar
2. ✅ A form with store info should appear (Store Name, Phone, Address)
3. Fill in or update the store name and click **Save**
4. ✅ Should save without errors

**Opening Hours:**
5. Look for **Store Hours** section
6. Toggle Monday to "Open", set hours 9:00 AM to 10:00 PM
7. Toggle Sunday to "Closed"
8. Click **Save Hours**
9. ✅ Hours should save

**Delivery Zones:**
10. Look for **Delivery Zones** section
11. Click **Add Zone**
12. Fill in: Zone Name, Pincodes (e.g. 110001, 110002), Delivery Fee, Minimum Order
13. Click **Save**
14. ✅ New zone should appear in the list

---

## TEST 18 — Settings

**Goal:** Check app settings work.

1. Click **Settings** in the left sidebar
2. ✅ Settings page should open
3. Look for **Notification Preferences** — toggle some on/off and save
4. ✅ Preferences should save
5. Look for **API Keys** section if visible — ✅ should list any generated keys
6. Look for **Theme** toggle (Light/Dark mode) if present
7. ✅ Toggling should change the dashboard appearance

---

## TEST 19 — Notifications

**Goal:** Check notification bell works.

1. Look at the top right corner of the dashboard for a **bell icon**
2. ✅ It should show a red dot or number if there are unread notifications
3. Click the bell
4. ✅ A dropdown should show a list of notifications (e.g. "New order received")
5. Click a notification
6. ✅ Should navigate to the related page or mark as read
7. Look for **Mark All as Read** — click it
8. ✅ Red dot should disappear

---

## QUICK PASS/FAIL CHECKLIST

Go through each item and tick it off:

| # | What to Check | Pass? |
|---|--------------|-------|
| 1 | Login with demo credentials works | ☐ |
| 2 | Dashboard loads with stats and charts | ☐ |
| 3 | Profile page shows and saves changes | ☐ |
| 4 | Can add a team member | ☐ |
| 5 | Can create an Agent | ☐ |
| 6 | Can create a Campaign and Start it | ☐ |
| 7 | Leads list shows with Hot/Warm/Cold filter | ☐ |
| 8 | Can schedule a Callback and mark it complete | ☐ |
| 9 | Live Calls page opens (even if empty) | ☐ |
| 10 | Can create an Order and advance its status | ☐ |
| 11 | Inventory shows stock levels and allows adjustment | ☐ |
| 12 | Payments list loads and detail page opens | ☐ |
| 13 | Invoice can be viewed and downloaded | ☐ |
| 14 | Knowledge Base article can be added and searched | ☐ |
| 15 | Analytics charts load and date filter works | ☐ |
| 16 | Store Settings saves hours and delivery zones | ☐ |
| 17 | Notification bell shows and clears notifications | ☐ |

---

## WHAT TO NOTE IF SOMETHING BREAKS

When a page doesn't work, note down:
1. **Which page** you were on
2. **What you clicked** or typed
3. **What you expected** to happen
4. **What actually happened** (blank screen, error message, etc.)
5. Open browser → press **F12** → click **Console** tab → note any red error text

---

*Test on: http://localhost:5173 | Login: demo@example.com / demo123*
