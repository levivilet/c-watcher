#define _XOPEN_SOURCE 500
#include <dirent.h>
#include <errno.h>
#include <ftw.h>
#include <poll.h>
#include <regex.h>
#include <setjmp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/inotify.h>
#include <sys/ioctl.h>
#include <sys/select.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>

/* globals */

/* result of inotify_init */
static int fd;

/* end globals */

/* Read all available inotify events from the file descriptor 'fd'.
          wd is the table of watch descriptors for the directories in argv.
          argc is the length of wd and argv.
          argv is the list of watched directories.
          Entry 0 of wd and argv is unused. */

static void handle_events(int fd, int *wd, int argc, char *argv[]) {
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

            /* Print event type. */

            if (event->mask & IN_OPEN) printf("IN_OPEN: ");
            if (event->mask & IN_CLOSE_NOWRITE) printf("IN_CLOSE_NOWRITE: ");
            if (event->mask & IN_CLOSE_WRITE) printf("IN_CLOSE_WRITE: ");

            /* Print the name of the watched directory. */

            for (int i = 1; i < argc; ++i) {
                if (wd[i] == event->wd) {
                    // printf("%d", wd)
                    printf("%s/", argv[i]);
                    break;
                }
            }

            /* Print the name of the file. */

            if (event->len) printf("%s", event->name);

            /* Print type of filesystem object. */

            if (event->mask & IN_ISDIR)
                printf(" [directory]\n");
            else
                printf(" [file]\n");
        }
    }
}

static int add_watch(const char *fpath, const struct stat *sb, int tflag,
                     struct FTW *ftwbuf) {
    int wd = inotify_add_watch(fd, fpath, IN_OPEN | IN_CLOSE | IN_CREATE);
    if (wd == -1) {
        fprintf(stderr, "Cannot watch '%s': %s\n", fpath, strerror(errno));
        exit(EXIT_FAILURE);
    }

    printf("add watch %s\n", fpath);

    return 0; /* To tell nftw() to continue */
}

int main(int argc, char *argv[]) {
    char buf;
    int i, poll_num;
    int *wd;
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

    int flags = 0;

    /* Walk folder recursively and setup watcher for each file */
    if (nftw(argv[1], add_watch, 20, flags) == -1) {
        perror("nftw");
        exit(EXIT_FAILURE);
    }

    /* Prepare for polling. */

    nfds = 2;

    fds[0].fd = STDIN_FILENO; /* Console input */
    fds[0].events = POLLIN;

    fds[1].fd = fd; /* Inotify input */
    fds[1].events = POLLIN;

    /* Wait for events and/or terminal input. */

    printf("Listening for events.\n");
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

                handle_events(fd, wd, argc, argv);
            }
        }
    }

    // printf("Listening for events stopped.\n");

    // /* Close inotify file descriptor. */

    // close(fd);

    // free(wd);
    // exit(EXIT_SUCCESS);
}