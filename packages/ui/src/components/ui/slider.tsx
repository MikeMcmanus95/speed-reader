import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "../../lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none cursor-pointer group data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-bg-deep border border-border-subtle relative grow overflow-hidden rounded-full transition-colors data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5 group-hover:border-amber-500/50"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "bg-amber-500 absolute transition-colors data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full group-hover:bg-amber-400"
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="border-amber-500 ring-amber-400/30 block size-4 shrink-0 rounded-full border-2 bg-bg-deep shadow-[0_0_6px_rgba(240,166,35,0.3)] transition-[color,box-shadow,transform] hover:ring-4 hover:shadow-[0_0_10px_rgba(240,166,35,0.5)] focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 group-hover:scale-110 group-hover:shadow-[0_0_12px_rgba(240,166,35,0.6)]"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
