# c watcher

Recursive file watcher for linux similar to [inotifywait](https://github.com/inotify-tools/inotify-tools).

The focus of this project is on low memory usage and performance for recursively watching folders using the inotify api.

## Usage

```sh
./hello sample-folder
```

## Output

The output is in csv format, for example:

```
sample-folder/file.txt,CREATE
sample-folder/file.txt,CLOSE_WRITE
```

The following events can be emitted:

| Name           | Description                   |
| -------------- | ----------------------------- |
| CREATE_DIR     | directory is created          |
| MODIFY_DIR     | directory is modified         |
| OPEN_DIR       | directory is opened           |
| DELETE_DIR     | directory is deleted          |
| MOVED_FROM_DIR | directory moves in            |
| MOVED_TO_DIR   | directory moves out           |
| ACCESS         | file is accessed              |
| ATTRIB         | file attribute is changed     |
| CLOSE_WRITE    | file is written to and closed |
| CLOSE_NOWRITE  | file is closed                |
| CREATE         | file is created               |
| DELETE         | file is deleted               |
| MODIFY         | file is modified              |
| MOVED_FROM     | file moves in                 |
| MOVED_TO       | file moves out                |
| OPEN           | file is opened                |

## Caveats

There are race conditions in the recursive directory watching code which can cause events to be missed if they occur in a directory immediately after that directory is created.

Workaround: Walk each created directory recursively and emit a synthetic create event for each visited dirent.

It will break when creating many folders fast (e.g. creating 50000 folders) since the inotify event queue will overflow.
