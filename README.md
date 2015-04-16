[![Build Status](https://travis-ci.org/lakenen/node-box-view.png?branch=master)](https://travis-ci.org/lakenen/node-box-view)

# Box View API Node Client

A node client for the [Box View API](http://developers.box.com/view/)


## Installation

```
npm install box-view
```


## Usage

Create a client:
```js
var myKey = process.env.BOX_VIEW_API_TOKEN;
var client = require('box-view').createClient(myKey);
```

See the [Box View API Documentation](http://developers.box.com/view/) for a list of available endpoints and their parameters.

### Documents

#### list

`client.documents.list(options, callback)`

Fetch a list of documents uploaded using this API key.

* `[options]` - (`object`) An optional set of options for the request
    * `[options.params]` - (`object`) An optional map of URL parameters for filtering documents
    * `[options.params.limit]` - (`int`) The number of documents to return (default: 10, max: 50)
    * `[options.params.created_before]` - (`Date`) An upper limit on the creation timestamps of documents returned (default: now)
    * `[options.params.created_after]` - (`Date`)  A lower limit on the creation timestamps of documents returned
    * `[options.retry]` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)
* `[callback]` - (`Function`) A callback to call with the following arguments:
    * an error object or `null`
    * JSON-parsed response data
    * the http response object

Example:
```js
client.documents.list(function (err, list, res) {
    // `list` is the JSON-parsed response body
    // `res` is the HTTP Response object
    console.log(list);
});
```

#### get

`client.documents.get(id, options, callback)`

Fetch the metadata for a single document.

* `id` - (`string`) The document uuid
* `[options]` - (`object`) An optional set of options for the request
    * `[options.fields]` - (`Array` or `string`) An optional array or comma-separated list of fields to return (e.g., `['name', 'status']` or `'name,status'`); id and type are always returned
    * `[options.retry]` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)
* `[callback]` - (`Function`) A callback to call with the following arguments:
    * an error object or `null`
    * JSON-parsed response data
    * the http response object

Example:
```js
client.documents.get('some document id', function (err, doc, res) {
    // `doc` is the JSON-parsed response body
    // `res` is the HTTP Response object
    console.log(doc);
});
```

#### update

`client.documents.update(id, data, options, callback)`

Update the metadata for a single document.

* `id` - (`string`) The document uuid
* `data` - (`object`) The new metadata (currently only `name` is supported)
* `[options]` - (`object`) An optional set of options for the request
    * `[options.retry]` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)
* `[callback]` - (`Function`) A callback to call with the following arguments:
    * an error object or `null`
    * JSON-parsed response data
    * the http response object

#### delete (documents)

`client.documents.delete(id, options, callback)`

Delete a single document.

* `id` - (`string`) The document uuid
* `[options]` - (`object`) An optional set of options for the request
    * `[options.retry]` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)
* `[callback]` - (`Function`) A callback to call with the following arguments:
    * an error object or `null`
    * JSON-parsed body if error
    * the http response object if error

#### uploadFile

`client.documents.uploadFile(file, options, callback)`

Do a multipart upload.

**NOTE: the `retry` option is not supported for multipart uploads (uploads specified via string filename or Stream.**

* `file` - (`string` or `stream.Readable` or `File` or `Buffer`) A path to a file to read, a readable stream, a File object (e.g., in a browser), or a Buffer
* `[options]` - (`object`) An optional set of options for the request
    * `[options.params]` - (`object`) An optional map of upload parameters
    * `[options.params.name]` - (`string`) The name of the file. If `options.params.name` is not set, it will be inferred from the file path.
    * `[options.params.thumbnails]` - (`string`) Comma-separated list of thumbnail dimensions of the format `{width}x{height}` (e.g. `'128×128,256×256'`) – width can be between 16 and 1024, height between 16 and 768
    * `[options.params.non_svg]` - (`boolean`) Whether to also create the non-svg version of the document
    * `[options.retry]` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`). *See above note about retry support for streams.*
* `[callback]` - (`Function`) A callback to call with the following arguments:
    * an error object or `null`
    * JSON-parsed response data
    * the http response object

#### uploadURL

`client.documents.uploadURL(url, options, callback)`

Do a URL upload of a file.

* `[url]` - (`string`) A URL to a publicly-accessible file to upload
* `[options]` - (`object`) An optional set of options for the request
    * `[options.params]` - (`object`) An optional map of upload parameters
    * `[options.params.name]` - (`string`) The name of the file. If `options.params.name` is not set, it will be inferred from the URL.
    * `[options.params.thumbnails]` - (`string`) Comma-separated list of thumbnail dimensions of the format `{width}x{height}` (e.g. `'128×128,256×256'`) – width can be between 16 and 1024, height between 16 and 768
    * `[options.params.non_svg]` - (`boolean`) Whether to also create the non-svg version of the document
    * `[options.retry]` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)
* `[callback]` - (`Function`) A callback to call with the following arguments:
    * an error object or `null`
    * JSON-parsed response data
    * the http response object

#### getContent

`client.documents.getContent(id, options, callback)`

Fetch a document of a specified format.

* If an extension is not specified, the document's original format is returned.
* `id` - (`string`) The document uuid
* `[options]` - (`object`) An optional set of options for the request
    * `[options.extension]` - (`string`) Optional document format to request (`'pdf'` or `'zip'`). If excluded, the original document format will be returned.
    * `[options.retry]` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)
* `[callback]` - (`Function`) A callback to call with the following arguments:
    * an error object or `null`
    * the http response object (or JSON-parsed body if error)
    * the http response object if error

Example:
```js
client.documents.getContent(id, { extension: 'zip' }, function (err, res) {
    if (err) {
        console.error(err);
        return;
    }

    // `res` is the HTTP Response object
    res.pipe(fs.createWriteStream('./doc.zip'));
});
```

#### getThumbnail

`client.documents.getThumbnail(id, width, height, options, callback)`

Fetch a thumbnail for the given document id.

* `id` - (`string`) The document uuid
* `width` - (`int`) The thumbnail width
* `height` - (`int`) The thumbnail height
* `[options]` - (`object`) An optional set of options for the request
    * `[options.retry]` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)
* `[callback]` - (`Function`) A callback to call with the following arguments:
    * an error object or `null`
    * the http response object (or JSON-parsed body if error)
    * the http response object if error

Example:
```js
client.documents.getThumbnail(id, params, function (err, res) {
    if (err) {
        console.error(err);
        return;
    }

    // `res` is the HTTP Response object
    res.pipe(fs.createWriteStream('./thumbnail.png'));
});
```

### Sessions

#### create

`client.sessions.create(id, options, callback)`

Request a viewing session for a document.

* `[id]` - (`string`) The document uuid
* `[options]` - (`object`) An optional set of options for the request
    * `[options.params]` - (`object`) An optional map of session parameters
    * `[options.params.duration]` - (`int`) The duration in minutes until the session expires (default: 60)
    * `[options.params.expires_at]` - (`Date`) The timestamp at which the session should expire
    * `[options.params.is_downloadable]` - (`boolean`) Whether the original file will be available for download via GET /sessions/{id}/content while the session is active
    * `[options.retry]` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)
* `[callback]` - (`Function`) A callback to call with the following arguments:
    * an error object or `null`
    * JSON-parsed response data
    * the http response object

#### delete (sessions)

`client.sessions.delete(id, options, callback)`

Delete a single session.

* `id` - (`string`) The session uuid
* `[options]` - (`object`) An optional set of options for the request
    * `[options.retry]` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)
* `[callback]` - (`Function`) A callback to call with the following arguments:
    * an error object or `null`
    * JSON-parsed body if error
    * the http response object if error


## Running Tests

Make sure you have the development dependencies installed by running `npm install`, then you should be able to run the tests with `npm test`.


## API Support

For any bugs or feedback with conversion or the API in general, please email api@box.com.


## License

([The MIT License](LICENSE))

Copyright 2014 Cameron Lakenen
