// Colours match the room status flow in docs/guest-accommodation-documentation.html.
export const roomStatusColor: Record<string, string> = {
    available:
        'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    occupied:
        'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
    check_out:
        'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
    inspection:
        'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    cleaning:
        'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
    under_maintenance:
        'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    out_of_service:
        'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
};
