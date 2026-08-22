import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        gray: "bg-secondary text-secondary-foreground",
        green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        red: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
        amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
        blue: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
        indigo: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
