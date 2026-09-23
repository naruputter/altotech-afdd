import { request, ApiResponse } from './httpClient.ts';
import { TelemetryPoint } from '../types/index.ts';

export interface TelemetryHistoryRecord {
  id: string;
  timestamp: string;
  entity_id: string;
  metric_name: string;
  val: number;
  unit: string | null;
  site_id: string;
  ingested_at: string;
}

export interface GetTelemetryHistoryParams {
  site_id?: string;
  entity_id?: string;
  metric_name?: string;
  search?: string;
  start_time?: string;
  end_time?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedTelemetryResult {
  items: TelemetryHistoryRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const telemetryService = {
  ingestTelemetry: async (points: TelemetryPoint[]): Promise<{ status: string; count: number }> => {
    return await request('/telemetry/ingest', {
      method: 'POST',
      body: JSON.stringify({ points })
    });
  },

  getLatestMetrics: async (entityId: string): Promise<TelemetryHistoryRecord[]> => {
    try {
      return await request(`/telemetry/latest/${entityId}`);
    } catch (err) {
      return [];
    }
  },

  getHistory: async (params: GetTelemetryHistoryParams = {}): Promise<TelemetryHistoryRecord[]> => {
    try {
      const query = new URLSearchParams();
      if (params.site_id && params.site_id !== 'all') query.append('site_id', params.site_id);
      if (params.entity_id) query.append('entity_id', params.entity_id);
      if (params.metric_name) query.append('metric_name', params.metric_name);
      if (params.search) query.append('search', params.search);
      if (params.start_time) query.append('start_time', params.start_time);
      if (params.end_time) query.append('end_time', params.end_time);
      if (params.page) query.append('page', params.page.toString());
      if (params.limit) query.append('limit', params.limit.toString());

      return await request(`/telemetry/history?${query.toString()}`);
    } catch (err) {
      console.error('Failed to fetch telemetry history:', err);
      return [];
    }
  },

  getHistoryPaginated: async (params: GetTelemetryHistoryParams = {}): Promise<PaginatedTelemetryResult> => {
    try {
      const query = new URLSearchParams();
      if (params.site_id && params.site_id !== 'all') query.append('site_id', params.site_id);
      if (params.entity_id) query.append('entity_id', params.entity_id);
      if (params.metric_name) query.append('metric_name', params.metric_name);
      if (params.search) query.append('search', params.search);
      if (params.start_time) query.append('start_time', params.start_time);
      if (params.end_time) query.append('end_time', params.end_time);
      if (params.page) query.append('page', params.page.toString());
      if (params.limit) query.append('limit', params.limit.toString());

      const res = await request<ApiResponse<TelemetryHistoryRecord[]>>(
        `/telemetry/history?${query.toString()}`,
        { returnFullResponse: true }
      );

      const items = res.data || [];
      const total = res.pagination?.total ?? items.length;
      const page = res.pagination?.current_page ?? (params.page || 1);
      const limit = res.pagination?.limit ?? (params.limit || 50);
      const totalPages = res.pagination?.total_pages ?? Math.max(1, Math.ceil(total / limit));

      return {
        items,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (err) {
      console.error('Failed to fetch paginated telemetry history:', err);
      return {
        items: [],
        total: 0,
        page: params.page || 1,
        limit: params.limit || 50,
        totalPages: 1,
      };
    }
  },

  getDeviceStatus: async (siteId: string): Promise<Array<{ entity_id: string; last_seen: string | null; reading_count: number }>> => {
    try {
      return await request(`/telemetry/device-status?site_id=${siteId}`);
    } catch (err) {
      console.error('Failed to fetch device status:', err);
      return [];
    }
  }
};


