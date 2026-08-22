import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      ref={ref}
      className={cn("mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground", className)}
      {...props}
    />
  )
);
Label.displayName = "Label";

function Field({ label, children, hint, className }: { label?: string; children: React.ReactNode; hint?: string; className?: string }) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export { Label, Field };
