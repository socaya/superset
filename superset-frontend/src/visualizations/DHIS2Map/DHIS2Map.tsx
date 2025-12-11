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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { styled, SupersetClient, t } from '@superset-ui/core';
import { MapContainer, TileLayer, GeoJSON, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DHIS2MapProps, BoundaryFeature, DrillState } from './types';
import LegendPanel from './components/LegendPanel';
import DrillControls from './components/DrillControls';
import { getColorScale, formatValue, calculateBounds } from './utils';

const MapWrapper = styled.div`
  width: 100%;
  height: 100%;
  position: relative;

  .leaflet-container {
    width: 100%;
    height: 100%;
    background: #f0f0f0;
  }

  .map-label {
    background: transparent;
    border: none;
    box-shadow: none;
    font-weight: 500;
    text-shadow: 1px 1px 1px white, -1px -1px 1px white, 1px -1px 1px white,
      -1px 1px 1px white;
  }

  .map-loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
  }

  .map-error-message {
    position: absolute;
    top: 10px;
    right: 10px;
    background: #f5222d;
    color: white;
    padding: 10px 16px;
    border-radius: 4px;
    z-index: 999;
  }
`;

const DHIS2Map: React.FC<DHIS2MapProps> = ({
  data,
  width,
  height,
  databaseId,
  orgUnitColumn,
  metric,
  boundaryLevel,
  enableDrill,
  colorScheme,
  opacity,
  strokeColor,
  strokeWidth,
  showLabels,
  labelType,
  labelFontSize,
  showLegend,
  legendPosition,
  legendClasses,
  tooltipColumns,
  onDrillDown,
  setDataMask,
}) => {
  const [boundaries, setBoundaries] = useState<BoundaryFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drillState, setDrillState] = useState<DrillState>({
    currentLevel: boundaryLevel,
    parentId: null,
    parentName: null,
    breadcrumbs: [],
  });
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((row) => {
      const orgUnitId = row[orgUnitColumn];
      const value = row[metric];
      if (orgUnitId && value !== undefined) {
        map.set(String(orgUnitId), Number(value));
      }
    });
    return map;
  }, [data, orgUnitColumn, metric]);

  const valueRange = useMemo(() => {
    const values = Array.from(dataMap.values()).filter((v) => !isNaN(v));
    if (values.length === 0) {
      return { min: 0, max: 100 };
    }
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [dataMap]);

  const colorScale = useMemo(
    () => getColorScale(colorScheme, valueRange.min, valueRange.max, legendClasses),
    [colorScheme, valueRange, legendClasses],
  );

  const fetchBoundaries = useCallback(
    async (level: number, parent?: string) => {
      setLoading(true);
      setError(null);

      try {
        let url = `/api/v1/dhis2_boundaries/${databaseId}/?level=${level}`;
        if (parent) {
          url += `&parent=${parent}`;
        }

        const response = await SupersetClient.get({ endpoint: url });
        const geojson = response.json;

        if (geojson?.features) {
          setBoundaries(geojson.features);

          if (mapInstance && geojson.features.length > 0) {
            const bounds = calculateBounds(geojson.features);
            mapInstance.fitBounds(bounds, { padding: [20, 20] });
          }
        }
      } catch (err) {
        setError(t('Failed to load map boundaries'));
        console.error('Boundary fetch error:', err);
      } finally {
        setLoading(false);
      }
    },
    [databaseId, mapInstance],
  );

  useEffect(() => {
    fetchBoundaries(drillState.currentLevel, drillState.parentId || undefined);
  }, [drillState.currentLevel, drillState.parentId, fetchBoundaries]);

  const handleDrillDown = useCallback(
    (feature: BoundaryFeature) => {
      if (!enableDrill || !feature.properties.hasChildrenWithCoordinates) {
        return;
      }

      const newLevel = drillState.currentLevel + 1;
      const newBreadcrumbs = [
        ...drillState.breadcrumbs,
        { id: feature.id, name: feature.properties.name, level: drillState.currentLevel },
      ];

      setDrillState({
        currentLevel: newLevel,
        parentId: feature.id,
        parentName: feature.properties.name,
        breadcrumbs: newBreadcrumbs,
      });

      if (onDrillDown) {
        onDrillDown(feature.id, feature.properties.name);
      }

      if (setDataMask) {
        setDataMask({
          extraFormData: {
            filters: [
              {
                col: orgUnitColumn,
                op: 'IN',
                val: [feature.id],
              },
            ],
          },
          filterState: {
            value: [feature.id],
            label: feature.properties.name,
          },
        });
      }
    },
    [enableDrill, drillState, orgUnitColumn, onDrillDown, setDataMask],
  );

  const handleDrillUp = useCallback(
    (toIndex?: number) => {
      if (drillState.breadcrumbs.length === 0) {
        return;
      }

      let newBreadcrumbs: typeof drillState.breadcrumbs;
      let newLevel: number;
      let newParentId: string | null;
      let newParentName: string | null;

      if (toIndex !== undefined && toIndex >= 0) {
        newBreadcrumbs = drillState.breadcrumbs.slice(0, toIndex);
        const targetCrumb = drillState.breadcrumbs[toIndex - 1];
        newLevel = targetCrumb?.level + 1 || boundaryLevel;
        newParentId = targetCrumb?.id || null;
        newParentName = targetCrumb?.name || null;
      } else {
        newBreadcrumbs = drillState.breadcrumbs.slice(0, -1);
        const lastCrumb = newBreadcrumbs[newBreadcrumbs.length - 1];
        newLevel = lastCrumb?.level + 1 || boundaryLevel;
        newParentId = lastCrumb?.id || null;
        newParentName = lastCrumb?.name || null;
      }

      setDrillState({
        currentLevel: newLevel,
        parentId: newParentId,
        parentName: newParentName,
        breadcrumbs: newBreadcrumbs,
      });

      if (setDataMask) {
        setDataMask({
          extraFormData: {},
          filterState: {},
        });
      }
    },
    [drillState, boundaryLevel, setDataMask],
  );

  const getFeatureStyle = useCallback(
    (feature: BoundaryFeature) => {
      const value = dataMap.get(feature.id);
      const fillColor = value !== undefined ? colorScale(value) : '#cccccc';
      const isHovered = hoveredFeature === feature.id;

      return {
        fillColor,
        fillOpacity: isHovered ? Math.min(opacity + 0.2, 1) : opacity,
        color: isHovered
          ? '#000000'
          : `rgba(${strokeColor.r},${strokeColor.g},${strokeColor.b},${strokeColor.a})`,
        weight: isHovered ? strokeWidth + 1 : strokeWidth,
      };
    },
    [dataMap, colorScale, opacity, strokeColor, strokeWidth, hoveredFeature],
  );

  const onEachFeature = useCallback(
    (feature: BoundaryFeature, layer: L.Layer) => {
      const value = dataMap.get(feature.id);
      const tooltipContent = `
        <div class="dhis2-map-tooltip">
          <strong>${feature.properties.name}</strong>
          <br/>
          ${metric}: ${value !== undefined ? formatValue(value) : 'No data'}
          ${
            tooltipColumns
              ?.map((col) => {
                const row = data.find((r) => String(r[orgUnitColumn]) === feature.id);
                return row ? `<br/>${col}: ${row[col]}` : '';
              })
              .join('') || ''
          }
        </div>
      `;

      layer.bindTooltip(tooltipContent, {
        sticky: true,
        className: 'dhis2-map-tooltip-container',
      });

      layer.on({
        mouseover: () => setHoveredFeature(feature.id),
        mouseout: () => setHoveredFeature(null),
        click: () => handleDrillDown(feature),
      });

      if (showLabels && feature.geometry.type !== 'Point') {
        const center = L.geoJSON(feature).getBounds().getCenter();
        let labelText = '';

        switch (labelType) {
          case 'name':
            labelText = feature.properties.name;
            break;
          case 'value':
            labelText = value !== undefined ? formatValue(value) : '';
            break;
          case 'name_value':
            labelText = `${feature.properties.name}\n${
              value !== undefined ? formatValue(value) : ''
            }`;
            break;
          case 'percent':
            const total = Array.from(dataMap.values()).reduce((a, b) => a + b, 0);
            labelText = value !== undefined ? `${((value / total) * 100).toFixed(1)}%` : '';
            break;
          default:
            break;
        }

        if (labelText && mapInstance) {
          L.marker(center, {
            icon: L.divIcon({
              className: 'map-label',
              html: `<div style="font-size: ${labelFontSize}px; text-align: center; white-space: nowrap;">${labelText}</div>`,
            }),
          }).addTo(mapInstance);
        }
      }
    },
    [
      dataMap,
      metric,
      data,
      orgUnitColumn,
      tooltipColumns,
      showLabels,
      labelType,
      labelFontSize,
      handleDrillDown,
      mapInstance,
    ],
  );

  return (
    <MapWrapper style={{ width, height }}>
      <MapContainer
        center={[0, 32]}
        zoom={6}
        zoomControl={false}
        whenCreated={setMapInstance}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <ZoomControl position="topright" />

        {boundaries.length > 0 && (
          <GeoJSON
            key={`${drillState.currentLevel}-${drillState.parentId}`}
            data={{ type: 'FeatureCollection', features: boundaries } as any}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {enableDrill && drillState.breadcrumbs.length > 0 && (
        <DrillControls
          breadcrumbs={drillState.breadcrumbs}
          onDrillUp={() => handleDrillUp()}
          onBreadcrumbClick={(index) => handleDrillUp(index)}
        />
      )}

      {showLegend && (
        <LegendPanel
          colorScale={colorScale}
          valueRange={valueRange}
          position={legendPosition}
          classes={legendClasses}
          metricName={metric}
        />
      )}

      {loading && (
        <div className="map-loading-overlay">
          <span>{t('Loading boundaries...')}</span>
        </div>
      )}

      {error && <div className="map-error-message">{error}</div>}
    </MapWrapper>
  );
};

export default DHIS2Map;
