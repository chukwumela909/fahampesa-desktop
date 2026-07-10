import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-semibold transition-all duration-200 active:scale-[0.98] focus:outline-none focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#004aad] text-white shadow-[0_10px_22px_rgba(0,74,173,0.18)] hover:bg-[#003d8f]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_10px_22px_rgba(220,38,38,0.14)] hover:bg-destructive/90",
        outline:
          "border border-[#e6ebf2] bg-white text-[#334155] hover:border-[#d7e0ec] hover:bg-[#e9f2f8] hover:text-[#004aad]",
        secondary:
          "bg-[#e9f2f8] text-[#004aad] hover:bg-[#dcecff]",
        ghost: "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#004aad]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-[10px] px-3",
        lg: "h-12 rounded-[14px] px-8",
        icon: "h-10 w-10 rounded-[12px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
