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

import { useState } from 'react';
import { styled } from '@superset-ui/core';
import { Button } from '@superset-ui/core/components';
import logoImage from 'src/assets/images/loog.jpg';
import DataSourceSidebar, {
  type Dashboard,
} from 'src/features/home/DataSourceSidebar';
import DashboardContentArea from 'src/features/home/DashboardContentArea';

// Hide the original Superset menu
const PageWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  z-index: 9999;
  overflow-y: auto;
`;

// Custom navbar for public view
const PublicNavbar = styled.div`
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 101;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 24px;
`;

const LogoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const LogoImage = styled.img`
  height: 40px;
  width: auto;
`;

const LogoText = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: #1890ff;
`;

const LoginButton = styled.div``;

const ContentWrapper = styled.div`
  display: flex;
  width: 100%;
  min-height: calc(100vh - 60px);
  position: relative;
  padding-top: 60px;
`;

export default function PublicLandingPage() {
  const [selectedDashboard, setSelectedDashboard] = useState<
    Dashboard | undefined
  >(undefined);

  const handleLogin = () => {
    window.location.href = '/login/';
  };

  const handleDashboardSelect = (dashboard: Dashboard) => {
    console.log('Dashboard selected:', dashboard);
    setSelectedDashboard(dashboard);
  };

  return (
    <PageWrapper>
      <PublicNavbar>
        <LogoSection>
          <LogoImage src={logoImage} alt="Uganda Ministry of Health" />
          <LogoText>Uganda Malaria Data Repository</LogoText>
        </LogoSection>

        <LoginButton>
          <Button type="primary" onClick={handleLogin}>
            Login
          </Button>
        </LoginButton>
      </PublicNavbar>

      <ContentWrapper>
        <DataSourceSidebar
          selectedKey={selectedDashboard?.id.toString()}
          onSelect={handleDashboardSelect}
          isPublic={true}
        />
        {selectedDashboard && (
          <DashboardContentArea
            selectedDashboard={selectedDashboard}
            isPublic={true}
          />
        )}
      </ContentWrapper>
    </PageWrapper>
  );
}
