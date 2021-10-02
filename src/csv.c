// #define _XOPEN_SOURCE 500
#define _GNU_SOURCE

#include <errno.h>
#include <ftw.h>
#include <poll.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/inotify.h>
#include <time.h>
#include <unistd.h>

bool csv_needs_escape(const char* str) {
    int len = strlen(str);
    for (int i = 0; i < len; i++) {
        switch (str[i]) {
            case '"':
            case ',':
            case '\n':
            case ' ':
                return true;
            default:
                break;
        }
    }
    return false;
}

char* csv_escape(char** escaped, const char* str) {
    int len = strlen(str);
    int escapes = 0;
    for (int i = 0; i < len; i++) {
        if (str[i] == '"') {
            escapes++;
        }
    }
    *escaped = malloc(len + escapes + 2);
    int j = 0;
    (*escaped)[j++] = '"';
    for (int i = 0; i < len; i++) {
        if (str[i] == '"') {
            (*escaped)[j++] = '"';
        }
        (*escaped)[j++] = str[i];
    }
    (*escaped)[j++] = '"';
    (*escaped)[j] = '\0';
}