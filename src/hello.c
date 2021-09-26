// #define _XOPEN_SOURCE 500
#define _GNU_SOURCE

#include <errno.h>
#include <ftw.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/inotify.h>
#include <unistd.h>

#include "storage.h"

/* globals */

/* result of inotify_init */
static int fd = -1;
/* end globals */

static void output_event(const struct inotify_event *event) {
    /* Print the name of the file. */
    ListNode *node = storage_find(event->wd);

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
    // if (event->mask & MOVED_FROM) printf("MOVED_FROM");
    // if (event->mask & MOVED_TO) printf("MOVED_TO");
    fprintf(stdout, "\n");
    // TODO more efficient buffer handling
    fflush(stdout);
}

static int visit_dirent(const char *fpath, const struct stat *sb, int tflag,
                        struct FTW *ftwbuf) {
    if (tflag == FTW_D) {
        int wd = inotify_add_watch(fd, fpath,
                                   IN_CLOSE_WRITE | IN_MOVE | IN_CREATE |
                                       IN_DELETE | IN_MOVE | IN_UNMOUNT);
        if (wd == -1) {
            fprintf(stderr, "Cannot watch '%s': %s\n", fpath, strerror(errno));
            exit(EXIT_FAILURE);
        }

        // TODO use dynamic array (or better tree)
        storage_add(wd, fpath);
    }

    return 0; /* To tell nftw() to continue */
}

/* Walk folder recursively and setup watcher for each file */
static void watch_recursively(const char *dir) {
    int flags = FTW_PHYS;
    if (nftw(dir, visit_dirent, 20, flags) == -1) {
        perror("nftw");
        exit(EXIT_FAILURE);
    }
}

/* Read all available inotify events from the file descriptor 'fd'.
          wd is the table of watch descriptors for the directories in argv.
          argc is the length of wd and argv.
          argv is the list of watched directories.
          Entry 0 of wd and argv is unused. */

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
            if (event->mask & IN_CREATE && event->mask & IN_ISDIR) {
                ListNode *node = storage_find(event->wd);
                char *full_path;
                asprintf(&full_path, "%s/%s", node->fpath, event->name);
                // printf("FULLPATH%s\n", path);
                // const char* new_file = asprintf
                // printf("NEW_DIR in %s\n", node->fpath);
                // printf("NAME: %s\n", event->name);
                watch_recursively(full_path);
                free(full_path);
            }
        }
    }
}

int main(int argc, char *argv[]) {
    char buf;
    int poll_num;
    nfds_t nfds;
    struct pollfd fds[2];

    if (argc < 2) {
        printf("Usage: %s PATH [PATH ...]\n", argv[0]);
        exit(EXIT_FAILURE);
    }

    /* Create the file descriptor for accessing the inotify API. */
    fd = inotify_init1(IN_NONBLOCK);
    if (fd == -1) {
        perror("inotify_init1");
        exit(EXIT_FAILURE);
    }

    fprintf(stderr, "Setting up watches. This may take a while!\n");

    watch_recursively(argv[1]);

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

    close(fd);

    exit(EXIT_SUCCESS);
}