import { request, ApiResponse } from './httpClient.ts';
import { Entity, EntityRelationship, EntityType } from '../types/index.ts';

const FALLBACK_ENTITIES: Entity[] = [
  { id: 'Bldg_A', code: 'building-a', name: 'Building A - Headquarters', entity_type: 'Building', site_id: 'Building_A', brick_class: 'brick:Building' },
  { id: 'Floor_A_1', code: 'building-a-f01', name: 'Building A Floor 1', entity_type: 'Floor', site_id: 'Building_A', brick_class: 'brick:Floor' },
  { id: 'Zone_A_1', code: 'building-a-f01-east', name: 'HVAC Zone A-1', entity_type: 'HVAC_Zone', site_id: 'Building_A', brick_class: 'brick:HVAC_Zone' },
  { id: 'Room_A_101', code: 'building-a-f01-east-r01', name: 'Conference Room 101', entity_type: 'Room', site_id: 'Building_A', brick_class: 'brick:Room' },
  { id: 'Room_A_102', code: 'building-a-f01-east-r02', name: 'Open Office 102', entity_type: 'Room', site_id: 'Building_A', brick_class: 'brick:Room' },
  { id: 'AHU_A_01', code: 'ahu-a-f01-east', name: 'Air Handling Unit AHU-A1', entity_type: 'AHU', site_id: 'Building_A', brick_class: 'brick:Air_Handling_Unit' },
  { id: 'Meter_A_Main', code: 'pm-a-main', name: 'Main Electrical Meter Bldg A', entity_type: 'Meter', site_id: 'Building_A', brick_class: 'brick:Electric_Meter' },
  { id: 'IAQ_A_101', code: 'iaq-a-01-east-1', name: 'IAQ Sensor Room 101', entity_type: 'IAQ_Sensor', site_id: 'Building_A', brick_class: 'brick:Air_Quality_Sensor' }
];

const FALLBACK_RELATIONSHIPS: EntityRelationship[] = [
  { id: 'rel-1', subject_id: 'Bldg_A', predicate: 'hasPart', object_id: 'Floor_A_1' },
  { id: 'rel-2', subject_id: 'AHU_A_01', predicate: 'feeds', object_id: 'Zone_A_1' },
  { id: 'rel-3', subject_id: 'Room_A_101', predicate: 'isPartOf', object_id: 'Zone_A_1' },
  { id: 'rel-4', subject_id: 'Room_A_102', predicate: 'isPartOf', object_id: 'Zone_A_1' },
  { id: 'rel-5', subject_id: 'Meter_A_Main', predicate: 'measures', object_id: 'Bldg_A' },
  { id: 'rel-6', subject_id: 'IAQ_A_101', predicate: 'locatedIn', object_id: 'Room_A_101' }
];

export interface GetEntitiesParams {
  site_id?: string;
  entity_type?: EntityType | string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedEntitiesResult {
  items: Entity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const ontologyService = {
  getEntities: async (siteId?: string): Promise<Entity[]> => {
    try {
      const url = siteId && siteId !== 'all' ? `/ontology/entities?site_id=${encodeURIComponent(siteId)}&limit=1000` : '/ontology/entities?limit=1000';
      return await request<Entity[]>(url);
    } catch (err) {
      console.warn('[ontologyService] Using fallback entities:', err);
      return FALLBACK_ENTITIES;
    }
  },

  getEntitiesPaginated: async (params: GetEntitiesParams = {}): Promise<PaginatedEntitiesResult> => {
    try {
      const query = new URLSearchParams();
      if (params.site_id && params.site_id !== 'all') query.append('site_id', params.site_id);
      if (params.entity_type && params.entity_type !== 'ALL') query.append('entity_type', params.entity_type);
      if (params.search) query.append('search', params.search);
      if (params.page) query.append('page', params.page.toString());
      if (params.limit) query.append('limit', params.limit.toString());

      const res = await request<ApiResponse<Entity[]>>(`/ontology/entities?${query.toString()}`, {
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
      console.warn('[ontologyService.getEntitiesPaginated] Using fallback entities:', err);
      let filtered = FALLBACK_ENTITIES;
      if (params.entity_type && params.entity_type !== 'ALL') {
        filtered = filtered.filter(e => e.entity_type === params.entity_type);
      }
      return {
        items: filtered,
        total: filtered.length,
        page: 1,
        limit: params.limit || 15,
        totalPages: 1
      };
    }
  },

  getRelationships: async (): Promise<EntityRelationship[]> => {
    try {
      return await request<EntityRelationship[]>('/ontology/relationships');
    } catch (err) {
      console.warn('[ontologyService] Using fallback relationships:', err);
      return FALLBACK_RELATIONSHIPS;
    }
  },

  getDownstreamImpact: async (entityId: string): Promise<any> => {
    try {
      return await request(`/ontology/entities/${entityId}/downstream-impact`);
    } catch (err) {
      return { affected_rooms: ['Room_A_101', 'Room_A_102'] };
    }
  },

  createEntity: async (payload: Partial<Entity>): Promise<Entity> => {
    return await request<Entity>('/ontology/entities', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateEntity: async (entityId: string, payload: { name?: string; brick_class?: string }): Promise<Entity> => {
    return await request<Entity>(`/ontology/entities/${entityId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },

  deleteEntity: async (entityId: string): Promise<void> => {
    await request(`/ontology/entities/${entityId}`, {
      method: 'DELETE'
    });
  },

  createRelationship: async (payload: { subject_id: string; predicate: string; object_id: string }): Promise<EntityRelationship> => {
    return await request<EntityRelationship>('/ontology/relationships', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  deleteRelationship: async (params: { subject_id?: string; predicate?: string; object_id?: string }): Promise<void> => {
    const query = new URLSearchParams();
    if (params.subject_id) query.append('subject_id', params.subject_id);
    if (params.predicate) query.append('predicate', params.predicate);
    if (params.object_id) query.append('object_id', params.object_id);
    await request(`/ontology/relationships?${query.toString()}`, {
      method: 'DELETE'
    });
  }
};
