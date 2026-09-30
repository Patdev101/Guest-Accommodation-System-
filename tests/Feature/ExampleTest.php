<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_sends_visitors_to_the_login_page()
    {
        $this->get(route('home'))->assertRedirect(route('login'));
    }

    public function test_home_sends_logged_in_users_to_the_dashboard()
    {
        $this->actingAs(User::factory()->admin()->create())
            ->get(route('home'))
            ->assertRedirect(route('dashboard'));
    }
}
