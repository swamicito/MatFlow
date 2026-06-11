"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleEnter = () => {
    setLoading(true);
    setTimeout(() => {
      router.push("/portal");
    }, 500);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-2xl bg-white flex items-center justify-center">
              <span className="text-black font-bold text-3xl tracking-tighter">M</span>
            </div>
            <span className="text-4xl font-semibold tracking-tight text-white">MATFLOW</span>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white mb-3">Student Portal</h1>
          <p className="text-[#888]">Demo • Asbury Park Jiu-Jitsu</p>
        </div>

        <Button 
          onClick={handleEnter}
          disabled={loading}
          className="w-full py-6 text-lg font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-2xl"
        >
          {loading ? "Entering..." : "🚀 Enter Student Portal (Demo)"}
        </Button>
      </div>
    </div>
  );
}