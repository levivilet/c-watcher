// #define _XOPEN_SOURCE 500
#define _GNU_SOURCE

#include <argp.h>
#include <errno.h>
#include <ftw.h>
#include <poll.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/inotify.h>
#include <time.h>
#include <unistd.h>

#include "lib.h"

#define TOOL_NAME "hello"
#define TOOL_VERSION "0.0.1"

static const char short_options[] = "e:hv";

static const struct option long_options[] = {
    {"help", no_argument, 0, 'h'},
    {"version", no_argument, 0, 'v'},
    {"exclude", required_argument, 0, 'e'},
    {0, 0, 0, 0}};

static void print_help() {
    printf("%s %s\n", TOOL_NAME, TOOL_VERSION);
    printf("Recursively watch a folder for changes\n");
    printf("Usage: %s [ options ] sample-folder\n", TOOL_NAME);
    printf("Options:\n");
    printf("\t-h|--help     \tShow this help text.\n");
    printf(
        "\t--exclude <name>\n"
        "\t              \tExclude all events on files matching <name>\n");
}

static void print_usage() {
    printf("Usage: %s [ options ] sample-folder\n", TOOL_NAME);
}

int main(int argc, char* argv[]) {
    opterr = 0;
    char** exclude;
    int excludec = 0;
    int index = 0;
    int c = 0;
    int help = 0;
    int version = 0;
    char* folder = 0;

    while ((c = getopt_long(argc, argv, short_options, long_options, NULL)) !=
           -1) {
        switch (c) {
            case '?':
                print_usage();
                exit(2);
                break;
            case 'e':
                if (optarg == NULL) {
                    print_usage();
                    exit(2);
                }
                excludec++;
                if (excludec == 1) {
                    exclude = malloc(excludec * sizeof(char*));
                    exclude[excludec - 1] = optarg;
                } else {
                    char** old_exclude = exclude;
                    exclude = malloc(excludec * sizeof(char*));
                    for (int i = 0; i < excludec - 1; i++) {
                        exclude[i] = old_exclude[i];
                    }
                    exclude[excludec - 1] = optarg;
                    free(old_exclude);
                }
                break;
            case 'v':
                version = 1;
                break;
            case 'h':
                help = 1;
                break;
            default:
                print_usage();
                exit(EXIT_FAILURE);
        }
    }

    if (version) {
        printf("%s %s\n", TOOL_NAME, TOOL_VERSION);
        exit(EXIT_SUCCESS);
    }
    if (help) {
        print_help();
        exit(EXIT_SUCCESS);
    }
    if (optind < argc) {
        folder = argv[optind];
    } else {
        fprintf(stderr, "No files specified to watch!\n");
        exit(2);
    }
    watch(folder);
    exit(EXIT_SUCCESS);
}
