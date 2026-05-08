import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

/**
 * Address autocomplete proxy.
 *
 * Free, no API-key required, US-only via OpenStreetMap Nominatim. We proxy
 * server-side so we control the User-Agent header (Nominatim ToS requires
 * a real one for identification) and so we can swap providers later without
 * touching the client.
 *
 * If you want better accuracy / higher rate limits later, swap the inner
 * fetch to Google Places, Mapbox, or Smarty — the response shape stays the
 * same.
 *
 * Rate limits: Nominatim's public instance allows ~1 req/sec. The
 * AddressAutocomplete component debounces by 400ms and refuses to query
 * fewer than 4 characters, which keeps us comfortably under that for
 * typical typing.
 */

type Suggestion = {
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat: string | null;
  lon: string | null;
};

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "QualityOneCareHRPortal/1.0 (info@qualityonecare.com)";

type NominatimAddress = {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  state?: string;
  postcode?: string;
  country?: string;
};
type NominatimResult = {
  display_name?: string;
  address?: NominatimAddress;
  lat?: string;
  lon?: string;
};

function pickCity(addr: NominatimAddress): string {
  return addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? "";
}

function buildStreet(addr: NominatimAddress): string {
  if (addr.house_number && addr.road) return `${addr.house_number} ${addr.road}`;
  return addr.road ?? "";
}

function shorten(label: string, max = 120): string {
  return label.length > max ? label.slice(0, max - 1) + "…" : label;
}

export async function GET(request: Request) {
  // Any logged-in user can search addresses (applicants filling forms,
  // HR doing on-behalf intake, etc).
  await requireAuth();

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 4) return NextResponse.json({ suggestions: [] });

  const upstream = new URL(NOMINATIM);
  upstream.searchParams.set("format", "jsonv2");
  upstream.searchParams.set("addressdetails", "1");
  upstream.searchParams.set("countrycodes", "us");
  upstream.searchParams.set("limit", "5");
  upstream.searchParams.set("q", q);

  try {
    const res = await fetch(upstream.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json"
      },
      // Nominatim is fine with caching repeated queries.
      next: { revalidate: 300 }
    });
    if (!res.ok) {
      return NextResponse.json({ suggestions: [], error: `Upstream ${res.status}` }, { status: 200 });
    }
    const raw = (await res.json()) as NominatimResult[];

    const suggestions: Suggestion[] = raw.map((r) => {
      const addr = r.address ?? {};
      return {
        label: shorten(r.display_name ?? ""),
        street: buildStreet(addr),
        city: pickCity(addr),
        state: addr.state ?? "",
        zip: addr.postcode ?? "",
        country: addr.country ?? "",
        lat: r.lat ?? null,
        lon: r.lon ?? null
      };
    }).filter((s) => s.street || s.city);

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
