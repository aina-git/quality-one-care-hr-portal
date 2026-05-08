"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, Sun } from "lucide-react";

type CurrentWeather = {
  temperature: number;
  weathercode: number;
  windspeed: number;
};

type DailyForecast = {
  date: string;
  high: number;
  low: number;
  weathercode: number;
};

type WeatherPayload = {
  current: CurrentWeather;
  daily: DailyForecast[];
};

const DEFAULT_LATITUDE = 39.2904;
const DEFAULT_LONGITUDE = -76.6122;
const DEFAULT_PLACE = "Baltimore, MD";

function describeCode(code: number) {
  if (code === 0) return { label: "Clear", Icon: Sun };
  if ([1, 2, 3].includes(code)) return { label: code === 1 ? "Mostly clear" : code === 2 ? "Partly cloudy" : "Overcast", Icon: Cloud };
  if ([45, 48].includes(code)) return { label: "Foggy", Icon: CloudFog };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "Drizzle", Icon: CloudDrizzle };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "Rain", Icon: CloudRain };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow", Icon: CloudSnow };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", Icon: CloudLightning };
  return { label: "Cloudy", Icon: Cloud };
}

function formatDay(iso: string, today: string) {
  if (iso === today) return "Today";
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export function WeatherWidget({
  latitude = DEFAULT_LATITUDE,
  longitude = DEFAULT_LONGITUDE,
  place = DEFAULT_PLACE
}: {
  latitude?: number;
  longitude?: number;
  place?: string;
}) {
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", String(latitude));
        url.searchParams.set("longitude", String(longitude));
        url.searchParams.set("current_weather", "true");
        url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
        url.searchParams.set("timezone", "America/New_York");
        url.searchParams.set("forecast_days", "4");
        url.searchParams.set("temperature_unit", "fahrenheit");
        url.searchParams.set("windspeed_unit", "mph");
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
        const payload = await response.json();
        if (cancelled) return;
        const current = payload.current_weather as { temperature: number; weathercode: number; windspeed: number };
        const dailyTimes: string[] = payload.daily?.time ?? [];
        const dailyMax: number[] = payload.daily?.temperature_2m_max ?? [];
        const dailyMin: number[] = payload.daily?.temperature_2m_min ?? [];
        const dailyCode: number[] = payload.daily?.weather_code ?? [];
        const daily = dailyTimes.map((date, index) => ({
          date,
          high: Math.round(dailyMax[index] ?? 0),
          low: Math.round(dailyMin[index] ?? 0),
          weathercode: dailyCode[index] ?? 0
        }));
        setData({
          current: {
            temperature: Math.round(current.temperature),
            weathercode: current.weathercode,
            windspeed: Math.round(current.windspeed)
          },
          daily
        });
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Could not load weather.");
      }
    }
    void load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [latitude, longitude]);

  if (!data && !error) {
    return <div className="h-[220px] animate-pulse rounded-xl border bg-slate-50" />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-orange-600">Local weather</p>
        <p className="mt-2 text-sm text-slate-500">Weather data is unavailable right now ({error}).</p>
      </div>
    );
  }

  const today = data!.daily[0]?.date ?? new Date().toISOString().slice(0, 10);
  const { label, Icon } = describeCode(data!.current.weathercode);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orange-600">Local weather</p>
          <p className="text-xs text-slate-500">{place}</p>
        </div>
        <Icon className="h-10 w-10 text-orange-500" />
      </div>
      <div>
        <p className="text-4xl font-bold tracking-tight text-slate-900">
          {data!.current.temperature}&deg;<span className="text-2xl font-semibold text-slate-500">F</span>
        </p>
        <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">Wind {data!.current.windspeed} mph</p>
      </div>
      <div className="grid grid-cols-4 gap-2 border-t border-slate-100 pt-3 text-center">
        {data!.daily.slice(0, 4).map((day) => {
          const dayInfo = describeCode(day.weathercode);
          const DayIcon = dayInfo.Icon;
          return (
            <div key={day.date} className="flex flex-col items-center gap-1">
              <p className="text-xs font-medium text-slate-600">{formatDay(day.date, today)}</p>
              <DayIcon className="h-5 w-5 text-slate-500" />
              <p className="text-xs font-semibold text-slate-900">{day.high}&deg;</p>
              <p className="text-xs text-slate-500">{day.low}&deg;</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
