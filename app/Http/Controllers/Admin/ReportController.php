<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Reports;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Reports for the Admin: guest log, IDs still held, unpaid bills by company,
 * occupancy and income for a date range. Each list can be printed or exported.
 */
class ReportController extends Controller
{
    public function index(Request $request, Reports $reports): Response|StreamedResponse
    {
        $query = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'export' => ['nullable', 'in:guest_log,ids_held,unpaid,income'],
        ]);

        $from = isset($query['from']) ? CarbonImmutable::parse($query['from'])->startOfDay() : CarbonImmutable::now()->startOfMonth();
        $to = isset($query['to']) ? CarbonImmutable::parse($query['to'])->endOfDay() : CarbonImmutable::now()->endOfDay();

        if ($to->lt($from)) {
            $to = $from->endOfDay();
        }

        if (isset($query['export'])) {
            return $this->export($query['export'], $reports, $from, $to);
        }

        return Inertia::render('admin/reports', [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'guestLog' => $reports->guestLog($from, $to),
            'idsHeld' => $reports->idsHeld(),
            'unpaid' => $reports->unpaid(),
            'occupancy' => $reports->occupancy($from, $to->min(CarbonImmutable::now())->max($from->addMinute())),
            'income' => $reports->income($from, $to),
        ]);
    }

    private function export(string $report, Reports $reports, CarbonImmutable $from, CarbonImmutable $to): StreamedResponse
    {
        $time = fn (?string $iso) => $iso === null ? '' : CarbonImmutable::parse($iso)->setTimezone(config('app.timezone'))->format('Y-m-d H:i');

        [$headings, $rows] = match ($report) {
            'guest_log' => [
                ['Guest', 'Company', 'Contact number', 'Rooms', 'Guests', 'Checked in', 'Checked out', 'Expected check-out', 'ID', 'ID status'],
                array_map(fn (array $row) => [
                    $row['guest'], $row['company'], $row['contact_number'], $row['rooms'], $row['pax'],
                    $time($row['checked_in_at']), $time($row['checked_out_at']), $time($row['expected_check_out_at']), $row['id_type'], $row['id_status'],
                ], $reports->guestLog($from, $to)),
            ],
            'ids_held' => [
                ['Guest', 'Company', 'Rooms', 'ID type', 'Status', 'Received by', 'Held since', 'Checked out'],
                array_map(fn (array $row) => [
                    $row['guest'], $row['company'], $row['rooms'], $row['id_type'], $row['status'], $row['received_by'], $time($row['since']), $row['checked_out'] ? 'Yes' : 'No',
                ], $reports->idsHeld()),
            ],
            'unpaid' => [
                ['Company', 'Stays', 'Balance', 'Oldest stay'],
                array_map(fn (array $row) => [$row['company'], $row['stays'], number_format($row['balance'], 2, '.', ''), $time($row['oldest'])], $reports->unpaid()),
            ],
            default => (function () use ($reports, $from, $to) {
                $income = $reports->income($from, $to);

                return [
                    ['Item', 'Count', 'Amount'],
                    [
                        ...array_map(fn (array $row) => ['Received: '.$row['method'], $row['count'], number_format($row['amount'], 2, '.', '')], $income['by_method']),
                        ['Total received', $income['payments'], number_format($income['received'], 2, '.', '')],
                        ['Refunded', '', number_format($income['refunded'], 2, '.', '')],
                        ['Net income', '', number_format($income['net'], 2, '.', '')],
                    ],
                ];
            })(),
        };

        $name = str_replace('_', '-', $report).'-'.$from->format('Ymd').'-'.$to->format('Ymd').'.csv';

        return response()->streamDownload(function () use ($headings, $rows) {
            $out = fopen('php://output', 'w');

            if ($out === false) {
                return;
            }

            // So Excel opens the peso sign and accents correctly.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, $headings);

            foreach ($rows as $row) {
                fputcsv($out, $row);
            }

            fclose($out);
        }, $name, ['Content-Type' => 'text/csv']);
    }
}
