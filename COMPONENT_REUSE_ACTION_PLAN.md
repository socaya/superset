# Component Reuse Implementation - Full Action Plan

**Project:** Replace iframe-based chart rendering with SuperChart component reuse
**Goal:** Make filters actually work by sharing React state between filter bar and charts
**Estimated Time:** 2-3 hours
**Difficulty:** Medium
**Date Created:** November 24, 2025

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture](#target-architecture)
4. [Step-by-Step Implementation](#step-by-step-implementation)
5. [Testing Strategy](#testing-strategy)
6. [Rollback Plan](#rollback-plan)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Success Criteria](#success-criteria)

---

## 🎯 Executive Summary

### The Problem
Current iframe-based chart rendering creates isolated sandboxes that cannot access parent page's filter state. This means the Apply button doesn't work - filters don't affect charts.

### The Solution
Replace `<iframe>` with Superset's `SuperChart` component, allowing direct filter application via React props.

### Why This Works
```
Before (Iframe):                    After (SuperChart):
┌──────────────────┐               ┌──────────────────┐
│ Filter Bar       │               │ Filter Bar       │
│ filterValues: {} │               │ filterValues: {} │
└──────────────────┘               └────────┬─────────┘
        ↓ ❌ ISOLATED                       ↓ ✅ PROP
┌──────────────────┐               ┌────────▼─────────┐
│ <iframe>         │               │ <SuperChart      │
│   Can't access   │               │   filterValues={}│
│   parent state   │               │   Receives props!│
└──────────────────┘               └──────────────────┘
```

### Key Benefits
- ✅ Filters work automatically (state shared)
- ✅ No Redux complexity required
- ✅ Only modify your own code (don't touch Superset core)
- ✅ Better performance (no iframe overhead)
- ✅ Easier debugging (same React context)

---

## 🔍 Current State Analysis

### Files Involved

#### 1. PublicChartRenderer.tsx (PRIMARY FILE TO MODIFY)
**Location:** `superset-frontend/src/features/home/PublicChartRenderer.tsx`

**Current Implementation:**
```typescript
// Uses iframe with standalone explore URL
<ChartIframe
  src={`/superset/explore/?slice_id=${chartId}&standalone=true`}
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
/>
```

**Problems:**
- ❌ Iframe isolated from parent state
- ❌ URL parameters don't work for filters
- ❌ No way to trigger re-render with new filters

---

#### 2. DashboardContentArea.tsx (ALREADY WORKING)
**Location:** `superset-frontend/src/features/home/DashboardContentArea.tsx`

**Current State:**
```typescript
// Fetches filters from dashboard metadata
const [nativeFilters, setNativeFilters] = useState<Filter[]>([]);
const [filterValues, setFilterValues] = useState<Record<string, any>>({});

// Passes filters to charts
<PublicChartRenderer
  chartId={chart.id}
  filterValues={filterValues}  // ✅ Already passing filters!
/>
```

**Status:** ✅ No changes needed - already passing filter state correctly

---

#### 3. EnhancedHomeFilterBar.tsx (ALREADY WORKING)
**Location:** `superset-frontend/src/features/home/EnhancedHomeFilterBar.tsx`

**Current State:**
- ✅ Loads filter options from datasource API
- ✅ Displays horizontal filter dropdowns
- ✅ Calls `onFilterChange` when user selects values
- ✅ Calls `onApply` when user clicks Apply button

**Status:** ✅ No changes needed - UI and state management working perfectly

---

### Architecture Dependencies

```
DashboardContentArea
├── Fetches dashboard metadata (json_metadata)
├── Extracts native_filter_configuration
├── Manages filterValues state
│
├── EnhancedHomeFilterBar (WORKING ✅)
│   ├── Loads filter options
│   ├── User selects values
│   └── Calls onApply → updates filterValues
│
└── PublicChartRenderer (NEEDS REFACTOR 🔴)
    ├── Receives chartId prop
    ├── Receives filterValues prop
    └── Currently: Renders iframe (doesn't use filterValues)
    └── Target: Render SuperChart (uses filterValues)
```

---

## 🏗️ Target Architecture

### New Data Flow

```
1. User selects filter value in EnhancedHomeFilterBar
   ↓
2. onFilterChange updates filterValues state in DashboardContentArea
   ↓
3. filterValues prop passed to PublicChartRenderer
   ↓
4. PublicChartRenderer useEffect triggers (filterValues changed)
   ↓
5. Fetch chart config from /api/v1/chart/{id}
   ↓
6. Map filterValues to extra_filters format
   ↓
7. Fetch chart data from /api/v1/chart/data with filters
   ↓
8. Render SuperChart with filtered data
   ↓
9. Chart updates! ✅
```

### Filter Mapping Logic

**Input (from FilterBar):**
```typescript
filterValues = {
  "NATIVE_FILTER-abc123": ["India", "USA"],
  "NATIVE_FILTER-def456": "2024-01-01"
}
```

**Need to convert to (for chart API):**
```typescript
extra_filters = [
  { col: "country", op: "IN", val: ["India", "USA"] },
  { col: "date", op: ">=", val: "2024-01-01" }
]
```

**Challenge:** Filter IDs don't include column names!

**Solution:** Pass `nativeFilters` array (has filter configs) to PublicChartRenderer:
```typescript
<PublicChartRenderer
  chartId={chart.id}
  filterValues={filterValues}
  nativeFilters={nativeFilters}  // ← ADD THIS
/>
```

---

## 📝 Step-by-Step Implementation

### STEP 1: Backup Current Implementation (5 minutes)

```bash
# Create backup of current file
cp superset-frontend/src/features/home/PublicChartRenderer.tsx \
   superset-frontend/src/features/home/PublicChartRenderer.tsx.backup-iframe
```

**Why:** Easy rollback if something goes wrong

---

### STEP 2: Update DashboardContentArea to pass nativeFilters (10 minutes)

**File:** `superset-frontend/src/features/home/DashboardContentArea.tsx`

**Find this line (~line 550):**
```typescript
<PublicChartRenderer
  chartId={chart.id}
  chartName={chart.slice_name}
  isPublic={chart.is_public || false}
  filterValues={filterValues}
/>
```

**Change to:**
```typescript
<PublicChartRenderer
  chartId={chart.id}
  chartName={chart.slice_name}
  isPublic={chart.is_public || false}
  filterValues={filterValues}
  nativeFilters={nativeFilters}  // ← ADD THIS LINE
/>
```

**Why:** PublicChartRenderer needs filter configs to map filter IDs to column names

---

### STEP 3: Rewrite PublicChartRenderer (90 minutes)

**File:** `superset-frontend/src/features/home/PublicChartRenderer.tsx`

Replace entire file contents with:

```typescript
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useEffect, useState } from 'react';
import { SuperChart, styled } from '@superset-ui/core';
import { Spin, Alert } from 'antd';

const ChartContainer = styled.div`
  ${({ theme }) => `
    width: 100%;
    height: 400px;
    display: flex;
    flex-direction: column;
    position: relative;
    background: ${theme.colors.grayscale.light5};
    border-radius: ${theme.borderRadius}px;
    overflow: hidden;
  `}
`;

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  flex-direction: column;
  gap: 16px;
`;

const ErrorContainer = styled.div`
  padding: 16px;
`;

interface NativeFilter {
  id: string;
  filterType: string;
  targets?: Array<{
    datasetId: number;
    column: {
      name: string;
    };
  }>;
}

interface PublicChartRendererProps {
  chartId: number;
  chartName: string;
  isPublic?: boolean;
  filterValues?: Record<string, any>;
  nativeFilters?: NativeFilter[];
}

export default function PublicChartRenderer({
  chartId,
  chartName,
  filterValues = {},
  nativeFilters = [],
}: PublicChartRendererProps) {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchChartData = async () => {
      console.log('[PublicChartRenderer] Fetching chart data:', {
        chartId,
        filterValues,
        nativeFilters,
      });

      setLoading(true);
      setError(null);

      try {
        // Step 1: Fetch chart configuration
        const chartResponse = await fetch(`/api/v1/chart/${chartId}`, {
          credentials: 'same-origin',
        });

        if (!chartResponse.ok) {
          throw new Error(`Failed to fetch chart config: ${chartResponse.status}`);
        }

        const chartJson = await chartResponse.json();
        const chartConfig = chartJson.result;

        console.log('[PublicChartRenderer] Chart config loaded:', chartConfig);

        // Step 2: Convert filterValues to extra_filters format
        const extra_filters = Object.entries(filterValues)
          .filter(([_, value]) => {
            // Skip empty filters
            if (value === null || value === undefined) return false;
            if (Array.isArray(value) && value.length === 0) return false;
            return true;
          })
          .map(([filterId, value]) => {
            // Find filter config to get column name
            const filterConfig = nativeFilters.find(f => f.id === filterId);
            const columnName = filterConfig?.targets?.[0]?.column?.name;

            if (!columnName) {
              console.warn(`[PublicChartRenderer] No column found for filter ${filterId}`);
              return null;
            }

            console.log('[PublicChartRenderer] Mapping filter:', {
              filterId,
              columnName,
              value,
            });

            return {
              col: columnName,
              op: 'IN',
              val: Array.isArray(value) ? value : [value],
            };
          })
          .filter(Boolean); // Remove null entries

        console.log('[PublicChartRenderer] Mapped filters:', extra_filters);

        // Step 3: Build formData with filters
        const formData = {
          ...chartConfig.form_data,
          extra_filters,
        };

        // Step 4: Fetch chart data with filters applied
        const dataPayload = {
          datasource: {
            id: chartConfig.datasource_id,
            type: chartConfig.datasource_type || 'table',
          },
          queries: [
            {
              ...formData,
            },
          ],
          result_format: 'json',
          result_type: 'full',
        };

        console.log('[PublicChartRenderer] Fetching data with payload:', dataPayload);

        const dataResponse = await fetch('/api/v1/chart/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'same-origin',
          body: JSON.stringify(dataPayload),
        });

        if (!dataResponse.ok) {
          const errorText = await dataResponse.text();
          console.error('[PublicChartRenderer] Data fetch error:', errorText);
          throw new Error(`Failed to fetch chart data: ${dataResponse.status}`);
        }

        const dataJson = await dataResponse.json();

        console.log('[PublicChartRenderer] Data loaded:', dataJson);

        if (!isCancelled) {
          setChartData({
            chartConfig,
            formData,
            queriesData: dataJson.result,
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('[PublicChartRenderer] Error:', err);
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    fetchChartData();

    return () => {
      isCancelled = true;
    };
  }, [chartId, filterValues, nativeFilters]);

  if (loading) {
    return (
      <ChartContainer>
        <LoadingContainer>
          <Spin size="large" />
          <div>Loading {chartName}...</div>
        </LoadingContainer>
      </ChartContainer>
    );
  }

  if (error) {
    return (
      <ChartContainer>
        <ErrorContainer>
          <Alert
            message="Error Loading Chart"
            description={error}
            type="error"
            showIcon
          />
        </ErrorContainer>
      </ChartContainer>
    );
  }

  if (!chartData) {
    return (
      <ChartContainer>
        <LoadingContainer>No data available</LoadingContainer>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer>
      <SuperChart
        chartType={chartData.chartConfig.viz_type}
        formData={chartData.formData}
        queriesData={chartData.queriesData}
        width="100%"
        height={400}
      />
    </ChartContainer>
  );
}
```

**Key Features:**
- ✅ Uses SuperChart instead of iframe
- ✅ Fetches chart config and data
- ✅ Maps filter IDs to column names using nativeFilters
- ✅ Applies filters via extra_filters
- ✅ Re-fetches when filterValues change (useEffect dependency)
- ✅ Comprehensive console logging for debugging
- ✅ Loading and error states
- ✅ Clean, readable code

---

### STEP 4: Build Frontend (5 minutes)

```bash
cd superset-frontend
npm run build
```

**Expected output:**
```
webpack compiled successfully in X seconds
```

**If errors occur:**
- Check for TypeScript compilation errors
- Verify all imports are correct
- Check console for missing dependencies

---

### STEP 5: Restart Superset (2 minutes)

**If using Docker:**
```bash
docker restart superset_app
```

**If using systemd (Ubuntu server):**
```bash
sudo systemctl restart superset
```

**Verify restart:**
```bash
curl http://localhost:8088/health
# Should return: {"health": "ok"}
```

---

## 🧪 Testing Strategy

### Test Case 1: Filter Application on /superset/welcome/

**Steps:**
1. Navigate to `http://localhost:8088/superset/welcome/`
2. Select a dashboard with filters from sidebar
3. Open browser DevTools → Console tab
4. Select a filter value (e.g., "India" in Country dropdown)
5. Click "Apply" button
6. Watch console logs

**Expected Results:**
```
[PublicChartRenderer] Fetching chart data: { chartId: 14, filterValues: { NATIVE_FILTER-xxx: ["India"] } }
[PublicChartRenderer] Chart config loaded: { viz_type: "...", ... }
[PublicChartRenderer] Mapping filter: { filterId: "NATIVE_FILTER-xxx", columnName: "country", value: ["India"] }
[PublicChartRenderer] Mapped filters: [{ col: "country", op: "IN", val: ["India"] }]
[PublicChartRenderer] Data loaded: { ... }
```

**Success Criteria:**
- ✅ Charts update with filtered data
- ✅ Console shows filter mapping logs
- ✅ No errors in console
- ✅ Charts show only filtered records (e.g., only India data)

---

### Test Case 2: Multiple Filters

**Steps:**
1. Select "India" in Country filter
2. Select "Stage 1" in Stage filter
3. Click "Apply"

**Expected Results:**
- ✅ Both filters applied to charts
- ✅ Console shows 2 mapped filters
- ✅ Charts show intersection of both filters (India AND Stage 1)

---

### Test Case 3: Clear Filters

**Steps:**
1. Apply some filters
2. Click "Clear All" button

**Expected Results:**
- ✅ Filter dropdowns reset to empty
- ✅ Charts reload with all data (no filters)
- ✅ Console shows `filterValues: {}`

---

### Test Case 4: Public Page (/superset/public/)

**Steps:**
1. Navigate to `http://localhost:8088/superset/public/`
2. Select a published dashboard
3. Test filter application

**Expected Results:**
- ✅ Filters visible (if backend issue fixed)
- ✅ Same behavior as /welcome/ page
- ✅ Public role has permissions to fetch chart data

---

### Test Case 5: Error Handling

**Steps:**
1. Open DevTools → Network tab
2. Throttle network to "Slow 3G"
3. Apply filters

**Expected Results:**
- ✅ Loading spinner shows during fetch
- ✅ Charts eventually load
- ✅ No crashes or blank screens

---

### Test Case 6: Filter Types

Test different filter types:
- ✅ Single-select filters
- ✅ Multi-select filters
- ✅ Date range filters (if applicable)
- ✅ Number filters (if applicable)

---

## 🔄 Rollback Plan

### If Implementation Fails

**Step 1: Restore backup**
```bash
cd superset-frontend/src/features/home
mv PublicChartRenderer.tsx PublicChartRenderer.tsx.broken
mv PublicChartRenderer.tsx.backup-iframe PublicChartRenderer.tsx
```

**Step 2: Revert DashboardContentArea.tsx**
```bash
git checkout -- superset-frontend/src/features/home/DashboardContentArea.tsx
```

**Step 3: Rebuild**
```bash
cd superset-frontend
npm run build
docker restart superset_app
```

**Step 4: Verify rollback**
```bash
curl http://localhost:8088/health
# Visit /superset/welcome/ - should see iframes again
```

---

## 🔧 Troubleshooting Guide

### Issue 1: SuperChart not rendering

**Symptoms:**
- Blank chart area
- No errors in console

**Debugging:**
```typescript
// Add to PublicChartRenderer after setChartData
console.log('SuperChart props:', {
  chartType: chartData.chartConfig.viz_type,
  formData: chartData.formData,
  queriesData: chartData.queriesData,
});
```

**Possible Causes:**
- `queriesData` format incorrect
- `viz_type` not supported
- Missing chart plugin

**Solution:**
Check if chart type is registered:
```typescript
import { getChartMetadataRegistry } from '@superset-ui/core';
console.log('Registered charts:', getChartMetadataRegistry().keys());
```

---

### Issue 2: Filters not applying

**Symptoms:**
- Charts load but show all data (not filtered)
- Console logs show `extra_filters: []`

**Debugging:**
```typescript
// Check filter mapping
console.log('Filter mapping debug:', {
  filterValues,
  nativeFilters,
  mapped: extra_filters,
});
```

**Possible Causes:**
- `nativeFilters` not passed from DashboardContentArea
- Filter ID doesn't match
- Column name wrong

**Solution:**
Verify filter config structure:
```typescript
console.log('Native filter structure:', nativeFilters.map(f => ({
  id: f.id,
  column: f.targets?.[0]?.column?.name,
})));
```

---

### Issue 3: 403 Forbidden on chart data API

**Symptoms:**
- Error message: "Failed to fetch chart data: 403"

**Cause:**
- Public role doesn't have permission to access chart data endpoint

**Solution:**
```bash
# On server
superset fab sync-permissions
sudo systemctl restart superset
```

Or add specific permission:
```sql
-- Check permissions
SELECT * FROM ab_permission WHERE name = 'can_post on ChartRestApi';

-- Grant to Public role if missing
INSERT INTO ab_permission_view_role (permission_view_id, role_id)
SELECT pv.id, r.id
FROM ab_permission_view pv
JOIN ab_permission p ON pv.permission_id = p.id
JOIN ab_view_menu v ON pv.view_menu_id = v.id
JOIN ab_role r ON r.name = 'Public'
WHERE p.name = 'can_post' AND v.name = 'ChartRestApi';
```

---

### Issue 4: TypeScript compilation errors

**Symptoms:**
- Build fails with type errors

**Common Errors:**

**Error:** `Property 'nativeFilters' does not exist on type 'PublicChartRendererProps'`
**Solution:** Ensure interface updated:
```typescript
interface PublicChartRendererProps {
  chartId: number;
  chartName: string;
  isPublic?: boolean;
  filterValues?: Record<string, any>;
  nativeFilters?: NativeFilter[];  // ← Make sure this line exists
}
```

**Error:** `Cannot find module '@superset-ui/core'`
**Solution:**
```bash
cd superset-frontend
npm install
```

---

### Issue 5: Charts load but wrong data

**Symptoms:**
- Charts render but show unexpected data
- Data doesn't match filter selection

**Debugging:**
```typescript
// Log the actual API request
console.log('Chart data request:', JSON.stringify(dataPayload, null, 2));

// Check API response
console.log('Chart data response:', dataJson);
```

**Possible Causes:**
- Filter operator wrong (should be "IN" for select filters)
- Column name doesn't match database column
- Filter value format wrong

**Solution:**
Test API directly:
```bash
curl -X POST http://localhost:8088/api/v1/chart/data \
  -H "Content-Type: application/json" \
  -d '{
    "datasource": {"id": 75, "type": "table"},
    "queries": [{
      "columns": ["country"],
      "metrics": ["count"],
      "extra_filters": [{"col": "country", "op": "IN", "val": ["India"]}]
    }],
    "result_format": "json",
    "result_type": "full"
  }'
```

---

### Issue 6: Filters work on /welcome/ but not /public/

**Symptoms:**
- Filters apply correctly on logged-in page
- Same filters don't work on public page

**Cause:**
- Public API endpoint not returning `json_metadata`
- Public role missing permissions

**Solution:**

**1. Verify backend API returns metadata:**
```bash
# Check public dashboard API
curl http://localhost:8088/api/v1/dashboard/public/37 | jq '.result.json_metadata'
# Should NOT be null or empty
```

**2. Check backend code:**
File: `superset/dashboards/api.py` line ~1994
```python
result = {
    "id": dash.id,
    "dashboard_title": dash.dashboard_title,
    "slug": dash.slug or "",
    "position_json": dash.position_json,
    "json_metadata": dash.json_metadata,  # ← MUST BE HERE
    "metadata": dash.params,
    "is_public_entry": getattr(dash, "is_public_entry", False),
}
```

**3. Verify public page passes filters:**
File: `superset-frontend/src/pages/PublicLandingPage/index.tsx`

Should use `DashboardContentArea` which already passes filters correctly.

---

## ✅ Success Criteria

### Functional Requirements

- ✅ **FR-1:** Filter bar displays on both `/superset/welcome/` and `/superset/public/`
- ✅ **FR-2:** Filter dropdowns load actual data from datasource
- ✅ **FR-3:** User can select filter values (single and multi-select)
- ✅ **FR-4:** Clicking "Apply" updates all charts with filtered data
- ✅ **FR-5:** Clicking "Clear All" resets filters and shows unfiltered data
- ✅ **FR-6:** Charts display correct filtered data matching filter selection
- ✅ **FR-7:** Multiple filters work together (AND logic)
- ✅ **FR-8:** Loading states show during data fetching
- ✅ **FR-9:** Error states display meaningful messages

### Performance Requirements

- ✅ **PR-1:** Filters apply within 2 seconds on normal network
- ✅ **PR-2:** No memory leaks when applying filters multiple times
- ✅ **PR-3:** Charts render within 3 seconds after Apply

### Code Quality Requirements

- ✅ **CQ-1:** No TypeScript compilation errors
- ✅ **CQ-2:** No console errors during normal operation
- ✅ **CQ-3:** Code follows Superset's style guidelines
- ✅ **CQ-4:** Comprehensive console logging for debugging
- ✅ **CQ-5:** Proper error handling and user feedback

---

## 📊 Implementation Checklist

Copy this checklist and mark items as you complete them:

```
Pre-Implementation
[ ] Read and understand entire action plan
[ ] Verify current implementation is working (iframes display)
[ ] Create backup of PublicChartRenderer.tsx
[ ] Take screenshot of current working state

Implementation
[ ] Step 1: Backup completed
[ ] Step 2: Modified DashboardContentArea.tsx to pass nativeFilters
[ ] Step 3: Rewrote PublicChartRenderer.tsx with SuperChart
[ ] Step 4: Frontend build completed without errors
[ ] Step 5: Superset restarted successfully

Testing
[ ] Test Case 1: Single filter works on /welcome/
[ ] Test Case 2: Multiple filters work together
[ ] Test Case 3: Clear All resets filters
[ ] Test Case 4: Filters work on /public/ page
[ ] Test Case 5: Error handling works (slow network)
[ ] Test Case 6: Different filter types work

Validation
[ ] Console logs show filter mapping correctly
[ ] Charts display filtered data (verified by checking data)
[ ] No TypeScript errors
[ ] No runtime errors in console
[ ] Loading states display correctly
[ ] Error states display meaningful messages

Documentation
[ ] Update progress_report.md with results
[ ] Document any issues encountered
[ ] Update .gitignore if needed
[ ] Add notes for future developers
```

---

## 🎓 Learning Resources

### Superset Architecture References

1. **SuperChart API:** `superset-frontend/packages/superset-ui-core/src/chart/components/SuperChart.tsx`
2. **Chart Data API:** `superset/charts/api.py` - `/api/v1/chart/data` endpoint
3. **Filter Types:** `superset-frontend/src/dashboard/components/nativeFilters/types.ts`
4. **Extra Filters Format:** Search codebase for `extra_filters` examples

### Debugging Commands

```bash
# Watch frontend build
cd superset-frontend && npm run dev

# Watch backend logs
docker logs -f superset_app
# OR
sudo journalctl -u superset -f

# Check API responses
curl -X GET http://localhost:8088/api/v1/chart/14
curl -X POST http://localhost:8088/api/v1/chart/data -H "Content-Type: application/json" -d '...'

# Check browser console
# DevTools → Console tab
# Filter by "PublicChartRenderer" to see only relevant logs
```

---

## 📈 Expected Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Setup** | 10 min | Backup files, verify environment |
| **Implementation** | 90 min | Modify 2 files, write new component logic |
| **Build & Deploy** | 10 min | npm build, restart services |
| **Testing** | 30 min | Run all 6 test cases |
| **Debugging** | 20 min | Fix any issues found (buffer time) |
| **Documentation** | 20 min | Update progress report |
| **TOTAL** | **2h 50min** | End-to-end completion |

---

## 🚀 Next Steps After Completion

1. **Update progress_report.md** with implementation results
2. **Test on production server** (Ubuntu deployment)
3. **Monitor for any edge cases** over next few days
4. **Consider enhancements:**
   - Filter persistence in URL
   - Filter presets/bookmarks
   - Chart export with filters applied
   - Filter performance optimization for large datasets

---

## 📞 Support

If you encounter issues not covered in this guide:

1. Check browser console for error messages
2. Check server logs for backend errors
3. Verify all prerequisites are met (permissions, API access)
4. Compare your implementation with backup files
5. Use rollback plan if needed

---

**Document Version:** 1.0
**Last Updated:** November 24, 2025
**Status:** Ready for implementation
**Risk Level:** Medium (can rollback easily)
**Confidence:** High (proven approach, clear path)
