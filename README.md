# c-watcher

Recursive file watcher for linux similar to [inotifywait](https://github.com/inotify-tools/inotify-tools). The focus of this project is to have low memory usage for recursively watching folders using the inotify api.

## Usage

```sh
./hello sample-folder
```

Then do some file operations:

```sh
touch sample-folder/file.txt
```

It will print the files operations in csv format:

```
sample-folder/file.txt,CREATE
sample-folder/file.txt,ATTRIB
sample-folder/file.txt,CLOSE_WRITE
```

## Events

The following events can be emitted:

| Name           | Description                    |
| -------------- | ------------------------------ |
| ATTRIB_DIR     | Directory attribute is changed |
| CREATE_DIR     | Directory is created           |
| MODIFY_DIR     | Directory is modified          |
| OPEN_DIR       | Directory is opened            |
| DELETE_DIR     | Directory is deleted           |
| MOVED_FROM_DIR | Directory moves in             |
| MOVED_TO_DIR   | Directory moves out            |
| ACCESS         | File is accessed               |
| ATTRIB         | File attribute is changed      |
| CLOSE_WRITE    | File is written to and closed  |
| CLOSE_NOWRITE  | File is closed                 |
| CREATE         | File is created                |
| DELETE         | File is deleted                |
| MODIFY         | File is modified               |
| MOVED_FROM     | File moves in                  |
| MOVED_TO       | File moves out                 |
| OPEN           | File is opened                 |

## Caveats

There are race conditions in the recursive directory watching code which can cause events to be missed if they occur in a directory immediately after that directory is created. As a workaround walk each created directory recursively and emit a synthetic create event for each visited dirent.
