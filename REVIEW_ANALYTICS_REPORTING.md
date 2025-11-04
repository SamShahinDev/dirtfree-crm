# Review Analytics & Reporting System

## Overview

Comprehensive analytics and reporting system providing data-driven insights into review collection performance.

**Created:** 2025-10-22
**Status:** ✅ Complete and Production-Ready

---

## Features

### 📊 Analytics Charts

#### 1. Review Request Performance
- **Requests Sent vs Responses Received** - Dual-line chart showing volume trends
- **Response Rate Trend** - Percentage of customers responding over time
- **Google Conversion Rate Trend** - Click-through rate for Google review links

#### 2. Rating Distribution
- **Histogram of 1-5 Star Ratings** - Bar chart showing rating breakdown
- **Average Rating Over Time** - Trend line of customer satisfaction

#### 3. Review Source Breakdown
- **Portal vs Google** - Pie chart showing review completion types
- **Email vs SMS vs Portal Requests** - Pie chart showing request methods

#### 4. Response Time Metrics
- **Average Time from Request to Portal Review** - Measured in hours
- **Average Time from Portal Review to Google Click** - Measured in minutes
- Shows total sample size for each metric

#### 5. Follow-up Effectiveness
- **Low-Rating Resolution Rate** - Percentage of 1-3 star reviews resolved
- **Resolution Progress Bar** - Visual indicator of follow-up success
- **Resolved vs Pending Counts** - Split view of follow-up status

---

## File Structure

```
supabase/migrations/
└── 20251022000000_create_review_analytics_view.sql  # Analytics views

src/app/
├── (dashboard)/dashboard/reviews/analytics/
│   └── page.tsx                                    # Analytics dashboard UI
└── api/reviews/analytics/
    └── route.ts                                    # Analytics API endpoint
```

---

## Database Views

### 1. review_analytics_monthly

Monthly aggregated review request analytics.

**Schema:**
```sql
CREATE VIEW review_analytics_monthly AS
SELECT
  DATE_TRUNC('month', requested_at) as month,
  COUNT(*) as total_requests,
  COUNT(CASE WHEN portal_review_completed THEN 1 END) as portal_completions,
  COUNT(CASE WHEN google_review_completed THEN 1 END) as google_completions,
  COUNT(CASE WHEN request_method = 'email' THEN 1 END) as email_requests,
  COUNT(CASE WHEN request_method = 'sms' THEN 1 END) as sms_requests,
  COUNT(CASE WHEN request_method = 'portal' THEN 1 END) as portal_requests,
  AVG(CASE WHEN portal_review_rating IS NOT NULL THEN portal_review_rating END) as avg_rating,
  COUNT(CASE WHEN portal_review_rating = 5 THEN 1 END) as rating_5_count,
  COUNT(CASE WHEN portal_review_rating = 4 THEN 1 END) as rating_4_count,
  COUNT(CASE WHEN portal_review_rating = 3 THEN 1 END) as rating_3_count,
  COUNT(CASE WHEN portal_review_rating = 2 THEN 1 END) as rating_2_count,
  COUNT(CASE WHEN portal_review_rating = 1 THEN 1 END) as rating_1_count,
  ROUND(
    COUNT(CASE WHEN portal_review_completed THEN 1 END)::DECIMAL /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as portal_response_rate,
  ROUND(
    COUNT(CASE WHEN google_review_link_clicked THEN 1 END)::DECIMAL /
    NULLIF(COUNT(CASE WHEN google_review_requested THEN 1 END), 0) * 100,
    2
  ) as google_conversion_rate
FROM review_requests
GROUP BY DATE_TRUNC('month', requested_at)
ORDER BY month DESC;
```

**Columns:**
- `month` - Month start date
- `total_requests` - Total review requests sent
- `portal_completions` - Portal reviews completed
- `google_completions` - Google reviews completed
- `email_requests` - Requests sent via email
- `sms_requests` - Requests sent via SMS
- `portal_requests` - Requests sent via portal notification
- `avg_rating` - Average rating for the month
- `rating_X_count` - Count of each rating (1-5)
- `portal_response_rate` - Percentage of requests completed via portal
- `google_conversion_rate` - Percentage of Google links clicked

---

### 2. review_analytics_weekly

Weekly aggregated analytics with identical schema to monthly view.

**Period Column:** `week` (week start date)

---

### 3. review_analytics_daily

Daily aggregated analytics with identical schema to monthly view.

**Period Column:** `day` (date)

---

## API Endpoint

### GET /api/reviews/analytics

Returns comprehensive analytics data for review system performance.

**Authentication:** Staff only (admin, manager, dispatcher)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `weekly` | Time granularity: `daily`, `weekly`, or `monthly` |
| `start_date` | ISO date | 90 days ago | Start of analysis period |
| `end_date` | ISO date | Today | End of analysis period |

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/reviews/analytics?period=weekly&start_date=2025-07-01&end_date=2025-10-22"
```

**Response Schema:**
```typescript
{
  success: true,
  data: {
    period: 'weekly' | 'daily' | 'monthly',
    date_range: {
      start: string,  // ISO date
      end: string     // ISO date
    },
    summary: {
      total_requests: number,
      total_responses: number,
      response_rate: number,        // Percentage
      avg_rating: number,            // 0-5
      google_conversion_rate: number // Percentage
    },
    trends: Array<{
      week?: string,                 // Period start date
      month?: string,
      day?: string,
      total_requests: number,
      portal_completions: number,
      google_completions: number,
      email_requests: number,
      sms_requests: number,
      portal_requests: number,
      avg_rating: number,
      rating_5_count: number,
      rating_4_count: number,
      rating_3_count: number,
      rating_2_count: number,
      rating_1_count: number,
      portal_response_rate: number,
      google_conversion_rate: number
    }>,
    rating_distribution: {
      rating_1: number,
      rating_2: number,
      rating_3: number,
      rating_4: number,
      rating_5: number
    },
    source_breakdown: {
      portal_reviews: number,
      google_reviews: number,
      email_requests: number,
      sms_requests: number,
      portal_requests: number
    },
    response_times: {
      avg_request_to_portal_hours: number,
      avg_portal_to_google_minutes: number,
      total_portal_responses: number,
      total_google_clicks: number
    },
    follow_up_effectiveness: {
      total_low_ratings: number,
      resolved_count: number,
      resolution_rate: number,      // Percentage
      pending_count: number
    }
  },
  version: 'v1',
  timestamp: string
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "period": "weekly",
    "date_range": {
      "start": "2025-07-23T00:00:00.000Z",
      "end": "2025-10-22T23:59:59.999Z"
    },
    "summary": {
      "total_requests": 234,
      "total_responses": 178,
      "response_rate": 76.1,
      "avg_rating": 4.6,
      "google_conversion_rate": 68.5
    },
    "trends": [
      {
        "week": "2025-10-14T00:00:00.000Z",
        "total_requests": 45,
        "portal_completions": 32,
        "google_completions": 24,
        "email_requests": 30,
        "sms_requests": 15,
        "portal_requests": 0,
        "avg_rating": 4.7,
        "rating_5_count": 20,
        "rating_4_count": 10,
        "rating_3_count": 2,
        "rating_2_count": 0,
        "rating_1_count": 0,
        "portal_response_rate": 71.1,
        "google_conversion_rate": 75.0
      }
    ],
    "rating_distribution": {
      "rating_1": 3,
      "rating_2": 5,
      "rating_3": 12,
      "rating_4": 58,
      "rating_5": 100
    },
    "source_breakdown": {
      "portal_reviews": 178,
      "google_reviews": 122,
      "email_requests": 156,
      "sms_requests": 78,
      "portal_requests": 0
    },
    "response_times": {
      "avg_request_to_portal_hours": 26.4,
      "avg_portal_to_google_minutes": 8.2,
      "total_portal_responses": 178,
      "total_google_clicks": 122
    },
    "follow_up_effectiveness": {
      "total_low_ratings": 20,
      "resolved_count": 16,
      "resolution_rate": 80.0,
      "pending_count": 4
    }
  },
  "version": "v1",
  "timestamp": "2025-10-22T12:00:00.000Z"
}
```

---

## Metric Calculations

### Response Rate
```typescript
response_rate = (total_responses / total_requests) * 100
```
- **total_responses** = Count where `portal_review_completed = true`
- **total_requests** = Total review requests sent

---

### Average Rating
```typescript
avg_rating = SUM(portal_review_rating) / COUNT(portal_review_rating)
```
- Only includes reviews with ratings (not null)
- Scale: 0.0 to 5.0

---

### Google Conversion Rate
```typescript
google_conversion_rate = (google_clicks / google_requested) * 100
```
- **google_clicks** = Count where `google_review_link_clicked = true`
- **google_requested** = Count where `google_review_requested = true`

---

### Average Request to Portal Time
```typescript
avg_request_to_portal_hours = AVG(
  (portal_review_submitted_at - requested_at) / 3600000
)
```
- Measured in hours
- Only includes completed portal reviews

---

### Average Portal to Google Time
```typescript
avg_portal_to_google_minutes = AVG(
  (google_review_clicked_at - portal_review_submitted_at) / 60000
)
```
- Measured in minutes
- Only includes reviews where Google link was clicked

---

### Follow-up Resolution Rate
```typescript
resolution_rate = (resolved_low_ratings / total_low_ratings) * 100
```
- **total_low_ratings** = Reviews with rating ≤ 3
- **resolved_low_ratings** = Low-rating reviews with resolved support tickets
- Support tickets queried from `support_tickets` table via `metadata.review_request_id`

---

## Dashboard UI

### Location
`/dashboard/reviews/analytics`

### Components

#### Header Controls
- **Period Selector**: Daily / Weekly / Monthly
- **Date Range Selector**: Last 30/60/90/180/365 days
- **Refresh Button**: Manual data refresh

#### Summary Cards (5 total)
1. **Total Requests** - Review requests sent
2. **Response Rate** - Percentage with response count
3. **Average Rating** - Out of 5.0 stars
4. **Google Conversion** - Link click-through percentage
5. **Resolution Rate** - Low-rating resolution percentage

#### Charts (9 total)

**1. Review Request Performance** (Full-width line chart)
- Dual-line chart: Requests sent (blue) vs Responses received (green)
- X-axis: Time periods
- Y-axis: Count

**2. Response Rate Trend** (Line chart)
- Portal review response rate over time
- Shows percentage trend
- Purple line

**3. Google Conversion Trend** (Line chart)
- Google review link click-through rate
- Shows percentage trend
- Green line

**4. Rating Distribution** (Bar chart)
- Histogram of 1-5 star ratings
- Color-coded bars:
  - 1 star: Red (#ef4444)
  - 2 stars: Orange (#f97316)
  - 3 stars: Yellow (#f59e0b)
  - 4 stars: Lime (#84cc16)
  - 5 stars: Green (#10b981)

**5. Average Rating Over Time** (Line chart)
- Trend of average customer ratings
- Y-axis: 0-5 scale
- Orange line

**6. Review Type Breakdown** (Pie chart)
- Portal reviews vs Google reviews
- Blue and green slices

**7. Request Method Breakdown** (Pie chart)
- Email vs SMS vs Portal requests
- Blue, purple, and green slices

**8. Response Time Metrics** (Stat card)
- Request to Portal Review: X hours
- Portal to Google Click: X minutes
- Shows sample sizes

**9. Follow-up Effectiveness** (Progress card)
- Resolution progress bar
- Resolved vs Pending counts
- Resolution rate percentage

---

## Chart Configuration

### Library
**Recharts** - React charting library

### Chart Types Used
- `LineChart` - Trend analysis
- `BarChart` - Distribution analysis
- `PieChart` - Composition analysis

### Color Palette
```typescript
const COLORS = {
  primary: '#3b82f6',      // Blue
  secondary: '#8b5cf6',    // Purple
  success: '#10b981',      // Green
  warning: '#f59e0b',      // Orange
  danger: '#ef4444',       // Red
  rating1: '#ef4444',      // Red
  rating2: '#f97316',      // Orange
  rating3: '#f59e0b',      // Yellow
  rating4: '#84cc16',      // Lime
  rating5: '#10b981',      // Green
}
```

---

## Data Flow

### Dashboard Load Sequence

```
1. Component mounts
   ↓
2. useEffect triggers fetchAnalytics()
   ↓
3. Calculate date range based on selection
   ↓
4. Build query params (period, start_date, end_date)
   ↓
5. GET /api/reviews/analytics?params
   ↓
6. API queries:
   - View: review_analytics_{period}
   - Table: review_requests (for detailed calculations)
   - Table: support_tickets (for follow-up metrics)
   ↓
7. Calculate metrics:
   - Summary statistics
   - Rating distribution
   - Source breakdown
   - Response times
   - Follow-up effectiveness
   ↓
8. Return aggregated data
   ↓
9. Transform data for charts
   ↓
10. Render all charts with data
```

### Filter Change Flow

```
1. User changes period or date range
   ↓
2. useEffect dependency triggers
   ↓
3. Re-fetch analytics with new params
   ↓
4. Update all charts with new data
```

---

## Performance Optimizations

### Database Views
- **Pre-aggregated Data**: Views calculate common metrics once
- **Indexed Columns**: `requested_at` indexed for fast date filtering
- **Efficient Grouping**: Uses `DATE_TRUNC` for period grouping

### API Optimizations
- **Single View Query**: One query for trend data
- **Bulk Processing**: All reviews fetched once, filtered in memory
- **Parallel Queries**: View and table queries run in parallel
- **Result Caching**: Frontend state prevents unnecessary re-fetches

### Frontend Optimizations
- **Lazy Rendering**: Charts only render when data available
- **Responsive Containers**: Charts adapt to screen size
- **Data Transformation**: Performed once, memoized
- **Loading States**: Prevents render thrashing

---

## Access Control

### Staff Roles with Access:
- ✅ Admin
- ✅ Manager
- ✅ Dispatcher

### Verification:
```typescript
async function verifyStaffAuth(supabase: any, userId: string): Promise<boolean> {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()

  return userRole && ['admin', 'manager', 'dispatcher'].includes(userRole.role)
}
```

---

## Error Handling

### API Errors
```json
{
  "success": false,
  "error": "error_code",
  "message": "Human-readable message",
  "version": "v1"
}
```

### Error Codes:
- `unauthorized` (401) - Not authenticated
- `forbidden` (403) - Not staff member
- `fetch_failed` (500) - Database query error
- `server_error` (500) - General server error

### Frontend Error Handling
- Try-catch blocks around API calls
- Console error logging
- Fallback to "No data available" message
- Loading state prevents empty renders

---

## Testing Checklist

### Manual Testing

#### Summary Cards
- [ ] All 5 cards display correct values
- [ ] Values update when filters change
- [ ] Percentages formatted to 1 decimal place
- [ ] Response count displayed

#### Performance Chart
- [ ] Dual-line chart renders
- [ ] Blue line (requests) and green line (responses)
- [ ] X-axis labels formatted correctly
- [ ] Hover tooltips show values

#### Response Rate Trend
- [ ] Purple line renders
- [ ] Y-axis shows percentages
- [ ] Data matches summary card

#### Google Conversion Trend
- [ ] Green line renders
- [ ] Trend correlates with summary

#### Rating Distribution
- [ ] 5 bars displayed
- [ ] Color-coded correctly (red to green)
- [ ] Heights match counts

#### Average Rating Trend
- [ ] Orange line renders
- [ ] Y-axis limited to 0-5 range
- [ ] Shows rating fluctuations

#### Review Type Pie Chart
- [ ] Two slices (portal and Google)
- [ ] Labels show counts
- [ ] Colors distinct

#### Request Method Pie Chart
- [ ] Three slices (email, SMS, portal)
- [ ] Labels show counts
- [ ] Proportions accurate

#### Response Time Metrics
- [ ] Request to portal hours displayed
- [ ] Portal to Google minutes displayed
- [ ] Sample sizes shown

#### Follow-up Effectiveness
- [ ] Progress bar width matches percentage
- [ ] Resolved/pending counts correct
- [ ] Resolution rate accurate

#### Filters
- [ ] Period selector changes data
- [ ] Date range selector works
- [ ] Refresh button re-fetches data

---

## Use Cases

### 1. Performance Monitoring
**Goal:** Track overall review collection effectiveness

**Metrics to Watch:**
- Response rate trend
- Average rating over time
- Google conversion rate

**Action Items:**
- If response rate drops below 60%, review request timing
- If average rating drops below 4.0, investigate service quality
- If Google conversion drops, review portal UX

---

### 2. Channel Optimization
**Goal:** Determine best request method (email vs SMS)

**Metrics to Watch:**
- Request method breakdown
- Response rate by method (compare email vs SMS weeks)

**Action Items:**
- Allocate budget to higher-performing channel
- Test different messaging for lower-performing channel

---

### 3. Follow-up Improvement
**Goal:** Increase resolution of low-rating reviews

**Metrics to Watch:**
- Follow-up effectiveness resolution rate
- Low-rating count trend

**Action Items:**
- If resolution rate < 70%, review follow-up process
- Track time to resolution
- Train staff on customer recovery

---

### 4. Seasonal Analysis
**Goal:** Understand seasonal patterns in reviews

**Metrics to Watch:**
- Monthly view of requests/responses
- Rating distribution by month

**Action Items:**
- Identify busy/slow seasons
- Adjust request frequency accordingly
- Plan promotions around high-rating periods

---

## Future Enhancements

### Planned Features

1. **Export Functionality**
   - CSV export of trend data
   - PDF report generation
   - Scheduled email reports

2. **Advanced Filtering**
   - Filter by service type
   - Filter by technician
   - Filter by customer segment
   - Multiple date range comparison

3. **Predictive Analytics**
   - Forecast response rates
   - Predict rating trends
   - Identify at-risk customers

4. **Goal Setting**
   - Set target response rate
   - Track against goals
   - Alert when below target

5. **Cohort Analysis**
   - Customer lifetime review behavior
   - First-time vs repeat customer ratings
   - Service type performance comparison

6. **Real-time Alerts**
   - Low rating notifications
   - Response rate threshold alerts
   - Daily/weekly digest emails

7. **Comparative Views**
   - Month-over-month comparison
   - Year-over-year comparison
   - Benchmark against industry standards

---

## Dependencies

### UI Components (Shadcn)
- `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`
- `Button`
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
- `Badge`

### Charts (Recharts)
- `LineChart`, `Line`
- `BarChart`, `Bar`
- `PieChart`, `Pie`, `Cell`
- `XAxis`, `YAxis`
- `CartesianGrid`
- `Tooltip`, `Legend`
- `ResponsiveContainer`

### Icons (Lucide React)
- `TrendingUp` - Trends
- `Star` - Ratings
- `Clock` - Time metrics
- `Target` - Goals/conversion
- `CheckCircle` - Success
- `MessageSquare` - Reviews
- `Send` - Requests
- `Mail` - Email
- `Phone` - SMS
- `Globe` - Google

### API Libraries
- `@/lib/supabase/server` - Database client

---

## Database Schema Dependencies

### Tables Used
- `review_requests` - Source data
- `support_tickets` - Follow-up resolution tracking

### Views Created
- `review_analytics_monthly`
- `review_analytics_weekly`
- `review_analytics_daily`

### Key Fields
```sql
-- review_requests
requested_at timestamptz
portal_review_completed boolean
portal_review_submitted_at timestamptz
portal_review_rating integer
google_review_requested boolean
google_review_link_clicked boolean
google_review_clicked_at timestamptz
request_method varchar(20)

-- support_tickets
status varchar(20)
metadata jsonb
```

---

## Production Deployment

### Environment Variables Required
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### Deployment Steps
1. ✅ Apply database migration (create views)
2. ✅ Deploy API endpoint
3. ✅ Deploy dashboard UI
4. ✅ Test with sample data
5. ⏳ Deploy to production
6. ⏳ Monitor query performance
7. ⏳ Verify chart rendering
8. ⏳ Test with real data

### Post-Deployment Monitoring
- Watch API response times (target < 1s)
- Monitor view query performance
- Check chart render times
- Verify data accuracy

---

## Troubleshooting

### Issue: Charts Not Rendering
**Symptoms:** Blank chart areas
**Solutions:**
1. Check browser console for errors
2. Verify API response contains `trends` array
3. Ensure data transformation is correct
4. Check Recharts dependency is installed

### Issue: Incorrect Metrics
**Symptoms:** Numbers don't match expectations
**Solutions:**
1. Verify date range filter
2. Check timezone handling
3. Review view query logic
4. Compare with raw table data

### Issue: Slow Load Times
**Symptoms:** Dashboard takes > 3 seconds to load
**Solutions:**
1. Add indexes on `requested_at`
2. Reduce date range
3. Use monthly period for large datasets
4. Consider materialized views for better performance

---

## Related Documentation
- [REVIEW_SYSTEM_IMPLEMENTATION.md](./REVIEW_SYSTEM_IMPLEMENTATION.md) - Base review system
- [AUTOMATED_REVIEW_REQUEST_SYSTEM.md](./AUTOMATED_REVIEW_REQUEST_SYSTEM.md) - Auto-request system
- [REVIEW_PORTAL_INTERFACE.md](./REVIEW_PORTAL_INTERFACE.md) - Customer portal
- [REVIEW_MANAGEMENT_DASHBOARD.md](./REVIEW_MANAGEMENT_DASHBOARD.md) - Staff management dashboard

---

## Changelog

### 2025-10-22 - Initial Release
- ✅ Created 3 database views (daily, weekly, monthly)
- ✅ Implemented analytics API endpoint
- ✅ Built comprehensive dashboard UI with 9 charts
- ✅ Added 5 summary metric cards
- ✅ Implemented flexible date range filtering
- ✅ Added period granularity selector
- ✅ TypeScript compilation successful
- ✅ Documentation complete

---

**Status:** ✅ Production-Ready
**Next Steps:** Deploy and monitor performance with real-world data
