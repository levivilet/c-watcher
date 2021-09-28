#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct ListNode {
    const char *fpath;
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
        // printf("iteration %d\n", node->wd);
        node = node->next;
        if (node->wd == wd) {
            return node;
        }
    }
    fprintf(stderr, "node is NULL, extremely unlucky user");
    exit(EXIT_FAILURE);
}

void storage_remove(int wd) {
    // printf("STORAGE REMOVE %d\n", wd);
    ListNode *prev = head;
    ListNode *node = head;
    while (node != NULL) {
        prev = node;
        node = node->next;
        if (node->wd == wd) {
            prev->next = node->next;
            free(node);
            return;
        }
    }
    fprintf(stderr, "node is NULL, extremely unlucky user");
    exit(EXIT_FAILURE);
}