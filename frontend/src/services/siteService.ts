import { request } from './httpClient.ts';
import { Site } from '../types/index.ts';

const FALLBACK_SITES: Site[] = [
  { id: 'Building_A', code: 'SITE_CAMPUS_A', name: 'Building A (Headquarters)', description: 'Commercial Corporate Headquarters' },
  { id: 'Building_B', code: 'SITE_CAMPUS_B', name: 'Building B (Tech Center)', description: 'Technology & R&D Facility' },
  { id: 'Building_C', code: 'SITE_CAMPUS_C', name: 'Building C (Grand Hotel)', description: 'Hospitality & Luxury Hotel' }
];

export const siteService = {
  getSites: async (): Promise<Site[]> => {
    try {
      return await request<Site[]>('/sites');
    } catch (err) {
      console.warn('[siteService] Using fallback sites:', err);
      return FALLBACK_SITES;
    }
  },

  getSite: async (siteId: string): Promise<Site> => {
    return await request<Site>(`/sites/${siteId}`);
  },

  createSite: async (payload: Partial<Site>): Promise<Site> => {
    return await request<Site>('/sites', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateSite: async (siteId: string, payload: Partial<Site>): Promise<Site> => {
    return await request<Site>(`/sites/${siteId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  deleteSite: async (siteId: string): Promise<void> => {
    await request(`/sites/${siteId}`, {
      method: 'DELETE'
    });
  }
};
