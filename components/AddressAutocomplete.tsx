"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

export type AddressSuggestion = {
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  lat: string | null;
  lon: string | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /**
   * Called when the user picks a suggestion. Use this to populate
   * separate street / city / state / zip fields if you have them.
   * If you only have a single combined field, use `onChange` and ignore
   * this — the component will keep the combined display string in sync.
   */
  onSelectSuggestion?: (s: AddressSuggestion) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  /**
   * If true, picking a suggestion replaces the value with a comma-joined
   * "street, city, state zip" string. Default true. Set false if you wire
   * onSelectSuggestion and don't want this side-effect.
   */
  autoFillCombined?: boolean;
  id?: string;
  name?: string;
};

const DEBOUNCE_MS = 400;
const MIN_QUERY = 4;

function combinedString(s: AddressSuggestion): string {
  const stateZip = [s.state, s.zip].filter(Boolean).join(" ");
  return [s.street, s.city, stateZip].filter(Boolean).join(", ");
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelectSuggestion,
  placeholder = "Start typing your street address…",
  required,
  className,
  inputClassName,
  autoFillCombined = true,
  id,
  name
}: Props) {
  const reactId = useId();
  const inputId = id ?? `addr-${reactId}`;
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ignoreNextFetch = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep internal query in sync if parent resets value externally.
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounced fetch
  useEffect(() => {
    if (ignoreNextFetch.current) {
      ignoreNextFetch.current = false;
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/address/suggest?q=${encodeURIComponent(trimmed)}`);
        const payload = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(payload.suggestions)) {
          setSuggestions(payload.suggestions);
          setOpen(payload.suggestions.length > 0);
        } else {
          setSuggestions([]);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(s: AddressSuggestion) {
    ignoreNextFetch.current = true;
    if (autoFillCombined) {
      const combined = combinedString(s);
      setQuery(combined);
      onChange(combined);
    } else {
      setQuery(s.street);
      onChange(s.street);
    }
    onSelectSuggestion?.(s);
    setOpen(false);
    setActiveIdx(-1);
  }

  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && activeIdx >= 0) {
      event.preventDefault();
      pick(suggestions[activeIdx]);
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    }
  }

  const baseInputClass = "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          required={required}
          autoComplete="street-address"
          className={inputClassName ?? `${baseInputClass} pr-9`}
          aria-autocomplete="list"
          aria-expanded={open}
        />
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {suggestions.map((s, idx) => {
            const isActive = idx === activeIdx;
            return (
              <li key={`${s.label}-${idx}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => pick(s)}
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm ${isActive ? "bg-orange-50" : "hover:bg-slate-50"}`}
                >
                  <MapPin size={14} className="mt-0.5 flex-shrink-0 text-orange-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900 truncate">
                      {s.street || s.city || "—"}
                    </span>
                    <span className="block text-xs text-slate-600 truncate">{s.label}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
