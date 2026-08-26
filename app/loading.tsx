export default function Loading() {
  return (
    <main className="min-h-screen bg-[#fff8e9] text-[#172d29]">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="h-4 w-28 animate-pulse bg-[#254a42]/15" />
        <div className="mt-6 h-12 max-w-xl animate-pulse bg-[#254a42]/15" />
        <div className="mt-4 h-5 max-w-2xl animate-pulse bg-[#254a42]/10" />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-48 animate-pulse border border-[#254a42]/15 bg-[#f0efd9]"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
