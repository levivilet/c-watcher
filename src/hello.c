// #define _XOPEN_SOURCE 500
#define _GNU_SOURCE

#include <errno.h>
#include <ftw.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/inotify.h>
#include <time.h>
#include <unistd.h>

#include "notify.h"
#include "storage.h"

extern int fd;

const struct inotify_event *moved_from_event = NULL;

void full_path(char **fpath, const struct inotify_event *event) {
    ListNode *node = storage_find(event->wd);
    if (asprintf(fpath, "%s/%s", node->fpath, event->name) == -1) {
        perror("asprintf");
        exit(EXIT_FAILURE);
    }
}

static void add_watch(const char *fpath) {
    int wd = notify_add_watch(fpath);
    // fprintf(stdout, "ADD WATCH %s\n", fpath);

    // TODO use dynamic array (or better tree)
    storage_add(wd, fpath);
    // storage_print();
    // storage_print();
}

static void remove_watch_by_path(const char *fpath) {
    // printf("rm by path %s\n", fpath);
    // storage_print();
    int wd = storage_find_by_path(fpath);
    // wd = 2;
    // printf("got wd to remove %d\n", wd);
    notify_remove_watch(wd);
    // storage_print();
}

static int visit_dirent(const char *fpath, const struct stat *sb, int tflag,
                        struct FTW *ftwbuf) {
    // printf("VISIT PATH %s\n", fpath);
    // sb.f
    if (tflag == FTW_D) {
        add_watch(fpath);
    }

    return 0; /* To tell nftw() to continue */
}

/* Walk folder recursively and setup watcher for each file */
static void watch_recursively(const char *dir) {
    int flags = FTW_PHYS;
    // TODO tweak amount of descriptors to tweak performance
    int descriptors = 255;
    if (nftw(dir, visit_dirent, descriptors, flags) == -1) {
        perror("nftw");
        exit(EXIT_FAILURE);
    }
}

static void event_print(const struct inotify_event *event) {
    printf("\n");
    printf("Event\n");
    if (event->len) {
        printf("path %s\n", event->name);
    }
    printf("wd %d\n", event->wd);
    if (event->mask & IN_OPEN) printf("type OPEN\n");
    if (event->mask & IN_CLOSE_NOWRITE) printf("type CLOSE_NOWRITE\n");
    if (event->mask & IN_CLOSE_WRITE) printf("type CLOSE_WRITE\n");
    if (event->mask & IN_ACCESS) printf("type ACCESS\n");
    if (event->mask & IN_MODIFY) printf("type MODIFY\n");
    if (event->mask & IN_ATTRIB) printf("type ATTRIB\n");
    if (event->mask & IN_OPEN) printf("type OPEN\n");
    if (event->mask & IN_CREATE) printf("type CREATE\n");
    if (event->mask & IN_DELETE) printf("type DELETE\n");
    if (event->mask & IN_DELETE_SELF) printf("type DELETE_SELF\n");
    if (event->mask & IN_ISDIR) printf("type ISDIR\n");
    // if (event->mask & IN_ISDIR) printf("type IN_ISDIR\n");
    if (event->mask & IN_MOVED_FROM) printf("type MOVED_FROM\n");
    if (event->mask & IN_MOVED_TO) printf("type MOVED_TO\n");
    if (event->mask & IN_MOVE) printf("type MOVE\n");
    // if (event->mask & IN_MODIFY) printf("type MODIFY\n");
    // if (event->mask & IN_DELETE_SELF) printf("type DELETESELF\n");
    if (event->mask & IN_MOVE_SELF) printf("type MOVE_SELF\n");
    if (event->mask & IN_ACCESS) printf("type ACCESS\n");
    if (event->mask & IN_IGNORED) printf("type IGNORED\n");
    printf("\n");
}

static void output_event(const struct inotify_event *event) {
    if (event->mask & IN_IGNORED) {
        return;
    }
    // printf("before\n");
    // event_print(event);
    // printf("after\n");
    // storage_print();
    // storage_print();
    // printf("EVENT\n");

    /* Print the name of the file. */
    ListNode *node = storage_find(event->wd);

    // fprintf(stdout, "%d ", node->wd);
    // fprintf(stdout, "COOKIE %d ", event->cookie);

    fflush(stdout);
    // if()
    fprintf(stdout, "%s/", node->fpath);

    if (event->len) fprintf(stdout, "%s ", event->name);

    if (event->mask & IN_OPEN) fprintf(stdout, "OPEN");
    if (event->mask & IN_CLOSE_NOWRITE) fprintf(stdout, "CLOSE_NOWRITE");
    if (event->mask & IN_CLOSE_WRITE) fprintf(stdout, "CLOSE_WRITE");
    if (event->mask & IN_ACCESS) fprintf(stdout, "ACCESS");
    if (event->mask & IN_MODIFY) fprintf(stdout, "MODIFY");
    if (event->mask & IN_ATTRIB) fprintf(stdout, "ATTRIB");
    if (event->mask & IN_OPEN) fprintf(stdout, "OPEN");
    if (event->mask & IN_CREATE) fprintf(stdout, "CREATE");
    if (event->mask & IN_DELETE) fprintf(stdout, "DELETE");
    if (event->mask & IN_DELETE_SELF) fprintf(stdout, "DELETE_SELF");
    if (event->mask & IN_ISDIR) fprintf(stdout, "ISDIR");
    // if (event->mask & IN_ISDIR) printf("IN_ISDIR");
    if (event->mask & IN_MOVED_FROM) fprintf(stdout, "MOVED_FROM");
    if (event->mask & IN_MOVED_TO) fprintf(stdout, "MOVED_TO");
    if (event->mask & IN_MOVE) fprintf(stdout, "MOVE");
    // if (event->mask & IN_MODIFY) fprintf(stdout,"MODIFY");
    // if (event->mask & IN_DELETE_SELF) fprintf(stdout,"DELETESELF");
    if (event->mask & IN_MOVE_SELF) fprintf(stdout, "MOVE_SELF");
    if (event->mask & IN_ACCESS) fprintf(stdout, "ACCESS");
    if (event->mask & IN_IGNORED) fprintf(stdout, "IGNORED");

    // TODO more efficient buffer handling

    fprintf(stdout, "\n");
    fflush(stdout);
}

static void adjust_watchers(const struct inotify_event *event) {
    // printf("EVENT LENGTH %d\n", event->len);
    // printf("EVENT NAME %s\n", event->name);
    if (!event->mask & IN_ISDIR) {
        return;
    }
    if (moved_from_event) {
        // TODO check cookie
        if (event->mask & IN_MOVED_TO) {
            // matching event -> rename
            // just rename, keep watches
            // printf("keep watch inside\n");
            char *moved_from;
            full_path(&moved_from, moved_from_event);
            char *moved_to;
            full_path(&moved_to, event);
            // storage_print();
            // printf("moved from %s\n", moved_from);
            // printf("moved to %s\n", moved_to);
            // printf("storage rename\n");
            // fflush(stdout);
            storage_rename(moved_from, moved_to);
            // storage_print();
            free(moved_from);
            free(moved_to);
            // storage_print();
            // printf("done storage rename\n");
            // fflush(stdout);
            // printf("new full path %s\n", fpath);
            // storage_rename();
            // moved_from->fpath=
            moved_from_event = NULL;
            return;
        }
        // moved outside -> remove watch
        char *fpath;
        full_path(&fpath, event);
        // printf("event %s\n", event->name);
        // storage_print();
        // printf("fpath: %s\n", fpath);
        // printf("remove watch\n");
        // TODO remove by path?
        notify_remove_watch(moved_from_event->wd);
        moved_from_event = NULL;
        return;
    }
    // printf("below\n");
    if ((event->mask & IN_CREATE) || event->mask & IN_MOVED_TO) {
        // new folder -> add watcher
        // printf("ADD WATCHER\n");
        char *fpath;
        full_path(&fpath, event);
        // printf("FULLPATH%s\n", path);
        // printf("NEW_DIR in %s\n", node->fpath);
        // printf("NAME: %s\n", event->name);
        watch_recursively(fpath);
        free(fpath);
    }
    // if(event->mask & IN_DELETE){

    // }
    if (event->mask & IN_MOVED_FROM) {
        // printf("MOVED_FROM\n");
        moved_from_event = event;
        // printf("MOVED from, from%s %d\n", moved_from->fpath,
        //        event->wd);
        // printf("%s\n", event->name);
    }
    if (event->mask & IN_IGNORED) {
        // folder has been ignored -> remove from storage
        // printf("!!!IGNORED!!! %d\n", event->wd);
        storage_remove_by_wd(event->wd);
    }
    // if (event->mask & IN_DELETE) {
    //     printf("delete %d\n", event->wd);
    //     char *fpath;
    //     full_path(&fpath, event);
    //     // storage_print();
    //     // storage_remove_by_path(fpath);
    //     storage_print();
    //     free(fpath);
    //     printf("free\n");
    // }
}

/* Read all available inotify events from the file descriptor 'fd'.
          wd is the table of watch descriptors
           */

static void handle_events(int fd) {
    /* Some systems cannot read integer variables if they are not
                properly aligned. On other systems, incorrect alignment may
                decrease performance. Hence, the buffer used for reading
       from the inotify file descriptor should have the same alignment as
                struct inotify_event. */

    char buf[4096] __attribute__((aligned(__alignof__(struct inotify_event))));
    const struct inotify_event *event;
    ssize_t len;

    /* Loop while events can be read from inotify file descriptor. */

    for (;;) {
        // printf("LOOP ITERATION\n");
        /* Read some events. */

        len = read(fd, buf, sizeof(buf));
        // printf("LEN: %d\n", len);
        if (len == -1 && errno != EAGAIN) {
            perror("read");
            exit(EXIT_FAILURE);
        }

        /* If the nonblocking read() found no events to read, then
                      it returns -1 with errno set to EAGAIN. In that case,
                      we exit the loop. */

        if (len <= 0) break;

        /* Loop over all events in the buffer. */

        for (char *ptr = buf; ptr < buf + len;
             ptr += sizeof(struct inotify_event) + event->len) {
            event = (const struct inotify_event *)ptr;
            output_event(event);
            adjust_watchers(event);
            // printf("iterate\n");
        }

        if (moved_from_event) {
            // trailing moved_from event
            // printf("trailing moved_from_event\n");
            // TODO don't remove event.wd remove wd from child
            // use (storage_find_by_path)
            char *fpath;
            full_path(&fpath, moved_from_event);
            // printf("%s\n", fpath);
            remove_watch_by_path(fpath);
            // printf("before free\n");
            free(fpath);
            moved_from_event = NULL;
            // printf("done\n");
        }
    }

    // printf("end of loop");
    // TODO free moved from if it is not null
    fflush(stdout);
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        printf("Usage: %s PATH [PATH ...]\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    char buf;
    int poll_num;
    nfds_t nfds;
    struct pollfd fds[2];

    /* Create the file descriptor for accessing the inotify API. */
    notify_init();

    fprintf(stderr, "Setting up watches. This may take a while!\n");
    clock_t start = clock();

    watch_recursively(argv[1]);

    /*Do something*/
    clock_t end = clock();
    float seconds = (float)(end - start) / CLOCKS_PER_SEC;
    fprintf(stderr, "Took %f\n", seconds);
    fprintf(stderr, "Watches established.\n");

    // storage_print();

    /* Prepare for polling. */

    nfds = 2;

    fds[0].fd = STDIN_FILENO; /* Console input */
    fds[0].events = POLLIN;

    fds[1].fd = fd; /* Inotify input */
    fds[1].events = POLLIN;

    /* Wait for events and/or terminal input. */

    // printf("Listening for events.\n");
    while (1) {
        poll_num = poll(fds, nfds, -1);
        if (poll_num == -1) {
            if (errno == EINTR) continue;
            perror("poll");
            exit(EXIT_FAILURE);
        }

        if (poll_num > 0) {
            if (fds[0].revents & POLLIN) {
                /* Console input is available. Empty stdin and quit. */

                while (read(STDIN_FILENO, &buf, 1) > 0 && buf != '\n') continue;
                break;
            }

            if (fds[1].revents & POLLIN) {
                /* Inotify events are available. */

                handle_events(fd);
            }
        }
    }

    printf("Listening for events stopped.\n");

    /* Close inotify file descriptor. */

    notify_dispose();

    exit(EXIT_SUCCESS);
}
