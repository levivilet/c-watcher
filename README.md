# c watcher

recursive file watcher for linux similar to `inotifywait`.

## Caveats

There are race conditions in the recursive directory watching code which can cause events to be missed if they occur in a directory immediately after that directory is created.

Workaround: Walk each created directory recursively and emit a synthetic create event for each visited dirent.
