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
        printf("asprintf error");
        fflush(stdout);
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
    // free(fpath);

    return 0; /* To tell nftw() to continue */
}

/* Walk folder recursively and setup watcher for each file */
static void watch_recursively(const char *dir) {
    int flags = FTW_PHYS;
    // TODO tweak amount of descriptors to tweak performance
    int descriptors = 255;
    if (nftw(dir, visit_dirent, descriptors, flags) == -1) {
        printf("nftw error");
        fflush(stdout);
        if (errno == EMFILE) {
            printf("em file");
        } else if (errno == ENFILE) {
            printf("nfile");
        } else if (errno == EOVERFLOW) {
            printf("overflow");
        } else if (errno == ENOTDIR) {
            printf("not dir");
        } else if (errno == ELOOP) {
            printf("loop");
        } else if (errno == EACCES) {
        } else {
            printf("something else");
        }
        // printf()
        // printf("errno addr %d\n", errno);
        // fflush(stdout);
        // printf("errno %s\n", strerror(errno));
        fflush(stdout);
        perror("nftw");
        exit(EXIT_FAILURE);
    }
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

    if (!(event->mask & IN_ISDIR)) {
        if (event->mask & IN_IGNORED) {
            // folder has been ignored -> remove from storage
            // printf("!!!IGNORED!!! %d\n", event->wd);
            storage_remove_by_wd(event->wd);
            return;
        }
        return;
    }
    if (moved_from_event) {
        // printf("HAS MOVED FROM EVENT\n");
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
        // printf("IS DIR %d", event->mask & IN_ISDIR);
        char *fpath;
        full_path(&fpath, event);
        // printf("event %s\n", event->name);
        // storage_print();
        // printf("fpath: %s\n", fpath);
        // printf("remove watch %d\n", event->wd);
        remove_watch_by_path(fpath);
        free(fpath);
        if (event->mask & IN_MOVED_FROM) {
            moved_from_event = event;
        } else {
            moved_from_event = NULL;
        }
        return;
    }
    // printf("below\n");
    if ((event->mask & IN_CREATE) || event->mask & IN_MOVED_TO) {
        // new folder -> add watcher
        char *fpath;
        full_path(&fpath, event);
        // printf("ADD WATCHER %s\n", fpath);
        // printf("FULLPATH%s\n", path);
        // printf("NEW_DIR in %s\n", node->fpath);
        // printf("NAME: %s\n", event->name);
        watch_recursively(fpath);
        free(fpath);
    }
    // if(event->mask & IN_DELETE){

    // }
    if (event->mask & IN_MOVED_FROM) {
        // printf("SET MOVED_FROM EVENT\n");
        moved_from_event = event;
        // printf("MOVED from, from%s %d\n", moved_from->fpath,
        //        event->wd);
        // printf("%s\n", event->name);
    }

    // if (event->mask & IN_DELETE) {
    //     printf("delete %d\n", event->wd);
    //     char *fpath;
    //     full_path(&fpath, event);
    //     // storage_print();
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
            printf("read error");
            fflush(stdout);
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
            // notify_print_event(event);
            // storage_print_count();`
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
            printf("poll error");
            fflush(stdout);
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
