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
    // printf("ADD WATCH %s\n", fpath);
    int flags = IN_MODIFY | IN_CLOSE_WRITE | IN_MOVED_FROM | IN_MOVED_TO |
                IN_CREATE | IN_DELETE;
    // flags = IN_ALL_EVENTS;
    // IN_IGNORED
    int wd = inotify_add_watch(fd, fpath, flags);
    if (wd == -1) {
        fprintf(stderr, "Cannot watch '%s': %s\n", fpath, strerror(errno));
        exit(EXIT_FAILURE);
    }
    // printf("wd %d\n", wd);
    return wd;
}

void notify_remove_watch(int wd) {
    // return;
    // printf("RM WATCH %d\n", wd);
    int status = inotify_rm_watch(fd, wd);
    if (status == -1) {
        // printf("%d\n", wd);
        // printf("%d\n", status);
        printf("not ok %s\n", strerror(errno));
        fprintf(stderr, "Cannot unwatch '%d': %s\n", wd, strerror(errno));
        fflush(stderr);
        exit(EXIT_FAILURE);
    }
}
