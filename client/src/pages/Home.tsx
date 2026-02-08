import { Navbar } from "@/components/layout/Navbar";
import { TokenColumn } from "@/components/dashboard/TokenColumn";
import { Footer } from "@/components/layout/Footer";

export default function Home() {
  return (
    <div className="landing h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30 overflow-hidden">
      <Navbar />

      <main className="flex-1 min-h-0 w-full px-2 md:px-2 py-2 md:py-2 grid grid-cols-1 md:grid-cols-3 gap-1 md:gap-2">
        <div className="min-h-0">
          <TokenColumn title="CLANKER SIGNALS" quote="CLANKER" onlySignal />
        </div>
        <div className="min-h-0">
          <TokenColumn title="ZORA STREAM" quote="ZORA" />
        </div>
        <div className="min-h-0">
          <TokenColumn title="PRINTR STREAM (OFFLINE)" quote="PRINTR" />
        </div>
      </main>

      <Footer />
    </div>
  );
}
