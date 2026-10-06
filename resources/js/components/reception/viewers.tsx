import { ImageIcon, Printer } from 'lucide-react';
import { useRef, useState } from 'react';
import StayToolsController from '@/actions/App/Http/Controllers/Reception/StayToolsController';
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

type ButtonSize = 'default' | 'sm';

/** Shows the photo of a held ID in a pop-up, without leaving the page. */
export function IdPhotoButton({
    url,
    guest,
    size = 'sm',
}: {
    url: string;
    guest: string;
    size?: ButtonSize;
}) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size={size}
                className="w-fit"
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
            >
                <ImageIcon />
                View ID photo
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="sm:max-w-2xl"
                    onClick={(event) => event.stopPropagation()}
                >
                    <DialogHeader>
                        <DialogTitle>ID of {guest}</DialogTitle>
                        <DialogDescription>
                            Kept privately; only staff can see it.
                        </DialogDescription>
                    </DialogHeader>
                    {open && (
                        <img
                            src={url}
                            alt={`ID of ${guest}`}
                            className="max-h-[70vh] w-full rounded-md border bg-muted object-contain"
                        />
                    )}
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

/** Shows the printable bill in a pop-up, with a button that prints it. */
export function BillButton({
    stayId,
    guest,
    size = 'default',
    label = 'Print bill',
}: {
    stayId: number;
    guest: string;
    size?: ButtonSize;
    label?: string;
}) {
    const [open, setOpen] = useState(false);
    const frame = useRef<HTMLIFrameElement>(null);

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size={size}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
            >
                <Printer />
                {label}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent
                    className="sm:max-w-4xl"
                    onClick={(event) => event.stopPropagation()}
                >
                    <DialogHeader>
                        <DialogTitle>Bill for {guest}</DialogTitle>
                        <DialogDescription>
                            Charges and payments so far. Print it, or choose
                            "Save as PDF" in the print window.
                        </DialogDescription>
                    </DialogHeader>
                    {open && (
                        <iframe
                            ref={frame}
                            title={`Bill for ${guest}`}
                            src={StayToolsController.bill.url(stayId, {
                                query: { embed: 1 },
                            })}
                            className="h-[65vh] w-full rounded-md border bg-white"
                        />
                    )}
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="outline">Close</Button>
                        </DialogClose>
                        <Button
                            onClick={() =>
                                frame.current?.contentWindow?.print()
                            }
                        >
                            <Printer />
                            Print or save as PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
