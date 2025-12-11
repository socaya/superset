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

import React from 'react';
import { styled, t } from '@superset-ui/core';
import { formatValue } from '../utils';

interface LegendPanelProps {
  colorScale: (value: number) => string;
  valueRange: { min: number; max: number };
  position: 'topleft' | 'topright' | 'bottomleft' | 'bottomright';
  classes: number;
  metricName: string;
}

const LegendContainer = styled.div<{ position: string }>`
  position: absolute;
  ${({ position }) => {
    const [vertical, horizontal] = [
      position.includes('top') ? 'top: 10px' : 'bottom: 30px',
      position.includes('left') ? 'left: 10px' : 'right: 10px',
    ];
    return `${vertical}; ${horizontal};`;
  }}
  background: white;
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  min-width: 120px;
`;

const LegendTitle = styled.div`
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 12px;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  margin: 4px 0;
  font-size: 11px;
`;

const ColorBox = styled.div<{ color: string }>`
  width: 20px;
  height: 14px;
  background: ${({ color }) => color};
  margin-right: 8px;
  border: 1px solid rgba(0, 0, 0, 0.2);
`;

const LegendPanel: React.FC<LegendPanelProps> = ({
  colorScale,
  valueRange,
  position,
  classes,
  metricName,
}) => {
  const step = (valueRange.max - valueRange.min) / classes;
  const breaks = Array.from({ length: classes }, (_, i) => valueRange.min + step * i);

  return (
    <LegendContainer position={position}>
      <LegendTitle>{metricName}</LegendTitle>
      {breaks.map((breakValue, index) => {
        const nextValue = index < breaks.length - 1 ? breaks[index + 1] : valueRange.max;
        return (
          <LegendItem key={index}>
            <ColorBox color={colorScale(breakValue + step / 2)} />
            <span>
              {formatValue(breakValue)} - {formatValue(nextValue)}
            </span>
          </LegendItem>
        );
      })}
      <LegendItem>
        <ColorBox color="#cccccc" />
        <span>{t('No data')}</span>
      </LegendItem>
    </LegendContainer>
  );
};

export default LegendPanel;
