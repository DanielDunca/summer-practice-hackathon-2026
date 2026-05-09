"use server";

export interface WeatherInfo {
  temperature: number;
  weatherCode: number;
  description: string;
  isRainy: boolean;
}

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
  80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
};

const RAINY_CODES = new Set([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]);

export async function getEventWeather(lat: number, lng: number, scheduledAt: string): Promise<WeatherInfo | null> {
  try {
    const date = scheduledAt.slice(0, 10);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weathercode&start_date=${date}&end_date=${date}&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();

    const hour = new Date(scheduledAt).getHours();
    const temp = data.hourly?.temperature_2m?.[hour] ?? data.hourly?.temperature_2m?.[12];
    const code = data.hourly?.weathercode?.[hour] ?? data.hourly?.weathercode?.[12];
    if (temp == null || code == null) return null;

    return {
      temperature: Math.round(temp),
      weatherCode: code,
      description: WMO_DESCRIPTIONS[code] ?? "Unknown",
      isRainy: RAINY_CODES.has(code),
    };
  } catch {
    return null;
  }
}
