import * as React from "react"

import { cn } from "@/lib/utils"

const inputClasses = [
  "border-input file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
  "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
]

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (type === "number") {
    return <NumberInput className={className} {...props} />
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputClasses, className)}
      {...props}
    />
  )
}

/**
 * A number typed as plain text (owner, 7 Oct 2026): no spinner arrows, and the
 * mouse wheel or arrow keys never change the value. Only digits are accepted;
 * money fields (a decimal `step`) also take a point and two decimals. `min` and
 * `max` are still checked when the form is sent.
 */
function NumberInput({
  className,
  min,
  max,
  step,
  onChange,
  ref,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const decimals = step !== undefined && String(step).includes(".")
  const element = React.useRef<HTMLInputElement | null>(null)

  // Also re-check after the value is set from outside (a default, a clamp).
  React.useEffect(() => {
    element.current?.setCustomValidity(outOfRange(element.current.value))
  })

  const clean = (raw: string) => {
    if (!decimals) {
      return raw.replace(/\D/g, "")
    }

    const [whole, ...rest] = raw.replace(/[^0-9.]/g, "").split(".")

    return rest.length > 0 ? `${whole}.${rest.join("").slice(0, 2)}` : whole
  }

  const outOfRange = (text: string) => {
    if (text === "") {
      return ""
    }

    const value = Number(text)
    const low = min === undefined ? null : Number(min)
    const high = max === undefined ? null : Number(max)

    if (
      Number.isNaN(value) ||
      (low !== null && value < low) ||
      (high !== null && value > high)
    ) {
      if (low !== null && high !== null) {
        return `Enter a number from ${low} to ${high}.`
      }

      return low !== null
        ? `Enter ${low} or more.`
        : high !== null
          ? `Enter ${high} or less.`
          : "Enter a number."
    }

    return ""
  }

  return (
    <input
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      autoComplete="off"
      data-slot="input"
      className={cn(inputClasses, className)}
      {...props}
      ref={(node) => {
        element.current = node

        if (typeof ref === "function") {
          ref(node)
        } else if (ref) {
          ref.current = node
        }
      }}
      onChange={(event) => {
        const input = event.target
        const text = clean(input.value)

        if (text !== input.value) {
          input.value = text
        }

        input.setCustomValidity(outOfRange(text))
        onChange?.(event)
      }}
    />
  )
}

export { Input }
