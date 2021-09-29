
void notify_init();

void notify_dispose();

int notify_add_watch(const char *fpath);

void notify_remove_watch(int wd);

void notify_print_event();