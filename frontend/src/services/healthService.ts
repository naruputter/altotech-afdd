import { request } from './httpClient.ts';

export interface HealthResponse {
  status: string;
  service?: string;
  version?: string;
}

export const checkHealth = async (): Promise<HealthResponse> => {
  try {
    return await request<HealthResponse>('http://localhost:8000/health');
  } catch (err) {
    return { status: 'offline' };
  }
};
