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

import { useState, useCallback } from 'react';
import { styled, t } from '@superset-ui/core';
import { Button, Icons } from '@superset-ui/core/components';
// eslint-disable-next-line no-restricted-imports
import { message, Collapse } from 'antd';
import { PeriodSelector } from 'src/features/datasets/AddDataset/DHIS2ParameterBuilder/PeriodSelector';
import { DxSelector } from 'src/features/datasets/AddDataset/DHIS2ParameterBuilder/DxSelector';
import { OuSelector } from 'src/features/datasets/AddDataset/DHIS2ParameterBuilder/OuSelector';

const { Panel } = Collapse;

interface DHIS2QueryBuilderProps {
  onInsertSQL: (sql: string) => void;
  databaseId?: number;
  endpoint?: string;
}

const StyledContainer = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 4}px;
    background: ${theme.colorBgContainer};
    border-radius: ${theme.borderRadius}px;
    margin: ${theme.sizeUnit * 2}px 0;
    border: 1px solid ${theme.colorBorder};
    max-height: 100vh;
    overflow-y: auto;
    
    .section-title {
      font-weight: 600;
      margin-bottom: ${theme.sizeUnit * 2}px;
      color: ${theme.colorText};
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit}px;
    }

    .ant-collapse {
      border: none !important;
      background: transparent !important;
      margin-bottom: ${theme.sizeUnit * 2}px;
      
      .ant-collapse-item {
        margin-bottom: ${theme.sizeUnit * 2}px;
        border: 1px solid ${theme.colorBorder} !important;
        border-radius: ${theme.borderRadius}px !important;
      }
      
      .ant-collapse-header {
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 2.5}px !important;
        background: ${theme.colorBgElevated} !important;
        font-weight: 500 !important;
      }
      
      .ant-collapse-content-box {
        padding: ${theme.sizeUnit * 2.5}px !important;
        min-height: 400px;
        overflow-y: auto;
        max-height: 500px;
      }
    }

    .preview-container {
      background: ${theme.colorBgLayout};
      color: ${theme.colorText};
      padding: ${theme.sizeUnit * 3}px;
      border-radius: ${theme.borderRadius}px;
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
      border: 1px solid ${theme.colorBorder};
      margin: ${theme.sizeUnit * 2}px 0;
      min-height: 100px;
      max-height: 200px;
      overflow-y: auto;
    }

    .button-group {
      display: flex;
      gap: ${theme.sizeUnit * 2}px;
      margin-top: ${theme.sizeUnit * 3}px;
    }
  `}
`;

export default function DHIS2QueryBuilder({
  onInsertSQL,
  databaseId = 0,
  endpoint = 'analytics',
}: DHIS2QueryBuilderProps) {
  const [selectedData, setSelectedData] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([
    'LAST_YEAR',
  ]);
  const [selectedOrgUnits, setSelectedOrgUnits] = useState<string[]>([
    'USER_ORGUNIT',
  ]);

  const generatedSQL = generateAnalyticsSQL(
    selectedData,
    selectedPeriods,
    selectedOrgUnits,
  );

  const handleInsertSQL = useCallback(() => {
    if (selectedData.length > 0 && selectedPeriods.length > 0) {
      onInsertSQL(generatedSQL);
      message.success(t('SQL inserted at cursor'));
    } else {
      message.warning(t('Please select at least one data element and period'));
    }
  }, [selectedData, selectedPeriods, generatedSQL, onInsertSQL]);

  const handleCopySQL = useCallback(() => {
    navigator.clipboard.writeText(generatedSQL);
    message.success(t('SQL copied to clipboard'));
  }, [generatedSQL]);

  const handleClear = useCallback(() => {
    setSelectedData([]);
    setSelectedPeriods(['LAST_YEAR']);
    setSelectedOrgUnits(['USER_ORGUNIT']);
  }, []);

  return (
    <StyledContainer>
      <div className="section-title">
        <Icons.AppstoreOutlined /> {t('DHIS2 Query Builder')}
      </div>

      <Collapse defaultActiveKey={['1', '2', '3']}>
        {/* Data Elements */}
        <Panel
          header={`${t('Data Elements')} (${selectedData.length})`}
          key="1"
        >
          <DxSelector
            databaseId={databaseId}
            endpoint={endpoint}
            value={selectedData}
            onChange={setSelectedData}
          />
        </Panel>

        {/* Periods */}
        <Panel header={`${t('Periods')} (${selectedPeriods.length})`} key="2">
          <PeriodSelector
            databaseId={databaseId}
            value={selectedPeriods}
            onChange={setSelectedPeriods}
          />
        </Panel>

        {/* Organization Units */}
        <Panel
          header={`${t('Organisation Units')} (${selectedOrgUnits.length})`}
          key="3"
        >
          <OuSelector
            databaseId={databaseId}
            value={selectedOrgUnits}
            onChange={setSelectedOrgUnits}
          />
        </Panel>
      </Collapse>

      {/* Preview */}
      <div style={{ marginTop: 16 }}>
        <div className="section-title">{t('Generated SQL')}</div>
        <div className="preview-container">{generatedSQL}</div>
      </div>

      {/* Actions */}
      <div className="button-group">
        <Button
          type="primary"
          icon={<Icons.AppstoreOutlined />}
          onClick={handleInsertSQL}
          disabled={selectedData.length === 0 || selectedPeriods.length === 0}
        >
          {t('Insert at Cursor')}
        </Button>
        <Button icon={<Icons.CopyOutlined />} onClick={handleCopySQL}>
          {t('Copy SQL')}
        </Button>
        <Button icon={<Icons.DeleteOutlined />} onClick={handleClear} danger>
          {t('Clear All')}
        </Button>
      </div>
    </StyledContainer>
  );
}

function generateAnalyticsSQL(
  dataElements: string[],
  periods: string[],
  orgUnits: string[],
): string {
  if (dataElements.length === 0 || periods.length === 0) {
    return '-- Select data elements and periods to generate SQL';
  }

  const dxParam = dataElements.join(';');
  const peParam = periods.join(';');
  const ouParam = orgUnits.join(';');

  const params = [
    `dimension=dx:${dxParam}`,
    `dimension=pe:${peParam}`,
    `dimension=ou:${ouParam}`,
    'displayProperty=NAME',
    'hierarchyMeta=true',
  ];

  const queryString = params.join('&');

  return `-- DHIS2 Analytics Query
-- Data Elements: ${dataElements.join(', ')}
-- Periods: ${periods.join(', ')}
-- Org Units: ${orgUnits.join(', ')}
-- 
-- This query will be executed against the DHIS2 analytics endpoint
-- The comment parameters above will be parsed by the DHIS2 dialect

-- Generated DHIS2 Analytics API query:
-- GET /api/analytics?${queryString}

SELECT * FROM analytics
-- WHERE the query parameters defined above are applied by the backend
`;
}
