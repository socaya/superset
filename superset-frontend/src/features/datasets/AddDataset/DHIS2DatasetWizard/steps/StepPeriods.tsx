import { useState, useEffect } from 'react';
import { styled, SupersetClient } from '@superset-ui/core';
import {
  Tabs,
  Select,
  Row,
  Col,
  Tag,
  Button,
  Badge,
  InputNumber,
  Empty,
  Checkbox,
} from 'antd';
import { Typography, Loading } from '@superset-ui/core/components';
import { DHIS2WizardState } from '../index';

const { Title, Paragraph, Text } = Typography;

const StepContainer = styled.div`
  max-width: 1200px;
`;

const Section = styled.div`
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h4`
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #000;
`;

const TabsContainer = styled(Tabs)`
  .ant-tabs-tab {
    font-weight: 500;
  }
`;

const ControlsRow = styled(Row)`
  margin-bottom: 16px;
`;

const PeriodsContainer = styled.div`
  ${({ theme }) => `
    background: ${theme.colorBgElevated};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    padding: 12px;
    max-height: 400px;
    overflow-y: auto;
  `}
`;

const PeriodCheckbox = styled.div`
  padding: 8px;
  display: flex;
  align-items: center;
  gap: 12px;

  &:hover {
    background-color: #f5f5f5;
    border-radius: 4px;
  }
`;

const SelectedSummary = styled.div`
  ${({ theme }) => `
    background: ${theme.colorBgElevated};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    padding: 16px;
    margin-top: 24px;
  `}
`;

const ErrorText = styled.div`
  color: #ff4d4f;
  font-size: 12px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: #fff1f0;
  border-radius: 4px;
`;

interface StepPeriodsProps {
  wizardState: DHIS2WizardState;
  updateState: (updates: Partial<DHIS2WizardState>) => void;
  errors: Record<string, string>;
  databaseId?: number;
}

interface Period {
  id: string;
  displayName: string;
  type: string;
  periodType?: string;
}

const PERIOD_TYPE_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly (Monday)' },
  { value: 'WEEKLY_WED', label: 'Weekly (Wednesday)' },
  { value: 'WEEKLY_THU', label: 'Weekly (Thursday)' },
  { value: 'WEEKLY_SAT', label: 'Weekly (Saturday)' },
  { value: 'WEEKLY_SUN', label: 'Weekly (Sunday)' },
  { value: 'BI_WEEKLY', label: 'Bi-weekly' },
  { value: 'FOUR_WEEKLY', label: 'Four-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'BI_MONTHLY', label: 'Bi-monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SIX_MONTHLY', label: 'Six-monthly (Jan)' },
  { value: 'SIX_MONTHLY_APR', label: 'Six-monthly (Apr)' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'FINANCIAL_APR', label: 'Financial Year (Apr)' },
  { value: 'FINANCIAL_JUL', label: 'Financial Year (Jul)' },
  { value: 'FINANCIAL_OCT', label: 'Financial Year (Oct)' },
  { value: 'FINANCIAL_NOV', label: 'Financial Year (Nov)' },
];

const RELATIVE_PERIODS = [
  { value: 'TODAY', label: 'Today', type: 'DAILY' },
  { value: 'YESTERDAY', label: 'Yesterday', type: 'DAILY' },
  { value: 'LAST_3_DAYS', label: 'Last 3 Days', type: 'DAILY' },
  { value: 'LAST_7_DAYS', label: 'Last 7 Days', type: 'DAILY' },
  { value: 'LAST_14_DAYS', label: 'Last 14 Days', type: 'DAILY' },
  { value: 'LAST_30_DAYS', label: 'Last 30 Days', type: 'DAILY' },
  { value: 'LAST_60_DAYS', label: 'Last 60 Days', type: 'DAILY' },
  { value: 'LAST_90_DAYS', label: 'Last 90 Days', type: 'DAILY' },
  { value: 'LAST_180_DAYS', label: 'Last 180 Days', type: 'DAILY' },
  { value: 'LAST_365_DAYS', label: 'Last 365 Days', type: 'DAILY' },
  { value: 'THIS_WEEK', label: 'This Week', type: 'WEEKLY' },
  { value: 'LAST_WEEK', label: 'Last Week', type: 'WEEKLY' },
  { value: 'LAST_4_WEEKS', label: 'Last 4 Weeks', type: 'WEEKLY' },
  { value: 'LAST_12_WEEKS', label: 'Last 12 Weeks', type: 'WEEKLY' },
  { value: 'LAST_52_WEEKS', label: 'Last 52 Weeks', type: 'WEEKLY' },
  { value: 'WEEKS_THIS_YEAR', label: 'Weeks This Year', type: 'WEEKLY' },
  { value: 'WEEKS_LAST_YEAR', label: 'Weeks Last Year', type: 'WEEKLY' },
  { value: 'THIS_BIWEEK', label: 'This Bi-week', type: 'BI_WEEKLY' },
  { value: 'LAST_BIWEEK', label: 'Last Bi-week', type: 'BI_WEEKLY' },
  { value: 'LAST_4_BIWEEKS', label: 'Last 4 Bi-weeks', type: 'BI_WEEKLY' },
  { value: 'LAST_12_BIWEEKS', label: 'Last 12 Bi-weeks', type: 'BI_WEEKLY' },
  {
    value: 'BIWEEKS_THIS_YEAR',
    label: 'Bi-weeks This Year',
    type: 'BI_WEEKLY',
  },
  {
    value: 'BIWEEKS_LAST_YEAR',
    label: 'Bi-weeks Last Year',
    type: 'BI_WEEKLY',
  },
  { value: 'THIS_MONTH', label: 'This Month', type: 'MONTHLY' },
  { value: 'LAST_MONTH', label: 'Last Month', type: 'MONTHLY' },
  { value: 'LAST_3_MONTHS', label: 'Last 3 Months', type: 'MONTHLY' },
  { value: 'LAST_6_MONTHS', label: 'Last 6 Months', type: 'MONTHLY' },
  { value: 'LAST_12_MONTHS', label: 'Last 12 Months', type: 'MONTHLY' },
  { value: 'MONTHS_THIS_YEAR', label: 'Months This Year', type: 'MONTHLY' },
  { value: 'MONTHS_LAST_YEAR', label: 'Months Last Year', type: 'MONTHLY' },
  { value: 'THIS_BIMONTH', label: 'This Bi-month', type: 'BI_MONTHLY' },
  { value: 'LAST_BIMONTH', label: 'Last Bi-month', type: 'BI_MONTHLY' },
  { value: 'LAST_6_BIMONTHS', label: 'Last 6 Bi-months', type: 'BI_MONTHLY' },
  {
    value: 'BIMONTHS_THIS_YEAR',
    label: 'Bi-months This Year',
    type: 'BI_MONTHLY',
  },
  {
    value: 'BIMONTHS_LAST_YEAR',
    label: 'Bi-months Last Year',
    type: 'BI_MONTHLY',
  },
  { value: 'THIS_QUARTER', label: 'This Quarter', type: 'QUARTERLY' },
  { value: 'LAST_QUARTER', label: 'Last Quarter', type: 'QUARTERLY' },
  { value: 'LAST_4_QUARTERS', label: 'Last 4 Quarters', type: 'QUARTERLY' },
  {
    value: 'QUARTERS_THIS_YEAR',
    label: 'Quarters This Year',
    type: 'QUARTERLY',
  },
  {
    value: 'QUARTERS_LAST_YEAR',
    label: 'Quarters Last Year',
    type: 'QUARTERLY',
  },
  { value: 'THIS_SIX_MONTH', label: 'This Six-month', type: 'SIX_MONTHLY' },
  { value: 'LAST_SIX_MONTH', label: 'Last Six-month', type: 'SIX_MONTHLY' },
  {
    value: 'LAST_2_SIXMONTHS',
    label: 'Last 2 Six-months',
    type: 'SIX_MONTHLY',
  },
  {
    value: 'SIXMONTHS_THIS_YEAR',
    label: 'Six-months This Year',
    type: 'SIX_MONTHLY',
  },
  {
    value: 'SIXMONTHS_LAST_YEAR',
    label: 'Six-months Last Year',
    type: 'SIX_MONTHLY',
  },
  { value: 'THIS_YEAR', label: 'This Year', type: 'YEARLY' },
  { value: 'LAST_YEAR', label: 'Last Year', type: 'YEARLY' },
  { value: 'LAST_5_YEARS', label: 'Last 5 Years', type: 'YEARLY' },
  { value: 'LAST_10_YEARS', label: 'Last 10 Years', type: 'YEARLY' },
  {
    value: 'THIS_FINANCIAL_YEAR',
    label: 'This Financial Year',
    type: 'FINANCIAL',
  },
  {
    value: 'LAST_FINANCIAL_YEAR',
    label: 'Last Financial Year',
    type: 'FINANCIAL',
  },
  {
    value: 'LAST_5_FINANCIAL_YEARS',
    label: 'Last 5 Financial Years',
    type: 'FINANCIAL',
  },
  {
    value: 'LAST_10_FINANCIAL_YEARS',
    label: 'Last 10 Financial Years',
    type: 'FINANCIAL',
  },
];

const RELATIVE_PERIOD_TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'BI_MONTHLY', label: 'Bi-monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'SIX_MONTHLY', label: 'Six-monthly' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'FINANCIAL', label: 'Financial Year' },
];

export default function WizardStepPeriods({
  wizardState,
  updateState,
  errors,
  databaseId,
}: StepPeriodsProps) {
  const [relativePeriods, setRelativePeriods] = useState<Period[]>([]);
  const [fixedPeriods, setFixedPeriods] = useState<Period[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [fixedPeriodType, setFixedPeriodType] = useState<string>('YEARLY');
  const [fixedYear, setFixedYear] = useState<number>(new Date().getFullYear());
  const [relativePeriodType, setRelativePeriodType] = useState<string>('ALL');

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const filtered = RELATIVE_PERIODS.filter(
      p => relativePeriodType === 'ALL' || p.type === relativePeriodType,
    );
    setRelativePeriods(
      filtered.map(p => ({
        id: p.value,
        displayName: p.label,
        type: 'RELATIVE',
        periodType: p.type,
      })),
    );
  }, [relativePeriodType]);

  useEffect(() => {
    fetchFixedPeriods();
  }, [fixedPeriodType, fixedYear, databaseId]);

  const fetchFixedPeriods = async () => {
    if (!databaseId) return;

    setLoadingPeriods(true);
    try {
      console.log('[StepPeriods] Fetching fixed periods:', { fixedPeriodType, fixedYear, databaseId });
      const response = await SupersetClient.get({
        endpoint: `/api/v1/database/${databaseId}/dhis2_metadata/periods?periodType=${fixedPeriodType}&year=${fixedYear}`,
      });

      const periods = response.json?.result || [];
      console.log('[StepPeriods] Received periods:', { count: periods.length, periodType: fixedPeriodType, year: fixedYear });

      if (fixedPeriodType === 'MONTHLY' || fixedPeriodType === 'QUARTERLY') {
        const yearPeriods = periods.filter((p: Period) => {
          const periodYear = parseInt(p.id.substring(0, 4), 10);
          return periodYear === fixedYear;
        });
        console.log('[StepPeriods] Filtered periods for year:', { year: fixedYear, filteredCount: yearPeriods.length });
        setFixedPeriods(yearPeriods);
      } else {
        setFixedPeriods(periods);
      }
    } catch (error) {
      console.error('[StepPeriods] Error fetching periods:', error);
      setFixedPeriods([]);
    } finally {
      setLoadingPeriods(false);
    }
  };

  const handlePeriodToggle = (periodId: string) => {
    const selected = new Set(wizardState.periods);
    if (selected.has(periodId)) {
      selected.delete(periodId);
      console.log('[StepPeriods] Deselected period:', periodId);
    } else {
      selected.add(periodId);
      console.log('[StepPeriods] Selected period:', periodId);
    }
    const updatedPeriods = Array.from(selected);
    console.log('[StepPeriods] Updated periods:', updatedPeriods);
    updateState({ periods: updatedPeriods });
  };

  const handleSelectAll = (periods: Period[]) => {
    const selected = new Set(wizardState.periods);
    periods.forEach(p => {
      selected.add(p.id);
      console.log('[StepPeriods] Selected all - adding:', p.id);
    });
    const updatedPeriods = Array.from(selected);
    console.log('[StepPeriods] Select all result:', updatedPeriods);
    updateState({ periods: updatedPeriods });
  };

  const handleDeselectAll = (periods: Period[]) => {
    const selected = new Set(wizardState.periods);
    periods.forEach(p => {
      selected.delete(p.id);
      console.log('[StepPeriods] Deselected all - removing:', p.id);
    });
    const updatedPeriods = Array.from(selected);
    console.log('[StepPeriods] Deselect all result:', updatedPeriods);
    updateState({ periods: updatedPeriods });
  };

  const getSelectedCount = (periods: Period[]) =>
    periods.filter(p => wizardState.periods.includes(p.id)).length;

  return (
    <StepContainer>
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, marginBottom: 8 }}>
          Period
        </Title>
        <Paragraph style={{ margin: 0 }}>
          Choose time periods for your dataset.
        </Paragraph>
      </div>

      {errors.periods && <ErrorText>{errors.periods}</ErrorText>}

      <TabsContainer
        items={[
          {
            key: 'relative',
            label: 'Relative periods',
            children: (
              <Section>
                <ControlsRow gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <div>
                      <SectionTitle>Period type</SectionTitle>
                      <Select
                        value={relativePeriodType}
                        onChange={setRelativePeriodType}
                        options={RELATIVE_PERIOD_TYPE_OPTIONS}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </Col>
                </ControlsRow>

                {relativePeriods.length > 0 ? (
                  <>
                    <ControlsRow gutter={[16, 16]}>
                      <Col>
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => handleSelectAll(relativePeriods)}
                          disabled={
                            getSelectedCount(relativePeriods) ===
                            relativePeriods.length
                          }
                        >
                          Select all
                        </Button>
                      </Col>
                      <Col>
                        <Button
                          size="small"
                          onClick={() => handleDeselectAll(relativePeriods)}
                          disabled={getSelectedCount(relativePeriods) === 0}
                        >
                          Deselect all
                        </Button>
                      </Col>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {getSelectedCount(relativePeriods)} of{' '}
                          {relativePeriods.length} selected
                        </Text>
                      </Col>
                    </ControlsRow>

                    <PeriodsContainer>
                      {relativePeriods.map(period => (
                        <PeriodCheckbox key={period.id}>
                          <Checkbox
                            checked={wizardState.periods.includes(period.id)}
                            onChange={() => handlePeriodToggle(period.id)}
                          />
                          <span>{period.displayName}</span>
                        </PeriodCheckbox>
                      ))}
                    </PeriodsContainer>
                  </>
                ) : (
                  <Empty description="No relative periods available" />
                )}
              </Section>
            ),
          },
          {
            key: 'fixed',
            label: 'Fixed periods',
            children: (
              <Section>
                <ControlsRow gutter={[16, 16]}>
                  <Col xs={24} sm={12}>
                    <div>
                      <SectionTitle>Period type</SectionTitle>
                      <Select
                        value={fixedPeriodType}
                        onChange={setFixedPeriodType}
                        options={PERIOD_TYPE_OPTIONS}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </Col>

                  {(fixedPeriodType === 'MONTHLY' ||
                    fixedPeriodType === 'QUARTERLY') && (
                    <Col xs={24} sm={12}>
                      <div>
                        <SectionTitle>Year</SectionTitle>
                        <InputNumber
                          value={fixedYear}
                          onChange={value => setFixedYear(value || currentYear)}
                          min={currentYear - 9}
                          max={currentYear + 1}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </Col>
                  )}
                </ControlsRow>

                {loadingPeriods ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <Loading />
                  </div>
                ) : fixedPeriods.length > 0 ? (
                  <>
                    <ControlsRow gutter={[16, 16]}>
                      <Col>
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => handleSelectAll(fixedPeriods)}
                          disabled={
                            getSelectedCount(fixedPeriods) ===
                            fixedPeriods.length
                          }
                        >
                          Select all
                        </Button>
                      </Col>
                      <Col>
                        <Button
                          size="small"
                          onClick={() => handleDeselectAll(fixedPeriods)}
                          disabled={getSelectedCount(fixedPeriods) === 0}
                        >
                          Deselect all
                        </Button>
                      </Col>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {getSelectedCount(fixedPeriods)} of{' '}
                          {fixedPeriods.length} selected
                        </Text>
                      </Col>
                    </ControlsRow>

                    <PeriodsContainer>
                      {fixedPeriods.length > 0 ? (
                        fixedPeriods.map(period => (
                          <PeriodCheckbox key={period.id}>
                            <Checkbox
                              checked={wizardState.periods.includes(period.id)}
                              onChange={() => handlePeriodToggle(period.id)}
                            />
                            <span>{period.displayName}</span>
                          </PeriodCheckbox>
                        ))
                      ) : (
                        <Empty
                          description="No periods available"
                          style={{ padding: '20px' }}
                        />
                      )}
                    </PeriodsContainer>
                  </>
                ) : (
                  <Empty description="No periods available for selected type" />
                )}
              </Section>
            ),
          },
        ]}
      />

      {wizardState.periods.length > 0 && (
        <SelectedSummary>
          <div style={{ marginBottom: 12 }}>
            <Text strong>
              <Badge
                count={wizardState.periods.length}
                style={{ backgroundColor: '#1890ff' }}
              />
              <span style={{ marginLeft: 8 }}>Periods Selected</span>
            </Text>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {wizardState.periods.map(period => {
              const relativePeriod = RELATIVE_PERIODS.find(
                p => p.value === period,
              );
              const label = relativePeriod?.label || period;
              return (
                <Tag
                  key={period}
                  closable
                  onClose={() => {
                    const updated = wizardState.periods.filter(
                      p => p !== period,
                    );
                    updateState({ periods: updated });
                  }}
                >
                  {label}
                </Tag>
              );
            })}
          </div>
        </SelectedSummary>
      )}

      {wizardState.periods.length > 0 && (
        <Button
          type="primary"
          danger
          block
          style={{ marginTop: 16 }}
          onClick={() => updateState({ periods: [] })}
        >
          Clear All Periods
        </Button>
      )}
    </StepContainer>
  );
}
