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
static ListNode EMPTY_NODE = {"", 0};
static ListNode *head = &EMPTY_NODE;
static ListNode *current = &EMPTY_NODE;

/* end globals */

void storage_print() {
    ListNode *current = head;
    printf("\n----- Storage -----\n");
    while (current != NULL) {
        printf("node: %d %s\n", current->wd, current->fpath);
        current = current->next;
    }
    printf("\n");
}

void storage_add(int wd, const char *fpath) {
    // printf("storage add %s %d\n", fpath, wd);
    // storage_print();
    ListNode *next = (ListNode *)calloc(1, sizeof(ListNode));
    next->wd = wd;
    next->fpath = strdup(fpath);
    current->next = next;
    current = next;
}

ListNode *storage_find(int wd) {
    ListNode *node = head;
    while (node != NULL) {
        if (node->wd == wd) {
            return node;
        }
        node = node->next;
    }
    printf("ERR %d\n", wd);
    fflush(stdout);
    fprintf(stderr, "node is NULL, extremely unlucky user");
    exit(EXIT_FAILURE);
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
            memcpy(node->fpath, moved_to, len_to);
            // // char *new_name;
            // // asprintf
            // printf("MATCH, has been renamed\n");
            // printf("%s\n", node->fpath);
        }
        node = node->next;
    }
    // free(moved_from);
    // free(moved_to);
}

void storage_remove_by_wd(int wd) {
    // printf("STORAGE REMOVE %d\n", wd);
    ListNode *prev = head;
    ListNode *node = head;
    while (node != NULL) {
        if (node->wd == wd) {
            prev->next = node->next;
            free(node);
            return;
        }
        prev = node;
        node = node->next;
    }
    fprintf(stderr, "node is NULL, extremely unlucky user");
    exit(EXIT_FAILURE);
}

int storage_find_by_path(const char *fpath) {
    // ListNode *prev = head;
    ListNode *node = head;
    while (node != NULL) {
        if (strcmp(node->fpath, fpath) == 0) {
            // prev->next = node->next;
            // int wd = node->wd;
            // free(node);
            return node->wd;
        }
        // prev = node;
        node = node->next;
    }
    fprintf(stderr, "node is NULL, extremely unlucky user");
    exit(EXIT_FAILURE);
    return -1;
}