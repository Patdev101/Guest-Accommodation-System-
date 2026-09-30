import { Form } from '@inertiajs/react';
import ReminderController from '@/actions/App/Http/Controllers/Reception/ReminderController';
import { FormField } from '@/components/form-field';
import InputError from '@/components/input-error';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const results = [
    {
        value: 'check_out',
        label: 'Checking out',
        description: 'Not extending. The rooms can be booked after check-out.',
    },
    {
        value: 'extend',
        label: 'Wants to extend',
        description: 'Then use Extend stay on the stay page.',
    },
    {
        value: 'no_answer',
        label: 'No answer',
        description: 'Try again later.',
    },
];

/** Record the call before check-out and what the guest said (rules 18 and 19). */
export function CallDialog({
    stay,
    onClose,
}: {
    stay: { id: number; contact_name: string; contact_number: string } | null;
    onClose: () => void;
}) {
    return (
        <Dialog
            open={stay !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                {stay && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Call {stay.contact_name}</DialogTitle>
                            <DialogDescription>
                                Ask whether they are checking out or extending.{' '}
                                <a
                                    href={`tel:${stay.contact_number}`}
                                    className="font-medium text-foreground underline-offset-4 hover:underline"
                                >
                                    {stay.contact_number}
                                </a>
                            </DialogDescription>
                        </DialogHeader>
                        <Form
                            {...ReminderController.store.form(stay.id)}
                            options={{ preserveScroll: true }}
                            onSuccess={onClose}
                            className="space-y-4"
                        >
                            {({ errors, processing }) => (
                                <>
                                    <fieldset className="grid gap-2">
                                        <legend className="mb-2 text-sm font-medium">
                                            What did they say?
                                        </legend>
                                        {results.map((result) => (
                                            <label
                                                key={result.value}
                                                className={cn(
                                                    'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/60',
                                                    'has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50',
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name="result"
                                                    value={result.value}
                                                    required
                                                    className="mt-0.5 size-4 accent-primary"
                                                />
                                                <span className="grid gap-0.5">
                                                    <span className="text-sm font-medium">
                                                        {result.label}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {result.description}
                                                    </span>
                                                </span>
                                            </label>
                                        ))}
                                        <InputError message={errors.result} />
                                    </fieldset>
                                    <FormField
                                        label="Notes"
                                        htmlFor="call_notes"
                                        optional
                                        error={errors.notes}
                                    >
                                        <Textarea
                                            id="call_notes"
                                            name="notes"
                                            rows={2}
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
                                            Save call
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
