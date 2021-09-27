typedef struct ListNode {
    const char *fpath;
    int wd;
    struct ListNode *next;
} ListNode;

void storage_print();

void storage_add(int wd, const char *fpath);

ListNode *storage_find(int wd);

void storage_remove(int wd);
