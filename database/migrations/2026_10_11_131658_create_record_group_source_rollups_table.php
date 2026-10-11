<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The per-route request rollups split by traffic source, so the requests
     * page's route list can leave crawlers or monitors out.
     */
    public function up(): void
    {
        Schema::create('record_group_source_rollups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32);
            $table->timestamp('bucket');
            $table->string('group_key', 64);
            $table->string('source', 16);
            $table->string('label', 255)->nullable();
            $table->text('sublabel')->nullable();
            $table->unsignedBigInteger('count')->default(0);
            $table->unsignedBigInteger('ok_count')->default(0);
            $table->unsignedBigInteger('client_error_count')->default(0);
            $table->unsignedBigInteger('server_error_count')->default(0);
            $table->unsignedBigInteger('neutral_count')->default(0);
            $table->unsignedBigInteger('hits')->default(0);
            $table->unsignedBigInteger('misses')->default(0);
            $table->unsignedBigInteger('writes')->default(0);
            $table->unsignedBigInteger('deletes')->default(0);
            $table->unsignedBigInteger('authed_count')->default(0);
            $table->double('sum_duration')->default(0);
            $table->unsignedBigInteger('count_duration')->default(0);
            $table->double('max_duration')->nullable();
            $table->double('min_duration')->nullable();

            foreach (['1000', '5000', '10000', '25000', '50000', '100000', '250000', '500000', '1000000', '2500000', '5000000', '10000000', 'inf'] as $boundary) {
                $table->unsignedBigInteger('lat_le_'.$boundary)->default(0);
            }

            $table->timestamp('last_seen_at')->nullable();

            $table->unique(['project_id', 'type', 'bucket', 'group_key', 'source'], 'record_group_source_rollups_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('record_group_source_rollups');
    }
};
