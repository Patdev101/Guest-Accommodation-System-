import { Input } from '@/components/ui/input';

/**
 * A date and a time side by side for one "2026-10-01T14:00" value. The date
 * takes the spare width; the time keeps room for its clock icon.
 */
export function DateTimeInput({
    id,
    label,
    value,
    onChange,
    min,
    required = false,
}: {
    id: string;
    /** Used for the time box's accessible name, e.g. "Arrival" → "Arrival time". */
    label: string;
    value: string;
    onChange: (value: string) => void;
    min?: string;
    required?: boolean;
}) {
    const [date, time = '00:00'] = value.split('T');

    return (
        <div className="flex gap-2">
            <Input
                id={id}
                type="date"
                min={min}
                value={date}
                onChange={(event) =>
                    event.target.value &&
                    onChange(`${event.target.value}T${time}`)
                }
                className="min-w-0 flex-1"
                required={required}
            />
            <Input
                type="time"
                step={900}
                aria-label={`${label} time`}
                value={time}
                onChange={(event) =>
                    event.target.value &&
                    onChange(`${date}T${event.target.value}`)
                }
                className="w-40 shrink-0"
                required={required}
            />
        </div>
    );
}
