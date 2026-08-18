import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition-[color,box-shadow] [&>svg]:pointer-events-none [&>svg]:size-3 focus-visible:border-foreground/70 focus-visible:ring-foreground/20 focus-visible:ring-[3px] aria-invalid:border-destructive aria-invalid:ring-destructive/25",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border border-foreground/10 bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90 dark:border-foreground/15",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/30",
        outline:
          "border-foreground/35 bg-background/70 text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground dark:border-foreground/40 dark:bg-card/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
