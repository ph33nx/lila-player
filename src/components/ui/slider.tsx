"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

/** Wheel distance that counts as one notch; a mouse sends ~100, a trackpad far less. */
const NOTCH = 20;
const SHIFT_STEPS = 5;

interface SliderProps extends React.ComponentPropsWithoutRef<
  typeof SliderPrimitive.Root
> {
  /** Accessible name for the thumb, which is the element with role="slider". */
  thumbLabel: string;
}

const decimalsOf = (step: number): number =>
  (String(step).split(".")[1] ?? "").length;

/**
 * shadcn's slider plus wheel input: scrolling over the track moves the value one
 * step per notch (five with Shift). Radix covers pointer and keyboard; the wheel
 * needs a non-passive listener so the page does not scroll instead.
 */
const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, thumbLabel, ...props }, ref) => {
  const rootRef = React.useRef<HTMLSpanElement>(null);
  React.useImperativeHandle(ref, () => rootRef.current as HTMLSpanElement);

  const latest = React.useRef(props);
  React.useEffect(() => {
    latest.current = props;
  });

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let travelled = 0;
    const onWheel = (event: WheelEvent): void => {
      const {
        value,
        min = 0,
        max = 100,
        step = 1,
        onValueChange,
        disabled,
      } = latest.current;
      const current = value?.[0];
      if (disabled || current === undefined) return;

      event.preventDefault();
      travelled += event.deltaY;
      if (Math.abs(travelled) < NOTCH) return;

      // Scrolling up raises the value, the way a knob or a volume wheel does.
      const notches =
        -Math.sign(travelled) * (event.shiftKey ? SHIFT_STEPS : 1);
      travelled = 0;
      const next = Math.min(max, Math.max(min, current + notches * step));
      const rounded = Number(next.toFixed(decimalsOf(step)));
      if (rounded !== current) onValueChange?.([rounded]);
    };

    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <SliderPrimitive.Root
      ref={rootRef}
      className={cn(
        "relative flex w-full touch-none select-none items-center py-2",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-input">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={thumbLabel}
        className="block h-4 w-4 rounded-full border-2 border-background bg-foreground outline-none transition-colors hover:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
