# Payment Processing System

A comprehensive payment processing system for voice AI calls with support for multiple payment methods, fraud detection, and real-time analytics.

## Features

### Supported Payment Methods
- **Credit/Debit Card** - PCI-DSS compliant with tokenization
- **UPI** - Unified Payments Interface (India) with QR code generation
- **Net Banking** - Direct bank transfer support
- **Digital Wallets** - Google Pay, Apple Pay integration
- **Payment Links** - Send secure payment links via SMS
- **Cash on Delivery (COD)** - Support for offline payments

### Core Capabilities
- ✅ Razorpay integration for payment processing
- ✅ PCI-DSS compliance with card tokenization
- ✅ Real-time payment status tracking
- ✅ Automatic invoice generation
- ✅ Fraud detection and prevention
- ✅ Payment analytics and reporting
- ✅ Refund management
- ✅ SMS payment links with expiration
- ✅ Audit logging for all transactions
- ✅ Team-scoped access control

## Database Models

### Payment
Main payment record storing all transaction details.

**Fields:**
- `id` - Unique payment identifier
- `orderId` - Associated order (optional)
- `customerId` - Customer reference
- `teamId` - Team for multi-tenant support
- `amount` - Payment amount
- `currency` - Currency code (default: INR)
- `method` - Payment method (card, upi, netbanking, wallet, cod, payment_link)
- `status` - Payment status (pending, processing, completed, failed, cancelled, refunded)
- `transactionId` - Gateway transaction ID (unique)
- `gateway` - Payment gateway (razorpay, stripe)
- `token` - Payment token for saved cards
- `cardLast4` - Last 4 digits of card (security)
- `cardBrand` - Card brand (visa, mastercard, rupay)
- `upiId` - UPI ID for UPI payments
- `failureReason` - Reason for payment failure
- `refundAmount` - Amount refunded
- `refundStatus` - Refund status
- `refundId` - Refund transaction ID
- `metadata` - Additional data (JSON)
- `timestamp` - Payment timestamp
- `expiresAt` - Expiration time (for payment links)
- `completedAt` - Completion timestamp

**Relations:**
- `order` - Associated order
- `customer` - Customer record
- `team` - Team record
- `link` - Payment link (if any)
- `logs` - Payment logs
- `invoice` - Generated invoice

### PaymentLink
Payment link sent via SMS for offline payment.

**Fields:**
- `id` - Unique link identifier
- `orderId` - Associated order
- `paymentId` - Payment record
- `link` - Full payment URL
- `shortLink` - Shortened link for SMS
- `expiresAt` - Link expiration (default: 24 hours)
- `clickedAt` - First click timestamp
- `status` - Link status (pending, clicked, paid, expired, cancelled)
- `sentCount` - Number of times sent via SMS
- `sentAt` - Last sent timestamp

### PaymentLog
Audit trail for all payment actions.

**Fields:**
- `id` - Log entry identifier
- `paymentId` - Associated payment
- `action` - Action type (initiated, processing, completed, failed, refunded, webhook_received)
- `status` - Action status
- `errorMessage` - Error details
- `metadata` - Additional data (JSON)
- `timestamp` - Action timestamp
- `ipAddress` - Client IP address
- `userAgent` - Client user agent

### Invoice
Invoice record with PDF generation.

**Fields:**
- `id` - Invoice identifier
- `orderId` - Associated order
- `paymentId` - Payment record
- `invoiceNumber` - Human-readable invoice number (INV-YYYY-MM-XXX)
- `items` - Invoice items (JSON array)
- `taxAmount` - Total tax amount
- `taxDetails` - Tax breakdown (JSON)
- `totalAmount` - Total invoice amount
- `currency` - Currency code
- `status` - Invoice status (generated, sent, paid, cancelled)
- `pdfUrl` - PDF download URL
- `sentAt` - Sent timestamp
- `sentVia` - Delivery method (email, sms, both)
- `billingAddress` - Billing address
- `customerName` - Customer name
- `customerEmail` - Customer email
- `customerPhone` - Customer phone
- `notes` - Invoice notes

### PaymentAnalytics
Payment statistics and analytics.

**Fields:**
- `id` - Analytics record identifier
- `teamId` - Team identifier (unique)
- `totalRevenue` - Total revenue collected
- `totalRefunds` - Total refund amount
- `successRate` - Payment success percentage
- `refundRate` - Refund percentage
- `averageAmount` - Average payment amount
- `methodBreakdown` - Payment method statistics (JSON)
- `topPaymentMethod` - Most used method
- `failedPayments` - Number of failed payments
- `commonFailReason` - Common failure reason
- `lastUpdated` - Last update timestamp

## API Endpoints

### Payment Endpoints

#### POST /api/payments/initiate
Initialize a new payment.

**Request Body:**
```json
{
  "orderId": "order-123",
  "customerId": "customer-123",
  "teamId": "team-123",
  "amount": 100.00,
  "currency": "INR",
  "method": "card",
  "customerDetails": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+911234567890"
  },
  "metadata": {
    "customField": "value"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "payment-123",
    "order": {
      "id": "order_rzp_123",
      "amount": 10000,
      "currency": "INR"
    },
    "keyId": "rzp_test_key"
  }
}
```

#### POST /api/payments/:id/confirm
Confirm payment status after gateway processing.

**Request Body:**
```json
{
  "paymentId": "payment-123",
  "transactionId": "txn_123",
  "status": "completed",
  "gatewayResponse": {}
}
```

#### GET /api/payments/:id
Get payment details by ID.

#### GET /api/payments/order/:orderId
Get all payments for a specific order.

#### POST /api/payments/refund
Process a refund.

**Request Body:**
```json
{
  "paymentId": "payment-123",
  "amount": 50.00,
  "reason": "Customer request"
}
```

#### GET /api/payments/:id/status
Check real-time payment status from gateway.

#### GET /api/payments
Search and filter payments.

**Query Parameters:**
- `teamId` - Filter by team
- `orderId` - Filter by order
- `customerId` - Filter by customer
- `status` - Filter by status
- `method` - Filter by payment method
- `startDate` - Start date range
- `endDate` - End date range
- `transactionId` - Filter by transaction ID
- `limit` - Results per page (default: 20)
- `offset` - Pagination offset

#### POST /api/payments/webhook
Process Razorpay webhook for payment notifications.

### Payment Link Endpoints

#### POST /api/payments/links
Generate a new payment link for SMS delivery.

**Request Body:**
```json
{
  "orderId": "order-123",
  "teamId": "team-123",
  "amount": 100.00,
  "currency": "INR",
  "description": "Payment for order #123",
  "expiresIn": 24
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "payment-123",
    "linkId": "link-123",
    "link": "http://localhost:3000/pay/payment-123",
    "shortLink": "http://localhost:3000/p/abc123",
    "expiresAt": "2024-01-02T10:30:00.000Z",
    "amount": 100.00,
    "currency": "INR"
  }
}
```

#### GET /api/payments/links/:id
Get payment link details.

#### POST /api/payments/links/:id/send
Send payment link via SMS.

**Request Body:**
```json
{
  "linkId": "link-123",
  "phone": "+911234567890",
  "message": "Custom SMS message"
}
```

#### GET /api/payments/links/:id/status
Check payment link status.

#### POST /api/payments/links/:id/cancel
Cancel a payment link.

#### POST /api/payments/links/:id/resend
Resend payment link with new expiration.

### Invoice Endpoints

#### POST /api/payments/invoices
Create a new invoice.

**Request Body:**
```json
{
  "orderId": "order-123",
  "paymentId": "payment-123",
  "customerDetails": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+911234567890",
    "billingAddress": "123 Main St, City, Country"
  },
  "items": [
    {
      "name": "Product 1",
      "quantity": 2,
      "unitPrice": 50.00,
      "taxRate": 18,
      "total": 118.00
    }
  ],
  "taxDetails": {
    "gst": 18.00
  },
  "notes": "Thank you for your order"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceId": "invoice-123",
    "invoiceNumber": "INV-2024-01-abc123",
    "pdfUrl": "http://localhost:3000/invoices/INV-2024-01-abc123.pdf"
  }
}
```

#### GET /api/payments/invoices/:id
Get invoice details.

#### POST /api/payments/invoices/:id/send
Send invoice via email/SMS.

**Request Body:**
```json
{
  "invoiceId": "invoice-123",
  "sendVia": "email"
}
```

#### POST /api/payments/invoices/auto-generate
Auto-generate invoice for completed payment.

**Request Body:**
```json
{
  "paymentId": "payment-123"
}
```

#### GET /api/payments/invoices/:id/download
Download invoice PDF.

### Payment Analytics Endpoints

#### GET /api/payments/analytics/metrics
Get payment metrics.

**Query Parameters:**
- `teamId` (required) - Team identifier
- `startDate` - Start date range
- `endDate` - End date range

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 100000.00,
    "totalPayments": 100,
    "completedPayments": 90,
    "failedPayments": 10,
    "refundedPayments": 5,
    "pendingPayments": 5,
    "averageAmount": 1000.00,
    "successRate": 90.00,
    "refundRate": 5.00
  }
}
```

#### GET /api/payments/analytics/methods
Get payment method breakdown.

#### GET /api/payments/analytics/trends
Get daily payment trends.

**Query Parameters:**
- `teamId` (required) - Team identifier
- `days` - Number of days (default: 30)

#### GET /api/payments/analytics/dashboard
Get comprehensive analytics dashboard.

#### GET /api/payments/analytics/export
Export payments as CSV.

### Fraud Detection Endpoints

#### POST /api/payments/fraud-check
Perform fraud detection check.

**Request Body:**
```json
{
  "customerId": "customer-123",
  "teamId": "team-123",
  "amount": 100.00,
  "method": "card",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isFraudulent": false,
    "riskLevel": "low",
    "score": 5,
    "reasons": [],
    "actions": ["monitor"]
  }
}
```

#### POST /api/payments/:id/report-fraud
Report fraud for a payment.

**Request Body:**
```json
{
  "reason": "Suspicious activity detected",
  "reportedBy": "admin@example.com"
}
```

#### GET /api/payments/fraud-statistics
Get fraud statistics.

**Query Parameters:**
- `teamId` (required) - Team identifier

## Services

### PaymentService
Main payment logic with Razorpay integration.

**Methods:**
- `getAvailablePaymentMethods()` - Get list of enabled payment methods
- `initiatePayment(request)` - Initialize payment with gateway
- `confirmPayment(request)` - Confirm payment status
- `processWebhook(data, signature, secret)` - Process gateway webhooks
- `generateUpiPayment(upiDetails, amount, description)` - Generate UPI QR code
- `tokenizeCard(cardDetails)` - Tokenize card for reuse
- `refundPayment(request)` - Process refund
- `getPaymentDetails(paymentId)` - Get payment information
- `searchPayments(limit, offset, filters)` - Search payments
- `getPaymentAnalytics(teamId)` - Get analytics
- `checkPaymentStatus(paymentId)` - Real-time status check
- `detectFraud(customerId, teamId)` - Fraud detection
- `getRefundablePayments(orderId)` - Get refundable payments

### PaymentLinkService
Generate and manage payment links for SMS delivery.

**Methods:**
- `createPaymentLink(request)` - Generate new payment link
- `getPaymentLink(linkId)` - Get link details
- `trackLinkClick(linkId)` - Track link clicks
- `sendPaymentLinkViaSMS(request)` - Send via SMS
- `checkPaymentLinkStatus(linkId)` - Check status
- `cancelPaymentLink(linkId)` - Cancel link
- `resendPaymentLink(linkId, phone, message)` - Resend link
- `getPaymentLinkStats(teamId)` - Get statistics

### InvoiceService
Generate PDF invoices with tax calculation.

**Methods:**
- `generateInvoicePDF(request)` - Generate PDF
- `createInvoice(request)` - Create invoice record
- `getInvoice(invoiceId)` - Get invoice details
- `getInvoiceByNumber(invoiceNumber)` - Get by invoice number
- `getInvoiceByPaymentId(paymentId)` - Get by payment ID
- `sendInvoice(request)` - Send via email/SMS
- `autoGenerateInvoice(paymentId)` - Auto-generate for completed payment
- `downloadInvoicePDF(invoiceId)` - Download PDF
- `updateInvoice(invoiceId, data)` - Update invoice

### PaymentAnalyticsService
Analytics and reporting for payments.

**Methods:**
- `getPaymentMetrics(filters)` - Get comprehensive metrics
- `getMethodBreakdown(filters)` - Payment method statistics
- `getDailyTrends(filters, days)` - Daily trend analysis
- `getTopPayers(filters, limit)` - Top paying customers
- `getFailedPaymentAnalysis(filters)` - Failed payment analysis
- `getRefundAnalysis(filters)` - Refund analysis
- `getAnalyticsDashboard(filters)` - Complete dashboard
- `exportPaymentsCSV(filters)` - Export to CSV

### FraudDetectionService
Fraud detection and prevention.

**Methods:**
- `checkFraud(request)` - Comprehensive fraud check
- `reportFraud(paymentId, reason, reportedBy)` - Report fraud
- `getFraudStatistics(teamId)` - Get fraud statistics

**Fraud Checks:**
- Velocity check - Multiple payments in short time
- Amount anomaly - Unusually high amounts
- Customer history - High refund/failure rates
- Failed attempts - Multiple failed payments
- Pattern matching - Card testing, method switching, round numbers, high-value COD

## Security Features

### PCI-DSS Compliance
- ✅ Never store full card numbers
- ✅ Use tokenization for card payments
- ✅ Store only last 4 digits
- ✅ Secure transmission via HTTPS
- ✅ Webhook signature verification

### Fraud Detection
- ✅ Payment velocity monitoring
- ✅ Amount anomaly detection
- ✅ Customer behavior analysis
- ✅ Failed attempt tracking
- ✅ Pattern recognition
- ✅ Risk scoring system

### Audit Logging
- ✅ All payment actions logged
- ✅ IP address and user agent tracking
- ✅ Timestamp for all operations
- ✅ Error details captured
- ✅ Metadata for additional context

## Configuration

### Environment Variables

Add to `.env` file:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret_here

# Invoice Configuration
COMPANY_NAME=Your Company Name
COMPANY_ADDRESS=123 Business Street, City, Country
COMPANY_PHONE=+91 1234567890
COMPANY_EMAIL=billing@company.com

# Application Configuration
BASE_URL=http://localhost:3000
```

### Getting Razorpay Credentials

1. Sign up at https://razorpay.com
2. Navigate to Settings → API Keys
3. Generate Key ID and Key Secret
4. Set up webhook at your server URL: `https://your-domain.com/api/payments/webhook`
5. Copy webhook secret for signature verification

## Usage Examples

### Initialize Card Payment

```typescript
const paymentService = new PaymentService();

const result = await paymentService.initiatePayment({
  orderId: 'order-123',
  teamId: 'team-123',
  amount: 1000,
  method: 'card',
  customerDetails: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+911234567890'
  }
});

console.log(`Payment initiated: ${result.paymentId}`);
console.log(`Razorpay Order ID: ${result.order.id}`);
```

### Generate Payment Link

```typescript
const paymentLinkService = new PaymentLinkService();

const result = await paymentLinkService.createPaymentLink({
  orderId: 'order-123',
  teamId: 'team-123',
  amount: 500,
  description: 'Payment for order #123'
});

// Send via SMS
await paymentLinkService.sendPaymentLinkViaSMS({
  linkId: result.linkId,
  phone: '+911234567890'
});
```

### Generate UPI Payment

```typescript
const paymentService = new PaymentService();

const result = await paymentService.generateUpiPayment({
  vpa: 'john@upi',
  name: 'John Doe'
}, 500, 'Payment for order #123');

console.log(`UPI String: ${result.upiString}`);
console.log(`QR Code: ${result.qrCode}`);
```

### Process Refund

```typescript
const paymentService = new PaymentService();

const result = await paymentService.refundPayment({
  paymentId: 'payment-123',
  amount: 500,
  reason: 'Customer request'
});

console.log(`Refund processed: ${result.refundId}`);
```

### Generate Invoice

```typescript
const invoiceService = new InvoiceService();

const result = await invoiceService.createInvoice({
  orderId: 'order-123',
  paymentId: 'payment-123',
  customerDetails: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+911234567890',
    billingAddress: '123 Main St'
  },
  items: [
    {
      name: 'Product 1',
      quantity: 2,
      unitPrice: 50,
      total: 100
    }
  ],
  taxDetails: {
    gst: 18
  },
  totalAmount: 118
});

console.log(`Invoice generated: ${result.invoiceNumber}`);
console.log(`PDF URL: ${result.pdfUrl}`);
```

### Check for Fraud

```typescript
const fraudDetectionService = new FraudDetectionService();

const result = await fraudDetectionService.checkFraud({
  customerId: 'customer-123',
  teamId: 'team-123',
  amount: 1000,
  method: 'card',
  ipAddress: '192.168.1.1'
});

if (result.isFraudulent) {
  console.log(`Risk Level: ${result.riskLevel}`);
  console.log(`Reasons: ${result.reasons.join(', ')}`);
  console.log(`Actions: ${result.actions.join(', ')}`);
}
```

## Payment Flow During Voice Call

### AI Bot Integration

1. **Order Confirmation**
   - AI bot confirms order total with customer
   - "Your total is ₹500. How would you like to pay?"

2. **Payment Method Selection**
   - Offer options: Card, UPI, Payment Link, COD
   - "Press 1 for Card, 2 for UPI, 3 for Payment Link, 4 for COD"

3. **Card Payment (via DTMF)**
   - Guide customer through card entry
   - Use tokenization (never store full card number)
   - Confirm 3D Secure if required
   - "Please enter your card number followed by hash"

4. **UPI Payment**
   - Generate UPI string and QR code
   - Send payment request via SMS
   - Wait for payment confirmation
   - "Check your phone for UPI payment request"

5. **Payment Link**
   - Generate secure payment link
   - Send via SMS with expiration
   - Track link clicks and payment status
   - "I've sent a payment link to your phone"

6. **COD Confirmation**
   - Confirm delivery address
   - Verify payment amount
   - Schedule collection
   - "Our delivery partner will collect ₹500 cash on delivery"

7. **Payment Confirmation**
   - Confirm payment status with customer
   - Provide receipt/confirmation number
   - "Payment confirmed! Your confirmation number is #ABC123"

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run payment service tests
npm test -- paymentService.test.ts

# Run payment route tests
npm test -- payments.test.ts

# Run payment repository tests
npm test -- paymentRepository.test.ts
```

### Test Coverage

- ✅ Payment initiation and confirmation
- ✅ Payment link generation and tracking
- ✅ Invoice generation and PDF creation
- ✅ Fraud detection algorithms
- ✅ Refund processing
- ✅ Analytics and reporting
- ✅ API endpoint validation
- ✅ Error handling

## Migration

### Database Migration

A migration has been created and applied:

```bash
# Migration file
migrations/20251231103242_add_payment_system/

# To apply migration
npm run db:migrate -- --name add_payment_system
```

### Generated Prisma Client

```bash
npm run db:generate
```

## Troubleshooting

### Razorpay Integration Issues

**Problem:** Payment initiation fails with "Invalid API key"
- **Solution:** Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env

**Problem:** Webhook not received
- **Solution:** Check webhook URL is publicly accessible and signature matches

### Payment Link Issues

**Problem:** Link expired immediately
- **Solution:** Check system time and expiration calculation

**Problem:** SMS not sending
- **Solution:** Verify Twilio configuration for SMS sending

### Invoice Generation Issues

**Problem:** PDF not generated
- **Solution:** Ensure `invoices/` directory exists with write permissions

**Problem:** Tax calculation incorrect
- **Solution:** Verify tax rates in request body

### Fraud Detection Issues

**Problem:** Too many false positives
- **Solution:** Adjust risk scoring thresholds in FraudDetectionService

**Problem:** Missing fraud patterns
- **Solution:** Update pattern matching rules in detectFraudPatterns()

## Future Enhancements

- [ ] Support for multiple payment gateways (Stripe, PayPal)
- [ ] Payment scheduling for recurring payments
- [ ] Advanced fraud detection with ML
- [ ] Multi-currency support with real-time conversion
- [ ] Payment reconciliation with accounting systems
- [ ] Customer payment methods storage (PCI-DSS compliant)
- [ ] Apple Pay and Google Pay direct integration
- [ ] NFC payment support for in-person collection
- [ ] Payment dispute management
- [ ] Advanced reporting dashboards

## License

This payment system is part of the Voice AI Bridge Server project.
