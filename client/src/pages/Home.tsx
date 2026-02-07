import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ChartSection } from "@/components/dashboard/ChartSection";
import { TokenList } from "@/components/dashboard/TokenList";
import { TokenInfo } from "@/components/dashboard/TokenInfo";
import { SciFiCard } from "@/components/dashboard/SciFiCard";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30 pb-12">
      <Navbar />
      
      <main className="flex-1 container mx-auto p-4 md:p-6 space-y-6">
        {/* Top Hero Section */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8">
            <ChartSection />
          </div>
          <div className="md:col-span-4">
            <TokenList />
          </div>
        </section>

        {/* Bottom Data Section */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8">
            <TokenInfo />
          </div>
          <div className="md:col-span-4 h-full">
            <SciFiCard title="SYSTEM LOGS" className="h-full min-h-[200px]">
              <div className="font-mono text-[10px] space-y-1 text-primary/60 h-full">
                <p>10:42:21 {">"} INITIALIZING SIMUN PROTOCOL...</p>
                <p>10:42:22 {">"} CONNECTING TO RPC NODES [ETH, SOL, BSC]...</p>
                <p>10:42:23 {">"} CONNECTION ESTABLISHED.</p>
                <p>10:42:24 {">"} FETCHING LIQUIDITY POOLS...</p>
                <p className="text-primary">10:42:25 {">"} SUCCESS. MONITORING 1,240 PAIRS.</p>
                <p>10:42:28 {">"} DETECTED WHALE MOVEMENT ON $PEPE...</p>
                <p>10:43:01 {">"} UPDATING ORACLE PRICES...</p>
                <p>10:43:05 {">"} SYSTEM OPTIMIZED.</p>
              </div>
            </SciFiCard>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
