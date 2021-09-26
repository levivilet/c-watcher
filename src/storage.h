typedef struct ListNode {
    const char *filename;
    int wd;
    struct ListNode *next;
} ListNode;

void storage_print();

void storage_add(int wd, const char *fpath);

ListNode *storage_find(int wd);
