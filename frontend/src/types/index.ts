export type EntityType = 
  | 'Building'
  | 'Floor'
  | 'HVAC_Zone'
  | 'Room'
  | 'AHU'
  | 'Meter'
  | 'IAQ_Sensor'
  | 'Equipment';

export type RelationshipType = 
  | 'feeds'
  | 'hasPart'
  | 'isPartOf'
  | 'locatedIn'
  | 'measures';

export interface Site {
  id: string;
  code: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Entity {
  id: string;
  code: string;
  name: string;
  entity_type: EntityType;
  site_id: string;
  brick_class: string;
  metadata_json?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface EntityRelationship {
  id: string;
  subject_id: string;
  predicate: RelationshipType;
  object_id: string;
  properties?: Record<string, any>;
  created_at?: string;
}

export type IssueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'MUTED';

export interface Issue {
  id: string;
  code: string;
  rule_id?: string;
  entity_id: string;
  site_id: string;
  title: string;
  description?: string;
  status: IssueStatus;
  severity: IssueSeverity;
  started_at: string;
  last_detected_at: string;
  resolved_at?: string;
  evidence: Record<string, any>;
  affected_rooms: string[];
  estimated_energy_waste_kwh?: number;
  created_at?: string;
  updated_at?: string;
}

export type RuleStatus = 'DRAFT' | 'APPROVED' | 'REJECTED';

export interface Rule {
  id: string;
  code: string;
  name: string;
  description?: string;
  target_scope?: Record<string, any>;
  fault_logic: {
    condition?: string;
    condition_expr?: string;
    duration_seconds: number;
    metrics?: string[];
    parameters?: Record<string, any>;
    threshold?: number;
  };
  severity: IssueSeverity;
  is_active: boolean;
  status: RuleStatus;
  created_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface TelemetryPoint {
  timestamp: string;
  entity_id: string;
  metric_name: string;
  val: number;
  unit?: string;
  site_id: string;
  tags?: Record<string, any>;
}

