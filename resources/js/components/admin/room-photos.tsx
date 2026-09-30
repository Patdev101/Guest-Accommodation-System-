import { Form, router } from '@inertiajs/react';
import {
    ChevronLeft,
    ChevronRight,
    GripVertical,
    ImagePlus,
    Pencil,
    Star,
    Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import RoomPhotoController from '@/actions/App/Http/Controllers/Admin/RoomPhotoController';
import { ConfirmDelete } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
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
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type RoomPhoto = {
    id: number;
    url: string;
    caption: string | null;
    is_cover: boolean;
};

/**
 * Photos guests see when browsing. The cover photo shows on room cards.
 * Choosing files uploads them straight away; drag (or use the arrows) to
 * change the order guests see them in.
 */
export function RoomPhotos({
    roomId,
    photos,
    max,
}: {
    roomId: number;
    photos: RoomPhoto[];
    max: number;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [deleting, setDeleting] = useState<RoomPhoto | null>(null);
    const [captioning, setCaptioning] = useState<RoomPhoto | null>(null);
    const [order, setOrder] = useState(photos);
    const [dragging, setDragging] = useState<number | null>(null);
    const full = photos.length >= max;

    // Follow the server's list after uploads, deletes and saves.
    useEffect(() => setOrder(photos), [photos]);

    const upload = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';

        if (files.length === 0) {
            return;
        }

        router.post(
            RoomPhotoController.store.url(roomId),
            { photos: files },
            {
                forceFormData: true,
                preserveScroll: true,
                onStart: () => {
                    setUploading(true);
                    setErrors([]);
                },
                onError: (all) =>
                    setErrors([
                        ...new Set(
                            Object.entries(all)
                                .filter(([key]) => key.startsWith('photos'))
                                .map(([, message]) => message),
                        ),
                    ]),
                onFinish: () => setUploading(false),
            },
        );
    };

    const saveOrder = (next: RoomPhoto[]) => {
        if (
            next.map((photo) => photo.id).join() ===
            photos.map((photo) => photo.id).join()
        ) {
            return;
        }

        router.put(
            RoomPhotoController.reorder.url(roomId),
            { photos: next.map((photo) => photo.id) },
            { preserveScroll: true, onError: () => setOrder(photos) },
        );
    };

    const move = (index: number, offset: -1 | 1) => {
        const next = [...order];
        const [photo] = next.splice(index, 1);
        next.splice(index + offset, 0, photo);
        setOrder(next);
        saveOrder(next);
    };

    const dragOver = (event: DragEvent<HTMLLIElement>, overId: number) => {
        event.preventDefault();

        if (dragging === null || dragging === overId) {
            return;
        }

        setOrder((current) => {
            const next = [...current];
            const from = next.findIndex((photo) => photo.id === dragging);
            const to = next.findIndex((photo) => photo.id === overId);
            const [photo] = next.splice(from, 1);
            next.splice(to, 0, photo);

            return next;
        });
    };

    const setCover = (photo: RoomPhoto) =>
        router.patch(
            RoomPhotoController.update.url({ room: roomId, photo: photo.id }),
            { is_cover: 1 },
            { preserveScroll: true },
        );

    const choose = () => input.current?.click();

    return (
        <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
                <div className="min-w-0 space-y-1.5">
                    <CardTitle>Photos</CardTitle>
                    <CardDescription>
                        Guests see these in this order. The cover photo shows on
                        room cards. Drag photos to reorder them. Up to {max}{' '}
                        photos, JPG, PNG or WebP, 5 MB each.
                    </CardDescription>
                </div>
                <input
                    ref={input}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={upload}
                />
                <Button
                    size="sm"
                    className="shrink-0"
                    disabled={uploading || full}
                    onClick={choose}
                >
                    {uploading ? <Spinner /> : <ImagePlus />}
                    {uploading ? 'Uploading…' : 'Add photos'}
                </Button>
            </CardHeader>
            <CardContent className="space-y-3">
                {errors.map((message) => (
                    <InputError key={message} message={message} />
                ))}

                {order.length === 0 ? (
                    <button
                        type="button"
                        onClick={choose}
                        disabled={uploading}
                        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/50"
                    >
                        <ImagePlus className="size-6 text-muted-foreground" />
                        <span className="font-medium">No photos yet</span>
                        <span className="text-sm text-muted-foreground">
                            Rooms with photos are easier for guests to choose.
                            Click to add some.
                        </span>
                    </button>
                ) : (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {order.map((photo, index) => (
                            <li
                                key={photo.id}
                                draggable
                                onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    setDragging(photo.id);
                                }}
                                onDragOver={(event) =>
                                    dragOver(event, photo.id)
                                }
                                onDrop={(event) => event.preventDefault()}
                                onDragEnd={() => {
                                    setDragging(null);
                                    saveOrder(order);
                                }}
                                className={cn(
                                    'overflow-hidden rounded-lg border bg-card transition-opacity',
                                    dragging === photo.id &&
                                        'opacity-50 ring-2 ring-ring',
                                )}
                            >
                                <div className="relative cursor-grab bg-muted active:cursor-grabbing">
                                    <img
                                        src={photo.url}
                                        alt={photo.caption ?? 'Room photo'}
                                        className="pointer-events-none aspect-[4/3] w-full object-cover"
                                        loading="lazy"
                                    />
                                    <span className="absolute bottom-2 left-2 flex size-6 items-center justify-center rounded bg-background/90 text-muted-foreground shadow-sm">
                                        <GripVertical className="size-4" />
                                    </span>
                                    {photo.is_cover && (
                                        <Badge className="absolute top-2 left-2">
                                            <Star className="fill-current" />
                                            Cover
                                        </Badge>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-0.5 rounded-md bg-background/90 p-0.5 shadow-sm">
                                        {!photo.is_cover && (
                                            <IconButton
                                                label="Set as cover photo"
                                                className="size-7"
                                                onClick={() => setCover(photo)}
                                            >
                                                <Star />
                                            </IconButton>
                                        )}
                                        <IconButton
                                            label={
                                                photo.caption
                                                    ? 'Edit caption'
                                                    : 'Add caption'
                                            }
                                            className="size-7"
                                            onClick={() => setCaptioning(photo)}
                                        >
                                            <Pencil />
                                        </IconButton>
                                        <IconButton
                                            label="Delete photo"
                                            className="size-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => setDeleting(photo)}
                                        >
                                            <Trash2 />
                                        </IconButton>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 px-2 py-1.5">
                                    <p
                                        className={cn(
                                            'min-w-0 flex-1 truncate text-xs',
                                            !photo.caption &&
                                                'text-muted-foreground',
                                        )}
                                        title={photo.caption ?? undefined}
                                    >
                                        {photo.caption ?? 'No caption'}
                                    </p>
                                    <IconButton
                                        label="Move earlier"
                                        className="size-7"
                                        disabled={index === 0}
                                        onClick={() => move(index, -1)}
                                    >
                                        <ChevronLeft />
                                    </IconButton>
                                    <IconButton
                                        label="Move later"
                                        className="size-7"
                                        disabled={index === order.length - 1}
                                        onClick={() => move(index, 1)}
                                    >
                                        <ChevronRight />
                                    </IconButton>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>

            <CaptionDialog
                roomId={roomId}
                photo={captioning}
                onClose={() => setCaptioning(null)}
            />

            {deleting && (
                <ConfirmDelete
                    open
                    onOpenChange={(open) => !open && setDeleting(null)}
                    title="Delete this photo?"
                    description={
                        deleting.is_cover
                            ? 'It is the cover photo; the next photo becomes the cover.'
                            : 'Guests will no longer see it.'
                    }
                    url={RoomPhotoController.destroy.url({
                        room: roomId,
                        photo: deleting.id,
                    })}
                />
            )}
        </Card>
    );
}

function CaptionDialog({
    roomId,
    photo,
    onClose,
}: {
    roomId: number;
    photo: RoomPhoto | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={photo !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                {photo && (
                    <>
                        <DialogHeader>
                            <DialogTitle>
                                {photo.caption ? 'Edit caption' : 'Add caption'}
                            </DialogTitle>
                            <DialogDescription>
                                A short line guests see with the photo, e.g.
                                “Queen bed with sea view”.
                            </DialogDescription>
                        </DialogHeader>
                        <img
                            src={photo.url}
                            alt=""
                            className="aspect-[16/9] w-full rounded-lg object-cover"
                        />
                        <Form
                            key={photo.id}
                            {...RoomPhotoController.update.form({
                                room: roomId,
                                photo: photo.id,
                            })}
                            options={{ preserveScroll: true }}
                            onSuccess={onClose}
                            className="space-y-4"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <FormField
                                        label="Caption"
                                        htmlFor="photo-caption"
                                        optional
                                        hint="Leave empty to remove it."
                                        error={errors.caption}
                                    >
                                        <Input
                                            id="photo-caption"
                                            name="caption"
                                            defaultValue={photo.caption ?? ''}
                                            maxLength={150}
                                            autoFocus
                                        />
                                    </FormField>
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            disabled={processing}
                                        >
                                            {processing && <Spinner />}
                                            Save caption
                                        </Button>
                                    </DialogFooter>
                                </>
                            )}
                        </Form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
