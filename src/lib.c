// #define _XOPEN_SOURCE 500
#define _GNU_SOURCE

#include <errno.h>
#include <ftw.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/inotify.h>
#include <time.h>
#include <unistd.h>

#include "csv.h"
#include "notify.h"
#include "storage.h"

extern int fd;
char **exclude;
int excludec = 0;

char *moved_from = 0;

const char *get_event_string(const struct inotify_event *event) {
    switch (event->mask) {
        case /* IN_ISDIR | IN_ATTRIB |  */ 1073741828:
            return "ATTRIB_DIR";
        case /* IN_ISDIR | IN_CREATE */ 1073742080:
            return "CREATE_DIR";
        case /* IN_ISDIR | IN_MODIFY */ 1073741826:
            return "MODIFY_DIR";
        case /* IN_ISDIR | IN_OPEN */ 1073741856:
            return "OPEN_DIR";
        case /* IN_ISDIR | IN_DELETE */ 1073742336:
            return "DELETE_DIR";
        case /* IN_ISDIR | IN_MOVED_FROM */ 1073741888:
            return "MOVED_FROM_DIR";
        case /* IN_ISDIR | IN_MOVED_TO */ 1073741952:
            return "MOVED_TO_DIR";
        case /* IN_ACCESS */ 1:
            return "ACCESS";
        case /* IN_ATTRIB */ 4:
            return "ATTRIB";
        case /* IN_CLOSE_WRITE */ 8:
            return "CLOSE_WRITE";
        case /* IN_CLOSE_NOWRITE */ 16:
            return "CLOSE_NOWRITE";
        case /* IN_CREATE */ 256:
            return "CREATE";
        case /* IN_DELETE */ 512:
            return "DELETE";
        case /* IN_MODIFY */ 2:
            return "MODIFY";
        case /* IN_MOVED_FROM */ 64:
            return "MOVED_FROM";
        case /* IN_MOVED_TO */ 128:
            return "MOVED_TO";
        case /* IN_OPEN */ 32:
            return "OPEN";
        default:
            return 0;
    }
}

static bool is_excluded_folder(const char *fpath) {
    char *slash = strrchr(fpath, '/');
    for (int i = 0; i < excludec; i++) {
        if (slash && !strcmp(slash + 1, exclude[i])) {
            return true;
        }
    }
    return false;
}

static void full_path(char **fpath, const struct inotify_event *event) {
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
    // fprintf(fp, "ADD WATCH %d %s\n", wd, fpath);

    // TODO use dynamic array (or better tree)
    storage_add(wd, fpath);
    // storage_print(fp);
    // storage_print();
}

static void remove_watch_by_path(const char *fpath) {
    storage_find_and_remove_by_path(fpath, notify_remove_watch);
}

static int visit_dirent(const char *fpath, const struct stat *sb, int tflag,
                        struct FTW *ftwbuf) {
    // printf("visit %s\n", fpath);
    // TODO use base to get basename
    if (tflag == FTW_D) {
        if (is_excluded_folder(fpath)) {
            // printf("is excluded %s\n", fpath);
            return FTW_SKIP_SUBTREE;
        }
        add_watch(fpath);
    }
    return FTW_CONTINUE;
}

/* Walk folder recursively and setup watcher for each file */
static void watch_recursively(const char *dir) {
    // fprintf(fp, "watch recursively %s\n", dir);
    int flags = FTW_PHYS | FTW_ACTIONRETVAL;
    // TODO tweak amount of descriptors to tweak performance
    int descriptors = 255;
    if (nftw(dir, visit_dirent, descriptors, flags) == -1) {
        if (errno == ENOENT) {
            printf("ENOENT\n");
            // folder might have already been removed
            return;
        }
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
            printf("access");
        } else if (errno == ENOENT) {
            printf("enoent");
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
    // TODO put this after getting node
    const char *event_string = get_event_string(event);
    if (!event->len || !event_string) {
        return;
    }
    ListNode *node = storage_find(event->wd);
    // node can be null if there is a moved out event and
    // then a file create event inside the moved out folder.
    if (node == NULL) {
        return;
    }
    if (csv_needs_escape(node->fpath) || csv_needs_escape(event->name)) {
        char *fpath;
        char *escaped;
        full_path(&fpath, event);
        csv_escape(&escaped, fpath);
        fprintf(stdout, "%s,%s\n", escaped, event_string);
        free(escaped);
        free(fpath);
    } else {
        fprintf(stdout, "%s/%s,%s\n", node->fpath, event->name, event_string);
    }
    // TODO more efficient buffer handling
    fflush(stdout);
}

static void adjust_watchers(const struct inotify_event *event) {
    // printf("EVENT LENGTH %d\n", event->len);
    // printf("EVENT NAME %s\n", event->name);

    if (moved_from) {
        // fprintf(stdout, "HAS MOVED FROM EVENT POTENTIAL RENAME\n");
        // TODO check cookie
        if (event->mask & IN_ISDIR && event->mask & IN_MOVED_TO) {
            // fprintf(fp, "moved from name %s\n", moved_from);
            // fprintf(fp, "moved to name %s\n", event->name);
            // fprintf(fp, "printing events again");
            // notify_print_event(moved_from_event, fp);
            // notify_print_event(event, fp);
            // fprintf(fp, "done printing events again");
            // matching event -> rename
            // just rename, keep watches
            // fprintf(fp, "RENAME keep watch inside\n");

            char *moved_to;
            full_path(&moved_to, event);

            if (is_excluded_folder(moved_from) &&
                !is_excluded_folder(moved_to)) {
                // printf("add watch yes %s\n", moved_to);
                // storage_add
                add_watch(moved_to);
            } else if (!is_excluded_folder(moved_from) &&
                       is_excluded_folder(moved_to)) {
                //    printf("rm watch")
                remove_watch_by_path(moved_from);
            }

            storage_rename(moved_from, moved_to);

            // storage_print();
            // fprintf(fp, "moved from %s\n", moved_from);
            // fprintf(fp, "moved to %s\n", moved_to);
            // printf("storage rename\n");
            // fflush(stdout);
            // storage_print();
            free(moved_from);
            moved_from = 0;
            free(moved_to);
            // storage_print();
            // printf("done storage rename\n");
            // fflush(stdout);
            // printf("new full path %s\n", fpath);
            return;
        }
        // moved outside -> remove watch
        // fprintf(fp, "NO RENAME, just ignored folder %s\n", fpath);
        // printf("event %s\n", event->name);
        // storage_print();
        // printf("fpath: %s\n", fpath);
        // printf("remove watch %d\n", event->wd);
        remove_watch_by_path(moved_from);
        free(moved_from);
        moved_from = 0;
        // storage_print(fp);
    }

    if (!(event->mask & IN_ISDIR)) {
        if (event->mask & IN_IGNORED) {
            // folder has been ignored -> remove from storage
            // fprintf(fp, "!!!IGNORED!!! %d\n", event->wd);
            // fprintf(fp, "LEN %d\n", event->len);
            // if (event->len) {
            // fprintf(fp, "NAME %s\n", event->name);
            // }
            // fprintf(fp, "IS DIR %d\n", event->mask & IN_ISDIR);
            storage_remove_by_wd(event->wd);
            return;
        }
        return;
    }

    // fprintf(fp, "normal, no moved_from event\n");
    if ((event->mask & IN_CREATE) || event->mask & IN_MOVED_TO) {
        // new folder -> add watcher
        char *fpath;
        full_path(&fpath, event);
        if (!is_excluded_folder(fpath)) {
            watch_recursively(fpath);
        }
        free(fpath);
    }
    // if(event->mask & IN_DELETE){

    // }
    if (event->mask & IN_MOVED_FROM) {
        // fprintf(fp, "SET MOVED_FROM EVENT\n");
        // fprintf(fp, "SET MOVED_FROM EVENT NAME %s\n", event->name);
        full_path(&moved_from, event);
        // printf("MOVED from, from%s %d\n", moved_from->fpath,
        //        event->wd);
        // printf("%s\n", event->name);
    }

    if (event->mask & IN_Q_OVERFLOW) {
        fprintf(stdout, "queue overflow\n");
        fflush(stdout);
        fprintf(stderr, "Inotify event queue overflow.\n");
        exit(EXIT_FAILURE);
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
        // fprintf(fp, "LOOP ITERATION\n");
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
            // fprintf(fp, "start___\n");
            // notify_print_event(event, fp);
            // storage_print(fp);
            adjust_watchers(event);
            output_event(event);
            // notify_print_event(event, fp);
            // fprintf(fp, "end___\n\n");

            // printf("iterate\n");
        }
    }

    if (moved_from) {
        // trailing moved_from event
        // fprintf(fp, "trailing moved_from_event\n");
        remove_watch_by_path(moved_from);
        free(moved_from);
        moved_from = 0;
        // storage_print(fp);
        // printf("done\n");
    }
    // fflush(stdout);
}

void watch(const char *folder) {
    // TODO pass exclude to global exclude
    char buf;
    int poll_num;
    nfds_t nfds;
    struct pollfd fds[2];

    notify_init();

    fprintf(stderr, "Setting up watches. This may take a while!\n");
    clock_t start = clock();

    watch_recursively(folder);

    /*Do something*/
    clock_t end = clock();
    float seconds = (float)(end - start) / CLOCKS_PER_SEC;
    fprintf(stderr, "Took %f\n", seconds);
    fprintf(stderr, "Watches established.\n");

    // storage_print();

    /* Prepare for polling. */

    nfds = 1;

    fds[0].fd = fd; /* Inotify input */
    fds[0].events = POLLIN;

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
                /* Inotify events are available. */
                handle_events(fd);
            }
        }
    }

    printf("Listening for events stopped.\n");

    /* Close inotify file descriptor. */

    notify_dispose();
}
