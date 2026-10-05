import { Form, Head } from '@inertiajs/react';
import SetPasswordController from '@/actions/App/Http/Controllers/Auth/SetPasswordController';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

type Props = {
    token: string;
    email: string;
    passwordRules: string;
};

/**
 * First-time password setup for an account an Admin created. Not the
 * "forgot password" page (that is auth/reset-password).
 */
export default function SetPassword({ token, email, passwordRules }: Props) {
    return (
        <>
            <Head title="Set up your password" />

            <Form
                {...SetPasswordController.store.form()}
                transform={(data) => ({ ...data, token, email })}
                resetOnSuccess={['password', 'password_confirmation']}
            >
                {({ processing, errors }) => (
                    <div className="grid gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="email">Your account</Label>
                            <Input
                                id="email"
                                type="email"
                                name="email"
                                autoComplete="username"
                                value={email}
                                readOnly
                            />
                            <InputError message={errors.email} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password">Choose a password</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                autoComplete="new-password"
                                autoFocus
                                required
                                passwordrules={passwordRules}
                            />
                            <p className="text-xs text-muted-foreground">
                                At least 8 characters. Only you will know it.
                            </p>
                            <InputError message={errors.password} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="password_confirmation">
                                Type it again
                            </Label>
                            <PasswordInput
                                id="password_confirmation"
                                name="password_confirmation"
                                autoComplete="new-password"
                                required
                                passwordrules={passwordRules}
                            />
                            <InputError
                                message={errors.password_confirmation}
                            />
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={processing}
                        >
                            {processing && <Spinner />}
                            Save password and continue
                        </Button>
                    </div>
                )}
            </Form>
        </>
    );
}

SetPassword.layout = {
    title: 'Set up your password',
    description:
        'Welcome. Choose a password for your new account, then log in.',
};
