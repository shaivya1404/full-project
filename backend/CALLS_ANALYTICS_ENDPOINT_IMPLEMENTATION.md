# /api/analytics/calls Endpoint Implementation

## Overview
Implemented the missing `/api/analytics/calls` endpoint that the frontend was trying to use but was returning 404 Not Found.

## Files Created

### 1. `/src/services/callAnalyticsService.ts`
Main service for aggregating call analytics data.

**Key Features:**
- `getCallAnalytics(filters)` - Main method that returns comprehensive call analytics
- `getSummary(filters)` - Calculates summary statistics (total calls, completed, failed, active, avg duration, avg sentiment, conversion rate)
- `getTrends(filters)` - Returns daily call trends with completed/failed breakdown
- `getCallsByStatus(filters)` - Returns call counts grouped by status
- `getTopReasons(filters)` - Returns top call reasons with conversion rates (uses status as reason)
- `getPeakHours(filters)` - Returns peak calling hours
- `filterCalls(filters)` - Private method to filter calls by teamId, date range, and campaignId

**Implementation Details:**
- Conversion rate calculated as: (calls with orders) / (completed calls)
- Campaign filtering works through orders since Call model doesn't have direct campaignId
- Sentiment averaged from all analytics records for each call
- Peak hours grouped by hour of day (0-23)
- Trends grouped by date in YYYY-MM-DD format

### 2. `/src/routes/analytics.ts`
Added the new route handler for `/api/analytics/calls`.

**Route:**
```
GET /api/analytics/calls
```

**Query Parameters (all optional):**
- `teamId` - Filter by team ID
- `startDate` - Start date for analytics (format: YYYY-MM-DD)
- `endDate` - End date for analytics (format: YYYY-MM-DD)
- `campaignId` - Filter by campaign ID (filters through orders)

**Response Format:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalCalls": 45,
      "completedCalls": 38,
      "failedCalls": 7,
      "activeOngoingCalls": 2,
      "averageCallDuration": 245,
      "averageSentiment": 0.85,
      "conversionRate": 0.84
    },
    "trends": [
      {
        "date": "2026-01-01",
        "calls": 12,
        "completed": 10,
        "failed": 2,
        "avgDuration": 250
      }
    ],
    "byStatus": {
      "completed": 38,
      "failed": 7,
      "abandoned": 3,
      "inProgress": 2
    },
    "topReasons": [
      {
        "reason": "order_placement",
        "count": 25,
        "conversionRate": 0.92
      }
    ],
    "peakHours": [
      {
        "hour": 10,
        "calls": 8
      }
    ]
  },
  "message": "Call analytics retrieved successfully"
}
```

**Error Handling:**
- 400 Bad Request for invalid date formats
- 500 Internal Server Error for database errors
- Proper error logging

### 3. Test Files Created

#### `/src/routes/analytics-calls.test.ts`
Tests for the route handler including:
- Successful analytics retrieval
- Team ID filtering
- Start date filtering
- End date filtering
- Campaign ID filtering
- Combined filters
- Invalid date format handling
- Empty data handling
- Error handling

#### `/src/services/callAnalyticsService.test.ts`
Tests for the service including:
- Complete analytics data retrieval
- Empty data handling
- Conversion rate calculation
- Average duration calculation
- Average sentiment calculation
- Trends grouping by date
- Peak hours identification
- Team ID filtering
- Date range filtering
- Campaign ID filtering

## Implementation Notes

### Database Queries
Uses Prisma to query calls with:
- Includes analytics records for sentiment calculation
- Includes orders for conversion rate calculation and campaign filtering
- Supports teamId, date range, and campaignId filters

### Status Mappings
- `completed` - Successfully completed calls
- `failed` - Failed calls
- `abandoned` - Abandoned calls
- `in_progress` or `active` - Currently active calls

### Campaign Filtering
Since the Call model doesn't have a direct campaignId field, campaign filtering works through orders:
```typescript
if (filters?.campaignId) {
  where.orders = {
    some: {
      campaignId: filters.campaignId,
    },
  };
}
```

### Conversion Rate Calculation
```typescript
const callsWithOrders = calls.filter(c => c.orders && c.orders.length > 0).length;
const conversionRate = completedCalls > 0 ? callsWithOrders / completedCalls : 0;
```

## Integration Points

### Frontend Integration
The frontend at `src/pages/Analytics.tsx` can now call:
```typescript
fetch('/api/analytics/calls')
  .then(res => res.json())
  .then(data => {
    // Display analytics
  });
```

### Existing Routes
This endpoint joins other analytics routes:
- `/api/analytics` - Aggregates and timeseries
- `/api/analytics/summary` - Summary analytics
- `/api/analytics/daily` - Daily analytics
- `/api/analytics/sentiment` - Sentiment analytics
- `/api/analytics/peak-hours` - Peak hours
- `/api/analytics/calls` - **NEW** Comprehensive call analytics

## Acceptance Criteria Met

✅ Endpoint returns 200 status
✅ Response format matches specification
✅ Returns correct data from database
✅ Handles all query parameters correctly (teamId, startDate, endDate, campaignId)
✅ Proper error handling for invalid inputs
✅ Frontend can receive data and display analytics
✅ No 404 errors when frontend calls endpoint
✅ Works with or without date filters
✅ Aggregates data correctly
✅ Includes comprehensive test coverage

## Example Usage

### Without filters
```bash
curl 'http://localhost:3000/api/analytics/calls'
```

### With team filter
```bash
curl 'http://localhost:3000/api/analytics/calls?teamId=team-123'
```

### With date range
```bash
curl 'http://localhost:3000/api/analytics/calls?startDate=2026-01-01&endDate=2026-01-31'
```

### With campaign filter
```bash
curl 'http://localhost:3000/api/analytics/calls?campaignId=campaign-456'
```

### With all filters
```bash
curl 'http://localhost:3000/api/analytics/calls?teamId=team-123&startDate=2026-01-01&endDate=2026-01-31&campaignId=campaign-456'
```

## Technical Details

### Performance Considerations
- All analytics queries run in parallel using Promise.all for better performance
- Database queries use proper indexes (teamId, createdAt) where available
- Filters applied at database level for efficiency
- No unnecessary data fetching

### Edge Cases Handled
- Empty database returns 0s, not nulls
- Invalid date formats return 400 Bad Request
- No analytics records for a call handled gracefully
- No orders for a call handled gracefully (conversion rate = 0)
- Multiple analytics records per call averaged correctly

### Error Handling
- All errors logged with appropriate context
- Errors passed to Express error handling middleware
- User-friendly error messages for client errors
