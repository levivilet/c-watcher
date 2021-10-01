// TODO remove unused imports
#include <errno.h>
#include <ftw.h>
#include <poll.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/inotify.h>
#include <time.h>
#include <unistd.h>

typedef struct ListNode {
    char *fpath;
    int wd;
    struct ListNode *next;
} ListNode;

/* globals */

/* result of inotify_init */
static int fd;

/* structure for mapping wd to directory path */
static ListNode *head = NULL;

/* end globals */

void storage_print(void *out) {
    ListNode *current = head;
    fprintf(out, "\n----- Storage -----\n");
    while (current != NULL) {
        fprintf(out, "node: %d %s\n", current->wd, current->fpath);
        current = current->next;
    }
    fprintf(out, "\n");
    fprintf(out, "storage print done\n");
}

void storage_print_count() {
    ListNode *current = head;
    int count = 0;
    while (current != NULL) {
        current = current->next;
        count++;
    }
    printf("count: %d\n", count);
}

void storage_add(int wd, const char *fpath) {
    // printf("storage add %s %d\n", fpath, wd);
    // storage_print_count();
    ListNode *new_node = (ListNode *)calloc(1, sizeof(ListNode));
    new_node->wd = wd;
    new_node->fpath = strdup(fpath);
    new_node->next = head;
    head = new_node;
    // current->next = next;
    // current = next;
}

ListNode *storage_find(int wd) {
    ListNode *node = head;
    while (node != NULL) {
        if (node->wd == wd) {
            return node;
        }
        node = node->next;
    }
    return NULL;
}

void storage_rename(const char *moved_from, const char *moved_to) {
    // printf("node check %s %s\n", moved_from, moved_to);
    ListNode *node = head;
    int len_from = strlen(moved_from);
    int len_to = strlen(moved_to);
    while (node != NULL) {
        // fflush(stdout);
        // int len_node = strlen(node->fpath);
        // printf("check %s\n", node);
        // fflush(stdout);
        if (strncmp(moved_from, node->fpath, len_from) == 0) {
            memcpy(node->fpath, moved_to, len_from);
            // // char *new_name;
            // // asprintf
            // printf("MATCH, has been renamed\n");
            // printf("%s\n", node->fpath);
        }
        node = node->next;
    }
}

void storage_remove_by_wd(int wd) {
    // printf("STORAGE REMOVE %d\n", wd);
    ListNode *prev = head;
    ListNode *node = head;
    while (node != NULL) {
        if (node->wd == wd) {
            if (node == head) {
                head = node->next;
            } else {
                prev->next = node->next;
            }
            free(node->fpath);
            free(node);
            return;
        }
        prev = node;
        node = node->next;
    }
    // printf("storage remove error");
    // fflush(stdout);
    // fprintf(stderr, "node is NULL, extremely unlucky user");
    // exit(EXIT_FAILURE);
}

int storage_find_by_path(const char *fpath) {
    ListNode *node = head;
    while (node != NULL) {
        if (strcmp(node->fpath, fpath) == 0) {
            return node->wd;
        }
        node = node->next;
    }
    return -1;
}

int storage_find_and_remove_by_path(const char *fpath) {
    ListNode *prev = head;
    ListNode *node = head;
    while (node != NULL) {
        if (strcmp(node->fpath, fpath) == 0) {
            int wd = node->wd;
            if (node == head) {
                head = node->next;
            } else {
                prev->next = node->next;
            }
            free(node->fpath);
            free(node);
            return wd;
        }
        prev = node;
        node = node->next;
    }
    return -1;
}