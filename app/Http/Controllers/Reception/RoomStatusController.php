<?php

namespace App\Http\Controllers\Reception;

use App\Http\Controllers\Admin\RoomStatusController as AdminRoomStatusController;
use App\Models\Room;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Reception updates room status from the front-desk room board: marks a
 * cleaned room available, reports maintenance, and so on. Same rules as the
 * Admin's room page; check-in and check-out drive the other statuses.
 */
class RoomStatusController extends AdminRoomStatusController
{
    public function __invoke(Request $request, Room $room): RedirectResponse
    {
        $this->change($request, $room);

        return back();
    }
}
