export interface StdinData {
  model?: { display_name?: string; id?: string };
  context_window?: {
    used_percentage?: number;
    context_window_size?: number;
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

export interface CacheData {
  ts: number;
  rider_running: boolean;
  serena_running: boolean;
  usage?: UsageData;
}
