import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border bg-clip-padding text-xs font-display font-bold uppercase tracking-widest whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-border bg-transparent text-foreground hover:bg-muted",
        outline: "border-border bg-transparent text-foreground hover:bg-muted",
        ghost: "border-transparent bg-transparent hover:bg-muted",
        danger: "border-transparent bg-destructive text-primary-foreground hover:bg-destructive/80",
        destructive: "border-transparent bg-destructive text-primary-foreground hover:bg-destructive/80",
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-4 text-[0.65rem]",
        lg: "h-12 px-6",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
