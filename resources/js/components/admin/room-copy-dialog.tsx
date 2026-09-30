import { Form } from '@inertiajs/react';
import { ListOrdered } from 'lucide-react';
import { useMemo, useState } from 'react';
import RoomCopyController from '@/actions/App/Http/Controllers/Admin/RoomCopyController';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { plural } from '@/lib/format';
import type { LocationOption } from '@/types';

const MAX_COPIES = 50;

/** Splits "A-101" into "A-" and 101 so a series can continue from it. */
function splitNumber(name: string): { prefix: string; number: number | null } {
    const match = name.match(/^(.*?)(\d+)$/);

    return match
        ? { prefix: match[1], number: Number(match[2]) }
        : { prefix: `${name} `, number: null };
}

/**
 * Copies a room with its pax, description, rates, inclusions and photos
 * under one or more new names.
 */
export function RoomCopyDialog({
    open,
    onOpenChange,
    room,
    locations,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    room: { id: number; name: string; location_id: number };
    locations: LocationOption[];
}) {
    const start = splitNumber(room.name);
    const [names, setNames] = useState('');
    const [prefix, setPrefix] = useState(start.prefix);
    const [from, setFrom] = useState(String((start.number ?? 1) + 1));
    const [to, setTo] = useState(String((start.number ?? 1) + 1));

    const count = useMemo(
        () =>
            names
                .split(/\r\n|\r|\n|,/)
                .map((name) => name.trim())
                .filter(Boolean).length,
        [names],
    );

    const fillSeries = () => {
        const first = Number(from);
        const last = Number(to);

        if (
            !Number.isInteger(first) ||
            !Number.isInteger(last) ||
            last < first
        ) {
            return;
        }

        const width = from.length;
        const series = Array.from(
            { length: Math.min(last - first + 1, MAX_COPIES) },
            (_, index) =>
                `${prefix}${String(first + index).padStart(width, '0')}`,
        );

        setNames(series.join('\n'));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Copy {room.name}</DialogTitle>
                    <DialogDescription>
                        New rooms get the same pax capacity, description, rates,
                        inclusions and photos. Maintenance history is not
                        copied. Each new room starts as Available.
                    </DialogDescription>
                </DialogHeader>

                <Form
                    {...RoomCopyController.form(room.id)}
                    onSuccess={() => {
                        onOpenChange(false);
                        setNames('');
                    }}
                    className="space-y-4"
                >
                    {({ errors, processing }) => (
                        <>
                            <FormField
                                label="Location"
                                htmlFor="copy-location"
                                error={errors.location_id}
                            >
                                <Select
                                    name="location_id"
                                    defaultValue={String(room.location_id)}
                                >
                                    <SelectTrigger
                                        id="copy-location"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {locations.map((location) => (
                                            <SelectItem
                                                key={location.id}
                                                value={String(location.id)}
                                            >
                                                {location.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormField>

                            <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                                <p className="text-sm font-medium">
                                    Number them for me
                                </p>
                                <div className="grid grid-cols-[1fr_5rem_5rem_auto] items-end gap-2">
                                    <div className="grid gap-1">
                                        <Label
                                            htmlFor="series-prefix"
                                            className="text-xs"
                                        >
                                            Name starts with
                                        </Label>
                                        <Input
                                            id="series-prefix"
                                            value={prefix}
                                            onChange={(event) =>
                                                setPrefix(event.target.value)
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label
                                            htmlFor="series-from"
                                            className="text-xs"
                                        >
                                            From
                                        </Label>
                                        <Input
                                            id="series-from"
                                            inputMode="numeric"
                                            value={from}
                                            onChange={(event) =>
                                                setFrom(event.target.value)
                                            }
                                        />
                                    </div>
                                    <div className="grid gap-1">
                                        <Label
                                            htmlFor="series-to"
                                            className="text-xs"
                                        >
                                            To
                                        </Label>
                                        <Input
                                            id="series-to"
                                            inputMode="numeric"
                                            value={to}
                                            onChange={(event) =>
                                                setTo(event.target.value)
                                            }
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={fillSeries}
                                    >
                                        <ListOrdered />
                                        Fill
                                    </Button>
                                </div>
                            </div>

                            <FormField
                                label="New room names"
                                htmlFor="copy-names"
                                hint={
                                    count > 0
                                        ? `Creates ${plural(count, 'room')}. One name per line, up to ${MAX_COPIES}.`
                                        : `One name per line, up to ${MAX_COPIES}.`
                                }
                                error={errors.names}
                            >
                                <Textarea
                                    id="copy-names"
                                    name="names"
                                    value={names}
                                    onChange={(event) =>
                                        setNames(event.target.value)
                                    }
                                    placeholder={`${start.prefix}${(start.number ?? 1) + 1}\n${start.prefix}${(start.number ?? 1) + 2}`}
                                    rows={5}
                                    className="max-h-60 font-mono text-sm"
                                    required
                                />
                            </FormField>

                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Cancel
                                    </Button>
                                </DialogClose>
                                <Button
                                    type="submit"
                                    disabled={
                                        processing ||
                                        count === 0 ||
                                        count > MAX_COPIES
                                    }
                                >
                                    {processing && <Spinner />}
                                    {count > 1
                                        ? `Create ${count} rooms`
                                        : 'Create copy'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
