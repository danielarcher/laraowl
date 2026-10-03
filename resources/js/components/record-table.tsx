import { formatDistanceToNow } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export function RecordTable({ records }: { records: any[] }) {
    if (records.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                <p>No records found for this period.</p>
            </div>
        );
    }

    // Determine columns based on first record type
    const firstRecord = records[0];
    const type = firstRecord.type;

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Time</TableHead>
                        {type === 'request' && (
                            <>
                                <TableHead>Method</TableHead>
                                <TableHead>URI</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Duration</TableHead>
                            </>
                        )}
                        {type === 'exception' && (
                            <>
                                <TableHead>Class</TableHead>
                                <TableHead>Message</TableHead>
                                <TableHead>File</TableHead>
                            </>
                        )}
                        {type === 'query' && (
                            <>
                                <TableHead>Connection</TableHead>
                                <TableHead>Query</TableHead>
                                <TableHead>Time</TableHead>
                            </>
                        )}
                        {type === 'job' && (
                            <>
                                <TableHead>Job</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Queue</TableHead>
                                <TableHead>Duration</TableHead>
                            </>
                        )}
                        {type === 'command' && (
                            <>
                                <TableHead>Command</TableHead>
                                <TableHead>Exit Code</TableHead>
                            </>
                        )}
                        {type === 'log' && (
                            <>
                                <TableHead>Level</TableHead>
                                <TableHead>Message</TableHead>
                            </>
                        )}
                        {/* Fallback for other types */}
                        {![
                            'request',
                            'exception',
                            'query',
                            'job',
                            'command',
                            'log',
                        ].includes(type) && (
                            <TableHead>Payload Summary</TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record) => (
                        <TableRow key={record.id}>
                            <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                                {formatDistanceToNow(
                                    new Date(record.created_at),
                                    { addSuffix: true },
                                )}
                            </TableCell>
                            {type === 'request' && (
                                <>
                                    <TableCell className="font-mono text-xs">
                                        {record.payload.method}
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">
                                        {record.payload.uri}
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={`rounded px-2 py-0.5 text-xs ${
                                                record.payload.status >= 500
                                                    ? 'bg-red-500/10 text-red-500'
                                                    : record.payload.status >=
                                                        400
                                                      ? 'bg-yellow-500/10 text-yellow-500'
                                                      : 'bg-green-500/10 text-green-500'
                                            }`}
                                        >
                                            {record.payload.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {record.payload.duration}ms
                                    </TableCell>
                                </>
                            )}
                            {type === 'exception' && (
                                <>
                                    <TableCell className="max-w-xs truncate font-mono text-xs text-red-500">
                                        {record.payload.class}
                                    </TableCell>
                                    <TableCell className="max-w-sm truncate">
                                        {record.payload.message}
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                                        {record.payload.file}:
                                        {record.payload.line}
                                    </TableCell>
                                </>
                            )}
                            {type === 'query' && (
                                <>
                                    <TableCell className="text-xs">
                                        {record.payload.connection}
                                    </TableCell>
                                    <TableCell className="max-w-lg truncate font-mono text-xs">
                                        {record.payload.sql}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {record.payload.time}ms
                                    </TableCell>
                                </>
                            )}
                            {type === 'job' && (
                                <>
                                    <TableCell className="max-w-xs truncate font-mono text-xs">
                                        {record.payload.name}
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={`rounded px-2 py-0.5 text-xs ${
                                                record.payload.status ===
                                                'failed'
                                                    ? 'bg-red-500/10 text-red-500'
                                                    : 'bg-green-500/10 text-green-500'
                                            }`}
                                        >
                                            {record.payload.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {record.payload.queue}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {record.payload.duration}ms
                                    </TableCell>
                                </>
                            )}
                            {type === 'command' && (
                                <>
                                    <TableCell className="font-mono text-xs">
                                        php artisan {record.payload.command}
                                    </TableCell>
                                    <TableCell>
                                        <span
                                            className={`rounded px-2 py-0.5 text-xs ${
                                                record.payload.exit_code === 0
                                                    ? 'bg-green-500/10 text-green-500'
                                                    : 'bg-red-500/10 text-red-500'
                                            }`}
                                        >
                                            {record.payload.exit_code}
                                        </span>
                                    </TableCell>
                                </>
                            )}
                            {type === 'log' && (
                                <>
                                    <TableCell>
                                        <span
                                            className={`rounded px-2 py-0.5 text-xs uppercase ${
                                                [
                                                    'error',
                                                    'critical',
                                                    'alert',
                                                    'emergency',
                                                ].includes(record.payload.level)
                                                    ? 'bg-red-500/10 text-red-500'
                                                    : [
                                                            'warning',
                                                            'notice',
                                                        ].includes(
                                                            record.payload
                                                                .level,
                                                        )
                                                      ? 'bg-yellow-500/10 text-yellow-500'
                                                      : 'bg-blue-500/10 text-blue-500'
                                            }`}
                                        >
                                            {record.payload.level}
                                        </span>
                                    </TableCell>
                                    <TableCell className="max-w-xl truncate">
                                        {record.payload.message}
                                    </TableCell>
                                </>
                            )}
                            {![
                                'request',
                                'exception',
                                'query',
                                'job',
                                'command',
                                'log',
                            ].includes(type) && (
                                <TableCell className="max-w-lg truncate font-mono text-xs">
                                    {JSON.stringify(record.payload)}
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
