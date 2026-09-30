<?php

namespace App\Console\Commands;

use App\Services\FrontDeskAlerts;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('front-desk:alerts')]
#[Description('Send due front-desk alerts: check-out calls, guests not arrived, arrivals soon')]
class SendFrontDeskAlerts extends Command
{
    public function handle(FrontDeskAlerts $alerts): int
    {
        $sent = $alerts->run();

        $this->info("Sent {$sent} alert(s).");

        return self::SUCCESS;
    }
}
