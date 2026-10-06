<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Bill for {{ $stay->guest->name }} (stay #{{ $stay->id }})</title>
    <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 24px; font-family: Segoe UI, Arial, sans-serif; font-size: 13px; color: #1f2a3a; background: #f2f5f9; }
        .sheet { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #d9dee6; padding: 32px; }
        header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 3px solid #1f3c73; padding-bottom: 14px; margin-bottom: 18px; }
        h1 { margin: 0; font-size: 18px; color: #1f3c73; }
        h2 { margin: 22px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .5px; color: #1f3c73; }
        .muted { color: #6b7686; }
        .right { text-align: right; }
        .details { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 24px; }
        .details b { display: inline-block; min-width: 110px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 6px 8px; border-bottom: 1px solid #d9dee6; text-align: left; vertical-align: top; }
        th { font-size: 11px; text-transform: uppercase; letter-spacing: .3px; color: #6b7686; }
        td.amount, th.amount { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .totals { margin-top: 16px; margin-left: auto; width: 320px; }
        .totals td { border: 0; padding: 4px 8px; }
        .totals .due td { border-top: 2px solid #1f3c73; font-size: 16px; font-weight: 700; padding-top: 8px; }
        .signs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 48px; }
        .signs div { border-top: 1px solid #1f2a3a; padding-top: 6px; text-align: center; }
        .bar { max-width: 760px; margin: 0 auto 12px; display: flex; gap: 8px; }
        button, a.btn { padding: 8px 14px; border: 1px solid #aab3c0; background: #fff; border-radius: 4px; font: inherit; color: inherit; cursor: pointer; text-decoration: none; }
        button.primary { background: #1f3c73; border-color: #1f3c73; color: #fff; }
        @media print {
            body { background: #fff; padding: 0; }
            .sheet { border: 0; padding: 0; max-width: none; }
            .bar { display: none; }
        }
    </style>
</head>
<body @if ($embed) style="background: #fff; padding: 0;" @endif>
    {{-- Inside the pop-up the page around it has the buttons. --}}
    @unless ($embed)
        <div class="bar">
            <button type="button" class="primary" onclick="window.print()">Print or save as PDF</button>
            <a class="btn" href="{{ route('reception.stays.show', $stay) }}">Back to the stay</a>
        </div>
    @endunless

    <div class="sheet" @if ($embed) style="border: 0;" @endif>
        <header>
            <div>
                <h1>Mindoro Marine Manufacturing Corporation</h1>
                <div class="muted">Guest Accommodation</div>
            </div>
            <div class="right">
                <b>{{ $balance > 0 ? 'Statement of account' : 'Official bill' }}</b><br>
                Stay #{{ $stay->id }}@if ($stay->reservation_id) · Reservation #{{ $stay->reservation_id }}@endif<br>
                <span class="muted">Printed {{ now()->format('j M Y, g:i A') }}</span>
            </div>
        </header>

        <div class="details">
            <div><b>Company</b> {{ $company ?: '—' }}</div>
            <div><b>Checked in</b> {{ $stay->checked_in_at->format('j M Y, g:i A') }}</div>
            <div><b>Contact person</b> {{ $stay->guest->name }}</div>
            <div><b>{{ $stay->checked_out_at ? 'Checked out' : 'Due out' }}</b> {{ ($stay->checked_out_at ?? $stay->expected_check_out_at)->format('j M Y, g:i A') }}</div>
            <div><b>Contact number</b> {{ $stay->guest->contact_number }}</div>
            <div><b>Rooms</b> {{ $stay->rooms->map(fn ($line) => $line->room->name.' ('.$line->pax.' '.($line->pax == 1 ? 'guest' : 'guests').')')->implode(', ') }}</div>
        </div>

        <h2>Charges</h2>
        <table>
            <tr><th>Description</th><th>Type</th><th>Billed to</th><th class="amount">Amount</th></tr>
            @forelse ($charges as $charge)
                <tr>
                    <td>{{ $charge->description }}</td>
                    <td>{{ $charge->type->label() }}</td>
                    <td>{{ $charge->billed_to->label() }}</td>
                    <td class="amount">₱{{ number_format((float) $charge->amount, 2) }}</td>
                </tr>
            @empty
                <tr><td colspan="4" class="muted">No charges.</td></tr>
            @endforelse
        </table>

        <h2>Payments</h2>
        <table>
            <tr><th>Date</th><th>Method</th><th>Receipt no.</th><th>Paid by</th><th class="amount">Amount</th></tr>
            @forelse ($payments as $payment)
                <tr>
                    <td>{{ $payment->paid_at->format('j M Y, g:i A') }}</td>
                    <td>{{ $payment->method }}</td>
                    <td>{{ $payment->receipt_number ?: '—' }}</td>
                    <td>{{ $payment->paid_by->label() }}</td>
                    <td class="amount">₱{{ number_format((float) $payment->amount, 2) }}</td>
                </tr>
            @empty
                <tr><td colspan="5" class="muted">No payments yet.</td></tr>
            @endforelse
        </table>

        <table class="totals">
            <tr><td>Total charges</td><td class="amount">₱{{ number_format($charged, 2) }}</td></tr>
            <tr><td>Total paid</td><td class="amount">− ₱{{ number_format($paid, 2) }}</td></tr>
            @if ($refunded > 0)
                <tr><td>Overpayment refunded</td><td class="amount">+ ₱{{ number_format($refunded, 2) }}</td></tr>
            @endif
            <tr class="due">
                <td>{{ $balance > 0 ? 'Balance due' : ($balance < 0 ? 'To be refunded' : 'Fully paid') }}</td>
                <td class="amount">₱{{ number_format(abs($balance), 2) }}</td>
            </tr>
        </table>

        <div class="signs">
            <div>Prepared by: {{ $printedBy }}</div>
            <div>Received by (guest or company)</div>
        </div>
    </div>
</body>
</html>
