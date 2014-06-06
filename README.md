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

`client.documents.list(params, callback)`

Fetch a list of documents uploaded using this API key.
* `params` - (`object`) a map of URL parameters
* `params.limit` - (`int`) The number of documents to return (default: 10, max: 50)
* `params.created_before` - (`Date`) An upper limit on the creation timestamps of documents returned (default: now)
* `params.created_after` - (`Date`)  A lower limit on the creation timestamps of documents returned
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)

#### get

`client.documents.get(id, fields, callback)`

Fetch the metadata for a single document.
* `id` - (`string`) The document uuid
* `fields` - (`string`) Comma-separated list of fields to return (e.g., `'id,type,name,status'`); id and type are always returned
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)

#### update

`client.documents.update(id, data, callback)`

Update the metadata for a single document
* `id` - (`string`) The document uuid
* `data` - (`object`) The new metadata (currently only `name` is supported)
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)

#### delete

`client.documents.delete(id, callback)`

Delete a single document
* `id` - (`string`) The document uuid
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)

#### uploadFile

`client.documents.uploadFile(file, params, callback)`

Do a multipart upload from a file path or readable stream
* `file` - (`string` or `stream.Readable`) A path to a file to read or a readable stream
* `params` - (`object`) Upload parameters
* `params.name` - (`string`) The name of the file
* `params.thumbnails` - (`string`) Comma-separated list of thumbnail dimensions of the format `{width}x{height}` (e.g. `'128×128,256×256'`) – width can be between 16 and 1024, height between 16 and 768
* `params.non_svg` - (`boolean`) Whether to also create the non-svg version of the document
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)

#### uploadURL

`client.documents.uploadFile(url, params, callback)`

Do a URL upload of a file
* `url` - (`string`) A URL to a publicly-accessible file to upload
* `params` - (`object`) Upload parameters
* `params.name` - (`string`) The name of the file
* `params.thumbnails` - (`string`) Comma-separated list of thumbnail dimensions of the format `{width}x{height}` (e.g. `'128×128,256×256'`) – width can be between 16 and 1024, height between 16 and 768
* `params.non_svg` - (`boolean`) Whether to also create the non-svg version of the document
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)

#### getContent

`client.documents.getContent(id, extension, callback)`

Fetches a document in the form specified by `extension`, which can be `pdf` or `zip`.
* If an extension is not specified, the document’s original format is returned.
* `id` - (`string`) The document uuid
* `extension` - (`string`) The document format to request
* `callback` - (`function(error, response)`) A callback to call with the response (or error)

#### getThumbnail

`client.documents.getThumbnail(id, params, callback)`

Fetches a thumbnail for the given document id
* `id` - (`string`) The document uuid
* `params` - (`object`) The thumbnail params
* `params.width` - (`int`) The thumbnail width
* `params.height` - (`int`) The thumbnail height
* `callback` - (`function(error, response)`) A callback to call with the response (or error)

### Sessions

#### create

`client.sessions.create(id, params, callback)`

Request a viewing session for a documentRequest a viewing session for a document
* `id` - (`string`) The document uuid
* `params` - (`object`) Session parameters
* `params.duration` - (`int`) The duration in minutes until the session expires (default: 60)
* `params.expires_at` - (`Date`) The timestamp at which the session should expire
* `params.is_downloadable` - (`boolean`) Whether a the original file will be available for download via GET /sessions/{id}/content while the session is active
* `callback` - (`function(error, response)`) A callback to call with the response data (or error)


## Copyright and License

Copyright 2014 Box, Inc. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
