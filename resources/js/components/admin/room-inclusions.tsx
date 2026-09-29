import { Form, router } from '@inertiajs/react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import RoomInclusionController from '@/actions/App/Http/Controllers/Admin/RoomInclusionController';
import { IconButton } from '@/components/icon-button';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { RoomInclusion } from '@/types';

export function RoomInclusions({
    roomId,
    inclusions,
}: {
    roomId: number;
    inclusions: RoomInclusion[];
}) {
    const [busy, setBusy] = useState<number | null>(null);

    const visit = (id: number, action: () => void) => {
        setBusy(id);
        action();
    };

    const setQuantity = (inclusion: RoomInclusion, quantity: number) =>
        visit(inclusion.id, () =>
            router.patch(
                RoomInclusionController.update.url({
                    room: roomId,
                    inclusion: inclusion.id,
                }),
                { quantity },
                { preserveScroll: true, onFinish: () => setBusy(null) },
            ),
        );

    const remove = (inclusion: RoomInclusion) =>
        visit(inclusion.id, () =>
            router.delete(
                RoomInclusionController.destroy.url({
                    room: roomId,
                    inclusion: inclusion.id,
                }),
                { preserveScroll: true, onFinish: () => setBusy(null) },
            ),
        );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Inclusions</CardTitle>
                <CardDescription>What guests find in the room.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {inclusions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Nothing listed yet, e.g. 2 double decks, a fridge,
                        chairs and a table.
                    </p>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {inclusions.map((inclusion) => (
                            <li
                                key={inclusion.id}
                                className="flex items-center gap-2 py-1.5 pr-1.5 pl-3"
                                aria-busy={busy === inclusion.id}
                            >
                                <span className="min-w-0 flex-1 truncate text-sm">
                                    {inclusion.item}
                                </span>
                                <div className="flex items-center rounded-md border">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        aria-label={`One fewer ${inclusion.item}`}
                                        disabled={
                                            inclusion.quantity <= 1 ||
                                            busy !== null
                                        }
                                        onClick={() =>
                                            setQuantity(
                                                inclusion,
                                                inclusion.quantity - 1,
                                            )
                                        }
                                    >
                                        <Minus />
                                    </Button>
                                    <span
                                        className="w-7 text-center text-sm font-medium tabular-nums"
                                        aria-label={`Quantity ${inclusion.quantity}`}
                                    >
                                        {inclusion.quantity}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="size-7"
                                        aria-label={`One more ${inclusion.item}`}
                                        disabled={busy !== null}
                                        onClick={() =>
                                            setQuantity(
                                                inclusion,
                                                inclusion.quantity + 1,
                                            )
                                        }
                                    >
                                        <Plus />
                                    </Button>
                                </div>
                                <IconButton
                                    label={`Remove ${inclusion.item}`}
                                    className="ml-1 text-muted-foreground hover:text-destructive"
                                    disabled={busy !== null}
                                    onClick={() => remove(inclusion)}
                                >
                                    <Trash2 />
                                </IconButton>
                            </li>
                        ))}
                    </ul>
                )}

                <Form
                    {...RoomInclusionController.store.form(roomId)}
                    options={{ preserveScroll: true }}
                    resetOnSuccess
                    className="space-y-2"
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="flex gap-2">
                                <Input
                                    name="item"
                                    placeholder="Add an item"
                                    aria-label="Item"
                                    required
                                    className="flex-1"
                                />
                                <Input
                                    name="quantity"
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    max={999}
                                    defaultValue={1}
                                    aria-label="Quantity"
                                    className="w-16"
                                    required
                                />
                                <Button
                                    type="submit"
                                    variant="outline"
                                    disabled={processing}
                                >
                                    <Plus />
                                    Add
                                </Button>
                            </div>
                            <InputError
                                message={errors.item ?? errors.quantity}
                            />
                        </>
                    )}
                </Form>
            </CardContent>
        </Card>
    );
}
