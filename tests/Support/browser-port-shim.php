<?php

/*
 * The Pest browser plugin finds a free port with ext-sockets, which many PHP
 * builds leave off. Unqualified calls inside its namespace resolve here first,
 * so these stand-ins (plain stream sockets) let the suite run on any PHP.
 */

namespace Pest\Browser\Support;

if (! \extension_loaded('sockets')) {
    /**
     * @return resource|false
     */
    function socket_create_listen(int $port)
    {
        return \stream_socket_server("tcp://127.0.0.1:{$port}");
    }

    /**
     * @param  resource  $socket
     */
    function socket_getsockname($socket, &$address, &$port = null): bool
    {
        $name = \stream_socket_get_name($socket, false);

        if ($name === false) {
            return false;
        }

        $separator = \strrpos($name, ':');
        $address = \substr($name, 0, $separator);
        $port = (int) \substr($name, $separator + 1);

        return true;
    }

    /**
     * @param  resource  $socket
     */
    function socket_close($socket): void
    {
        \fclose($socket);
    }
}
