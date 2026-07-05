export interface StdinData {
  model?: { display_name?: string; id?: string };
  context_window?: {
    used_percentage?: number;
    context_window_size?: number;
  };
  cwd?: string;
  workspace?: {
    current_dir?: string;
    project_dir?: string;
  };
}

export interface UsageWindow {
  utilization?: number;
  resets_at?: string;
}

export interface ExtraUsage {
  is_enabled?: boolean;
  monthly_limit?: number;  // credits, in cents
  used_credits?: number;   // credits, in cents
  utilization?: number;    // percent 0-100
  currency?: string;
  disabled_reason?: string | null;
}

export interface UsageData {
  five_hour?: UsageWindow | null;
  seven_day?: UsageWindow | null;
  extra_usage?: ExtraUsage | null;
}

export interface IncidentInfo {
  name: string;
  status: string;   // investigating, identified, monitoring
  impact: string;   // none, minor, major, critical
}

export interface CacheData {
  ts: number;
  usage?: UsageData;
  incident?: IncidentInfo | null;
}

