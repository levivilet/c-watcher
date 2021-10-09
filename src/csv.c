#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

bool csv_needs_escape(const char* str) {
    size_t i = 0;
    while (str[i++] != '\0') {
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

void csv_escape(char** escaped, const char* str) {
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