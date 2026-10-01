export default function NotFound() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-semibold text-slate-900">Page Not Found</h1>
      <p className="mt-3 text-slate-600">The route you requested does not exist. Please choose a section from the sidebar.</p>
    </div>
  );
}
