/*
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

import { formatValue, parseCoordinates } from './utils';

describe('DHIS2Map Utils', () => {
  describe('formatValue', () => {
    it('should format millions', () => {
      expect(formatValue(1500000)).toBe('1.5M');
    });

    it('should format thousands', () => {
      expect(formatValue(1500)).toBe('1.5K');
    });

    it('should format small numbers', () => {
      expect(formatValue(500)).toBe('500');
    });

    it('should handle zero', () => {
      expect(formatValue(0)).toBe('0');
    });
  });

  describe('parseCoordinates', () => {
    it('should parse valid GeoJSON coordinates', () => {
      const json = '[[[0, 0], [1, 1], [1, 0]]]';
      const result = parseCoordinates(json);
      expect(result).toEqual([[[0, 0], [1, 1], [1, 0]]]);
    });

    it('should return null for invalid JSON', () => {
      const result = parseCoordinates('invalid');
      expect(result).toBeNull();
    });

    it('should handle empty coordinates', () => {
      const json = '[]';
      const result = parseCoordinates(json);
      expect(result).toEqual([]);
    });
  });
});
