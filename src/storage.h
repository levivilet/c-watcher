typedef struct ListNode {
    char *fpath;
    int wd;
    struct ListNode *next;
} ListNode;

void storage_print();

void storage_print_count();

void storage_add(int wd, const char *fpath);

ListNode *storage_find(int wd);

void storage_remove_by_wd(int wd);

int storage_find_by_path(const char* fpath);

void storage_rename(const char* oldPath, const char* newPath);
