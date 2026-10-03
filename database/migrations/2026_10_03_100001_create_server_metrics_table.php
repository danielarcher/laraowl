<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * One row per server per agent run (every minute). Sizes are bytes, and
     * `recorded_ts` repeats `recorded_at` as a Unix timestamp so charts can
     * bucket with plain integer division on every database driver.
     */
    public function up(): void
    {
        Schema::create('server_metrics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('server_id')->constrained()->cascadeOnDelete();
            $table->timestamp('recorded_at');
            $table->unsignedBigInteger('recorded_ts');
            $table->decimal('cpu_percent', 5, 2);
            $table->decimal('load_1', 8, 2);
            $table->decimal('load_5', 8, 2);
            $table->decimal('load_15', 8, 2);
            $table->unsignedBigInteger('memory_total');
            $table->unsignedBigInteger('memory_used');
            $table->unsignedBigInteger('swap_total')->default(0);
            $table->unsignedBigInteger('swap_used')->default(0);
            $table->unsignedBigInteger('disk_total');
            $table->unsignedBigInteger('disk_used');
            $table->json('disks')->nullable();
            $table->unsignedBigInteger('uptime_seconds')->nullable();

            $table->index(['server_id', 'recorded_ts']);
            $table->index('recorded_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('server_metrics');
    }
};
