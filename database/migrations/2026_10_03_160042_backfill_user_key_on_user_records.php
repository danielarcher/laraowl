<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * `user` records now carry their own id in user_key, which puts the
     * top-user profile lookup on the (project_id, user_key) index instead of
     * a JSON scan of every user record. Rows stored before that get it here.
     */
    public function up(): void
    {
        $id = match (DB::connection()->getDriverName()) {
            // Some payloads hold a \u0000, which ->> refuses to read, so the
            // id is taken from the text. It is the first key after t and timestamp.
            'pgsql' => "left(substring(payload::text from '\"id\":\\s*\"?([^\",}]+)'), 64)",
            'sqlite' => "substr(CAST(json_extract(payload, '$.id') AS TEXT), 1, 64)",
            default => "LEFT(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.id')), 64)",
        };

        DB::table('records')
            ->where('type', 'user')
            ->whereNull('user_key')
            ->update(['user_key' => DB::raw($id)]);
    }

    public function down(): void
    {
        DB::table('records')->where('type', 'user')->update(['user_key' => null]);
    }
};
