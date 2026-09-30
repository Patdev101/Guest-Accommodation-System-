import { router } from '@inertiajs/react';
import type { RequestPayload } from '@inertiajs/core';
import { useState } from 'react';
import type { ReactNode } from 'react';
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
import { Spinner } from '@/components/ui/spinner';

type Method = 'post' | 'put' | 'patch' | 'delete';

/**
 * Asks before sending a request, e.g. changing a role or deactivating an
 * account. Controlled by the caller so it can be opened from anywhere.
 */
export function ConfirmAction({
    open,
    onOpenChange,
    title,
    description,
    url,
    method,
    data = {},
    confirmLabel,
    destructive = false,
    onDone,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: ReactNode;
    url: string;
    method: Method;
    data?: RequestPayload;
    confirmLabel: string;
    destructive?: boolean;
    onDone?: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const confirm = () =>
        router.visit(url, {
            method,
            data,
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => {
                setProcessing(false);
                onOpenChange(false);
                onDone?.();
            },
        });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                        variant={destructive ? 'destructive' : 'default'}
                        onClick={confirm}
                        disabled={processing}
                    >
                        {processing && <Spinner />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Asks before sending a DELETE to `url`. */
export function ConfirmDelete({
    confirmLabel = 'Delete',
    onDeleted,
    ...props
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: ReactNode;
    url: string;
    confirmLabel?: string;
    onDeleted?: () => void;
}) {
    return (
        <ConfirmAction
            {...props}
            method="delete"
            confirmLabel={confirmLabel}
            destructive
            onDone={onDeleted}
        />
    );
}
