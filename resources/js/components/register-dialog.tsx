import { Form, router } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { store } from '@/routes/register';

/**
 * Creating a guest account without leaving the public page. It looks like the
 * register page (`pages/auth/register.tsx`), which still exists for links.
 */
export function RegisterDialog({
    open,
    onOpenChange,
    onLogIn,
    intended,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** "Already have an account? Log in" switches to the log-in pop-up. */
    onLogIn: () => void;
    /** A guest-only page to open once the account exists (e.g. the booking request). */
    intended?: string;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] gap-6 overflow-y-auto p-8 sm:max-w-md sm:p-10">
                <DialogHeader className="items-center gap-4 text-center sm:text-center">
                    <div className="flex flex-col items-center gap-2 font-medium">
                        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                            <AppLogoIcon className="size-6" />
                        </div>
                        <span className="text-sm font-semibold">
                            Guest Accommodation
                        </span>
                    </div>
                    <div className="space-y-2">
                        <DialogTitle className="text-xl font-medium">
                            Create an account
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Enter your details below to create your account
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <Form
                    {...store.form()}
                    resetOnSuccess={['password', 'password_confirmation']}
                    disableWhileProcessing
                    onSuccess={(page) => {
                        if (
                            intended &&
                            page.props.auth.user?.role === 'guest'
                        ) {
                            router.visit(intended);
                        }
                    }}
                    className="grid gap-5"
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="register_name">Name</Label>
                                <Input
                                    id="register_name"
                                    type="text"
                                    required
                                    autoComplete="name"
                                    name="name"
                                    placeholder="Full name"
                                />
                                <InputError message={errors.name} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="register_email">
                                    Email address
                                </Label>
                                <Input
                                    id="register_email"
                                    type="email"
                                    required
                                    autoComplete="email"
                                    name="email"
                                    placeholder="email@example.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="register_contact_number">
                                    Contact number
                                </Label>
                                <Input
                                    id="register_contact_number"
                                    type="tel"
                                    required
                                    autoComplete="tel"
                                    name="contact_number"
                                    placeholder="09XX XXX XXXX"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Reception calls this number one hour before
                                    your check-out.
                                </p>
                                <InputError message={errors.contact_number} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="register_password">
                                    Password
                                </Label>
                                <PasswordInput
                                    id="register_password"
                                    required
                                    autoComplete="new-password"
                                    name="password"
                                    placeholder="Password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="register_password_confirmation">
                                    Confirm password
                                </Label>
                                <PasswordInput
                                    id="register_password_confirmation"
                                    required
                                    autoComplete="new-password"
                                    name="password_confirmation"
                                    placeholder="Confirm password"
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <Button type="submit" className="mt-2 w-full">
                                {processing && <Spinner />}
                                Create account
                            </Button>

                            <p className="text-center text-sm text-muted-foreground">
                                Already have an account?{' '}
                                <button
                                    type="button"
                                    onClick={onLogIn}
                                    className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                >
                                    Log in
                                </button>
                            </p>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
