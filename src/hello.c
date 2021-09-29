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

static void output_event(const struct inotify_event *event) {
    /* Print the name of the file. */
    ListNode *node = storage_find(event->wd);

    // fprintf(stdout, "%d ", node->wd);
    // fprintf(stdout, "COOKIE %d ", event->cookie);

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

    fprintf(stdout, "\n");
    fflush(stdout);
    // TODO more efficient buffer handling
}

static void add_watch(const char *fpath) {
    int wd = notify_add_watch(fpath);
    // fprintf(stdout, "ADD WATCH %s\n", fpath);

    // TODO use dynamic array (or better tree)
    storage_add(wd, fpath);
    // storage_print();
}

static void remove_watch(int wd) {
    storage_remove(wd);
    notify_remove_watch(wd);
    // TODO remove from storage
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

void full_path(char **fpath, const struct inotify_event *event) {
    ListNode *node = storage_find(event->wd);
    if (asprintf(fpath, "%s/%s", node->fpath, event->name) == -1) {
        perror("asprintf");
        exit(EXIT_FAILURE);
    }
}

/* Read all available inotify events from the file descriptor 'fd'.
          wd is the table of watch descriptors
           */

static void handle_events(int fd) {
    /* Some systems cannot read integer variables if they are not
                properly aligned. On other systems, incorrect alignment may
                decrease performance. Hence, the buffer used for reading from
                the inotify file descriptor should have the same alignment as
                struct inotify_event. */

    char buf[4096] __attribute__((aligned(__alignof__(struct inotify_event))));
    const struct inotify_event *event;
    ssize_t len;

    /* Loop while events can be read from inotify file descriptor. */
    char *moved_from = NULL;

    for (;;) {
        /* Read some events. */

        len = read(fd, buf, sizeof(buf));
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
            if (event->mask & IN_ISDIR) {
                if (moved_from) {
                    // printf("has moved from object\n");
                    if (event->mask & IN_MOVED_TO) {
                        // moved inside watched area
                        // just rename, keep watches
                        // printf("keep watch inside\n");
                        char *moved_to;
                        full_path(&moved_to, event);
                        // printf("moved from %s\n", moved_from);
                        // printf("moved to %s\n", moved_to);
                        // printf("storage rename\n");
                        // fflush(stdout);
                        storage_rename(moved_from, moved_to);
                        free(moved_to);
                        // storage_print();
                        // printf("done storage rename\n");
                        // fflush(stdout);
                        // printf("new full path %s\n", fpath);
                        // full_path()
                        // storage_rename();
                        // moved_from->fpath=
                    } else {
                        printf("name %s\n", event->name);
                        printf("moved outside\n");
                        // printf()
                        // moved outside of watched area
                        // remove watches
                        // remove_watch(event->wd);
                    }
                    free(moved_from);
                    moved_from = NULL;
                }

                if ((event->mask & IN_CREATE)) {
                    ListNode *node = storage_find(event->wd);
                    char *full_path;
                    // TODO asprintf is said to be slow
                    // https://news.ycombinator.com/item?id=3112700
                    // maybe use something else
                    asprintf(&full_path, "%s/%s", node->fpath, event->name);
                    // printf("FULLPATH%s\n", path);
                    // const char* new_file = asprintf
                    // printf("NEW_DIR in %s\n", node->fpath);
                    // printf("NAME: %s\n", event->name);
                    watch_recursively(full_path);
                    free(full_path);
                }
                // else if (event->mask & IN_MOVED_FROM) {
                // fprintf(stdout, "RMOEV WATCH\n");
                // // TODO don't remove watch if MOVED_TO occurs inside
                // folder remove_watch(event->wd);
                // }
                if (event->mask & IN_MOVED_FROM) {
                    full_path(&moved_from, event);
                    // printf("MOVED from, from%s %d\n", moved_from->fpath,
                    //        event->wd);
                    // printf("%s\n", event->name);
                    // moved_from=from
                }

                // else if (event->mask & IN_MOVED_TO) {
                //     printf("MOVED TO, from%s %d\n", moved_from->fpath,
                //            event->wd);
                //     printf("%s\n", event->name);
                //     // storage_print();
                // }
            }
        }
    }
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
