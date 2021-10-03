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

const char *argp_program_version = "hello 1.0.0";
const char *argp_program_bug_address = "<bug-gnu-utils@gnu.org>";

/* Program documentation. */
static char doc[] = "hello --exclude node_modules sample-folder";

/* A description of the arguments we accept. */
static char args_doc[] = "FOLDER";

/* The options we understand. */
static struct argp_option options[] = {{"exclude", 'e', 0, 0, "exclude folder"},
                                       {0}};

struct arguments {
    int exclude;
    char *args[1]; /* arg1 */
};

static error_t parse_opt(int key, char *arg, struct argp_state *state) {
    struct arguments *arguments = state->input;
    switch (key) {
        case 'e':
            arguments->exclude = 1;
            break;
        case ARGP_KEY_ARG:
            if (state->arg_num >= 1) /* Too many arguments. */
                argp_usage(state);
            arguments->args[state->arg_num] = arg;
            break;
        case ARGP_KEY_END:
            if (state->arg_num < 1) /* Not enough arguments. */
                argp_usage(state);
            break;
        default:
            return ARGP_ERR_UNKNOWN;
    }
    return 0;
}

static struct argp argp = {options, parse_opt, args_doc, doc};

int main(int argc, char *argv[]) {
    struct arguments arguments;

    /* Default values. */
    // arguments.silent = 0;
    // arguments.verbose = 0;
    // arguments.output_file = "-";

    /* Parse our arguments; every option seen by parse_opt will
       be reflected in arguments. */
    argp_parse(&argp, argc, argv, 0, 0, &arguments);
    watch(argv[1]);
    exit(EXIT_SUCCESS);
}
