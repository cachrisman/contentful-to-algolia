
// 2k optimal average record size
// 10k max default record size (can be updated if needed)
// limit content to 1000-5000 characters for a single attribute of text
// add in a hour timer for index refresh + chunking if content is greater than 10mb
// add in complete reindex every so often (once every month)
// remove markdown from long text fields
// split very long text content into
// include lists as arrays of strings, not comma separated list of strings
// custom ranking attribute - include if possible, boolean or numeric, breaks ties between 2 equal textual relevant
// sort attribute -
// multi language records - 2 options: 1) split multiple language (contentful) records into separate (algolia) records one per language, add language field to the algolia record for filtering, 2) different algolia indexes for each language

