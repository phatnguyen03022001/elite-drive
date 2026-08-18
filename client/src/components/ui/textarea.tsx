import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground flex field-sizing-content min-h-24 w-full rounded-lg border border-foreground/45 bg-background/60 px-3 py-2 text-base shadow-sm transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-60 md:text-sm dark:border-foreground/40 dark:bg-card/80",
        "focus-visible:border-foreground/75 focus-visible:ring-foreground/20 focus-visible:ring-[3px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/25",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
