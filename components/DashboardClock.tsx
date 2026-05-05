"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function AnalogClock({ hours, minutes, seconds }: { hours: number; minutes: number; seconds: number }) {
  const hourAngle = ((hours % 12) + minutes / 60) * 30;
  const minuteAngle = (minutes + seconds / 60) * 6;
  const secondAngle = seconds * 6;

  return (
    <svg viewBox="0 0 200 200" className="h-40 w-40">
      <circle cx="100" cy="100" r="95" fill="white" stroke="#e2e8f0" strokeWidth="2" />
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x1 = 100 + 80 * Math.cos(angle);
        const y1 = 100 + 80 * Math.sin(angle);
        const x2 = 100 + 88 * Math.cos(angle);
        const y2 = 100 + 88 * Math.sin(angle);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />;
      })}
      {Array.from({ length: 60 }, (_, i) => {
        if (i % 5 === 0) return null;
        const angle = (i * 6 - 90) * (Math.PI / 180);
        const x1 = 100 + 85 * Math.cos(angle);
        const y1 = 100 + 85 * Math.sin(angle);
        const x2 = 100 + 88 * Math.cos(angle);
        const y2 = 100 + 88 * Math.sin(angle);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />;
      })}
      <line
        x1="100" y1="100"
        x2={100 + 50 * Math.cos((hourAngle - 90) * Math.PI / 180)}
        y2={100 + 50 * Math.sin((hourAngle - 90) * Math.PI / 180)}
        stroke="#0f172a" strokeWidth="4" strokeLinecap="round"
      />
      <line
        x1="100" y1="100"
        x2={100 + 68 * Math.cos((minuteAngle - 90) * Math.PI / 180)}
        y2={100 + 68 * Math.sin((minuteAngle - 90) * Math.PI / 180)}
        stroke="#334155" strokeWidth="2.5" strokeLinecap="round"
      />
      <line
        x1="100" y1="100"
        x2={100 + 72 * Math.cos((secondAngle - 90) * Math.PI / 180)}
        y2={100 + 72 * Math.sin((secondAngle - 90) * Math.PI / 180)}
        stroke="#ea580c" strokeWidth="1.2" strokeLinecap="round"
      />
      <circle cx="100" cy="100" r="4" fill="#0f172a" />
    </svg>
  );
}

export function DashboardClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <div className="h-[220px] animate-pulse rounded-xl border bg-slate-50" />;

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <AnalogClock hours={hours} minutes={minutes} seconds={seconds} />
      <div className="text-center">
        <p className="text-2xl font-bold tracking-tight text-slate-900">
          {pad(displayHours)}:{pad(minutes)}:{pad(seconds)}{" "}
          <span className="text-base font-semibold text-orange-600">{ampm}</span>
        </p>
        <p className="mt-1 text-sm text-slate-500">{dateStr}</p>
      </div>
    </div>
  );
}
