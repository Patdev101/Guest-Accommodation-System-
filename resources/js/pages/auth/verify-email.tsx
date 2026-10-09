import { Form, Head, Link } from '@inertiajs/react';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

type Props = {
    status?: string;
    email?: string | null;
};

/** Shown to a new guest until they open the link we emailed them. */
export default function VerifyEmail({ status, email }: Props) {
    return (
        <>
            <Head title="Confirm your email" />

            <div className="flex flex-col items-center gap-3 text-center text-sm">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MailCheck className="size-6" />
                </span>
                <p>
                    We sent a link to <b>{email ?? 'your email address'}</b>.
                    Open it to confirm the address is yours; then you can send
                    booking requests.
                </p>
                <p className="text-muted-foreground">
                    It can take a minute to arrive. Check your spam folder too.
                </p>
            </div>

            {status === 'verification-link-sent' && (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
                    <CheckCircle2 className="size-4 shrink-0" />A new link was
                    sent to your email address.
                </div>
            )}

            <Form {...send.form()} className="flex flex-col gap-3">
                {({ processing }) => (
                    <>
                        <Button type="submit" disabled={processing}>
                            {processing && <Spinner />}
                            Send the link again
                        </Button>
                        <Button variant="ghost" asChild>
                            <Link href={logout()} as="button" method="post">
                                Log out
                            </Link>
                        </Button>
                    </>
                )}
            </Form>
        </>
    );
}

VerifyEmail.layout = {
    title: 'Confirm your email',
    description: 'One more step before you can book',
};
