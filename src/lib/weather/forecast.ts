export interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  windGustMax: number;
  precipSum: number;
  weatherCode: number;
  label: string;
  icon: string;
}

interface OpenMeteoResponse {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    wind_gusts_10m_max?: number[];
    precipitation_sum?: number[];
  };
}

function describeWeatherCode(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Clear", icon: "☀️" };
  if (code >= 1 && code <= 3) return { label: "Partly cloudy", icon: "⛅" };
  if (code === 45 || code === 48) return { label: "Fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", icon: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Snow", icon: "❄️" };
  if (code >= 80 && code <= 82) return { label: "Showers", icon: "🌧️" };
  if (code >= 95 && code <= 99) return { label: "Thunderstorm", icon: "⛈️" };
  return { label: "Unknown", icon: "·" };
}

export async function fetchForecast(lat: number, lng: number): Promise<DailyForecast[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_gusts_10m_max,precipitation_sum` +
    `&forecast_days=3&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) {
      console.error(`[forecast] request failed: ${res.status}`);
      return [];
    }
    const data = (await res.json()) as OpenMeteoResponse;
    const d = data.daily;
    if (!d || !d.time) return [];

    const out: DailyForecast[] = [];
    for (let i = 0; i < d.time.length; i++) {
      const code = d.weather_code?.[i] ?? 0;
      const desc = describeWeatherCode(code);
      out.push({
        date: d.time[i],
        tempMax: d.temperature_2m_max?.[i] ?? 0,
        tempMin: d.temperature_2m_min?.[i] ?? 0,
        windGustMax: d.wind_gusts_10m_max?.[i] ?? 0,
        precipSum: d.precipitation_sum?.[i] ?? 0,
        weatherCode: code,
        label: desc.label,
        icon: desc.icon,
      });
    }
    return out;
  } catch (err) {
    console.error("[forecast] fetch error", err);
    return [];
  }
}
