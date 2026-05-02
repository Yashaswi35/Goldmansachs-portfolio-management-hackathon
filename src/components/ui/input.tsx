import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-xl border border-[#ffd8b8]/25 bg-white/[0.08] px-2.5 py-1 text-base text-[#fff2e2] transition-all outline-none backdrop-blur-xl file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[#ffe2c8]/45 focus-visible:border-[#ffd39d] focus-visible:ring-3 focus-visible:ring-[#ffc894]/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-white/[0.08] dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.52),0_10px_24px_rgba(0,0,0,0.24)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
