
#define _XOPEN_SOURCE 500
#include <ftw.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int visit_dirent(const char *fpath, const struct stat *sb, int tflag,
                        struct FTW *ftwbuf) {
    printf("%-3s  ", (tflag == FTW_D)     ? "d"
                     : (tflag == FTW_DNR) ? "dnr"
                     : (tflag == FTW_DP)  ? "dp"
                     : (tflag == FTW_F)   ? "f"
                     : (tflag == FTW_NS)  ? "ns"
                     : (tflag == FTW_SL)  ? "sl"
                     : (tflag == FTW_SLN) ? "sln"
                                          : "???");

    printf("   %-40s \n", fpath);

    return 0; /* To tell nftw() to continue */
}

int main(int argc, char *argv[]) {
    int flags = 0;

    if (argc > 2 && strchr(argv[2], 'd') != NULL) flags |= FTW_DEPTH;
    if (argc > 2 && strchr(argv[2], 'p') != NULL) flags |= FTW_PHYS;

    if (nftw((argc < 2) ? "." : argv[1], visit_dirent, 20, flags) == -1) {
        perror("nftw");
        exit(EXIT_FAILURE);
    }

    exit(EXIT_SUCCESS);
}
