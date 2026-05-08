import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

const DEFAULT_ZIP = "21201";

type Location = {
  zip: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
};

async function resolveZip(zip: string): Promise<Location> {
  const cleaned = zip.trim();
  if (!/^\d{5}$/.test(cleaned)) {
    throw new Error("Enter a valid 5-digit US ZIP code.");
  }
  const response = await fetch(`https://api.zippopotam.us/us/${cleaned}`, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(response.status === 404 ? "ZIP code not found." : `Lookup failed (${response.status}).`);
  }
  const payload = await response.json();
  const place = payload.places?.[0];
  if (!place) throw new Error("ZIP code has no associated location.");
  return {
    zip: cleaned,
    latitude: Number.parseFloat(place.latitude),
    longitude: Number.parseFloat(place.longitude),
    city: place["place name"] ?? cleaned,
    state: place["state abbreviation"] ?? place.state ?? ""
  };
}

async function fetchForecast(location: Location) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("current_weather", "true");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("windspeed_unit", "mph");
  const response = await fetch(url.toString(), { next: { revalidate: 600 } });
  if (!response.ok) throw new Error(`Weather API returned ${response.status}.`);
  const payload = await response.json();
  const current = payload.current_weather as { temperature: number; weathercode: number; windspeed: number };
  const dailyTimes: string[] = payload.daily?.time ?? [];
  const dailyMax: number[] = payload.daily?.temperature_2m_max ?? [];
  const dailyMin: number[] = payload.daily?.temperature_2m_min ?? [];
  const dailyCode: number[] = payload.daily?.weather_code ?? [];
  return {
    location,
    current: {
      temperature: Math.round(current.temperature),
      weathercode: current.weathercode,
      windspeed: Math.round(current.windspeed)
    },
    daily: dailyTimes.map((date, index) => ({
      date,
      high: Math.round(dailyMax[index] ?? 0),
      low: Math.round(dailyMin[index] ?? 0),
      weathercode: dailyCode[index] ?? 0
    }))
  };
}

export async function GET(request: Request) {
  await requireAuth();
  const url = new URL(request.url);
  const zip = (url.searchParams.get("zip") ?? DEFAULT_ZIP).trim();
  try {
    const location = await resolveZip(zip);
    const payload = await fetchForecast(location);
    return NextResponse.json(payload);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Weather fetch failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
