# Action Plan: Public Filters & Charts Implementation
## Uganda Malaria Data Repository - Superset Customization

**Goal**: Enable public dashboards with functional filters and charts (no authentication required)

**Status**: Ready to implement
**Start Date**: 2025-11-26
**Estimated Duration**: 2-3 days (14-20 hours)

---

## 📋 Overview

### Problem Statement
Public dashboards cannot display charts or filters because:
1. Chart metadata requires authentication (`/api/v1/chart/{id}`)
2. Filter column values require authentication (`/api/v1/datasource/table/{id}/column/{name}/values/`)
3. Current iframe approach fails with 403 FORBIDDEN errors

### Solution Summary
Add 3 public API endpoints + update frontend to use SuperChart instead of iframes:

```
Backend:  /api/v1/chart/public/{id}/                           [NEW]
Backend:  /api/v1/datasource/public/{id}/column/{name}/values/ [NEW]
Backend:  /api/v1/dashboard/public/{id}                        [ENHANCE]
Frontend: Switch from iframes to SuperChart                     [MODIFY]
```

---

## 🎯 Phase 1: Backend APIs (6-8 hours)

### Task 1.1: Create Public Chart Metadata Endpoint

**File**: `superset/charts/api.py`

**Endpoint**: `GET /api/v1/chart/public/{id}/`

**Implementation**:
```python
@expose("/public/<int:pk>/", methods=("GET",))
@statsd_metrics
@event_logger.log_this_with_context(
    action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_public_chart_metadata",
    log_to_statsd=False,
)
def get_public_chart_metadata(self, pk: int) -> Response:
    """
    Get chart metadata for public charts (no authentication required).
    Only works for charts marked as is_public=True.
    ---
    get:
      summary: Return metadata for a public chart
      parameters:
      - in: path
        schema:
          type: integer
        name: pk
        description: The chart ID
      responses:
        200:
          description: Chart metadata
        403:
          description: Chart is not public
        404:
          description: Chart not found
    """
    try:
        chart = db.session.query(Slice).filter_by(id=pk).first()

        if not chart:
            return self.response_404()

        if not getattr(chart, "is_public", False):
            return self.response(
                403,
                message="This chart is not public. Please log in to view it."
            )

        # Use existing schema to serialize chart metadata
        result = self.chart_entity_response_schema.dump(chart)

        return self.response(200, result=result)

    except Exception as ex:
        logger.error(f"Error fetching public chart metadata {pk}: {ex}")
        return self.response_500(message=str(ex))
```

**Returns**:
```json
{
  "id": 123,
  "slice_name": "Malaria Cases by District",
  "viz_type": "bar",
  "params": "{\"metrics\":[\"count\"],\"groupby\":[\"district\"]}",
  "datasource_id": 45,
  "datasource_type": "table",
  "is_public": true,
  "cache_timeout": 3600,
  "description": "Chart description"
}
```

**Testing**:
```bash
# Should return metadata
curl http://localhost:8088/api/v1/chart/public/123/

# Should return 403 if not public
curl http://localhost:8088/api/v1/chart/public/456/

# Should return 404 if doesn't exist
curl http://localhost:8088/api/v1/chart/public/99999/
```

**Validation Checklist**:
- [ ] Endpoint returns 200 for public charts
- [ ] Endpoint returns 403 for non-public charts
- [ ] Endpoint returns 404 for non-existent charts
- [ ] Response includes all necessary fields (viz_type, params, datasource_id)
- [ ] No authentication required
- [ ] Logged in event_logger

---

### Task 1.2: Create Public Datasource Column Values Endpoint

**File**: `superset/datasets/api.py` (or create `superset/datasets/public_api.py` if cleaner)

**Endpoint**: `GET /api/v1/datasource/public/{pk}/column/{column_name}/values/`

**Implementation**:
```python
@expose("/public/<int:pk>/column/<column_name>/values/", methods=("GET",))
@statsd_metrics
@event_logger.log_this_with_context(
    action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_public_column_values",
    log_to_statsd=False,
)
def get_public_column_values(self, pk: int, column_name: str) -> Response:
    """
    Get distinct column values for public datasets.
    Only works if the dataset is used by at least one public chart.
    ---
    get:
      summary: Return distinct values for a column in a public dataset
      parameters:
      - in: path
        schema:
          type: integer
        name: pk
        description: The dataset ID
      - in: path
        schema:
          type: string
        name: column_name
        description: The column name
      - in: query
        schema:
          type: string
        name: q
        description: Query parameters (filters, page, page_size)
      responses:
        200:
          description: Column values
        403:
          description: Dataset is not public
        404:
          description: Dataset or column not found
    """
    try:
        # Security check: Verify dataset has at least one public chart
        from superset.models.slice import Slice

        has_public_charts = db.session.query(Slice).filter(
            Slice.datasource_id == pk,
            Slice.datasource_type == "table",
            Slice.is_public == True
        ).first() is not None

        if not has_public_charts:
            return self.response(
                403,
                message="This dataset is not public. No public charts use it."
            )

        # Get dataset
        dataset = db.session.query(SqlaTable).filter_by(id=pk).first()
        if not dataset:
            return self.response_404()

        # Parse query parameters
        query_params = request.args.get("q", "{}")
        try:
            params = json.loads(query_params)
        except json.JSONDecodeError:
            params = {}

        filters = params.get("filters", [])
        page = params.get("page", 0)
        page_size = params.get("page_size", 1000)

        # Get distinct column values (reuse existing logic from DatasourceRestApi)
        # This is simplified - actual implementation should use dataset.get_column_values()
        from superset.connectors.sqla.models import SqlaTable

        column = None
        for col in dataset.columns:
            if col.column_name == column_name:
                column = col
                break

        if not column:
            return self.response_404()

        # Fetch distinct values
        try:
            values = dataset.values_for_column(
                column_name=column_name,
                limit=page_size
            )

            result = list(values)

            return self.response(200, result=result)

        except Exception as ex:
            logger.error(f"Error fetching column values: {ex}")
            return self.response_500(message=str(ex))

    except Exception as ex:
        logger.error(f"Error in get_public_column_values: {ex}")
        return self.response_500(message=str(ex))
```

**Returns**:
```json
{
  "result": ["Kampala", "Wakiso", "Mukono", "Jinja", ...]
}
```

**Testing**:
```bash
# Should return column values if dataset has public charts
curl 'http://localhost:8088/api/v1/datasource/public/75/column/country_name/values/?q=%7B%22filters%22%3A%5B%5D%2C%22page%22%3A0%2C%22page_size%22%3A1000%7D'

# Should return 403 if dataset has no public charts
curl 'http://localhost:8088/api/v1/datasource/public/99/column/some_column/values/?q=%7B%7D'
```

**Validation Checklist**:
- [ ] Endpoint returns 200 with values for public datasets
- [ ] Endpoint returns 403 for private datasets
- [ ] Endpoint returns 404 for non-existent datasets/columns
- [ ] Values are distinct and limited by page_size
- [ ] No authentication required
- [ ] Security check validates at least one public chart exists

---

### Task 1.3: Enhance Public Dashboard Metadata Endpoint

**File**: `superset/dashboards/api.py`

**Endpoint**: `GET /api/v1/dashboard/public/{id}` (ENHANCE EXISTING)

**Current State** (from commit `38a32cedf3`):
```python
@expose("/public/<pk>", methods=("GET",))
def get_public_dashboard(self, pk: str) -> Response:
    dash = db.session.query(Dashboard).filter_by(id=pk).first()
    if not dash or not dash.published:
        return self.response_404()
    return self.response(200, result=self.dashboard_entity_response_schema.dump(dash))
```

**Enhancement Required**:
Add chart IDs and dataset IDs to response.

**Modified Implementation**:
```python
@expose("/public/<pk>", methods=("GET",))
@statsd_metrics
@event_logger.log_this_with_context(
    action=lambda self, *args, **kwargs: f"{self.__class__.__name__}.get_public_dashboard",
    log_to_statsd=False,
)
def get_public_dashboard(self, pk: str) -> Response:
    """
    Get a public dashboard (no authentication required).
    Returns dashboard metadata including position_json, metadata, and chart/dataset lists.
    ---
    get:
      summary: Return public dashboard
      parameters:
      - in: path
        schema:
          type: string
        name: pk
        description: The dashboard ID
      responses:
        200:
          description: Dashboard metadata
        404:
          description: Dashboard not found or not published
    """
    try:
        dash = db.session.query(Dashboard).filter_by(id=pk).first()

        if not dash:
            return self.response_404()

        if not getattr(dash, "published", False):
            return self.response(
                404,
                message="Dashboard not found or not published"
            )

        # Serialize dashboard using schema
        result = self.dashboard_entity_response_schema.dump(dash)

        # Add list of public chart IDs
        public_chart_ids = [
            slice.id for slice in dash.slices
            if getattr(slice, "is_public", False)
        ]
        result["public_chart_ids"] = public_chart_ids

        # Add list of dataset IDs used by public charts
        public_dataset_ids = list(set([
            slice.datasource_id for slice in dash.slices
            if getattr(slice, "is_public", False) and slice.datasource_type == "table"
        ]))
        result["public_dataset_ids"] = public_dataset_ids

        return self.response(200, result=result)

    except Exception as ex:
        logger.error(f"Error fetching public dashboard {pk}: {ex}")
        return self.response_500(message=str(ex))
```

**Returns**:
```json
{
  "id": 20,
  "dashboard_title": "Malaria Surveillance Dashboard",
  "position_json": "{...}",
  "json_metadata": "{\"native_filters\":{...}}",
  "published": true,
  "public_chart_ids": [123, 124, 125],
  "public_dataset_ids": [45, 46],
  "slug": "malaria-surveillance",
  "changed_on": "2025-11-20T10:30:00"
}
```

**Testing**:
```bash
# Should return enhanced metadata
curl http://localhost:8088/api/v1/dashboard/public/20

# Verify public_chart_ids and public_dataset_ids are present
curl http://localhost:8088/api/v1/dashboard/public/20 | jq '.result.public_chart_ids'
```

**Validation Checklist**:
- [ ] Endpoint returns 200 for published dashboards
- [ ] Endpoint returns 404 for non-published dashboards
- [ ] Response includes `position_json` (existing)
- [ ] Response includes `json_metadata` with `native_filters` (existing)
- [ ] Response includes `public_chart_ids` (NEW)
- [ ] Response includes `public_dataset_ids` (NEW)
- [ ] Only public charts are included in lists
- [ ] No authentication required

---

### Task 1.4: Register New API Routes

**File**: `superset/initialization/__init__.py`

**Action**: Ensure new endpoints are registered with Flask-AppBuilder

**Verification**:
```bash
# After backend changes, verify routes are registered
flask routes | grep "public"

# Expected output should include:
# /api/v1/chart/public/<int:pk>/
# /api/v1/datasource/public/<int:pk>/column/<column_name>/values/
# /api/v1/dashboard/public/<pk>
```

**Note**: Flask-AppBuilder should auto-register @expose routes, but verify manually.

---

### Task 1.5: Backend Testing

**Test Script**: Create `test_public_apis.py`

```python
import requests

BASE_URL = "http://localhost:8088"

def test_public_chart_metadata():
    """Test public chart metadata endpoint"""
    # Test with a public chart
    response = requests.get(f"{BASE_URL}/api/v1/chart/public/123/")
    assert response.status_code == 200
    data = response.json()
    assert "result" in data
    assert data["result"]["is_public"] == True
    print("✅ Public chart metadata works")

    # Test with non-public chart
    response = requests.get(f"{BASE_URL}/api/v1/chart/public/456/")
    assert response.status_code == 403
    print("✅ Non-public chart returns 403")

def test_public_datasource_values():
    """Test public datasource column values endpoint"""
    response = requests.get(
        f"{BASE_URL}/api/v1/datasource/public/75/column/country_name/values/",
        params={"q": '{"filters":[],"page":0,"page_size":100}'}
    )
    assert response.status_code == 200
    data = response.json()
    assert "result" in data
    assert isinstance(data["result"], list)
    print("✅ Public datasource values work")

def test_public_dashboard():
    """Test enhanced public dashboard endpoint"""
    response = requests.get(f"{BASE_URL}/api/v1/dashboard/public/20")
    assert response.status_code == 200
    data = response.json()
    assert "public_chart_ids" in data["result"]
    assert "public_dataset_ids" in data["result"]
    print("✅ Enhanced dashboard metadata works")

if __name__ == "__main__":
    test_public_chart_metadata()
    test_public_datasource_values()
    test_public_dashboard()
    print("\n✅ All backend tests passed!")
```

**Run Tests**:
```bash
python test_public_apis.py
```

---

## 🎨 Phase 2: Frontend Changes (6-8 hours)

### Task 2.1: Revert PublicChartRenderer to SuperChart

**File**: `superset-frontend/src/features/home/PublicChartRenderer.tsx`

**Action**: Replace current implementation with SuperChart-based approach

**Implementation**:
```typescript
import { useEffect, useState, useMemo } from 'react';
import { styled, t, SuperChart, SupersetClient, Filter } from '@superset-ui/core';
import { Spin, Alert } from 'antd';

const ChartContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
`;

const LoadingContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
`;

const ChartContent = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
`;

interface PublicChartRendererProps {
  chartId: number;
  chartName: string;
  isPublic?: boolean;
  filterValues?: Record<string, any>;
  nativeFilters?: Filter[];
}

interface ChartData {
  formData: any;
  queriesResponse: any[];
}

// Helper to build adhoc_filters from filter values
function buildAdhocFilters(
  filterValues: Record<string, any>,
  nativeFilters: Filter[],
): any[] {
  const filters: any[] = [];

  Object.entries(filterValues).forEach(([filterId, value]) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;

    const filterConfig = nativeFilters.find((f: Filter) => f.id === filterId);
    const columnName = filterConfig?.targets?.[0]?.column?.name;

    if (columnName) {
      filters.push({
        col: columnName,
        op: 'IN',
        val: Array.isArray(value) ? value : [value],
      });
    }
  });

  return filters;
}

export default function PublicChartRenderer({
  chartId,
  chartName,
  isPublic = false,
  filterValues = {},
  nativeFilters = [],
}: PublicChartRendererProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);

  // Memoize filters
  const adhocFilters = useMemo(
    () => buildAdhocFilters(filterValues, nativeFilters),
    [filterValues, nativeFilters],
  );

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        // CHANGE 1: Use public or private metadata endpoint
        const metadataEndpoint = isPublic
          ? `/api/v1/chart/public/${chartId}/`
          : `/api/v1/chart/${chartId}`;

        const metaResponse = await SupersetClient.get({
          endpoint: metadataEndpoint,
        });

        const chartMeta = metaResponse.json.result;
        const formData = JSON.parse(chartMeta.params || '{}');

        // CHANGE 2: Use public or private data endpoint
        const dataEndpoint = isPublic
          ? `/api/v1/chart/${chartId}/public/data/`
          : `/api/v1/chart/${chartId}/data/`;

        // Build formData with filters
        const formDataWithFilters = {
          ...formData,
          slice_id: chartId,
          viz_type: chartMeta.viz_type,
          adhoc_filters: [
            ...(formData.adhoc_filters || []),
            ...adhocFilters,
          ],
        };

        const dataResponse = await SupersetClient.get({
          endpoint: dataEndpoint,
        });

        const queriesResponse = dataResponse.json.result || [];

        setChartData({
          formData: formDataWithFilters,
          queriesResponse,
        });
      } catch (err: any) {
        if (err.status === 403) {
          setError(t('This chart is not public. Please log in to view it.'));
        } else if (err.status === 401) {
          setError(t('Authentication required to view this chart.'));
        } else if (err.status === 404) {
          setError(t('Chart not found.'));
        } else {
          const errorMsg = err.message || t('Failed to load chart');
          setError(errorMsg);
        }
        console.error('Error loading chart:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [chartId, isPublic, adhocFilters]);

  if (loading) {
    return (
      <ChartContainer>
        <LoadingContainer>
          <Spin size="large" tip={t('Loading chart...')} />
        </LoadingContainer>
      </ChartContainer>
    );
  }

  if (error) {
    return (
      <ChartContainer>
        <LoadingContainer>
          <Alert
            message={t('Error Loading Chart')}
            description={error}
            type="error"
            showIcon
          />
        </LoadingContainer>
      </ChartContainer>
    );
  }

  if (!chartData || !chartData.queriesResponse?.length) {
    return (
      <ChartContainer>
        <LoadingContainer>
          <Alert
            message={t('No Data')}
            description={t('No data available for this chart')}
            type="info"
            showIcon
          />
        </LoadingContainer>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer>
      <ChartContent>
        <SuperChart
          chartType={chartData.formData.viz_type}
          formData={chartData.formData}
          queriesData={chartData.queriesResponse}
          height="100%"
          width="100%"
        />
      </ChartContent>
    </ChartContainer>
  );
}
```

**Key Changes**:
1. Use `/api/v1/chart/public/{id}/` when `isPublic=true`
2. Use `/api/v1/chart/{id}/public/data/` for data
3. Build `adhoc_filters` instead of `extra_filters`
4. Render with `SuperChart` instead of iframe

---

### Task 2.2: Update EnhancedHomeFilterBar for Public Mode

**File**: `superset-frontend/src/features/home/EnhancedHomeFilterBar.tsx`

**Action**: Use public datasource endpoint when on public page

**Key Changes**:
```typescript
// Around line 120-122, change:
const endpoint = `/api/v1/datasource/table/${target.datasetId}/column/${encodeURIComponent(column)}/values/?q=${encodeURIComponent(
  JSON.stringify({ filters: [], page: 0, page_size: 1000 }),
)}`;

// To:
const endpoint = isPublic
  ? `/api/v1/datasource/public/${target.datasetId}/column/${encodeURIComponent(column)}/values/?q=${encodeURIComponent(
      JSON.stringify({ filters: [], page: 0, page_size: 1000 }),
    )}`
  : `/api/v1/datasource/table/${target.datasetId}/column/${encodeURIComponent(column)}/values/?q=${encodeURIComponent(
      JSON.stringify({ filters: [], page: 0, page_size: 1000 }),
    )}`;
```

**Add Props**:
```typescript
interface EnhancedHomeFilterBarProps {
  filters: Filter[];
  onFilterChange: (filterId: string, value: any) => void;
  onApply: () => void;
  onClear: () => void;
  isPublic?: boolean;  // ADD THIS
}

const EnhancedHomeFilterBar: FC<EnhancedHomeFilterBarProps> = ({
  filters,
  onFilterChange,
  onApply,
  onClear,
  isPublic = false,  // ADD THIS
}) => {
  // ... existing code
}
```

---

### Task 2.3: Update DashboardContentArea to Pass isPublic

**File**: `superset-frontend/src/features/home/DashboardContentArea.tsx`

**Action**: Pass `isPublic` prop to filter bar

**Change** (around line 580):
```typescript
return (
  <ContentContainer>
    {!isPublic && (
      <EnhancedHomeFilterBar
        filters={nativeFilters}
        onFilterChange={handleFilterChange}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
        isPublic={isPublic}  // ADD THIS
      />
    )}
```

**Also change** chart renderer (around line 536):
```typescript
{!isPublic ? (
  <PublicChartRenderer
    chartId={chart.id}
    chartName={chart.slice_name}
    isPublic={chart.is_public || false}
    filterValues={filterValues}
    nativeFilters={nativeFilters}
  />
) : (
  // Remove the placeholder message, always show renderer
  <PublicChartRenderer
    chartId={chart.id}
    chartName={chart.slice_name}
    isPublic={true}  // Force public mode
    filterValues={filterValues}
    nativeFilters={nativeFilters}
  />
)}
```

Actually, simplify to:
```typescript
<PublicChartRenderer
  chartId={chart.id}
  chartName={chart.slice_name}
  isPublic={isPublic || chart.is_public || false}
  filterValues={filterValues}
  nativeFilters={nativeFilters}
/>
```

---

### Task 2.4: Build and Test Frontend

**Commands**:
```bash
cd superset-frontend
npm run build

# Or for development
npm run dev
```

**Manual Testing**:
1. Open public page: `http://localhost:8088/public/dashboard/20`
2. Verify charts load (no 403 errors)
3. Verify filter bar shows (if enabled)
4. Verify filter dropdowns populate
5. Select filter values and click Apply
6. Verify charts re-render with filtered data

---

## 🧪 Phase 3: Integration Testing (4-6 hours)

### Test Case 1: Public Dashboard - No Auth Required

**Steps**:
1. Open incognito browser
2. Navigate to `http://localhost:8088/public/dashboard/20`
3. Verify page loads without login redirect
4. Verify all public charts render
5. Verify filter bar shows (if not hidden)
6. Verify filter dropdowns populate

**Expected**: ✅ Everything works, no 401/403 errors

---

### Test Case 2: Filter Application on Public Page

**Steps**:
1. On public dashboard, select filter value (e.g., "Kampala" for district)
2. Click "Apply" button
3. Observe charts re-render
4. Verify charts show filtered data

**Expected**: ✅ Charts update with filtered data

---

### Test Case 3: Authenticated User on Welcome Page

**Steps**:
1. Log in as admin
2. Navigate to `/home/`
3. Select a dashboard from sidebar
4. Verify charts render
5. Apply filters
6. Verify filters work

**Expected**: ✅ Everything still works for authenticated users

---

### Test Case 4: Security - Non-Public Chart Access

**Steps**:
1. Open incognito browser
2. Try to access non-public chart: `http://localhost:8088/api/v1/chart/public/999/`
3. Verify 403 response

**Expected**: ✅ Access denied for non-public charts

---

### Test Case 5: Security - Non-Public Dataset Access

**Steps**:
1. Open incognito browser
2. Try to access dataset with no public charts:
   `http://localhost:8088/api/v1/datasource/public/99/column/test/values/`
3. Verify 403 response

**Expected**: ✅ Access denied for non-public datasets

---

### Test Case 6: Large Dataset Performance

**Steps**:
1. Create dashboard with 20+ charts
2. Apply filter
3. Measure time to re-render all charts

**Expected**: ✅ Reasonable performance (< 5 seconds)

---

## 📊 Success Criteria

### Must Have (Blocking)
- [ ] Public dashboards load without authentication
- [ ] Public charts render using SuperChart
- [ ] Filters show dropdown options on public pages
- [ ] Filter application updates charts
- [ ] No 401/403 errors on public pages
- [ ] Authenticated users' experience unchanged
- [ ] Non-public charts return 403 when accessed publicly
- [ ] Non-public datasets return 403 when accessed publicly

### Should Have (Important but not blocking)
- [ ] Filter options load within 2 seconds
- [ ] Charts re-render within 3 seconds after filter application
- [ ] Error messages are user-friendly
- [ ] Loading states show for all async operations

### Nice to Have (Future enhancements)
- [ ] Cache filter options for performance
- [ ] Show filter applied indicator
- [ ] Export filtered dashboard as PDF
- [ ] Share filtered dashboard URL

---

## 🚧 Known Limitations

1. **Large Datasets**: Fetching all column values may be slow for large datasets (1M+ rows)
   - **Mitigation**: Add pagination or limit to 10,000 values

2. **Cross-Filter Support**: Cross-filtering between charts not implemented
   - **Future**: Can add using Superset's native cross-filter events

3. **Real-Time Data**: Charts don't auto-refresh
   - **Future**: Add polling or WebSocket support

4. **Mobile Experience**: UI not optimized for mobile
   - **Future**: Add responsive breakpoints

---

## 🔄 Rollback Plan

If implementation fails or causes issues:

### Quick Rollback
```bash
git reset --hard 437eed71b9
git clean -fd
docker-compose restart superset
```

### Selective Rollback
If only frontend has issues:
```bash
git checkout 437eed71b9 -- superset-frontend/
npm run build
docker-compose restart superset
```

If only backend has issues:
```bash
git checkout 437eed71b9 -- superset/
docker-compose restart superset
```

---

## 📝 Documentation Updates Required

After successful implementation:

1. **Update CUSTOMIZATION_SUMMARY.md**:
   - Add section on public API endpoints
   - Update architecture diagram
   - Document security model

2. **Create USER_GUIDE.md**:
   - How to mark charts as public
   - How to publish dashboards
   - How to create filters for public dashboards

3. **Create ADMIN_GUIDE.md**:
   - How to configure public access
   - Security best practices
   - Performance tuning

---

## 🎯 Next Steps After Completion

Once this implementation is complete and tested:

1. **Performance Optimization**:
   - Add caching for filter options
   - Implement lazy loading for charts
   - Optimize DHIS2 queries

2. **Feature Enhancements**:
   - Add export functionality
   - Add chart annotations
   - Add drill-down capabilities

3. **Security Hardening**:
   - Add rate limiting
   - Add CAPTCHA for public pages
   - Implement audit logging

4. **User Feedback**:
   - Gather feedback from end users
   - Iterate on UI/UX
   - Fix bugs and edge cases

---

## 🔧 Critical Issue: DHIS2 Analytics API Data Transformation

### Problem Statement

Superset fails to visualize DHIS2 Analytics API tables because DHIS2 returns **wide, pivoted tables** with:
- Mixed header rows (metadata labels + actual headers)
- Inconsistent data types across columns
- "N/A" string values mixed with numeric data
- Non-numeric organizational unit names concatenated into single cells
- Multiple data elements as separate columns instead of rows

**Error Example**:
```
DB Engine Error: Could not convert string to numeric
```

### Root Cause

DHIS2 Analytics API returns data in this format:
```
| Organisation Unit | Period | Malaria Deaths < 5 yrs | Low birth weight | ... |
|-------------------|--------|------------------------|------------------|-----|
| BoKambiaPort Loko | 2024   | 85                     | N/A              | ... |
```

Problems:
1. **Wide format**: Each data element is a column (should be rows)
2. **Merged org units**: "BoKambiaPort Loko..." (should be separate)
3. **"N/A" strings**: Mixed with numeric values (breaks type casting)
4. **Metadata rows**: DHIS2 includes label rows before data

### Solution: Transform to Long/Tidy Format

**Required preprocessing in DHIS2 database dialect:**

```python
# Always convert DHIS2 analytics pivoted tables into long/tidy format:
# 1. Drop metadata rows
# 2. Clean headers
# 3. Replace "N/A" with None
# 4. Cast numeric columns
# 5. Melt into (OrgUnit, Period, DataElement, Value)
```

**Implementation Location**: `superset/db_engine_specs/dhis2.py` (or similar DHIS2 connector)

**Transformation Steps**:

1. **Remove metadata header rows**
   ```python
   # Skip first N rows that contain metadata labels
   df = df.iloc[metadata_row_count:]
   ```

2. **Promote actual header row as column names**
   ```python
   df.columns = df.iloc[0]
   df = df.iloc[1:]
   ```

3. **Replace "N/A" with None**
   ```python
   df = df.replace("N/A", None)
   ```

4. **Convert numeric columns**
   ```python
   for col in df.columns:
       if col not in ['Organisation Unit', 'Period']:
           df[col] = pd.to_numeric(df[col], errors='coerce')
   ```

5. **Reshape to long format (melt)**
   ```python
   df_long = df.melt(
       id_vars=['Organisation Unit', 'Period'],
       var_name='dataElement',
       value_name='value'
   )
   ```

**Expected Output Format**:
```
| orgUnit | period | dataElement              | value |
|---------|--------|--------------------------|-------|
| Bo      | 2024   | Malaria Deaths < 5 yrs   | 85    |
| Bo      | 2024   | Low birth weight         | 6087  |
| Kambia  | 2024   | Malaria Deaths < 5 yrs   | 42    |
| ...     | ...    | ...                      | ...   |
```

### Benefits

✅ **Superset compatibility**: Long format works natively with all chart types
✅ **No type errors**: Numeric columns are properly typed
✅ **Clean categorical axes**: OrgUnit becomes readable x-axis labels
✅ **Proper aggregations**: Can SUM, AVG, COUNT by dataElement
✅ **Filter support**: Can filter by orgUnit, period, dataElement
✅ **No merged strings**: "BoKambiaPort Loko" → separate rows

### Implementation Priority

**Priority**: HIGH - Blocking visualization of DHIS2 data

**Estimated Effort**: 4-6 hours

**Files to Modify**:
- `superset/db_engine_specs/dhis2.py` - Add transformation logic
- `superset/connectors/dhis2/` - Update data fetch methods
- `tests/integration_tests/db_engine_specs/test_dhis2.py` - Add tests

**Testing Requirements**:
1. Test with real DHIS2 Analytics API response
2. Verify all "N/A" values are converted to None
3. Verify numeric columns are properly typed
4. Verify long format output structure
5. Test chart rendering with transformed data

### Code Comment Template

When implementing, use this comment block:
```python
# DHIS2 Analytics API Data Transformation
# Always convert DHIS2 analytics pivoted tables into long/tidy format:
# - Drop metadata rows
# - Clean headers
# - Replace "N/A" with None
# - Cast numeric columns
# - Melt into (OrgUnit, Period, DataElement, Value)
# Superset cannot visualize wide pivoted DHIS2 tables directly.
```

---

**Document Version**: 1.1
**Created**: 2025-11-26
**Updated**: 2025-11-26
**Status**: Ready to implement
