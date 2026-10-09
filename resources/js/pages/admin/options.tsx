import { Form, Head } from '@inertiajs/react';
import { DatabaseBackup, Download, Trash2 } from 'lucide-react';
import { useState } from 'react';
import OptionsController from '@/actions/App/Http/Controllers/Admin/OptionsController';
import { ConfirmAction, ConfirmDelete } from '@/components/confirm-dialog';
import { FormField } from '@/components/form-field';
import { IconButton } from '@/components/icon-button';
import { Page, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, plural } from '@/lib/format';
import { edit as optionsEdit } from '@/routes/admin/options';

type Backup = { name: string; size: number; created_at: string };

type Props = {
    paymentMethods: string[];
    alertEmails: boolean;
    retentionDays: number;
    photos: { kept: number; returned: number; due: number };
    backupsToKeep: number;
    backups: Backup[];
    site: {
        contact_phone: string;
        contact_email: string;
        contact_address: string;
        booking_request_hold_hours: number;
    };
};

function fileSize(bytes: number): string {
    return bytes >= 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function Options({
    paymentMethods,
    alertEmails,
    retentionDays,
    photos,
    backupsToKeep,
    backups,
    site,
}: Props) {
    const [emails, setEmails] = useState(alertEmails);
    const [deletingPhotos, setDeletingPhotos] = useState(false);
    const [removing, setRemoving] = useState<Backup | null>(null);

    return (
        <>
            <Head title="Options and backups" />
            <Page className="max-w-4xl">
                <PageHeader
                    title="Options and backups"
                    description="Payment methods, emailed alerts, how long ID photos are kept, and backups of the data."
                />

                <Form
                    {...OptionsController.update.form()}
                    options={{ preserveScroll: true }}
                    className="space-y-6"
                >
                    {({ errors, processing }) => (
                        <>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Payment methods</CardTitle>
                                    <CardDescription>
                                        What reception can choose when recording
                                        a payment or a refund. Old payments keep
                                        the method they had.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <FormField
                                        label="Methods"
                                        htmlFor="payment_methods"
                                        hint="One per line, up to 12."
                                        error={errors.payment_methods}
                                    >
                                        <Textarea
                                            id="payment_methods"
                                            name="payment_methods"
                                            rows={6}
                                            defaultValue={paymentMethods.join(
                                                '\n',
                                            )}
                                            className="max-w-sm"
                                            required
                                        />
                                    </FormField>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Alerts by email</CardTitle>
                                    <CardDescription>
                                        Alerts always show under the bell. With
                                        this on, the urgent ones are also
                                        emailed to every active reception
                                        account, so they arrive even when nobody
                                        has the system open.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <input
                                        type="hidden"
                                        name="alert_emails"
                                        value={emails ? '1' : '0'}
                                    />
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="alert_emails"
                                            checked={emails}
                                            onCheckedChange={(checked) =>
                                                setEmails(checked === true)
                                            }
                                        />
                                        <Label
                                            htmlFor="alert_emails"
                                            className="leading-snug font-normal"
                                        >
                                            Also email urgent alerts: call a
                                            guest before check-out, a guest has
                                            not arrived, a room is still
                                            occupied when the next guest is due,
                                            and a guest must answer a room move.
                                        </Label>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Needs the mail server to be set up
                                        (System settings → Email) and the
                                        scheduler to be running. Text messages
                                        (SMS) are not available: they need a
                                        paid SMS provider.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>ID photos</CardTitle>
                                    <CardDescription>
                                        Photos of guests' IDs are personal data.
                                        Once an ID is returned, its photo is no
                                        longer needed; the record of the ID
                                        (type and number) is kept.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField
                                        label="Delete the photo this many days after the ID is returned"
                                        htmlFor="id_photo_retention_days"
                                        hint="0 keeps every photo until you delete them yourself. Deleting happens every night."
                                        error={errors.id_photo_retention_days}
                                    >
                                        <Input
                                            id="id_photo_retention_days"
                                            name="id_photo_retention_days"
                                            type="number"
                                            min={0}
                                            max={3650}
                                            defaultValue={retentionDays}
                                            className="w-32"
                                            required
                                        />
                                    </FormField>
                                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm">
                                        <p>
                                            {plural(photos.kept, 'photo')} kept
                                            now; {photos.returned} of them{' '}
                                            {photos.returned === 1
                                                ? 'is'
                                                : 'are'}{' '}
                                            for IDs already returned.
                                        </p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="text-destructive hover:text-destructive"
                                            disabled={photos.returned === 0}
                                            onClick={() =>
                                                setDeletingPhotos(true)
                                            }
                                        >
                                            <Trash2 />
                                            Delete those now
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Backups to keep</CardTitle>
                                    <CardDescription>
                                        A backup is written every night at 2:00
                                        AM (when the scheduler is running).
                                        Older ones are deleted. Keep between 1
                                        and 60; with one backup a night, 7 means
                                        you can go back about a week.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <FormField
                                        label="Number of backups kept on this computer"
                                        htmlFor="backups_to_keep"
                                        error={errors.backups_to_keep}
                                    >
                                        <Input
                                            id="backups_to_keep"
                                            name="backups_to_keep"
                                            type="number"
                                            min={1}
                                            max={60}
                                            defaultValue={backupsToKeep}
                                            className="w-32"
                                            required
                                        />
                                    </FormField>
                                </CardContent>
                            </Card>

                            <div className="flex justify-end">
                                <Button type="submit" disabled={processing}>
                                    {processing && <Spinner />}
                                    Save options
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                <Form
                    {...OptionsController.updateSite.form()}
                    options={{ preserveScroll: true }}
                >
                    {({ errors, processing }) => (
                        <Card>
                            <CardHeader>
                                <CardTitle>Guest website</CardTitle>
                                <CardDescription>
                                    How visitors reach the front desk, shown on
                                    the public pages. Leave a box empty to hide
                                    it.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <FormField
                                    label="Front desk phone"
                                    htmlFor="contact_phone"
                                    error={errors.contact_phone}
                                    optional
                                >
                                    <Input
                                        id="contact_phone"
                                        name="contact_phone"
                                        type="tel"
                                        maxLength={60}
                                        defaultValue={site.contact_phone}
                                    />
                                </FormField>
                                <FormField
                                    label="Front desk email"
                                    htmlFor="contact_email"
                                    error={errors.contact_email}
                                    optional
                                >
                                    <Input
                                        id="contact_email"
                                        name="contact_email"
                                        type="email"
                                        defaultValue={site.contact_email}
                                    />
                                </FormField>
                                <FormField
                                    label="Address"
                                    htmlFor="contact_address"
                                    error={errors.contact_address}
                                    className="sm:col-span-2"
                                    optional
                                >
                                    <Input
                                        id="contact_address"
                                        name="contact_address"
                                        maxLength={255}
                                        defaultValue={site.contact_address}
                                    />
                                </FormField>
                                <FormField
                                    label="Hours a booking request holds its rooms"
                                    htmlFor="booking_request_hold_hours"
                                    error={errors.booking_request_hold_hours}
                                    hint="From 1 to 168 (a week). A request nobody answers in this time expires and frees the rooms."
                                    className="sm:col-span-2"
                                >
                                    <Input
                                        id="booking_request_hold_hours"
                                        name="booking_request_hold_hours"
                                        type="number"
                                        min={1}
                                        max={168}
                                        defaultValue={
                                            site.booking_request_hold_hours
                                        }
                                        className="w-32"
                                        required
                                    />
                                </FormField>
                                <div className="flex justify-end sm:col-span-2">
                                    <Button type="submit" disabled={processing}>
                                        Save guest website
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </Form>

                <Card>
                    <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1.5">
                            <CardTitle>Backups</CardTitle>
                            <CardDescription>
                                Each backup is one file with all the records and
                                the uploaded photos. Download it and keep a copy
                                somewhere else: a backup that sits only on this
                                computer is lost with it.
                            </CardDescription>
                        </div>
                        <Form
                            {...OptionsController.backup.form()}
                            options={{ preserveScroll: true }}
                        >
                            {({ processing }) => (
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={processing}
                                >
                                    {processing ? (
                                        <Spinner />
                                    ) : (
                                        <DatabaseBackup />
                                    )}
                                    Back up now
                                </Button>
                            )}
                        </Form>
                    </CardHeader>
                    <CardContent>
                        {backups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No backups yet. Use "Back up now" to make the
                                first one.
                            </p>
                        ) : (
                            <ul className="divide-y rounded-lg border">
                                {backups.map((backup) => (
                                    <li
                                        key={backup.name}
                                        className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-medium">
                                                {backup.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {formatDateTime(
                                                    backup.created_at,
                                                )}{' '}
                                                · {fileSize(backup.size)}
                                            </span>
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            asChild
                                        >
                                            {/* A file download, so a plain link. */}
                                            <a
                                                href={OptionsController.download.url(
                                                    backup.name,
                                                )}
                                            >
                                                <Download />
                                                Download
                                            </a>
                                        </Button>
                                        <IconButton
                                            label={`Delete ${backup.name}`}
                                            className="text-muted-foreground hover:text-destructive"
                                            onClick={() => setRemoving(backup)}
                                        >
                                            <Trash2 />
                                        </IconButton>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-3 text-xs text-muted-foreground">
                            A backup contains personal data (names, contact
                            numbers, ID photos). Keep it private. Restoring from
                            a backup is done by a technician.
                        </p>
                    </CardContent>
                </Card>
            </Page>

            <ConfirmAction
                open={deletingPhotos}
                onOpenChange={setDeletingPhotos}
                title={`Delete ${plural(photos.returned, 'ID photo')}?`}
                description="Only photos of IDs that were already returned are deleted. The type and number of each ID stay on record. This cannot be undone."
                url={OptionsController.deletePhotos.url()}
                method="post"
                data={{ all: 1 }}
                confirmLabel="Delete photos"
                destructive
            />
            {removing && (
                <ConfirmDelete
                    open
                    onOpenChange={(open) => !open && setRemoving(null)}
                    title={`Delete ${removing.name}?`}
                    description="The backup file is removed from this computer."
                    url={OptionsController.destroyBackup.url(removing.name)}
                    confirmLabel="Delete backup"
                />
            )}
        </>
    );
}

Options.layout = {
    breadcrumbs: [{ title: 'Options and backups', href: optionsEdit() }],
};
