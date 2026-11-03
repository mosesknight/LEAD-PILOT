import Link from "next/link";
import { CloudOff } from "lucide-react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Brand />
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card">
        <CloudOff className="size-6 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">You&apos;re offline</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          LeadPilot needs a connection to sync leads and generate pitches. Your last loaded pages
          may still be available.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Try again</Link>
      </Button>
    </div>
  );
}
