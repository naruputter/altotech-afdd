import { request, ApiResponse } from './httpClient.ts';
import { Issue, IssueStatus, IssueSeverity } from '../types/index.ts';

const FALLBACK_ISSUES: Issue[] = [
  {
    id: 'iss-uuid-0001',
    code: 'ISSUE-AHU-01-HIGH-TEMP',
    title: 'AHU-A1 Supply Air Temperature Exceeding Threshold (Simultaneous Heating & Cooling Fault)',
    description: 'Supply temperature is 26.8°C while setpoint is 22.0°C for over 15 continuous minutes. Chilled water valve likely stuck at 15%.',
    severity: 'HIGH',
    status: 'OPEN',
    entity_id: 'AHU_A_01',
    site_id: 'Building_A',
    started_at: new Date(Date.now() - 3600000).toISOString(),
    last_detected_at: new Date().toISOString(),
    affected_rooms: ['Room_A_101', 'Room_A_102'],
    estimated_energy_waste_kwh: 42.5,
    evidence: {
      latest_metrics: {
        supply_air_temperature_c: 26.8,
        supply_air_temperature_setpoint_c: 22.0,
        chw_valve_command_pct: 15.0,
        run_status: 1
      },
      parameters: { tolerance: 3.0 }
    }
  },
  {
    id: 'iss-uuid-0002',
    code: 'ISSUE-IAQ-CO2-SPIKE',
    title: 'High CO2 Concentration in Conference Room 101',
    description: 'Indoor Air Quality sensor detected CO2 levels above 1,150 ppm due to damper minimum position limit.',
    severity: 'MEDIUM',
    status: 'OPEN',
    entity_id: 'IAQ_A_101',
    site_id: 'Building_A',
    started_at: new Date(Date.now() - 1800000).toISOString(),
    last_detected_at: new Date().toISOString(),
    affected_rooms: ['Room_A_101'],
    estimated_energy_waste_kwh: 12.0,
    evidence: {
      latest_metrics: {
        co2_ppm: 1180,
        tolerance: 1000
      },
      parameters: { tolerance: 1000 }
    }
  }
];

export interface GetIssuesParams {
  site_id?: string;
  status?: string;
  entity_id?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedIssuesResult {
  items: Issue[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const issueService = {
  getIssues: async (siteIdOrParams?: string | GetIssuesParams): Promise<Issue[]> => {
    try {
      let url = '/issues';
      if (typeof siteIdOrParams === 'string') {
        if (siteIdOrParams) url = `/issues?site_id=${encodeURIComponent(siteIdOrParams)}&limit=1000`;
      } else if (siteIdOrParams) {
        const query = new URLSearchParams();
        if (siteIdOrParams.site_id) query.append('site_id', siteIdOrParams.site_id);
        if (siteIdOrParams.status && siteIdOrParams.status !== 'ALL') query.append('status', siteIdOrParams.status);
        if (siteIdOrParams.entity_id) query.append('entity_id', siteIdOrParams.entity_id);
        if (siteIdOrParams.search) query.append('search', siteIdOrParams.search);
        if (siteIdOrParams.page) query.append('page', siteIdOrParams.page.toString());
        if (siteIdOrParams.limit) query.append('limit', siteIdOrParams.limit.toString());
        url = `/issues?${query.toString()}`;
      }
      return await request<Issue[]>(url);
    } catch (err) {
      console.warn('[issueService] Using fallback issues:', err);
      return FALLBACK_ISSUES;
    }
  },

  getIssuesPaginated: async (params: GetIssuesParams = {}): Promise<PaginatedIssuesResult> => {
    try {
      const query = new URLSearchParams();
      if (params.site_id) query.append('site_id', params.site_id);
      if (params.status && params.status !== 'ALL') query.append('status', params.status);
      if (params.entity_id) query.append('entity_id', params.entity_id);
      if (params.search) query.append('search', params.search);
      if (params.page) query.append('page', params.page.toString());
      if (params.limit) query.append('limit', params.limit.toString());

      const res = await request<ApiResponse<Issue[]>>(`/issues?${query.toString()}`, {
        returnFullResponse: true
      });

      return {
        items: res.data || [],
        total: res.pagination?.total ?? (res.data?.length || 0),
        page: res.pagination?.current_page ?? (params.page || 1),
        limit: res.pagination?.limit ?? (params.limit || 15),
        totalPages: res.pagination?.total_pages ?? 1
      };
    } catch (err) {
      console.warn('[issueService.getIssuesPaginated] Error fetching paginated issues, using fallback:', err);
      return {
        items: FALLBACK_ISSUES,
        total: FALLBACK_ISSUES.length,
        page: 1,
        limit: params.limit || 15,
        totalPages: 1
      };
    }
  },

  getOpenIssueCount: async (siteId?: string): Promise<number> => {
    try {
      const query = new URLSearchParams({ status: 'OPEN', limit: '1', page: '1' });
      if (siteId && siteId !== 'all') query.append('site_id', siteId);
      const res = await request<ApiResponse<Issue[]>>(`/issues?${query.toString()}`, {
        returnFullResponse: true
      });
      return res.pagination?.total ?? 0;
    } catch (err) {
      return 0;
    }
  },

  getIssueById: async (issueId: string): Promise<Issue | null> => {
    try {
      return await request<Issue>(`/issues/${issueId}`);
    } catch (err) {
      return FALLBACK_ISSUES.find(i => i.id === issueId) || null;
    }
  },

  updateIssueStatus: async (issueId: string, status: string): Promise<Issue | null> => {
    try {
      return await request<Issue>(`/issues/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    } catch (err) {
      console.warn('[issueService] Failed to update issue:', err);
      return null;
    }
  }
};
