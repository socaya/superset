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

import { t } from '@superset-ui/core';
import {
  ControlPanelConfig,
  sections,
  sharedControls,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Map Configuration'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'org_unit_column',
            config: {
              type: 'SelectControl',
              label: t('Organisation Unit Column'),
              description: t('Column containing org unit identifiers'),
              mapStateToProps: (state: any) => ({
                choices: state.datasource?.columns?.map((col: any) => [
                  col.column_name,
                  col.column_name,
                ]) || [],
              }),
              validators: [],
            },
          },
        ],
        [
          {
            name: 'metric',
            config: {
              ...sharedControls.metric,
              label: t('Metric to Display'),
              description: t('The metric to visualize on the map'),
            },
          },
        ],
        [
          {
            name: 'boundary_level',
            config: {
              type: 'SelectControl',
              label: t('Boundary Level'),
              description: t('Organisation unit level for boundaries'),
              default: 2,
              choices: [
                [1, t('Level 1 (National)')],
                [2, t('Level 2 (Region)')],
                [3, t('Level 3 (District)')],
                [4, t('Level 4 (Sub-county)')],
                [5, t('Level 5 (Facility)')],
              ],
            },
          },
        ],
        [
          {
            name: 'enable_drill',
            config: {
              type: 'CheckboxControl',
              label: t('Enable Drill Down/Up'),
              description: t(
                'Allow clicking on regions to drill down to child org units',
              ),
              default: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Map Style'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'color_scheme',
            config: {
              type: 'ColorSchemeControl',
              label: t('Color Scheme'),
              description: t('Color scheme for choropleth'),
              default: 'superset_seq_1',
            },
          },
        ],
        [
          {
            name: 'opacity',
            config: {
              type: 'SliderControl',
              label: t('Fill Opacity'),
              default: 0.7,
              min: 0,
              max: 1,
              step: 0.1,
            },
          },
        ],
        [
          {
            name: 'stroke_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Border Color'),
              default: { r: 255, g: 255, b: 255, a: 1 },
            },
          },
        ],
        [
          {
            name: 'stroke_width',
            config: {
              type: 'SliderControl',
              label: t('Border Width'),
              default: 1,
              min: 0,
              max: 5,
              step: 0.5,
            },
          },
        ],
      ],
    },
    {
      label: t('Labels'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'show_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Show Labels'),
              description: t('Display org unit names on the map'),
              default: true,
            },
          },
        ],
        [
          {
            name: 'label_type',
            config: {
              type: 'SelectControl',
              label: t('Label Content'),
              default: 'name',
              choices: [
                ['name', t('Name Only')],
                ['value', t('Value Only')],
                ['name_value', t('Name and Value')],
                ['percent', t('Percentage')],
              ],
            },
          },
        ],
        [
          {
            name: 'label_font_size',
            config: {
              type: 'SliderControl',
              label: t('Label Font Size'),
              default: 12,
              min: 8,
              max: 24,
              step: 1,
            },
          },
        ],
      ],
    },
    {
      label: t('Legend'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_legend',
            config: {
              type: 'CheckboxControl',
              label: t('Show Legend'),
              default: true,
            },
          },
        ],
        [
          {
            name: 'legend_position',
            config: {
              type: 'SelectControl',
              label: t('Legend Position'),
              default: 'bottomright',
              choices: [
                ['topleft', t('Top Left')],
                ['topright', t('Top Right')],
                ['bottomleft', t('Bottom Left')],
                ['bottomright', t('Bottom Right')],
              ],
            },
          },
        ],
        [
          {
            name: 'legend_classes',
            config: {
              type: 'SliderControl',
              label: t('Number of Classes'),
              description: t('Number of color classes in legend'),
              default: 5,
              min: 3,
              max: 9,
              step: 1,
            },
          },
        ],
      ],
    },
    {
      label: t('Tooltip'),
      expanded: false,
      controlSetRows: [
        [
          {
            name: 'tooltip_columns',
            config: {
              type: 'SelectControl',
              label: t('Tooltip Columns'),
              description: t('Additional columns to show in tooltip'),
              multi: true,
              mapStateToProps: (state: any) => ({
                choices: state.datasource?.columns?.map((col: any) => [
                  col.column_name,
                  col.column_name,
                ]) || [],
              }),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
