import { Form, router } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { store } from '@/routes/login';
import { request } from '@/routes/password';

/**
 * Logging in without leaving the public page. A wrong email or password shows
 * here; the full login page (`pages/auth/login.tsx`) still exists for links.
 */
export function LoginDialog({
    open,
    onOpenChange,
    onSignUp,
    intended,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** "Don't have an account? Sign up" switches to the create-account pop-up. */
    onSignUp: () => void;
    /** A guest-only page to open after logging in (e.g. the booking request). */
    intended?: string;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* The same look as the login page: logo, centred title, roomy form. */}
            <DialogContent className="gap-8 p-8 sm:max-w-md sm:p-10">
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
                            Log in to your account
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Enter your email and password below to log in
                        </DialogDescription>
                    </div>
                </DialogHeader>

                <Form
                    {...store.form()}
                    resetOnSuccess={['password']}
                    onSuccess={(page) => {
                        // Staff land on their dashboard; only a guest carries on to the request.
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
                                <Label htmlFor="login_email">
                                    Email address
                                </Label>
                                <Input
                                    id="login_email"
                                    type="email"
                                    name="email"
                                    required
                                    autoComplete="email"
                                    placeholder="email@example.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="login_password">Password</Label>
                                <PasswordInput
                                    id="login_password"
                                    name="password"
                                    required
                                    autoComplete="current-password"
                                    placeholder="Password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            {/* One row: "Remember me" on the left, the forgot link on the right. */}
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="login_remember"
                                        name="remember"
                                    />
                                    <Label
                                        htmlFor="login_remember"
                                        className="h-4 leading-4"
                                    >
                                        Remember me
                                    </Label>
                                </div>
                                <TextLink href={request()} className="text-sm">
                                    Forgot your password?
                                </TextLink>
                            </div>

                            <Button
                                type="submit"
                                className="mt-2 w-full"
                                disabled={processing}
                            >
                                {processing && <Spinner />}
                                Log in
                            </Button>

                            <p className="text-center text-sm text-muted-foreground">
                                Don't have an account?{' '}
                                <button
                                    type="button"
                                    onClick={onSignUp}
                                    className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                >
                                    Sign up
                                </button>
                            </p>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
