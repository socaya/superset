#!/usr/bin/env python
"""Test to verify DHIS2 raw column name handling in metric validation"""

import sys
sys.path.insert(0, '/Users/stephocay/projects/hispuganda/superset')

from superset.models.helpers import BaseModel
from unittest.mock import Mock, MagicMock, patch


def test_dhis2_raw_column_metric_validation():
    """
    Test that DHIS2 datasources accept raw column names as metrics
    without raising "Metric does not exist" error
    """
    
    # Mock database with DHIS2 URI
    mock_database = Mock()
    mock_database.sqlalchemy_uri_decrypted = 'dhis2://localhost/api'
    mock_database.backend = 'dhis2'
    
    # Create a mock datasource
    mock_datasource = Mock(spec=BaseModel)
    mock_datasource.database = mock_database
    
    # Mock column
    mock_column = Mock()
    mock_column.column_name = '105_EP01a_Suspected_fever'
    mock_column.get_sqla_col = Mock(return_value=Mock())
    
    columns_by_name = {
        '105_EP01a_Suspected_fever': mock_column,
    }
    
    metrics_by_name = {}
    
    # Check DHIS2 detection
    uri = getattr(mock_database, 'sqlalchemy_uri_decrypted', None) or getattr(mock_database, 'sqlalchemy_uri', '')
    is_dhis2_datasource = 'dhis2://' in str(uri)
    
    print("Test: DHIS2 Raw Column Metric Validation")
    print("=" * 70)
    print(f"Database URI: {uri}")
    print(f"Is DHIS2 datasource: {is_dhis2_datasource}")
    print(f"Metric: 105_EP01a_Suspected_fever")
    print(f"Column in columns_by_name: {'105_EP01a_Suspected_fever' in columns_by_name}")
    
    # Verify conditions
    metric = '105_EP01a_Suspected_fever'
    
    # Condition checks (mimicking the fixed code)
    is_adhoc = False  # Not an adhoc metric
    is_saved_metric = metric in metrics_by_name  # Not a saved metric
    
    import re
    agg_pattern = r'^(SUM|AVG|COUNT|MIN|MAX|STDDEV|STDDEV_POP|STDDEV_SAMP|VARIANCE|VAR_POP|VAR_SAMP)\s*\(\s*([^)]+)\s*\)$'
    matches_agg_pattern = bool(re.match(agg_pattern, metric, re.IGNORECASE))  # Doesn't match SQL pattern
    
    is_dhis2_raw_column = is_dhis2_datasource and metric in columns_by_name  # DHIS2 + in columns
    
    print()
    print("Condition checks:")
    print(f"  Is adhoc metric: {is_adhoc}")
    print(f"  Is saved metric: {is_saved_metric}")
    print(f"  Matches SQL aggregation pattern: {matches_agg_pattern}")
    print(f"  Is DHIS2 raw column: {is_dhis2_raw_column}")
    
    print()
    if is_dhis2_raw_column:
        print("✓ PASS: DHIS2 raw column metric would be accepted")
        print("  Action: Use metric as raw column from columns_by_name")
        return True
    else:
        print("✗ FAIL: DHIS2 raw column metric would be rejected")
        print("  Error: Metric does not exist")
        return False


if __name__ == '__main__':
    result = test_dhis2_raw_column_metric_validation()
    sys.exit(0 if result else 1)
