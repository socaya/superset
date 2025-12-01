// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import { SupersetClient } from '@superset-ui/core';

interface GuestTokenResponse {
  token: string;
}

const tokenCache = new Map<string, string>();

export async function fetchGuestToken(dashboardId: string): Promise<string> {
  console.log('fetchGuestToken: Requesting token for dashboard:', dashboardId);

  if (tokenCache.has(dashboardId)) {
    console.log('fetchGuestToken: Using cached token');
    return tokenCache.get(dashboardId)!;
  }

  try {
    console.log('fetchGuestToken: Making POST request to /api/v1/security/guest_token_proxy/');
    // Always send what we have; backend will resolve to UUID when needed
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(dashboardId);
    const payload = isUuid
      ? { dashboard_uuid: dashboardId }
      : { dashboard_id: dashboardId };

    const response = await SupersetClient.post({
      endpoint: '/api/v1/security/guest_token_proxy/',
      jsonPayload: payload,
    });

    console.log('fetchGuestToken: Response received:', response);
    const data = response.json as GuestTokenResponse;
    const token = data.token;

    if (!token) {
      throw new Error('No token in response');
    }

    console.log('fetchGuestToken: Token fetched successfully');
    tokenCache.set(dashboardId, token);

    return token;
  } catch (error: any) {
    console.error('fetchGuestToken: ERROR on proxy:', error);
    // Fallback: if proxy route is unavailable (404), try the legacy public endpoint
    const isUuid = /^[0-9a-fA-F-]{36}$/.test(dashboardId);
    const status = (error && (error.status || error.response?.status)) as number | undefined;
    if (status === 404 && !isUuid) {
      try {
        console.log('fetchGuestToken: Falling back to /api/v1/security/public_guest_token/');
        const fallback = await SupersetClient.post({
          endpoint: '/api/v1/security/public_guest_token/',
          jsonPayload: { dashboard_id: dashboardId },
        });
        const data = fallback.json as GuestTokenResponse;
        const token = data.token;
        if (!token) throw new Error('No token in fallback response');
        tokenCache.set(dashboardId, token);
        return token;
      } catch (fallbackErr) {
        console.error('fetchGuestToken: fallback also failed:', fallbackErr);
        throw fallbackErr;
      }
    }
    console.error('fetchGuestToken: Error details:', {
      dashboardId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

export function clearGuestTokenCache(dashboardId?: string): void {
  if (dashboardId) {
    tokenCache.delete(dashboardId);
  } else {
    tokenCache.clear();
  }
}
