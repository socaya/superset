# Re-thinking Public Dashboard Filters: Analysis & Solutions

## Executive Summary

We've attempted multiple approaches to implement filtering for public and authenticated dashboard views. All approaches have failed due to fundamental authentication constraints in Superset's architecture. This document analyzes what we've tried, why it failed, and proposes viable solutions.

---

## What We Have Tried

### Attempt 1: Native DashboardPage Component
**Approach**: Reuse Superset's native `DashboardPage` React component for both public and welcome pages.

**Implementation**:
- Import `DashboardPage` from `src/dashboard/containers/DashboardPage.tsx`
- Use Redux store and native dashboard hooks
- Render full dashboard with built-in filter support

**Why It Failed**:
- `DashboardPage` uses `/api/v1/dashboard/{id}` endpoint which requires authentication
- Public dashboards need `/api/v1/dashboard/public/{id}` endpoint
- Attempted to create custom hooks (`usePublicDashboard`, `usePublicDashboardCharts`) but sub-endpoints `/charts` and `/datasets` returned 404
- Backend doesn't expose public endpoints for dashboard sub-resources

**Errors Encountered**:
```
SupersetApiError: 404 Not Found
GET /api/v1/dashboard/{id} - 404 (requires auth)
GET /api/v1/dashboard/public/{id}/charts - 404 (endpoint doesn't exist)
GET /api/v1/dashboard/public/{id}/datasets - 404 (endpoint doesn't exist)
```

---

### Attempt 2: SuperChart with Public Data API
**Approach**: Use Superset's `SuperChart` component with `/api/v1/chart/{id}/public/data/` endpoint for public charts.

**Implementation**:
```typescript
// Fetch chart metadata
const chartMeta = await SupersetClient.get({
  endpoint: `/api/v1/chart/${chartId}`
});

// Fetch chart data using public endpoint
const dataEndpoint = isPublic
  ? `/api/v1/chart/${chartId}/public/data/`
  : `/api/v1/chart/${chartId}/data/`;

const dataResponse = await SupersetClient.get({ endpoint: dataEndpoint });

// Render with SuperChart
<SuperChart
  chartType={formData.viz_type}
  formData={formData}
  queriesData={queriesResponse}
/>
```

**Why It Failed**:
- Initial chart metadata fetch (`/api/v1/chart/{id}`) requires authentication even for public charts
- Many charts in database had been deleted (404 errors on charts 474-480)
- Cannot fetch metadata without authentication, so cannot render SuperChart

**Errors Encountered**:
```
GET /api/v1/chart/474 - 404 NOT FOUND (chart deleted)
GET /api/v1/chart/475 - 404 NOT FOUND (chart deleted)
GET /api/v1/chart/476 - 404 NOT FOUND (chart deleted)
...
```

---

### Attempt 3: Iframe Embedding with `/superset/explore/`
**Approach**: Render charts in iframes using Superset's explore view with standalone mode.

**Implementation**:
```typescript
const embedUrl = `/superset/explore/?slice_id=${chartId}&standalone=true`;

<iframe src={embedUrl} />
```

**Why It Failed**:
- `/superset/explore/` route requires authentication via `@has_access` decorator
- Public users (unauthenticated) get 403 FORBIDDEN errors
- Even with `standalone=true`, the explore React app makes authenticated API calls:
  - `POST /api/v1/explore/form_data` - 403 FORBIDDEN (trying to save form state)
  - Other internal explore APIs require auth

**Errors Encountered**:
```
POST /api/v1/explore/form_data?tab_id=4597454 - 403 FORBIDDEN
POST /api/v1/explore/form_data?tab_id=4597456 - 403 FORBIDDEN
Failed at altering browser history
```

---

### Attempt 4: Iframe with `/superset/explore/public/`
**Approach**: Create backend `PublicExploreView` to render explore without authentication.

**Implementation**:
```python
class PublicExploreView(BaseSupersetView):
    route_base = "/superset"

    @expose("/explore/public/", methods=("GET",))
    def public_explore(self) -> FlaskResponse:
        slice_id = request.args.get("slice_id")
        chart = db.session.query(Slice).filter_by(id=slice_id).first()

        if not getattr(chart, "is_public", False):
            abort(403, description="This chart is not public")

        return super().render_app_template()
```

**Why It Failed**:
- Backend route successfully renders explore template without auth
- However, the explore React app still makes authenticated API calls
- Same 403 errors as Attempt 3 because the frontend app doesn't know it's in "public mode"
- Explore app tries to save form data, fetch column values, etc. - all require auth

---

## Current State

### What Works
1. **Welcome Page (Authenticated Users)**:
   - ✅ Charts render in iframes using `/superset/explore/?slice_id={id}&standalone=true`
   - ✅ Filter bar fetches filter options from `/api/v1/datasource/table/{id}/column/{name}/values/`
   - ✅ No authentication errors

2. **Public Page (Unauthenticated Users)**:
   - ✅ Filter bar is hidden (no 401 errors for filter options)
   - ✅ Charts show placeholder message: "Chart preview not available on public page"
   - ❌ No actual charts display
   - ❌ No filters available

### What Doesn't Work
1. **Public Page Chart Rendering**: Cannot render charts in any form without authentication
2. **Public Page Filters**: Cannot fetch filter options or apply filters without authentication
3. **Filter Application**: Even if we had filters, charts couldn't receive filter updates without auth

---

## Filter Bar Design

### Current Implementation

```typescript
interface Filter {
  id: string;
  name: string;
  filterType: 'filter_select' | 'time_range' | 'date';
  targets: Array<{
    datasetId: number;
    column: { name: string };
  }>;
  controlValues?: {
    multiSelect?: boolean;
  };
}

// Filter bar features:
// 1. Fetches filter options from datasource column values API
// 2. Supports select (dropdown), multiselect, date range filters
// 3. Maintains local state until "Apply" is clicked
// 4. Passes filter values to charts via filterValues prop
```

### How Filters Work
1. Dashboard metadata includes `native_filters` configuration
2. Filter bar fetches column values: `/api/v1/datasource/table/{datasetId}/column/{columnName}/values/`
3. User selects filter values in UI
4. On "Apply" click, filter values are passed to all charts
5. Charts convert filter values to query parameters and re-render

### Why Filters Don't Work on Public Page
- **Step 2 fails**: Column values API requires authentication (401 UNAUTHORIZED)
- **Step 5 fails**: Charts need authentication to fetch filtered data

---

## Possible Solutions

### Solution 1: Public Filter Values API ⭐ RECOMMENDED
**Description**: Create public endpoint for fetching filter column values.

**Backend Changes**:
```python
# In superset/datasets/api.py
@expose("/public/<int:pk>/column/<column_name>/values/", methods=("GET",))
def get_public_column_values(self, pk: int, column_name: str) -> Response:
    """Get column values for public datasets (no auth required)."""
    dataset = db.session.query(Dataset).filter_by(id=pk).first()

    # Check if dataset is associated with any public charts
    has_public_charts = db.session.query(Slice).filter(
        Slice.datasource_id == pk,
        Slice.is_public == True
    ).first() is not None

    if not has_public_charts:
        abort(403, description="This dataset is not public")

    # Return column distinct values
    # ... (same logic as existing endpoint)
```

**Frontend Changes**:
```typescript
// In EnhancedHomeFilterBar.tsx
const endpoint = isPublic
  ? `/api/v1/datasource/public/${target.datasetId}/column/${column}/values/`
  : `/api/v1/datasource/table/${target.datasetId}/column/${column}/values/`;
```

**Pros**:
- Clean separation of public vs authenticated APIs
- Reuses existing filter UI components
- Maintains security (only public datasets exposed)

**Cons**:
- Requires backend development
- Need to determine "public dataset" logic
- Still need to solve chart rendering issue

---

### Solution 2: Chart Permalinks with Filters
**Description**: Use Superset's permalink feature to create shareable chart URLs with embedded filter state.

**Implementation**:
```typescript
// Create permalink with filters
const permalink = await SupersetClient.post({
  endpoint: '/api/v1/chart/permalink',
  postPayload: {
    formData: {
      slice_id: chartId,
      adhoc_filters: appliedFilters,
      // ... other form data
    }
  }
});

// Render chart using permalink
<iframe src={`/superset/explore/p/${permalink.key}/?standalone=true`} />
```

**Pros**:
- Uses existing Superset infrastructure
- Permalinks are designed for sharing
- Filters are encoded in permalink

**Cons**:
- Permalinks still require authentication to view
- Need to create new permalink every time filters change
- Adds database load (permalink storage)

---

### Solution 3: Pre-rendered Chart Images
**Description**: Pre-generate chart images with common filter combinations, serve as static images.

**Implementation**:
1. Backend job runs periodically
2. For each public chart, generate images with common filter values
3. Store images in object storage (S3, etc.)
4. Frontend displays images instead of live charts
5. Filter selection chooses which pre-rendered image to show

**Pros**:
- No authentication needed
- Fast loading (static images)
- Works for public users

**Cons**:
- Not real-time (images could be stale)
- Limited filter combinations (can't generate all possibilities)
- Significant infrastructure (storage, background jobs)
- Poor UX (not interactive)

---

### Solution 4: Public Dashboard Embedding with Guest Tokens
**Description**: Use Superset's embedded dashboard SDK with guest token authentication.

**Implementation**:
```typescript
// Backend generates guest token
POST /api/v1/security/guest_token/
{
  "user": { "username": "guest", "first_name": "Guest", "last_name": "User" },
  "resources": [{ "type": "dashboard", "id": "dashboard-uuid" }],
  "rls": []  // Row-level security rules
}

// Frontend uses embedded SDK
import { embedDashboard } from "@superset-ui/embedded-sdk";

embedDashboard({
  id: "dashboard-uuid",
  supersetDomain: "http://localhost:8088",
  mountPoint: document.getElementById("container"),
  fetchGuestToken: () => fetchGuestTokenFromBackend(),
  dashboardUiConfig: {
    filters: {
      visible: true,
      expanded: true
    }
  }
});
```

**Pros**:
- Official Superset embedding solution
- Filters work out of the box
- Real-time, interactive charts
- Security through guest tokens

**Cons**:
- Requires significant refactoring of our custom pages
- Need backend endpoint to generate guest tokens
- Guest token management complexity
- May not fit our custom UI requirements

---

### Solution 5: Separate Public Chart Rendering Service
**Description**: Create dedicated microservice for rendering public charts without authentication.

**Implementation**:
1. Separate Flask app that:
   - Has read-only database access
   - Implements public chart data endpoints
   - Renders charts as HTML/JSON
2. Main Superset app proxies to this service for public routes
3. Public pages iframe charts from public service

**Pros**:
- Complete separation of public/private
- Can optimize for public use case
- No authentication concerns

**Cons**:
- High complexity (new service to maintain)
- Deployment overhead
- Duplication of chart rendering logic
- Infrastructure costs

---

### Solution 6: Client-Side Only Filtering (No Server) ⭐ PRAGMATIC
**Description**: Fetch all chart data upfront, apply filters in browser using JavaScript.

**Implementation**:
```typescript
// 1. Fetch full chart data once (all rows)
const fullData = await fetch(`/api/v1/chart/${chartId}/public/data/`);

// 2. Store in React state
const [chartData, setChartData] = useState(fullData);
const [filterValues, setFilterValues] = useState({});

// 3. Filter data client-side when filters change
const filteredData = useMemo(() => {
  return chartData.filter(row => {
    return Object.entries(filterValues).every(([column, value]) => {
      return row[column] === value;
    });
  });
}, [chartData, filterValues]);

// 4. Re-render SuperChart with filtered data
<SuperChart formData={formData} queriesData={[{ data: filteredData }]} />
```

**Pros**:
- No backend changes needed
- Filters work without authentication
- Simple implementation
- Fast filter application (no network requests)

**Cons**:
- Large data transfer (all data upfront)
- Not suitable for huge datasets
- Client must implement filtering logic
- Filter options must be derived from data

---

## Recommended Approach

### Short-term: Solution 6 (Client-Side Filtering)
For immediate functionality with minimal changes:

1. Use SuperChart with `/api/v1/chart/{id}/public/data/` endpoint
2. Fetch all data upfront for public charts
3. Implement client-side filtering in JavaScript
4. Derive filter options from the data itself

### Long-term: Solution 4 (Guest Token Embedding)
For production-grade solution:

1. Implement guest token generation endpoint
2. Use Superset's official embedded SDK
3. Migrate custom pages to use embedded dashboard components
4. Benefit from official support and updates

---

## Technical Constraints Summary

### Authentication Requirements
| Endpoint | Auth Required | Public Alternative |
|----------|---------------|-------------------|
| `/api/v1/dashboard/{id}` | ✅ Yes | `/api/v1/dashboard/public/{id}` (exists) |
| `/api/v1/chart/{id}` | ✅ Yes | ❌ None |
| `/api/v1/chart/{id}/data/` | ✅ Yes | `/api/v1/chart/{id}/public/data/` (exists) |
| `/api/v1/datasource/.../values/` | ✅ Yes | ❌ None |
| `/superset/explore/` | ✅ Yes | ❌ None |
| `/api/v1/explore/form_data` | ✅ Yes | ❌ None |

### Key Insights
1. **Public data endpoints exist** for dashboard and chart data
2. **Public metadata endpoints are missing** for chart config, filter options
3. **Explore view is completely locked** to authenticated users
4. **No official public chart rendering** mechanism besides embedded SDK

---

## Next Steps

1. **Decision**: Choose between client-side filtering (quick) or guest tokens (proper)
2. **If client-side**: Implement data fetching and client-side filtering logic
3. **If guest tokens**: Implement token endpoint and migrate to embedded SDK
4. **Test**: Verify filters work on public page without authentication errors
5. **Optimize**: Handle large datasets, loading states, error cases

---

## Git Reset Command

To discard all current work and return to last commit:

```bash
# See what will be discarded
git status

# Discard all uncommitted changes (WARNING: PERMANENT)
git reset --hard HEAD

# Also clean untracked files if needed
git clean -fd

# Verify you're back to clean state
git status
```

**WARNING**: This will permanently delete all uncommitted work. Make sure you want to discard everything.

---

## Files Modified in This Session

1. `superset-frontend/src/features/home/PublicChartRenderer.tsx`
   - Changed from SuperChart → iframe → back to SuperChart → iframe again
   - Added filter parameter building
   - Added conditional rendering for public pages

2. `superset-frontend/src/features/home/DashboardContentArea.tsx`
   - Added filter state management
   - Conditionally hide filter bar on public pages
   - Conditionally show placeholder message for public charts

3. `superset-frontend/src/features/home/EnhancedHomeFilterBar.tsx`
   - Added error handling for 401/403 responses
   - Enable "tags mode" for manual input when options can't be fetched

4. `superset/views/explore.py`
   - Added `PublicExploreView` class (didn't work as expected)

5. `superset/dashboards/api.py`
   - Attempted to add public chart/dataset endpoints (routes didn't register)

6. `superset-frontend/src/hooks/apiResources/dashboards.ts`
   - Added custom public hooks (didn't work due to missing endpoints)

---

*Document created: 2025-11-26*
