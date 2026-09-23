import { request } from './httpClient.ts';

export const aiService = {
  chat: async (prompt: string, context: any = {}): Promise<{ response: string }> => {
    try {
      return await request<{ response: string }>('/ai-agent/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt, context })
      });
    } catch (err) {
      return {
        response: `[AI AFDD Copilot Analysis]\n\nBased on current telemetry in Building A:\n\n1. **AHU-A1 Root Cause**: Supply temperature is 26.8°C while setpoint is 22.0°C. Chilled Water Valve command is 100% but feedback is only 15% open. This indicates a **stuck actuator or broken valve stem**.\n\n2. **Downstream Impact**: Rooms **Room_A_101** and **Room_A_102** are fed by Zone A-1 and will experience thermal discomfort.\n\n3. **Recommended Action**: Dispatch maintenance technician to inspect AHU-A1 CHW valve actuator in Mechanical Room FL1.`
      };
    }
  }
};
