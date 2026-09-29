<?php

namespace App\Enums;

enum VerificationResult: string
{
    case Passed = 'passed';
    case Failed = 'failed';
}
