export const API_BASE = 'http://localhost:8000/api/v1';

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  current_page: number;
  total_pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: PaginationMeta;
  message: string;
}

export interface RequestOptions extends RequestInit {
  returnFullResponse?: boolean;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const errorMsg = json?.message || `HTTP Error ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  // If status is 204 No Content
  if (response.status === 204 || !json) {
    return {} as T;
  }

  // Handle standard ApiResponse wrapper { success: true, data: ..., pagination: ..., message: ... }
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    if (!json.success) {
      throw new Error(json.message || 'API request failed');
    }
    // If caller explicitly asked for full envelope response (to read pagination metadata)
    if (options.returnFullResponse) {
      return json as T;
    }
    return json.data as T;
  }

  // Fallback for direct responses
  return json as T;
}
