export * from "./auth";

export interface HealthResponse {
  status: "ok";
  service: string;
  time: string; // ISO-8601
}

export interface ComparisonRow {
  targetDate: string;
  leadTimeDays: number;
  forecastMax: number | null;
  actualMax: number | null;
  errorMax: number | null;
  forecastMin: number | null;
  actualMin: number | null;
  errorMin: number | null;
}

export interface LeadTimeStat {
  leadTimeDays: number;
  count: number;
  maeMax: number | null;
  maeMin: number | null;
}
