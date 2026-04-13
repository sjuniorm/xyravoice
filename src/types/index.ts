// Core domain types — mirrors Supabase schema

export interface Tenant {
  id: string;
  name: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: "admin" | "user";
  created_at: string;
}

export interface SipUser {
  id: string;
  tenant_id: string;
  extension: string;
  display_name: string;
  sip_username: string;
  sip_password: string;
  max_concurrent_calls: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trunk {
  id: string;
  tenant_id: string;
  name: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  transport: "udp" | "tcp" | "tls";
  enabled: boolean;
  caller_id: string | null;
  register: boolean;
  from_user: string | null;
  from_domain: string | null;
  created_at: string;
  updated_at: string;
}

export interface Did {
  id: string;
  tenant_id: string;
  trunk_id: string;
  did_number: string;
  destination_type: "extension" | "callflow";
  destination_value: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CallLog {
  id: string;
  tenant_id: string;
  direction: "inbound" | "outbound" | "internal";
  caller: string;
  callee: string;
  status: "answered" | "missed" | "busy" | "failed" | "no_answer";
  started_at: string;
  answered_at: string | null;
  ended_at: string | null;
  duration_secs: number;
  trunk_name: string | null;
  channel_id: string | null;
  created_at: string;
}

// Call flow step types
export interface IvrStep {
  type: "ivr";
  greeting: string;
  options: Record<string, string>; // e.g. { "1": "ext:101", "2": "group:sales" }
}

export interface RingGroupStep {
  type: "ring_group";
  strategy: "simultaneous" | "sequential";
  members: string[]; // extension numbers
  timeout: number;   // seconds before fallback
}

export interface ForwardStep {
  type: "forward";
  mode: "always" | "busy" | "no_answer";
  destination: string; // extension or phone number
}

export type CallFlowStep = IvrStep | RingGroupStep | ForwardStep;

export interface CallFlow {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  steps: CallFlowStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
