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

import { ChartProps, QueryFormData } from '@superset-ui/core';
import { DHIS2MapProps } from './types';

export default function transformProps(chartProps: ChartProps): DHIS2MapProps {
  const { width, height, formData, queriesData, datasource, hooks } = chartProps;

  const {
    org_unit_column,
    metric,
    boundary_level,
    enable_drill,
    color_scheme,
    opacity,
    stroke_color,
    stroke_width,
    show_labels,
    label_type,
    label_font_size,
    show_legend,
    legend_position,
    legend_classes,
    tooltip_columns,
  } = formData as QueryFormData;

  const data = queriesData[0]?.data || [];

  const databaseId = datasource?.database?.id;

  return {
    width,
    height,
    data,
    databaseId,
    orgUnitColumn: org_unit_column,
    metric:
      typeof metric === 'string'
        ? metric
        : metric?.label || metric?.expressionType || 'value',
    boundaryLevel: boundary_level || 2,
    enableDrill: enable_drill !== false,
    colorScheme: color_scheme || 'superset_seq_1',
    opacity: opacity ?? 0.7,
    strokeColor: stroke_color || { r: 255, g: 255, b: 255, a: 1 },
    strokeWidth: stroke_width ?? 1,
    showLabels: show_labels !== false,
    labelType: label_type || 'name',
    labelFontSize: label_font_size || 12,
    showLegend: show_legend !== false,
    legendPosition: legend_position || 'bottomright',
    legendClasses: legend_classes || 5,
    tooltipColumns: tooltip_columns || [],
    setDataMask: hooks?.setDataMask,
  };
}
