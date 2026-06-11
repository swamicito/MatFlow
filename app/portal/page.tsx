import Link from "next/link";

export default function PortalDashboard() {
  return (
    <div className="max-w-2xl mx-auto pt-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Welcome back, Steve</h1>
        <p className="text-[#888] mt-2">Blue Belt • Asbury Park Jiu-Jitsu</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[#111] p-6 rounded-2xl">
          <div className="text-sm text-[#888]">Current Streak</div>
          <div className="text-5xl font-bold mt-2">12</div>
          <div className="text-emerald-400 text-sm mt-1">days</div>
        </div>
        <div className="bg-[#111] p-6 rounded-2xl">
          <div className="text-sm text-[#888]">Classes This Month</div>
          <div className="text-5xl font-bold mt-2">27</div>
        </div>
        <div className="bg-[#111] p-6 rounded-2xl">
          <div className="text-sm text-[#888]">Badges Earned</div>
          <div className="text-5xl font-bold mt-2">8</div>
        </div>
      </div>

      <div className="bg-[#111] p-6 rounded-2xl">
        <h3 className="font-semibold mb-4">Quick Actions</h3>
        <div className="space-y-3">
          <Link href="/portal/schedule" className="flex items-center justify-between bg-black p-4 rounded-xl active:scale-[0.98] transition-transform">
            <span>Book a Class</span>
            <span className="text-[#444]">→</span>
          </Link>
          <Link href="/portal/schedule" className="flex items-center justify-between bg-black p-4 rounded-xl active:scale-[0.98] transition-transform">
            <span>View Schedule</span>
            <span className="text-[#444]">→</span>
          </Link>
          <Link href="/portal/shop" className="flex items-center justify-between bg-black p-4 rounded-xl active:scale-[0.98] transition-transform">
            <span>Buy Merch</span>
            <span className="text-[#444]">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
