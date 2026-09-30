<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Front-desk alerts (rules 17, 18 and 27). Needs `php artisan schedule:run`
// every minute (Windows Task Scheduler) or `php artisan schedule:work`.
Schedule::command('front-desk:alerts')->everyMinute()->withoutOverlapping();
