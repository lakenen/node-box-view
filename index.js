'use strict';

// fs must be declared separately, else browserify gets sad w/brfs transform
var fs = require('fs');

var path = require('path'),
    concat = require('concat-stream'),
    extend = require('extend'),
    FormData = require('./lib/form-data'),
    hyperquest = require('hyperquest'),
    PassThrough = require('stream').PassThrough,
    querystring = require('querystring');

var VERSION = require('./package').version,
    UPLOAD_BASE = 'https://upload.view-api.box.com/1/',
    API_BASE = 'https://view-api.box.com/1/',
    DOCUMENTS_UPLOAD_URL = UPLOAD_BASE + 'documents',
    DOCUMENTS_URL = API_BASE + 'documents',
    SESSIONS_URL = API_BASE + 'sessions';

/**
 * Return a RFC3339-formatted date string
 * @param   {string|Date} date Some date object (default: now)
 * @returns {string}            The date string
 */
function getTimestamp(date) {
    return (date ? new Date(date) : new Date()).toISOString();
}

/**
 * Get the status text for a given http status code
 * @param   {int} statusCode The status code
 * @returns {string}         The status text
 */
function statusText(statusCode) {
    return require('http').STATUS_CODES[statusCode] || 'unknown';
}

/**
 * Parse response body as JSON if possible, else return the raw body
 * @param   {string} body   The response body
 * @returns {Object|string} The parsed body
 */
function parseJSONBody(body) {
    try {
        return JSON.parse(body.toString());
    } catch (e) {
        return body;
    }
}

/**
 * Try to figure out the filename for the given file
 * @param   {Stream} file The file stream
 * @returns {string}      The guessed filename
 */
function determineFilename(file) {
    var filename,
        filenameMatch;

    if (file.hasOwnProperty('httpVersion')) {
        // it's an http response
        // first let's check if there's a content-disposition header...
        if (file.headers['content-disposition']) {
            filenameMatch = /filename=(.*)/.exec(file.headers['content-disposition']);
            filename = filenameMatch[1];
        }
        if (!filename) {
            // try to get the path of the request url
            filename = path.basename(file.client._httpMessage.path);
        }
    } else if (file.path) {
        // it looks like a file, let's just get the path
        filename = path.basename(file.path);
    }
    return filename || 'untitled document';
}

/**
 * Make an HTTP request
 * @param   {string}    uri      Request uri
 * @param   {object}    opt      Request options
 * @param   {Function}  callback Callback function
 * @returns {HTTPRequest}        The request object
 */
function request(uri, opt, callback) {
    if (typeof opt === 'function') {
        callback = opt;
        opt = {};
    }
    return hyperquest(uri, opt, callback);
}

/**
 * Create and return a request method that has the given defaults baked in
 * @param   {object} options The default options
 * @returns {Function}       The new request method
 */
request.defaults = function (options) {
    return function (uri, opt, callback) {
        if (typeof opt === 'function') {
            callback = opt;
            opt = {};
        }
        opt = extend(true, {}, options, opt);
        return request(uri, opt, callback);
    };
};

/**
 * Create an error object from the response and call the callback function
 * @param   {Object}   body     The parsed response body (or null if not yet parsed)
 * @param   {Response} response The HTTP response object
 * @param   {Function} callback Function to call with the resulting error object
 * @returns {void}
 */
function handleError(body, response, callback) {
    var error;
    if (!body) {
        response.pipe(concat(function (body) {
            body = parseJSONBody(body);
            error = body.message || statusText(response.statusCode);
            callback(new Error(error), body, response);
        }));
    } else {
        error = body.message || statusText(response.statusCode);
        callback(new Error(error), body, response);
    }
}

/**
 * Return an http response handler for API calls
 * @param   {Function} callback      The callback method to call
 * @param   {Array}    okStatusCodes (optional) HTTP status codes to use as OK (default: [200])
 * @param   {Boolean}  noBuffer      (optional) If true, the response will not be buffered and JSON parsed (unless error), default: false
 * @param   {Function} retryFn       (optional) If defined, function to call when receiving a Retry-After header
 * @returns {Function}               The response handler
 */
function createResponseHandler(callback, okStatusCodes, noBuffer, retryFn) {
    if (typeof callback !== 'function') {
        callback = function () {};
    }

    if (typeof okStatusCodes === 'function') {
        retryFn = okStatusCodes;
        okStatusCodes = null;
        noBuffer = retryFn;
    }
    if (typeof noBuffer === 'function') {
        retryFn = noBuffer;
        noBuffer = false;
    }

    okStatusCodes = okStatusCodes || [200];

    /**
     * Retry the request if a retry function and retry-after headers are present
     * @param   {HTTPResponse} response The response object
     * @returns {void}
     */
    function retry(response) {
        var retryAfter = response.headers['retry-after'];
        if (typeof retryFn === 'function' && retryAfter) {
            retryAfter = parseInt(retryAfter, 10);
            setTimeout(retryFn, retryAfter * 1000);
            return true;
        }
        return false;
    }

    function handleResponse(response, body) {
        var error;

        // the handler expects a parsed response body
        if (noBuffer !== true && typeof body === 'undefined') {
            response.pipe(concat(function (body) {
                handleResponse(response, parseJSONBody(body));
            }));
            return;
        }

        if (okStatusCodes.indexOf(response.statusCode) > -1) {
            if (!retry(response)) {
                if (noBuffer) {
                    callback(null, response);
                } else {
                    callback(null, body, response);
                }
            }
        } else {
            if (response.statusCode === 429) {
                if (retry(response)) {
                    return;
                }
            }

            handleError(body, response, callback);
        }
    }

    return function (error, response) {
        if (error) {
            callback(error, response);
        } else {
            handleResponse(response);
        }
    };
}

/**
 * The BoxView client constructor
 * @param {String} key The API token
 * @constructor
 */
function BoxView(key, options) {
    var client = this,
        defaults = extend(true, {
            headers: {
                'authorization': 'token ' + key,
                'user-agent': 'node-box-view@' + VERSION
            }
        }, options || {}),
        req = request.defaults(defaults);

    this.documentsURL = DOCUMENTS_URL;
    this.documentsUploadURL = DOCUMENTS_UPLOAD_URL;
    this.sessionsURL = SESSIONS_URL;

    this.documents = {
        /**
         * Fetch a list of documents uploaded using this API key
         * @param   {Object}   [options]                        List options
         * @param   {boolean}  [options.retry]                  Whether to retry the request after 'retry-after' seconds if the retry-after header is sent
         * @param   {Object}   [options.params]                 URL parameters
         * @param   {int}      [options.params.limit]           The number of documents to return (default: 10, max: 50)
         * @param   {Date}     [options.params.created_before]  An upper limit on the creation timestamps of documents returned (default: now)
         * @param   {Date}     [options.params.created_after]   A lower limit on the creation timestamps of documents returned
         * @param   {Function} [callback]                       A callback to call with the response data (or error)
         * @returns {Request}
         */
        list: function (options, callback) {
            var query,
                handler,
                retry = false,
                params,
                args = arguments;

            if (typeof options === 'function') {
                callback = options;
                params = {};
            } else {
                params = extend({}, options.params);
                retry = options.retry;
            }

            retry = (retry === true) && function () {
                this.list.apply(this, args);
            }.bind(this);

            if (params['created_before']) {
                params['created_before'] = getTimestamp(params['created_before']);
            }

            if (params['created_after']) {
                params['created_after'] = getTimestamp(params['created_after']);
            }

            query = querystring.stringify(params);
            if (query) {
                query = '?' + query;
            }

            handler = createResponseHandler(callback, retry);

            return req(client.documentsURL + query, handler);
        },

        /**
         * Fetch the metadata for a single document
         * @param   {String}        id                  The document uuid
         * @param   {Object}        [options]           Get options
         * @param   {boolean}       [options.retry]     Whether to retry the request after 'retry-after' seconds if the retry-after header is sent
         * @param   {String|Array}  [options.fields]    Array of strings or comma-separated string of fields to return. id and type are always returned.
         * @param   {Function}      [callback]          A callback to call with the response data (or error)
         * @returns {Request}
         */
        get: function (id, options, callback) {
            var query = '',
                handler,
                retry = false,
                fields,
                args = arguments;

            if (typeof options === 'function') {
                callback = options;
                fields = '';
            } else {
                options = extend({}, options);
                fields = options.fields || '';
                retry = options.retry;
            }

            if (Array.isArray(fields)) {
                fields = fields.join(',');
            }

            retry = (retry === true) && function () {
                this.get.apply(this, args);
            }.bind(this);

            if (fields) {
                query = '?' + querystring.stringify({
                    fields: fields
                });
            }

            handler = createResponseHandler(callback, retry);

            return req(client.documentsURL + '/' + id + query, handler);
        },

        /**
         * Update the metadata for a single document
         * @param   {String}   id               The document uuid
         * @param   {Object}   data             The new metadata
         * @param   {Object}   [options]        Update options
         * @param   {boolean}  [options.retry]  Whether to retry the request after 'retry-after' seconds if the retry-after header is sent
         * @param   {Function} [callback]       A callback to call with the response data (or error)
         * @returns {Request}
         */
        update: function (id, data, options, callback) {
            var args = arguments,
                r,
                handler,
                retry = false,
                requestOptions = {
                    method: 'PUT',
                    headers: {
                        'content-type': 'application/json'
                    }
                };

            if (typeof options === 'function') {
                callback = options;
            } else {
                options = extend({}, options);
                retry = options.retry;
            }

            retry = (retry === true) && function () {
                this.update.apply(this, args);
            }.bind(this);

            handler = createResponseHandler(callback, retry);

            r = req(client.documentsURL + '/' + id, requestOptions, handler);
            data = new Buffer(JSON.stringify(data));
            r.setHeader('content-length', data.length);
            r.end(data);
            return r;
        },

        /**
         * Delete a single document
         * @param   {String}   id               The document uuid
         * @param   {Object}   [options]        Delete options
         * @param   {boolean}  [options.retry]  Whether to retry the request after 'retry-after' seconds if the retry-after header is sent
         * @param   {Function} [callback]       A callback to call with the response data (or error)
         * @returns {Request}
         */
        delete: function (id, options, callback) {
            var args = arguments,
                retry = false,
                handler;

            if (typeof options === 'function') {
                callback = options;
            } else {
                options = extend({}, options);
                retry = options.retry;
            }

            retry = (retry === true) && function () {
                this.delete.apply(this, args);
            }.bind(this);

            handler = createResponseHandler(callback, [204], true, retry);

            return req(client.documentsURL + '/' + id, { method: 'DELETE' }, handler);
        },

        /**
         * Do a multipart upload from a file path or readable stream
         * @param   {String|Stream|Buffer}  file                        A path to a file to read, a readable stream, or a Buffer
         * @param   {Object}                [options]                   Upload options
         * @param   {boolean}               [options.retry]             Whether to retry the request after 'retry-after' seconds if the retry-after header is sent
         * @param   {Object}                [options.params]            Upload parameters
         * @param   {String}                [options.params.name]       The name of the file
         * @param   {String}                [options.params.thumbnails] Comma-separated list of thumbnail dimensions of the format {width}x{height} e.g. 128×128,256×256 – width can be between 16 and 1024, height between 16 and 768
         * @param   {Boolean}               [options.params.non_svg]    Whether to also create the non-svg version of the document
         * @param   {Function}              [callback]                  A callback to call with the response data (or error)
         * @returns {Request}
         */
        uploadFile: function (file, options, callback) {
            var args = arguments,
                r,
                param,
                form,
                handler,
                params,
                retry = false,
                requestOptions = {
                    method: 'POST'
                };

            if (typeof file === 'string') {
                file = fs.createReadStream(file);
            }

            if (typeof options === 'function') {
                callback = options;
                params = {};
            } else {
                options = extend({}, options);
                params = extend({}, options.params);
                retry = options.retry;
            }

            retry = (retry === true) && function () {
                this.uploadFile.apply(this, args);
            }.bind(this);

            // filename is required for the form to work properly, so try to
            // figure out a name...
            if (!params.name) {
                params.name = determineFilename(file);
            }

            // if the file is a stream, we cannot retry
            if (retry && file.readable) {
                throw new Error('Retry option is not supported for streams.');
            }

            handler = createResponseHandler(callback, [200, 202], retry);

            form = new FormData();
            for (param in params) {
                if (params.hasOwnProperty(param)) {
                    form.append(param, params[param].toString());
                }
            }

            form.append('file', file, { filename: params.name });
            extend(true, requestOptions, {
                headers: form.getHeaders()
            });

            r = req(client.documentsUploadURL, requestOptions, handler);
            form.pipe(r);
            return r;
        },

        /**
         * Do a URL upload of a file
         * @param   {String}   url                         A URL to a publicly-accessible file to upload
         * @param   {Object}   [options]                   Upload options
         * @param   {boolean}  [options.retry]             Whether to retry the request after 'retry-after' seconds if the retry-after header is sent
         * @param   {Object}   [options.params]            Upload parameters
         * @param   {String}   [options.params.name]       The name of the file
         * @param   {String}   [options.params.thumbnails] Comma-separated list of thumbnail dimensions of the format {width}x{height} e.g. 128×128,256×256 – width can be between 16 and 1024, height between 16 and 768
         * @param   {Boolean}  [options.params.non_svg]    Whether to also create the non-svg version of the document
         * @param   {Function} [callback]                  A callback to call with the response data (or error)
         * @returns {Request}
         */
        uploadURL: function (url, options, callback) {
            var args = arguments,
                r,
                handler,
                params,
                data = '',
                retry = false,
                requestOptions = {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    }
                };

            if (typeof options === 'function') {
                callback = options;
                params = {};
            } else {
                options = extend({}, options);
                params = extend({}, options.params);
                retry = options.retry;
            }

            retry = (retry === true) && function () {
                this.uploadURL.apply(this, args);
            }.bind(this);

            if (!params.name) {
                params.name = path.basename(url);
            }

            params.url = url;

            handler = createResponseHandler(callback, [200, 202], retry);

            r = req(client.documentsURL, requestOptions, handler);

            data = new Buffer(JSON.stringify(params));
            r.setHeader('content-length', data.length);
            r.end(data);
            return r;
        },

        /**
         * Fetches a document in the form specified by `extension`, which can be `pdf` or `zip`.
         * If an extension is not specified, the document’s original format is returned.
         * @param   {string}   id                   The document uuid
         * @param   {Object}   [options]            Content options
         * @param   {boolean}  [options.retry]      Whether to retry the request after 'retry-after' seconds if the retry-after header is sent
         * @param   {string}   [options.extension]  The document format to request
         * @param   {Function} [callback]           A callback to call with the response (or error)
         * @returns {Request}
         */
        getContent: function (id, options, callback) {
            var args = arguments,
                retry = false,
                extension,
                url,
                handler;

            if (typeof options === 'function') {
                callback = options;
                extension = '';
            } else {
                options = extend({}, options);
                retry = options.retry;
                extension = options.extension || '';
                // add a . if there is an extension
                if (extension && !/^\./.test(extension)) {
                    extension = '.' + extension;
                }
            }

            retry = (retry === true) && function () {
                this.getContent.apply(this, args);
            }.bind(this);

            handler = createResponseHandler(callback, [200, 202], true, retry);

            url = client.documentsURL + '/' + id + '/content' + extension;
            return req(url, handler);
        },

        /**
         * Fetches a thumbnail for the given document id
         * @param   {string}   id               The document uuid
         * @param   {int}      width            The thumbnail width
         * @param   {int}      height           The thumbnail height
         * @param   {Object}   [options]        Content options
         * @param   {boolean}  [options.retry]  Whether to retry the request after 'retry-after' seconds if the retry-after header is sent
         * @param   {Function} [callback]       A callback to call with the response (or error)
         * @returns {Request}
         */
        getThumbnail: function (id, width, height, options, callback) {
            var args = arguments,
                url,
                query,
                retry = false,
                params,
                handler;

            if (typeof options === 'function') {
                callback = options;
            } else {
                options = extend({}, options);
                retry = options.retry;
            }

            retry = (retry === true) && function () {
                this.getThumbnail.apply(this, args);
            }.bind(this);

            params = {
                width: width,
                height: height
            };

            handler = createResponseHandler(callback, [200, 202], true, retry);

            query = querystring.stringify(params);
            url = client.documentsURL + '/' + id + '/thumbnail?' + query;
            return req(url, handler);
        }
    };

    this.sessions = {

        /**
         * Request a viewing session for a document
         * @param   {String}   id                               The document uuid
         * @param   {Object}   [options]                        Session options
         * @param   {boolean}  [options.retry]                  Whether to retry the request after 'retry-after' seconds if the retry-after header is sent
         * @param   {Object}   [options.params]                 Session parameters
         * @param   {int}      [options.params.duration]        The duration in minutes until the session expires (default: 60)
         * @param   {Date}     [options.params.expires_at]      The timestamp at which the session should expire
         * @param   {boolean}  [options.params.is_downloadable] Whether a the original file will be available for download via GET /sessions/{id}/content while the session is active
         * @param   {Function} [callback]                       A callback to call with the response data (or error)
         * @returns {void}
         */
        create: function (id, options, callback) {
            var args = arguments,
                r,
                handler,
                params,
                data = '',
                retry = false,
                requestOptions = {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json'
                    }
                };

            if (typeof options === 'function') {
                callback = options;
                params = {};
            } else {
                options = extend({}, options);
                params = extend({}, options.params);
                retry = options.retry;
            }

            retry = (retry === true) && function () {
                this.create.apply(this, args);
            }.bind(this);

            params['document_id'] = id;

            if (params['expires_at']) {
                params['expires_at'] = getTimestamp(params['expires_at']);
            }

            handler = createResponseHandler(callback, [201, 202], retry);

            r = req(client.sessionsURL, requestOptions, handler);

            data = new Buffer(JSON.stringify(params));
            r.setHeader('content-length', data.length);
            r.end(data);
            return r;
        },

        /**
         * Delete a session
         * @param   {String}   id               The session uuid
         * @param   {Object}   [options]        Delete options
         * @param   {boolean}  [options.retry]  Whether to retry the request after 'retry-after' seconds if the retry-after header is sent
         * @param   {Function} [callback]       A callback to call with the response data (or error)
         * @returns {Request}
         */
        delete: function (id, options, callback) {
            var args = arguments,
                retry = false,
                handler;

            if (typeof options === 'function') {
                callback = options;
            } else {
                options = extend({}, options);
                retry = options.retry;
            }

            retry = (retry === true) && function () {
                this.delete.apply(this, args);
            }.bind(this);

            handler = createResponseHandler(callback, [204], true, retry);

            return req(client.sessionsURL + '/' + id, { method: 'DELETE' }, handler);
        }
    };
}

module.exports = {
    DOCUMENTS_UPLOAD_URL: DOCUMENTS_UPLOAD_URL,
    DOCUMENTS_URL: DOCUMENTS_URL,
    SESSIONS_URL: SESSIONS_URL,
    BoxView: BoxView,
    createClient: function (token, options) {
        return new BoxView(token, options);
    }
};
