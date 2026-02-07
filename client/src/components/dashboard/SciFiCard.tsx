import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface SciFiCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  title?: string;
  className?: string;
  noPadding?: boolean;
}

export function SciFiCard({ children, title, className, noPadding = false, ...props }: SciFiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={cn("relative bg-card/50 border border-primary/30 overflow-hidden", className)}
      {...props}
    >
      {/* Corner Brackets */}
      <div className="absolute top-0 left-0 w-2 h-2 border-l-2 border-t-2 border-primary" />
      <div className="absolute top-0 right-0 w-2 h-2 border-r-2 border-t-2 border-primary" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-l-2 border-b-2 border-primary" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-r-2 border-b-2 border-primary" />

      {/* Title Bar */}
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-b border-primary/20">
          <h3 className="font-orbitron text-xs tracking-widest text-primary uppercase flex items-center gap-2">
            <span className="w-2 h-2 bg-primary animate-pulse" />
            {title}
          </h3>
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-primary/50" />
            <div className="w-1 h-1 bg-primary/50" />
            <div className="w-1 h-1 bg-primary/50" />
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn("relative z-10", noPadding ? "" : "p-4")}>
        {children}
      </div>

      {/* Scanline Overlay (Subtle) */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent opacity-0 animate-scan pointer-events-none" />
    </motion.div>
  );
}
