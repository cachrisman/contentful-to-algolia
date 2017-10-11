const fs = require('fs')
const contentful = require('contentful')
const algoliasearch = require('algoliasearch')
const listener = require("contentful-webhook-listener")
const webhook = listener.createServer()
const sync_token_file = __dirname + 'syncToken'

// settings
const PORT = 5000
const CONTENTFUL_SPACE_ID = 'contentful_space_id'
const CONTENTFUL_ACCESS_TOKEN = 'contentful_delivery_api_token'
const ALGOLIA_APP_ID = 'app_id'
const ALGOLIA_ADMIN_API_KEY = 'admin_api_key'
const ALGOLIA_INDEX_NAME = 'index_name'
// optional, comment out or set to '' if not using
// see https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/synchronization for details
const CONTENTFUL_SYNC_TYPE = 'Entry'
//optional, comment out or set to '' if not using
const CONTENTFUL_CONTENT_TYPE = 'post'
// time in seconds to wait after receiving publish webhook event before running subsequentSync
const CONTENTFUL_SYNC_DELAY = 60
// end of settings

// instantiate the contentful client with the appropriate space id and api token
const contentful_client = contentful.createClient({
  space: CONTENTFUL_SPACE_ID,
  accessToken: CONTENTFUL_ACCESS_TOKEN
})

// instantiate the algolia client with the appropriate app id, admin api token and setup the index
const algolia_client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_API_KEY)
const algolia_index = algolia_client.initIndex(ALGOLIA_INDEX_NAME)

// store this somewhere to be used in the webhook listener
let nextSyncToken

// if sync_token_file exists, we read the next sync token from file
if (fs.existsSync(__dirname + sync_token_file)) {
  nextSyncToken = fs.readFilesync(__dirname + sync_token_file, 'utf8')
}

function initialSync() {
  // set options
  let options = {initial: true}
  if (CONTENTFUL_SYNC_TYPE) options.type = CONTENTFUL_SYNC_TYPE
  if (CONTENTFUL_CONTENT_TYPE) options.content_type = CONTENTFUL_CONTENT_TYPE

  // make the initial sync of the contentful space
  contentful_client.sync(options).then((response) => {
    let entries = response.entries
    nextSyncToken = response.nextSyncToken
    fs.writeFileSync(data_dir + file, nextSyncToken)

    // transform the contentful entries to include an objectID (which Algolia wants)
    // and to exclude the extraneous data (like the sys object)
    var _entries = entries.map(entry => {
      return Object.assign({}, {objectID: entry.sys.id}, entry.fields)
    })

    // add the transformed entries to the Algolia index
    algolia_index.addObjects(_entries, function(err, content) {
      if (err) console.error(err)
    })
  }).catch(console.error)
}

async function subsequentSync () {
  // set options
  let options = {nextSyncToken: nextSyncToken}
  if (CONTENTFUL_SYNC_TYPE) options.type = CONTENTFUL_SYNC_TYPE
  if (CONTENTFUL_CONTENT_TYPE) options.content_type = CONTENTFUL_CONTENT_TYPE

  // grab the updated content from Contentful using the nextSyncToken from the previous execution of the sync
  contentful_client.sync(options).then((response) => {
    let new_or_updated_entries = response.entries
    nextSyncToken = response.nextSyncToken
    fs.writeFileSync(data_dir + file, nextSyncToken)

    // same as before: transform the contentful entries to include an objectID (which Algolia
    // wants) and to exclude the extraneous data (like the sys object)
    var _new_or_updated_entries = new_or_updated_entries.map(entry => {
      return Object.assign({}, {objectID: entry.sys.id}, entry.fields)
    })

    // same as before: add the transformed updated/new entries to the Algolia index
    algolia_index.addObjects(_new_or_updated_entries, function(err, content) {
      if (err) console.error(err)
    })
  }).catch(console.error)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms*1000))
}

// This next bit runs a webhook processor listening for the contentful publish event.
// There is some delay built in because it takes a bit of time for the newly published
// entries to be copied over to the delivery infrastructure and made available to the Sync API.
// Test it out to see what works and perhaps something much quicker could work but a few minutes
// should definitely be adequate.
webhook.on("publish", async function (payload) {
  await sleep(CONTENTFUL_SYNC_DELAY)
  subsequentSync()
})

webhook.listen(PORT)

// if the next sync token hasn't been set, run the initial sync of content into algolia
if (!nextSyncToken)
  initialSync()
