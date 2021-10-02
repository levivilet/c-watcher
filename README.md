# c watcher

Recursive file watcher for linux similar to `inotifywait`.

The focus of this project is on low memory usage and performance for recursively watching folders using the inotify api.

## Caveats

There are race conditions in the recursive directory watching code which can cause events to be missed if they occur in a directory immediately after that directory is created.

Workaround: Walk each created directory recursively and emit a synthetic create event for each visited dirent.

It will break when creating many folders fast (e.g. creating 50000 folders) since the inotify event queue will overflow.
