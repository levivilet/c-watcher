typedef struct ListNode {
    const char *fpath;
    int wd;
    struct ListNode *next;
} ListNode;

void storage_print();

void storage_add(int wd, const char *fpath);

ListNode *storage_find(int wd);

void storage_remove_by_wd(int wd);

void storage_remove_by_path(const char* fpath);

int storage_find_by_path(const char* fpath);

void storage_rename(const char* oldPath, const char* newPath);
