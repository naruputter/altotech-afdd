import { request, ApiResponse } from './httpClient.ts';
import { Rule, RuleStatus } from '../types/index.ts';

const FALLBACK_RULES: Rule[] = [
  {
    id: 'rule-uuid-0001',
    code: 'RULE_AHU_SUPPLY_TEMP_HIGH',
    name: 'AHU Supply Air Temperature High Fault',
    description: 'Triggers when supply_temp > setpoint + 3.0°C continuously for 15 minutes during occupied hours.',
    severity: 'HIGH',
    is_active: true,
    status: 'APPROVED',
    created_by: 'system',
    fault_logic: {
      condition: 'supply_temp > temp_setpoint + 3.0',
      duration_seconds: 900,
      metrics: ['supply_temp', 'temp_setpoint', 'chw_valve_pos']
    }
  },
  {
    id: 'rule-uuid-0002',
    code: 'RULE_IAQ_CO2_OVERLIMIT',
    name: 'High Indoor CO2 Alert',
    description: 'Triggers when CO2 concentration exceeds 1000 ppm for more than 10 minutes.',
    severity: 'MEDIUM',
    is_active: true,
    status: 'APPROVED',
    created_by: 'system',
    fault_logic: {
      condition: 'co2_ppm > 1000',
      duration_seconds: 600,
      metrics: ['co2_ppm']
    }
  },
  {
    id: 'rule-uuid-0003',
    code: 'RULE_SIMULTANEOUS_HEAT_COOL',
    name: 'Simultaneous Heating and Cooling Detection (AI Draft)',
    description: 'AI detected inefficient reheat valve opening while chilled water valve is at 80%.',
    severity: 'CRITICAL',
    is_active: false,
    status: 'DRAFT',
    created_by: 'ai_agent',
    fault_logic: {
      condition: 'chw_valve > 50 AND reheat_valve > 30',
      duration_seconds: 1200,
      metrics: ['chw_valve', 'reheat_valve']
    }
  }
];

export interface GetRulesParams {
  status?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedRulesResult {
  items: Rule[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const ruleService = {
  getRules: async (statusOrParams?: string | GetRulesParams): Promise<Rule[]> => {
    try {
      let url = '/rules?limit=1000';
      if (typeof statusOrParams === 'string') {
        if (statusOrParams && statusOrParams !== 'ALL') url = `/rules?status=${encodeURIComponent(statusOrParams)}&limit=1000`;
      } else if (statusOrParams) {
        const query = new URLSearchParams();
        if (statusOrParams.status && statusOrParams.status !== 'ALL') query.append('status', statusOrParams.status);
        if (statusOrParams.is_active !== undefined) query.append('is_active', String(statusOrParams.is_active));
        if (statusOrParams.search) query.append('search', statusOrParams.search);
        if (statusOrParams.page) query.append('page', statusOrParams.page.toString());
        if (statusOrParams.limit) query.append('limit', statusOrParams.limit.toString());
        url = `/rules?${query.toString()}`;
      }
      return await request<Rule[]>(url);
    } catch (err) {
      console.warn('[ruleService] Using fallback rules:', err);
      return FALLBACK_RULES;
    }
  },

  getRulesPaginated: async (params: GetRulesParams = {}): Promise<PaginatedRulesResult> => {
    try {
      const query = new URLSearchParams();
      if (params.status && params.status !== 'ALL') query.append('status', params.status);
      if (params.is_active !== undefined) query.append('is_active', String(params.is_active));
      if (params.search) query.append('search', params.search);
      if (params.page) query.append('page', params.page.toString());
      if (params.limit) query.append('limit', params.limit.toString());

      const res = await request<ApiResponse<Rule[]>>(`/rules?${query.toString()}`, {
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
      console.warn('[ruleService.getRulesPaginated] Using fallback rules:', err);
      return {
        items: FALLBACK_RULES,
        total: FALLBACK_RULES.length,
        page: 1,
        limit: params.limit || 15,
        totalPages: 1
      };
    }
  },

  createRule: async (ruleData: Partial<Rule>): Promise<Rule> => {
    return await request<Rule>('/rules', {
      method: 'POST',
      body: JSON.stringify(ruleData)
    });
  },

  updateRule: async (ruleId: string, ruleData: Partial<Rule>): Promise<Rule> => {
    return await request<Rule>(`/rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify(ruleData)
    });
  },

  updateRuleStatus: async (ruleId: string, status: string, is_active?: boolean): Promise<Rule> => {
    return await request<Rule>(`/rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, is_active })
    });
  },

  deleteRule: async (ruleId: string): Promise<void> => {
    await request<void>(`/rules/${ruleId}`, {
      method: 'DELETE'
    });
  }
};
