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

import L from 'leaflet';
import { scaleQuantize, scaleSqrt } from 'd3';
import { getSequentialSchemeRegistry } from '@superset-ui/core';
import { BoundaryFeature } from './types';

export function getColorScale(
  schemeName: string,
  min: number,
  max: number,
  classes: number,
): (value: number) => string {
  const schemeRegistry = getSequentialSchemeRegistry();
  const scheme = schemeRegistry.get(schemeName);
  let colors = scheme?.colors;

  if (!colors) {
    colors = generateDefaultColors(classes);
  }

  return scaleQuantize<string>()
    .domain([min, max])
    .range(colors.slice(0, classes));
}

function generateDefaultColors(count: number): string[] {
  const colors = [
    '#edf8fb',
    '#b2e2e2',
    '#66c2a5',
    '#3d8c8c',
    '#238b45',
    '#006d2c',
    '#00441b',
    '#08519c',
    '#3182bd',
  ];
  return colors.slice(0, Math.min(count, colors.length));
}

export function formatValue(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

export function calculateBounds(features: BoundaryFeature[]): L.LatLngBounds {
  const geojsonLayer = L.geoJSON({
    type: 'FeatureCollection',
    features: features as any,
  });
  return geojsonLayer.getBounds();
}

export function getRadiusScale(
  min: number,
  max: number,
  minRadius: number = 5,
  maxRadius: number = 30,
): (value: number) => number {
  return scaleSqrt()
    .domain([min, max])
    .range([minRadius, maxRadius]);
}

export function parseCoordinates(coordString: string): number[][][] | null {
  try {
    return JSON.parse(coordString);
  } catch {
    return null;
  }
}

export function getFeatureCenter(feature: BoundaryFeature): [number, number] {
  const geojsonLayer = L.geoJSON(feature as any);
  const center = geojsonLayer.getBounds().getCenter();
  return [center.lat, center.lng];
}
