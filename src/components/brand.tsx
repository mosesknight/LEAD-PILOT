import Link from "next/link";
import { Zap } from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Brand({
  className,
  href = "/",
  compact = false,
}: {
  className?: string;
  href?: string;
  compact?: boolean;
}) {
  return (
    <Link href={href} className={cn("group flex items-center gap-2.5", className)}>
      <span className="relative flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary shadow-[0_0_24px_-8px_rgba(52,211,153,0.9)]">
        <Zap className="size-4" strokeWidth={2.5} />
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {APP_NAME}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Lead engine
          </span>
        </span>
      ) : null}
    </Link>
  );
}
