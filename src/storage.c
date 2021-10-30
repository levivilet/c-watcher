#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct ListNode {
    char *fpath;
    int wd;
    struct ListNode *next;
} ListNode;

static ListNode *head = NULL;

void storage_print(void *out) {
    ListNode *current = head;
    fprintf(out, "\n----- Storage -----\n");
    while (current != NULL) {
        fprintf(out, "node: %d %s\n", current->wd, current->fpath);
        current = current->next;
    }
    fprintf(out, "\n");
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
    ListNode *new_node = (ListNode *)malloc(sizeof(ListNode));
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
    // int len_to = strlen(moved_to);
    // bool found = false;

    // /tmp/a
    // /tmp/a/b
    // /tmp/a/b/c

    // /tmp/f2
    // /tmp/f2/b
    // /tmp/f2/b/c
    while (node != NULL) {
        // fflush(stdout);
        // int len_node = strlen(node->fpath);
        // printf("check %s\n", node);
        // fflush(stdout);
        // TODO bug
        if (strncmp(moved_from, node->fpath, len_from) == 0) {
            // TODO need use malloc and free when len_to is greater than
            // len_from
            if (len_from == len_to) {
                memcpy(node->fpath, moved_to, len_from);
            } else {
                int count = strlen(node->fpath) + len_to - len_from + 1;
                char *oldPath = node->fpath;
                node->fpath = malloc(count);
                int max = len_to > len_from ? len_to : len_from;
                memcpy(node->fpath, moved_to, max);
                memcpy(node->fpath + max, oldPath + len_from, count - max);
                free(oldPath);
            }
            // found = true;
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
    // fprintf(stdout, "rm path %s\n", node->fpath);
    // fflush(stdout);
    while (node != NULL) {
        if (node->wd == wd) {
            if (node == head) {
                head = node->next;
            } else {
                prev->next = node->next;
            }
            // fprintf(stdout, "found node\n");
            // fflush(stdout);
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

void storage_find_and_remove_by_path(const char *fpath, void (*cb)(int wd)) {
    ListNode *prev = head;
    ListNode *node = head;
    int len = strlen(fpath);
    while (node != NULL) {
        // fprintf(stdout, "compare %s with %s\n", fpath, node->fpath);
        if (strncmp(node->fpath, fpath, len) == 0 &&
            (strlen(node->fpath) == len || node->fpath[len] == '/')) {
            int wd = node->wd;
            // fprintf(stdout, "found wd %d\n", wd);
            // fflush(stdout);
            cb(wd);
            if (node == head) {
                head = node->next;
            } else {
                prev->next = node->next;
            }
            free(node->fpath);
            free(node);
        }
        prev = node;
        node = node->next;
    }
}