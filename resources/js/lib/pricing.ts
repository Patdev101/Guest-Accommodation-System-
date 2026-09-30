/**
 * The suggested price of one room for a stay: the rate's price times how many
 * of its units the stay covers (open question 1, option a). Reception can
 * always change the price. Stay times are form values like "2026-10-01T14:00".
 */
export type Suggestion = {
    quantity: number;
    unitLabel: string;
    total: number;
};

function toUtcMinutes(value: string): number {
    const [date, time = '00:00'] = value.split('T');
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);

    return Date.UTC(year, month - 1, day, hours, minutes) / 60000;
}

function calendarDays(startsAt: string, endsAt: string): number {
    const start = toUtcMinutes(`${startsAt.split('T')[0]}T00:00`);
    const end = toUtcMinutes(`${endsAt.split('T')[0]}T00:00`);

    return Math.round((end - start) / 1440);
}

export function suggestPrice(
    price: string | number,
    unit: string,
    startsAt: string,
    endsAt: string,
): Suggestion {
    const minutes = toUtcMinutes(endsAt) - toUtcMinutes(startsAt);
    const days = calendarDays(startsAt, endsAt);
    const name = unit.toLowerCase();

    let quantity: number;
    let unitLabel: string;

    if (name.includes('hour')) {
        quantity = Math.ceil(minutes / 60);
        unitLabel = 'hour';
    } else if (name.includes('night')) {
        quantity = days;
        unitLabel = 'night';
    } else if (name.includes('week')) {
        quantity = Math.ceil(days / 7);
        unitLabel = 'week';
    } else if (name.includes('day')) {
        quantity = days + 1;
        unitLabel = 'day';
    } else {
        quantity = 1;
        unitLabel = unit.toLowerCase();
    }

    quantity = Math.max(1, Number.isFinite(quantity) ? quantity : 1);

    return {
        quantity,
        unitLabel,
        total: Math.round(Number(price) * quantity * 100) / 100,
    };
}
