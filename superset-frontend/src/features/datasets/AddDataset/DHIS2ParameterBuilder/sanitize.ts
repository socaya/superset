/**
 * Sanitize DHIS2 column names for Superset compatibility.
 * MUST match the sanitization in the backend (superset/db_engine_specs/dhis2_dialect.py)
 * 
 * Applies transformations in order:
 * 1. Replace dots (.) with underscores (_)
 * 2. Replace whitespace with underscores
 * 3. Remove parentheses
 * 4. Replace dashes (-) with underscores
 * 5. Collapse multiple underscores to single
 * 6. Strip leading/trailing underscores
 */
export function sanitizeDHIS2ColumnName(name: string): string {
  let sanitized = name;
  
  sanitized = sanitized.replace(/\./g, '_');
  sanitized = sanitized.replace(/\s+/g, '_');
  sanitized = sanitized.replace(/[()]/g, '');
  sanitized = sanitized.replace(/-/g, '_');
  sanitized = sanitized.replace(/\//g, '_');
  sanitized = sanitized.replace(/_+/g, '_');
  sanitized = sanitized.replace(/^_+|_+$/g, '');
  
  return sanitized;
}
