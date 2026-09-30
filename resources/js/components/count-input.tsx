import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * A whole-number box you can clear and retype. `onChange` only receives
 * valid numbers (above `max` becomes `max`); leaving the box empty or below
 * `min` puts the last good number back.
 */
export function CountInput({
    value,
    onChange,
    min = 1,
    max,
    ...props
}: Omit<
    ComponentProps<typeof Input>,
    'value' | 'onChange' | 'type' | 'min' | 'max'
> & {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
}) {
    const [text, setText] = useState(String(value));
    const [shown, setShown] = useState(value);

    // Follow changes made elsewhere (e.g. "Use these dates" or a clamp).
    if (value !== shown) {
        setShown(value);
        setText(String(value));
    }

    return (
        <Input
            {...props}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={text}
            onChange={(event) => {
                const raw = event.target.value;
                const number = Number(raw);
                setText(raw);

                if (raw !== '' && Number.isInteger(number) && number >= min) {
                    onChange(
                        max === undefined ? number : Math.min(number, max),
                    );
                }
            }}
            onBlur={(event) => {
                setText(String(value));
                props.onBlur?.(event);
            }}
        />
    );
}
