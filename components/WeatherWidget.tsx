"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, MapPin, RefreshCw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

type Location = {
  zip: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
};

type WeatherPayload = {
  current: CurrentWeather;
  daily: DailyForecast[];
  location: Location;
};

const DEFAULT_ZIP = "21201";
const STORAGE_KEY = "qoc-weather-zip";

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

async function resolveZip(zip: string): Promise<Location> {
  const cleaned = zip.trim();
  if (!/^\d{5}$/.test(cleaned)) {
    throw new Error("Enter a valid 5-digit US ZIP code.");
  }
  const response = await fetch(`https://api.zippopotam.us/us/${cleaned}`);
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

async function fetchForecast(location: Location): Promise<WeatherPayload> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("current_weather", "true");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("windspeed_unit", "mph");
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Weather API returned ${response.status}.`);
  const payload = await response.json();
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
  return {
    location,
    current: {
      temperature: Math.round(current.temperature),
      weathercode: current.weathercode,
      windspeed: Math.round(current.windspeed)
    },
    daily
  };
}

export function WeatherWidget() {
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zipInput, setZipInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(zip: string, persist: boolean) {
    setBusy(true);
    setError(null);
    try {
      const location = await resolveZip(zip);
      const payload = await fetchForecast(location);
      setData(payload);
      setZipInput(location.zip);
      if (persist && typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, location.zip);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load weather.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const initial = (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) || DEFAULT_ZIP;
    void load(initial, false);
    const id = setInterval(() => {
      const current = (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) || DEFAULT_ZIP;
      void load(current, false);
    }, 15 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit() {
    const candidate = zipInput.trim();
    if (!candidate) return;
    void load(candidate, true);
  }

  if (!data && !error) {
    return <div className="h-[260px] animate-pulse rounded-xl border bg-slate-50" />;
  }

  const today = data?.daily[0]?.date ?? new Date().toISOString().slice(0, 10);
  const Icon = data ? describeCode(data.current.weathercode).Icon : Cloud;
  const conditionLabel = data ? describeCode(data.current.weathercode).label : "";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-orange-600">Local weather</p>
          {data ? (
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={12} />
              {data.location.city}{data.location.state ? `, ${data.location.state}` : ""} · {data.location.zip}
            </p>
          ) : null}
        </div>
        <Icon className="h-10 w-10 text-orange-500" />
      </div>
      {data ? (
        <div>
          <p className="text-4xl font-bold tracking-tight text-slate-900">
            {data.current.temperature}&deg;<span className="text-2xl font-semibold text-slate-500">F</span>
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">{conditionLabel}</p>
          <p className="text-xs text-slate-500">Wind {data.current.windspeed} mph</p>
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-end gap-2"
      >
        <div className="grid flex-1 gap-1">
          <label className="text-xs font-medium text-slate-600" htmlFor="weather-zip">ZIP code</label>
          <Input
            id="weather-zip"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            value={zipInput}
            onChange={(event) => setZipInput(event.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="21201"
            className="h-9"
            disabled={busy}
          />
        </div>
        <Button type="submit" size="sm" disabled={busy || zipInput.trim().length !== 5}>
          <RefreshCw size={14} /> Update
        </Button>
      </form>

      {error ? <p className="text-xs text-red-700">{error}</p> : null}

      {data ? (
        <div className="grid grid-cols-7 gap-1 border-t border-slate-100 pt-3 text-center">
          {data.daily.slice(0, 7).map((day) => {
            const dayInfo = describeCode(day.weathercode);
            const DayIcon = dayInfo.Icon;
            return (
              <div key={day.date} className="flex flex-col items-center gap-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-600">{formatDay(day.date, today)}</p>
                <DayIcon className="h-4 w-4 text-slate-500" />
                <p className="text-xs font-semibold text-slate-900">{day.high}&deg;</p>
                <p className="text-[10px] text-slate-500">{day.low}&deg;</p>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
