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

export interface BoundaryFeature {
  type: 'Feature';
  id: string;
  properties: {
    id: string;
    name: string;
    level: number;
    parentId: string;
    parentName: string;
    hasChildrenWithCoordinates: boolean;
    hasParentWithCoordinates: boolean;
  };
  geometry: {
    type: 'Point' | 'Polygon' | 'MultiPolygon';
    coordinates: number[] | number[][] | number[][][];
  };
}

export interface DrillState {
  currentLevel: number;
  parentId: string | null;
  parentName: string | null;
  breadcrumbs: Array<{
    id: string;
    name: string;
    level: number;
  }>;
}

export interface DHIS2MapProps {
  width: number;
  height: number;
  data: Record<string, any>[];
  databaseId: number;
  orgUnitColumn: string;
  metric: string;
  boundaryLevel: number;
  enableDrill: boolean;
  colorScheme: string;
  opacity: number;
  strokeColor: { r: number; g: number; b: number; a: number };
  strokeWidth: number;
  showLabels: boolean;
  labelType: 'name' | 'value' | 'name_value' | 'percent';
  labelFontSize: number;
  showLegend: boolean;
  legendPosition: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  legendClasses: number;
  tooltipColumns: string[];
  onDrillDown?: (orgUnitId: string, orgUnitName: string) => void;
  setDataMask?: (dataMask: any) => void;
}

export interface ThematicLayerConfig {
  boundaries: BoundaryFeature[];
  metric: string;
  colorScale: (value: number) => string;
  opacity: number;
  strokeColor: string;
  strokeWidth: number;
}

export interface FacilityData {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  } | null;
  level: number;
  parentId: string;
}

export interface MapLegendBreak {
  min: number;
  max: number;
  color: string;
  label: string;
}
