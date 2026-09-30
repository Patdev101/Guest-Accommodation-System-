<?php

namespace App\Http\Controllers\Reception;

use App\Http\Controllers\Controller;
use App\Models\IdCustody;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Shows a held ID's photo to staff only. The photos live on the private disk,
 * so there is no public link to them.
 */
class IdPhotoController extends Controller
{
    public function __invoke(IdCustody $idCustody): StreamedResponse
    {
        $disk = Storage::disk(IdCustody::DISK);

        abort_if($idCustody->photo_path === null || ! $disk->exists($idCustody->photo_path), 404);

        return $disk->response($idCustody->photo_path, null, [
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
