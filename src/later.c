void csv_scape(char** escaped, char* str) {
    int len = strlen(str);
    char quote = '"';
    fwrite(&quote, sizeof(int), 1, out);
    for (int i = 0; i < len; i++) {
        if (str[i] == '"') {
            fwrite(&quote, sizeof(int), 1, out);
        }
        fwrite(&str[i], sizeof(int), 1, out);
    }
    fwrite(&quote, sizeof(int), 1, out);
    fwrite(0, sizeof(int), 1, out);
}