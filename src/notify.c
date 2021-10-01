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

void notify_print_event(const struct inotify_event *event, void *out) {
    fprintf(out, "\n");
    fprintf(out, "Event\n");
    if (event->len) {
        fprintf(out, "name %s\n", event->name);
    }
    fprintf(out, "wd %d\n", event->wd);
    if (event->mask & IN_OPEN) fprintf(out, "type OPEN\n");
    if (event->mask & IN_CLOSE_NOWRITE) fprintf(out, "type CLOSE_NOWRITE\n");
    if (event->mask & IN_CLOSE_WRITE) fprintf(out, "type CLOSE_WRITE\n");
    if (event->mask & IN_ACCESS) fprintf(out, "type ACCESS\n");
    if (event->mask & IN_MODIFY) fprintf(out, "type MODIFY\n");
    if (event->mask & IN_ATTRIB) fprintf(out, "type ATTRIB\n");
    if (event->mask & IN_OPEN) fprintf(out, "type OPEN\n");
    if (event->mask & IN_CREATE) fprintf(out, "type CREATE\n");
    if (event->mask & IN_DELETE) fprintf(out, "type DELETE\n");
    if (event->mask & IN_DELETE_SELF) fprintf(out, "type DELETE_SELF\n");
    if (event->mask & IN_ISDIR) fprintf(out, "type ISDIR\n");
    // if (event->mask & IN_ISDIR) fprintf(out,"type IN_ISDIR\n");
    if (event->mask & IN_MOVED_FROM) fprintf(out, "type MOVED_FROM\n");
    if (event->mask & IN_MOVED_TO) fprintf(out, "type MOVED_TO\n");
    if (event->mask & IN_MOVE) fprintf(out, "type MOVE\n");
    // if (event->mask & IN_MODIFY) fprintf(out,"type MODIFY\n");
    // if (event->mask & IN_DELETE_SELF) fprintf(out,"type DELETESELF\n");
    if (event->mask & IN_MOVE_SELF) fprintf(out, "type MOVE_SELF\n");
    if (event->mask & IN_ACCESS) fprintf(out, "type ACCESS\n");
    if (event->mask & IN_IGNORED) fprintf(out, "type IGNORED\n");
    fprintf(out, "\n");
}