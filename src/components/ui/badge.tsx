import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-5 transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/10 text-primary",
        secondary: "border-border bg-secondary text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        success: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
        info: "border-sky-400/25 bg-sky-400/10 text-sky-300",
        warning: "border-amber-400/25 bg-amber-400/10 text-amber-300",
        danger: "border-red-400/25 bg-red-400/10 text-red-300",
        hot: "border-orange-400/30 bg-orange-400/10 text-orange-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
