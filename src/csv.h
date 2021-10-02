#include <stdbool.h>

bool csv_needs_escape(const char* str);

void csv_escape(char** escaped, const char* str);
