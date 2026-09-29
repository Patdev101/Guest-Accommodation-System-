const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
});

const pesoWhole = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
});

const longDate = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
});

// "Now" is always read in the facility's time zone, so the server render and
// every browser show the same day and greeting.
const TIME_ZONE = 'Asia/Manila';

const weekdayDate = new Intl.DateTimeFormat('en-PH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
});

const isoDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

const hour = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: TIME_ZONE,
});

/** ₱1,500.00, or ₱1,500 when the amount has no centavos. */
export function formatPeso(amount: string | number): string {
    const value = Number(amount);

    return Number.isInteger(value)
        ? pesoWhole.format(value)
        : peso.format(value);
}

/** A "YYYY-MM-DD" date shown as e.g. "29 Sept 2026", read in local time. */
export function formatDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);

    return longDate.format(new Date(year, month - 1, day));
}

export function formatToday(): string {
    return weekdayDate.format(new Date());
}

/** Today as "YYYY-MM-DD", for date inputs. */
export function todayIso(): string {
    return isoDate.format(new Date());
}

export function greeting(): string {
    const now = Number(hour.format(new Date()));

    if (now < 12) {
        return 'Good morning';
    }

    return now < 18 ? 'Good afternoon' : 'Good evening';
}

export function plural(count: number, one: string, many = `${one}s`): string {
    return `${count} ${count === 1 ? one : many}`;
}

export function percent(part: number, whole: number): string {
    return whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`;
}
