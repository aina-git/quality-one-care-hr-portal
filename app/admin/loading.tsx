export default function AdminLoading() {
  return (
    <main className="mx-auto grid max-w-7xl gap-4 px-4 py-6">
      <div className="animate-pulse rounded-lg border bg-white p-6 shadow-sm">
        <div className="h-4 w-36 rounded bg-slate-200" />
        <div className="mt-4 h-8 w-72 rounded bg-slate-200" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-lg border bg-white p-6 shadow-sm">
            <div className="h-4 w-20 rounded bg-slate-200" />
            <div className="mt-4 h-10 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </main>
  );
}
