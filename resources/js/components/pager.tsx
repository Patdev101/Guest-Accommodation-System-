import { Link } from '@inertiajs/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { Paginated } from '@/types';

function PageLink({
    href,
    children,
}: {
    href: string | null;
    children: ReactNode;
}) {
    return (
        <Button variant="outline" size="sm" asChild>
            {href ? (
                <Link href={href} preserveScroll>
                    {children}
                </Link>
            ) : (
                <span aria-disabled className="pointer-events-none opacity-50">
                    {children}
                </span>
            )}
        </Button>
    );
}

/** "Showing 1–25 of 60" with Previous / Next, under a paginated list. */
export function Pager({ page }: { page: Paginated<unknown> }) {
    if (page.last_page <= 1) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
                Showing {page.from}–{page.to} of {page.total}
            </p>
            <div className="flex gap-2">
                <PageLink href={page.prev_page_url}>
                    <ChevronLeft />
                    Previous
                </PageLink>
                <PageLink href={page.next_page_url}>
                    Next
                    <ChevronRight />
                </PageLink>
            </div>
        </div>
    );
}
