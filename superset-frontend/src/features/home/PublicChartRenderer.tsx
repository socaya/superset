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
import { useEffect, useState } from 'react';
import { styled, t, SuperChart, SupersetClient } from '@superset-ui/core';
import { Spin, Alert } from 'antd';

const ChartContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
`;

const LoadingContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fafafa;
`;

const ChartContent = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
`;

interface PublicChartRendererProps {
  chartId: number;
  chartName: string;
  isPublic: boolean;
}

interface ChartData {
  formData: any;
  queriesResponse: any[];
  datasource?: any;
}

export default function PublicChartRenderer({
  chartId,
  chartName,
  isPublic,
}: PublicChartRendererProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        // First, get the chart metadata to get form_data
        const chartMetaEndpoint = `/api/v1/chart/${chartId}`;
        const metaResponse = await SupersetClient.get({
          endpoint: chartMetaEndpoint,
        });

        const chartMeta = metaResponse.json.result;
        const formData = JSON.parse(chartMeta.params || '{}');

        // FR-2.3: Use public data endpoint for public charts (FR-2.1)
        const dataEndpoint = isPublic
          ? `/api/v1/chart/${chartId}/public/data/`
          : `/api/v1/chart/${chartId}/data/`;

        const dataResponse = await SupersetClient.get({
          endpoint: dataEndpoint,
        });

        const queriesResponse = dataResponse.json.result || [];

        setChartData({
          formData: {
            ...formData,
            slice_id: chartId,
            viz_type: chartMeta.viz_type,
          },
          queriesResponse,
          datasource: chartMeta.datasource,
        });
      } catch (err: any) {
        // FR-4.1: Handle unauthorized access with proper error codes
        if (err.status === 403) {
          setError(t('This chart is not public. Please log in to view it.'));
        } else if (err.status === 401) {
          setError(t('Authentication required to view this chart.'));
        } else {
          const errorMsg = err.message || t('Failed to load chart');
          setError(errorMsg);
        }
        console.error('Error loading chart:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [chartId, isPublic]);

  if (loading) {
    return (
      <ChartContainer>
        <LoadingContainer>
          <Spin size="large" tip={t('Loading chart...')} />
        </LoadingContainer>
      </ChartContainer>
    );
  }

  if (error) {
    return (
      <ChartContainer>
        <LoadingContainer>
          <Alert
            message={t('Error Loading Chart')}
            description={error}
            type="error"
            showIcon
          />
        </LoadingContainer>
      </ChartContainer>
    );
  }

  if (!chartData || !chartData.queriesResponse || chartData.queriesResponse.length === 0) {
    return (
      <ChartContainer>
        <LoadingContainer>
          <Alert
            message={t('No Data')}
            description={t('No data available for this chart')}
            type="info"
            showIcon
          />
        </LoadingContainer>
      </ChartContainer>
    );
  }

  // FR-2.4: Render chart using SuperChart (native Superset rendering, NO iframes)
  // This uses the same rendering engine as dashboards and explore view
  return (
    <ChartContainer>
      <ChartContent>
        <SuperChart
          chartType={chartData.formData.viz_type}
          formData={chartData.formData}
          queriesData={chartData.queriesResponse}
          height="100%"
          width="100%"
        />
      </ChartContent>
    </ChartContainer>
  );
}
