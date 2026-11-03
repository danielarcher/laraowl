<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('team_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            // registered: a domain the team owns; platform: a host on someone else's domain (on-forge.com).
            $table->string('kind', 16)->default('registered');
            $table->json('hosts')->nullable();
            $table->json('nameservers')->nullable();
            $table->string('dns_provider')->nullable();
            $table->json('email')->nullable();
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->string('redirects_to')->nullable();
            $table->string('registrar')->nullable();
            $table->timestamp('registered_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            // ok, unsupported (no RDAP for the TLD) or failed.
            $table->string('rdap_status', 16)->nullable();
            $table->timestamp('rdap_checked_at')->nullable();
            $table->timestamp('scanned_at')->nullable();
            $table->timestamps();

            $table->unique(['team_id', 'name']);
        });

        Schema::table('uptime_checks', function (Blueprint $table) {
            $table->index(['project_id', 'checked_at']);
        });
    }

    public function down(): void
    {
        Schema::table('uptime_checks', function (Blueprint $table) {
            $table->dropIndex(['project_id', 'checked_at']);
        });

        Schema::dropIfExists('domains');
    }
};
