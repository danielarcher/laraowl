<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each user's latest name and email, kept apart from the raw `user`
     * records so a user is still named once those are pruned.
     */
    public function up(): void
    {
        Schema::create('record_user_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('user_key', 64);
            $table->string('name')->default('');
            $table->string('email')->default('');
            $table->timestamp('seen_at')->nullable();

            $table->unique(['project_id', 'user_key'], 'record_user_profiles_unique');
        });

        // Seeded from the profiles still on hand, newest first, project by
        // project on the (project_id, type, created_at) index.
        foreach (DB::table('projects')->pluck('id') as $projectId) {
            $rows = [];

            $profiles = DB::table('records')
                ->where('project_id', $projectId)
                ->where('type', 'user')
                ->orderByDesc('created_at')
                ->select(['user_key', 'payload', 'created_at'])
                ->cursor();

            foreach ($profiles as $record) {
                if ($record->user_key === null || isset($rows[$record->user_key])) {
                    continue;
                }

                $payload = json_decode($record->payload, true) ?: [];
                $rows[$record->user_key] = [
                    'project_id' => $projectId,
                    'user_key' => $record->user_key,
                    'name' => mb_substr((string) ($payload['name'] ?? ''), 0, 255),
                    'email' => mb_substr((string) ($payload['username'] ?? $payload['email'] ?? ''), 0, 255),
                    'seen_at' => $record->created_at,
                ];
            }

            foreach (array_chunk(array_values($rows), 500) as $chunk) {
                DB::table('record_user_profiles')->insert($chunk);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('record_user_profiles');
    }
};
