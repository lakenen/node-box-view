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

`client.documents.list([params,] callback [,retry])`

Fetch a list of documents uploaded using this API key.
* `params` - (`object`) An optional map of URL parameters for filtering documents
* `params.limit` - (`int`) The number of documents to return (default: 10, max: 50)
* `params.created_before` - (`Date`) An upper limit on the creation timestamps of documents returned (default: now)
* `params.created_after` - (`Date`)  A lower limit on the creation timestamps of documents returned
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)
* `retry` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)

#### get

`client.documents.get(id, [fields,] callback [,retry])`

Fetch the metadata for a single document.
* `id` - (`string`) The document uuid
* `fields` - (`Array` or `string`) An optional array or comma-separated list of fields to return (e.g., `['name', 'status']` or `'name,status'`); id and type are always returned
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)
* `retry` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)

#### update

`client.documents.update(id, data, callback [,retry])`

Update the metadata for a single document
* `id` - (`string`) The document uuid
* `data` - (`object`) The new metadata (currently only `name` is supported)
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)
* `retry` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)

#### delete

`client.documents.delete(id, callback [,retry])`

Delete a single document
* `id` - (`string`) The document uuid
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)
* `retry` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)

#### uploadFile

`client.documents.uploadFile(file, [params,] callback [,retry])`

Do a multipart upload
* `file` - (`string` or `stream.Readable` or `File` or `Buffer`) A path to a file to read, a readable stream, a File object (e.g., in a browser), or a Buffer
* `params` - (`object`) An optional map of upload parameters
* `params.name` - (`string`) The name of the file. If `params.name` is not set, it will be inferred from the file path.
* `params.thumbnails` - (`string`) Comma-separated list of thumbnail dimensions of the format `{width}x{height}` (e.g. `'128×128,256×256'`) – width can be between 16 and 1024, height between 16 and 768
* `params.non_svg` - (`boolean`) Whether to also create the non-svg version of the document
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)
* `retry` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)

#### uploadURL

`client.documents.uploadURL(url, [params,] callback [,retry])`

Do a URL upload of a file
* `url` - (`string`) A URL to a publicly-accessible file to upload
* `params` - (`object`) An optional map of upload parameters
* `params.name` - (`string`) The name of the file. If `params.name` is not set, it will be inferred from the URL.
* `params.thumbnails` - (`string`) Comma-separated list of thumbnail dimensions of the format `{width}x{height}` (e.g. `'128×128,256×256'`) – width can be between 16 and 1024, height between 16 and 768
* `params.non_svg` - (`boolean`) Whether to also create the non-svg version of the document
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)
* `retry` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)

#### getContent

`client.documents.getContent(id, [extension,] callback [,retry])`

Fetches a document of a specified format.
* If an extension is not specified, the document’s original format is returned.
* `id` - (`string`) The document uuid
* `extension` - (`string`) Optional document format to request (`'pdf'` or `'zip'`). If excluded, the original document format will be returned.
* `callback` - (`function(error, response)`) A callback to call with the response (or error)
* `retry` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)

Example:
```js
client.documents.getContent(id, 'zip', function (err, res) {
    var file;
    if (err) {
        console.log(err);
        return;
    }

    file = fs.createWriteStream('./doc.zip');
    file.on('finish', function() {
        file.close();
    });
    res.pipe(file);
});
```

#### getThumbnail

`client.documents.getThumbnail(id, params, callback [,retry])`

Fetches a thumbnail for the given document id
* `id` - (`string`) The document uuid
* `params` - (`object`) The thumbnail params (**required**)
* `params.width` - (`int`) The thumbnail width
* `params.height` - (`int`) The thumbnail height
* `callback` - (`function(error, response)`) A callback to call with the response (or error)
* `retry` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)

Example:
```js
client.documents.getThumbnail(id, params, function (err, res) {
    var file;
    if (err) {
        console.log(err);
        return;
    }

    file = fs.createWriteStream('./thumbnail.png');
    file.on('finish', function() {
        file.close();
    });
    res.pipe(file);
});
```

### Sessions

#### create

`client.sessions.create(id, [params,] callback [,retry])`

Request a viewing session for a document
* `id` - (`string`) The document uuid
* `params` - (`object`) An optional map of session parameters
* `params.duration` - (`int`) The duration in minutes until the session expires (default: 60)
* `params.expires_at` - (`Date`) The timestamp at which the session should expire
* `params.is_downloadable` - (`boolean`) Whether the original file will be available for download via GET /sessions/{id}/content while the session is active
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)
* `retry` - (`boolean`) Whether to retry the request after `retry-after` seconds if the retry-after header is sent (default: `false`)

## Running Tests

Make sure you have the development dependencies installed by running `npm install`, then you should be able to run the tests with `npm test`.


## License

([The MIT License](LICENSE))

Copyright 2014 Cameron Lakenen
