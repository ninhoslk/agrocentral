import { supabase } from '@/services/supabase/client'

/** Contrato interno de clima (independente do provedor) */
export interface WeatherDaily {
  date: string; weather_code: number | null; temperature_max_c: number | null; temperature_min_c: number | null
  precipitation_mm: number | null; precipitation_probability_pct: number | null; wind_speed_max_kmh: number | null
  wind_gusts_max_kmh: number | null; wind_direction_deg: number | null; uv_index_max: number | null; et0_mm: number | null
}
export interface WeatherHourly {
  time: string; temperature_c: number | null; relative_humidity_pct: number | null; precipitation_probability_pct: number | null
  precipitation_mm: number | null; wind_speed_kmh: number | null; wind_gusts_kmh: number | null; weather_code: number | null
}
export interface WeatherPayload {
  location: { lat: number; lon: number; elevation_m: number | null }
  current: { time: string; temperature_c: number; apparent_temperature_c: number; relative_humidity_pct: number; precipitation_mm: number; weather_code: number; wind_speed_kmh: number; wind_direction_deg: number; wind_gusts_kmh: number; is_day: number }
  hourly: WeatherHourly[]
  daily: WeatherDaily[]
  past_daily: { date: string; precipitation_mm: number | null }[]
}
export type WeatherResponse =
  | { status: 'ok' | 'stale'; data_kind: 'forecast'; provider: string; provider_url: string; license: string; fetched_at: string; valid_until: string; last_error_at: string | null; grid: { lat: number; lon: number }; farm: { id: string; name: string }; alerts_created: number; data: WeatherPayload }
  | { status: 'unavailable'; reason: 'no_coordinates' | 'provider_error'; message: string }

export async function getWeather(farmId: string, force = false): Promise<WeatherResponse> {
  const { data, error } = await supabase.functions.invoke<WeatherResponse>('weather', { body: { farm_id: farmId, force } })
  if (error) throw error
  return data!
}

/** Códigos WMO usados pelo Open-Meteo */
const WMO: Record<number, string> = {
  0: 'Céu limpo', 1: 'Predomínio de sol', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Nevoeiro', 48: 'Nevoeiro com geada',
  51: 'Garoa fraca', 53: 'Garoa moderada', 55: 'Garoa intensa', 56: 'Garoa congelante', 57: 'Garoa congelante intensa',
  61: 'Chuva fraca', 63: 'Chuva moderada', 65: 'Chuva forte', 66: 'Chuva congelante', 67: 'Chuva congelante forte',
  71: 'Neve fraca', 73: 'Neve moderada', 75: 'Neve forte', 77: 'Grãos de neve', 80: 'Pancadas de chuva fracas',
  81: 'Pancadas de chuva moderadas', 82: 'Pancadas de chuva fortes', 85: 'Pancadas de neve', 86: 'Pancadas de neve fortes',
  95: 'Trovoadas', 96: 'Trovoadas com granizo', 99: 'Trovoadas com granizo forte',
}
export const weatherLabel = (code: number | null | undefined) => (code === null || code === undefined ? '—' : WMO[code] ?? `Código ${code}`)

export function windDir(deg: number | null | undefined) {
  if (deg === null || deg === undefined) return ''
  return ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(deg / 45) % 8]
}
