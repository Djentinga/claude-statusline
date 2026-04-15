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

export interface UsageData {
  five_hour?: UsageWindow;
  seven_day?: UsageWindow;
}

export interface IncidentInfo {
  name: string;
  status: string;   // investigating, identified, monitoring
  impact: string;   // none, minor, major, critical
}

export interface SubagentUsage {
  tokens: number;  // input + output
  cost: number;    // estimated USD
}

export interface CacheData {
  ts: number;
  rider_running: boolean;
  serena_running: boolean;
  usage?: UsageData;
  incident?: IncidentInfo | null;
  /** Map of project slug → sub-agent usage. Keyed so multiple projects share one cache. */
  subagent_usage?: Record<string, SubagentUsage>;
}

