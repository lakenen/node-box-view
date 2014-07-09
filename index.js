'use strict';

var fs = require('fs'),
    path = require('path'),
    extend = require('extend'),
    https = require('http-https'),
    request = require('request'),
    querystring = require('querystring');

var UPLOAD_BASE = 'https://upload.view-api.box.com/1/',
    API_BASE = 'https://view-api.box.com/1/';

var DOCUMENTS_UPLOAD_URL = UPLOAD_BASE + 'documents',
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
        return JSON.parse(body);
    } catch (e) {
        return body;
    }
}

/**
 * Create an error object to return
 * @param   {*} error            The error
 * @param   {Response?} response The response if available
 * @returns {Object}             The error object
 */
function createErrorObject(error, response) {
    return {
        error: error,
        status: response && response.statusCode || 0,
        response: response
    };
}

/**
 * Read JSON data from an http response
 * @param   {http.Response} response The http response
 * @param   {Function}      callback The callback to call with the data
 * @returns {void}
 */
function readResponse(response, callback) {
    var body = '';
    response.on('data', function (d) {
        body += d.toString();
    });
    response.on('end', function () {
        callback(parseJSONBody(body));
    });
    response.on('error', callback);
}

/**
 * Return an http response handler for API calls
 * @param   {Function} callback      The callback method to call
 * @param   {Array}    okStatusCodes (optional) HTTP status codes to use as OK (default: [200])
 * @param   {Function} retryFn       (optional) If defined, function to call when receiving a Retry-After header
 * @param   {Boolean} isRawHttp      (optional) Specify whether this request is using the raw http/https module
 * @returns {Function}               The response handler
 */
function createResponseHandler(callback, okStatusCodes, retryFn, isRawHttp) {
    if (typeof okStatusCodes === 'function') {
        retryFn = okStatusCodes;
        okStatusCodes = null;
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
        if (okStatusCodes.indexOf(response.statusCode) > -1) {
            if (!retry(response)) {
                if (body) {
                    callback(null, parseJSONBody(body), response);
                } else {
                    callback(null, response);
                }
            }
        } else {
            if (response.statusCode === 429) {
                if (retry(response)) {
                    return;
                }
            }
            // the error will be in the response body (or if empty, return the default status text)
            if (body) {
                error = parseJSONBody(body) || statusText(response.statusCode);
                callback(createErrorObject(error, response));
            } else {
                // the response is in the body, but we haven't parsed it yet
                readResponse(response, function (error) {
                    callback(createErrorObject(error, response));
                });
            }
        }
    }

    if (isRawHttp) {
        return handleResponse;
    }

    return function (error, response, body) {
        if (error) {
            callback(createErrorObject(error, response));
        } else {
            handleResponse(response, body);
        }
    };
}

/**
 * The BoxView client constructor
 * @param {String} key The API token
 * @constructor
 */
function BoxView(key) {
    var client = this,
        req = request.defaults({
            headers: {
                'Authorization': 'Token ' + key,
                'Content-Type': 'application/json'
            }
        });

    this.documentsURL = DOCUMENTS_URL;
    this.documentsUploadURL = DOCUMENTS_UPLOAD_URL;
    this.sessionsURL = SESSIONS_URL;

    this.documents = {
        /**
         * Fetch a list of documents uploaded using this API key
         * @param   {Object}   params                (optional) URL parameters
         * @param   {int}      params.limit          The number of documents to return (default: 10, max: 50)
         * @param   {Date}     params.created_before An upper limit on the creation timestamps of documents returned (default: now)
         * @param   {Date}     params.created_after  A lower limit on the creation timestamps of documents returned
         * @param   {Function} callback              A callback to call with the response data (or error)
         * @returns {void}
         */
        list: function (params, callback, retry) {
            var query,
                args = arguments;

            if (typeof params === 'function') {
                retry = callback;
                callback = params;
                params = {};
            } else {
                params = extend({}, params);
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

            req({
                method: 'GET',
                url: client.documentsURL + query
            }, createResponseHandler(callback, retry));
        },

        /**
         * Fetch the metadata for a single document
         * @param   {String}       id       The document uuid
         * @param   {String|Array} fields   (optional) Array of strings or comma-separated string of fields to return. id and type are always returned.
         * @param   {Function}     callback A callback to call with the response data (or error)
         * @returns {void}
         */
        get: function (id, fields, callback, retry) {
            var query = '',
                args = arguments;

            if (Array.isArray(fields)) {
                fields = fields.join(',');
            }

            if (typeof fields === 'function') {
                retry = callback;
                callback = fields;
                fields = '';
            }

            retry = (retry === true) && function () {
                this.get.apply(this, args);
            }.bind(this);

            if (fields) {
                query = '?' + querystring.stringify({
                    fields: fields
                });
            }

            req({
                method: 'GET',
                url: client.documentsURL + '/' + id + query
            }, createResponseHandler(callback, retry));
        },

        /**
         * Update the metadata for a single document
         * @param   {String}   id       The document uuid
         * @param   {Object}   data     The new metadata
         * @param   {Function} callback A callback to call with the response data (or error)
         * @returns {void}
         */
        update: function (id, data, callback, retry) {
            var args = arguments;
            retry = (retry === true) && function () {
                this.update.apply(this, args);
            }.bind(this);

            req({
                method: 'PUT',
                url: client.documentsURL + '/' + id,
                body: JSON.stringify(data)
            }, createResponseHandler(callback, retry));
        },

        /**
         * Delete a single document
         * @param   {String}   id       The document uuid
         * @param   {Function} callback A callback to call with the response data (or error)
         * @returns {void}
         */
        delete: function (id, callback, retry) {
            var args = arguments;
            retry = (retry === true) && function () {
                this.delete.apply(this, args);
            }.bind(this);

            req({
                method: 'DELETE',
                url: client.documentsURL + '/' + id
            }, createResponseHandler(callback, [204], retry));
        },

        /**
         * Do a multipart upload from a file path or readable stream
         * @param   {String|Stream} file              A path to a file to read or a readable file stream
         * @param   {Object}        params            (optional) Upload parameters
         * @param   {String}        params.name       The name of the file
         * @param   {String}        params.thumbnails Comma-separated list of thumbnail dimensions of the format {width}x{height} e.g. 128×128,256×256 – width can be between 16 and 1024, height between 16 and 768
         * @param   {Boolean}       params.non_svg    Whether to also create the non-svg version of the document
         * @param   {Function}      callback          A callback to call with the response data (or error)
         * @returns {void}
         */
        uploadFile: function (file, params, callback, retry) {
            var args = arguments;

            if (typeof file === 'string') {
                file = fs.createReadStream(file);
            }

            if (typeof params === 'function') {
                retry = callback;
                callback = params;
                params = {};
            } else {
                params = extend({}, params);
            }

            retry = (retry === true) && function () {
                this.uploadFile.apply(this, args);
            }.bind(this);

            if (!params.name) {
                params.name = path.basename(file.path);
            }

            // get the file size so we can set the proper length
            fs.stat(file.path, function (err, stat) {
                var r, param, form;

                if (err) {
                    callback(createErrorObject(err));
                    return;
                }

                if (!stat.isFile()) {
                    callback(createErrorObject({
                        message: 'not a valid file'
                    }));
                }

                r = request({
                    method: 'POST',
                    url: client.documentsUploadURL,
                    headers: {
                        'Authorization': 'Token ' + key
                    }
                }, createResponseHandler(callback, [200, 202], retry));

                // NOTE: r.form() automatically adds the 'content-type: multipart/form-data' header
                form = r.form();
                for (param in params) {
                    if (params.hasOwnProperty(param)) {
                        form.append(param, params[param].toString());
                    }
                }
                form.append('file', file, {
                    // must provide file length manually, because this is a stream
                    knownLength: stat.size
                });
            });
        },

        /**
         * Do a URL upload of a file
         * @param   {String}   url               A URL to a publicly-accessible file to upload
         * @param   {Object}   params            (optional) Upload parameters
         * @param   {String}   params.name       The name of the file
         * @param   {String}   params.thumbnails Comma-separated list of thumbnail dimensions of the format {width}x{height} e.g. 128×128,256×256 – width can be between 16 and 1024, height between 16 and 768
         * @param   {Boolean}  params.non_svg    Whether to also create the non-svg version of the document
         * @param   {Function} callback          A callback to call with the response data (or error)
         * @returns {void}
         */
        uploadURL: function (url, params, callback, retry) {
            var args = arguments;

            if (typeof params === 'function') {
                retry = callback;
                callback = params;
                params = {};
            } else {
                params = extend({}, params);
            }

            retry = (retry === true) && function () {
                this.uploadURL.apply(this, args);
            }.bind(this);

            if (!params.name) {
                params.name = path.basename(url);
            }

            params.url = url;
            req({
                method: 'POST',
                url: client.documentsURL,
                body: JSON.stringify(params)
            }, createResponseHandler(callback, [200, 202], retry));
        },

        /**
         * Fetches a document in the form specified by `extension`, which can be `pdf` or `zip`.
         * If an extension is not specified, the document’s original format is returned.
         * @param   {string}   id        The document uuid
         * @param   {string}   extension (optional) The document format to request
         * @param   {Function} callback  A callback to call with the response (or error)
         * @returns {void}
         */
        getContent: function (id, extension, callback, retry) {
            var r, url,
                args = arguments;

            if (typeof extension === 'function') {
                retry = callback;
                callback = extension;
                extension = '';
            } else if (extension) {
                // add a . if there is an extension
                if (!/^\./.test(extension)) {
                    extension = '.' + extension;
                }
            } else {
                extension = '';
            }

            retry = (retry === true) && function () {
                this.getContent.apply(this, args);
            }.bind(this);

            url = client.documentsURL + '/' + id + '/content' + extension;
            r = https.request(url, createResponseHandler(callback, [200, 202], retry, true));
            r.setHeader('Authorization', 'Token ' + key);
            r.end();
            r.on('error', function (error) {
                callback(createErrorObject(error));
            });
        },

        /**
         * Fetches a thumbnail for the given document id
         * @param   {string}   id            The document uuid
         * @param   {Object}   params        (required) The thumbnail params
         * @param   {int}      params.width  The thumbnail width
         * @param   {int}      params.height The thumbnail height
         * @param   {Function} callback      A callback to call with the response (or error)
         * @returns {void}
         */
        getThumbnail: function (id, params, callback, retry) {
            var r, url,
                args = arguments;

            retry = (retry === true) && function () {
                this.getThumbnail.apply(this, args);
            }.bind(this);

            params = extend({}, params);

            // NOTE: query string params are require here
            url = client.documentsURL + '/' + id + '/thumbnail?' + querystring.stringify(params);
            r = https.request(url, createResponseHandler(callback, [200, 202], retry, true));
            r.setHeader('Authorization', 'Token ' + key);
            r.end();
            r.on('error', function (err) {
                createErrorObject(err);
            });
        }
    };

    this.sessions = {

        /**
         * Request a viewing session for a document
         * @param   {String}   id                     The document uuid
         * @param   {Object}   params                 (optional) Session parameters
         * @param   {int}      params.duration        The duration in minutes until the session expires (default: 60)
         * @param   {Date}     params.expires_at      The timestamp at which the session should expire
         * @param   {boolean}  params.is_downloadable Whether a the original file will be available for download via GET /sessions/{id}/content while the session is active
         * @param   {Function} callback               A callback to call with the response data (or error)
         * @returns {void}
         */
        create: function (id, params, callback, retry) {
            var args = arguments;

            if (typeof params === 'function') {
                retry = callback;
                callback = params;
                params = {};
            } else {
                params = extend({}, params);
            }

            retry = (retry === true) && function () {
                this.create.apply(this, args);
            }.bind(this);

            params['document_id'] = id;

            if (params['expires_at']) {
                params['expires_at'] = getTimestamp(params['expires_at']);
            }

            req({
                method: 'POST',
                url: client.sessionsURL,
                body: JSON.stringify(params)
            }, createResponseHandler(callback, [201, 202], retry));
        }
    };
}

module.exports = {
    DOCUMENTS_UPLOAD_URL: DOCUMENTS_UPLOAD_URL,
    DOCUMENTS_URL: DOCUMENTS_URL,
    SESSIONS_URL: SESSIONS_URL,
    BoxView: BoxView,
    createClient: function (key) {
        return new BoxView(key);
    }
};
