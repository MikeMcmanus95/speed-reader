import * as React from "react"

import { cn } from "../../lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-border placeholder:text-text-tertiary focus-visible:border-amber-500 focus-visible:ring-amber-400/30 aria-invalid:ring-destructive/20 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-lg border bg-bg-surface px-3 py-2 text-base text-text-primary shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm selection:bg-amber-500 selection:text-bg-deep",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
