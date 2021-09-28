#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/inotify.h>
#include <unistd.h>

int fd = -1;

void notify_init() {
    fd = inotify_init1(IN_NONBLOCK);
    if (fd == -1) {
        perror("inotify_init1");
        exit(EXIT_FAILURE);
    }
}

void notify_dispose() {
    close(fd);
    fd = -1;
}

int notify_add_watch(const char *fpath) {
    int flags = IN_MODIFY | IN_CLOSE_WRITE | IN_MOVED_FROM | IN_MOVED_TO |
                IN_CREATE | IN_DELETE | IN_MOVE_SELF | IN_MOVE;
    // flags = IN_ALL_EVENTS;
    int wd = inotify_add_watch(fd, fpath, flags);
    if (wd == -1) {
        fprintf(stderr, "Cannot watch '%s': %s\n", fpath, strerror(errno));
        exit(EXIT_FAILURE);
    }
    return wd;
}

void notify_remove_watch(int wd) {
    int ok = inotify_rm_watch(fd, wd);
    if (!ok) {
        fprintf(stderr, "Cannot unwatch '%d': %s\n", wd, strerror(errno));
        exit(EXIT_FAILURE);
    }
}
