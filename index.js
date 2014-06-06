'use strict';

var fs = require('fs'),
    path = require('path'),
    https = require('https'),
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
 * @returns {string}      The date string
 */
function getTimestamp(date) {
    return (date ? new Date(date) : new Date()).toISOString();
}

/**
 * Return a default http response handler that will be used in most API calls
 * @param   {Function} callback  The callback method to call
 * @param   {int}   okStatusCode The HTTP status code to use as OK
 * @returns {Function}           The response handler
 */
function createDefaultResponseHandler(callback, okStatusCode) {
    return function (error, response, body) {
        if (error) {
            callback(error);
        } else {
            if (response.statusCode === okStatusCode || 200) {
                callback(null, JSON.parse(body));
            } else {
                callback(JSON.parse(body));
            }
        }
    };
}

/**
 * The BoxView client constructor
 * @param {String} key The API token
 * @constructor
 */
function BoxView(key) {
    var req = request.defaults({
        headers: {
            'Authorization': 'Token ' + key,
            'Content-Type': 'application/json'
        }
    });

    this.documents = {
        /**
         * Fetch a list of documents uploaded using this API key
         * @param   {Object}   params                URL parameters
         * @param   {int}      params.limit          The number of documents to return (default: 10, max: 50)
         * @param   {Date}     params.created_before An upper limit on the creation timestamps of documents returned (default: now)
         * @param   {Date}     params.created_after  A lower limit on the creation timestamps of documents returned
         * @param   {Function} callback              A callback to call with the response data (or error)
         * @returns {void}
         */
        list: function (params, callback) {
            if (params['created_before']) {
                params['created_before'] = getTimestamp(params['created_before']);
            }
            if (params['created_after']) {
                params['created_after'] = getTimestamp(params['created_after']);
            }
            req({
                method: 'GET',
                url: DOCUMENTS_URL + '?' + querystring.stringify(params || {})
            }, createDefaultResponseHandler(callback));
        },

        /**
         * Fetch the metadata for a single document
         * @param   {String}   id       The document uuid
         * @param   {String}   fields   Comma-separated list of fields to return. id and type are always returned.
         * @param   {Function} callback A callback to call with the response data (or error)
         * @returns {void}
         */
        get: function (id, fields, callback) {
            if (Array.isArray(fields)) {
                fields = fields.join(',');
            }
            req({
                method: 'GET',
                url: DOCUMENTS_URL + '/' + id + '?' + querystring.stringify({
                    fields: fields
                })
            }, createDefaultResponseHandler(callback));
        },

        /**
         * Update the metadata for a single document
         * @param   {String}   id       The document uuid
         * @param   {Object}   data     The new metadata
         * @param   {Function} callback A callback to call with the response data (or error)
         * @returns {void}
         */
        update: function (id, data, callback) {
            req({
                method: 'PUT',
                url: DOCUMENTS_URL + '/' + id,
                body: JSON.stringify(data)
            }, createDefaultResponseHandler(callback));
        },

        /**
         * Delete a single document
         * @param   {String}   id       The document uuid
         * @param   {Function} callback A callback to call with the response data (or error)
         * @returns {void}
         */
        delete: function (id, callback) {
            req({
                method: 'DELETE',
                url: DOCUMENTS_URL + '/' + id
            }, createDefaultResponseHandler(callback));
        },

        /**
         * Do a multipart upload from a file path or readable stream
         * @param   {String|Stream} file              A path to a file to read or a readable stream
         * @param   {Object}        params            Upload parameters
         * @param   {String}        params.name       The name of the file
         * @param   {String}        params.thumbnails Comma-separated list of thumbnail dimensions of the format {width}x{height} e.g. 128×128,256×256 – width can be between 16 and 1024, height between 16 and 768
         * @param   {Boolean}       params.non_svg    Whether to also create the non-svg version of the document
         * @param   {Function}      callback          A callback to call with the response data (or error)
         * @returns {void}
         */
        uploadFile: function (file, params, callback) {
            if (typeof file === 'string') {
                file = fs.createReadStream(file);
            }

            var r = req({
                method: 'POST',
                url: DOCUMENTS_UPLOAD_URL
            }, createDefaultResponseHandler(callback));
            var form = r.form();
            for (var p in params) {
                if (params.hasOwnProperty(p)) {
                    form.append(p, params[p]);
                }
            }
            form.append('file', file);
        },

        /**
         * Do a URL upload of a file
         * @param   {String}   url               A URL to a publicly-accessible file to upload
         * @param   {Object}   params            Upload parameters
         * @param   {String}   params.name       The name of the file
         * @param   {String}   params.thumbnails Comma-separated list of thumbnail dimensions of the format {width}x{height} e.g. 128×128,256×256 – width can be between 16 and 1024, height between 16 and 768
         * @param   {Boolean}  params.non_svg    Whether to also create the non-svg version of the document
         * @param   {Function} callback          A callback to call with the response data (or error)
         * @returns {void}
         */
        uploadURL: function (url, params, callback) {
            if (!params.name) {
                params.name = path.basename(url);
            }
            params.url = url;
            req({
                method: 'POST',
                url: DOCUMENTS_URL,
                body: JSON.stringify(params)
            }, createDefaultResponseHandler(callback, 202));
        },

        /**
         * Fetches a document in the form specified by `extension`, which can be `pdf` or `zip`.
         * If an extension is not specified, the document’s original format is returned.
         * @param   {string}   id        The document uuid
         * @param   {string}   extension The document format to request
         * @param   {Function} callback  A callback to call with the response (or error)
         * @returns {void}
         */
        getContent: function (id, extension, callback) {
            var retry = function () {
                this.getContent(id, extension, callback);
            }.bind(this);

            if (extension) {
                extension = '.' + extension;
            } else {
                extension = '';
            }

            var url = DOCUMENTS_URL + '/' + id + '/content' + extension;
            var r = https.request(url, function (response) {
                var retryAfter, status;
                status = response.statusCode;
                switch (status) {
                    case 200:
                        callback(null, response);
                        break;
                    case 202:
                        retryAfter = response.headers['retry-after'];
                        if (retryAfter) {
                            setTimeout(retry, retryAfter * 1000);
                        }
                        break;
                    default:
                        // error
                        var body = '';
                        response.on('data', function (d) {
                            body += d.toString();
                        });
                        response.on('end', function () {
                            callback(JSON.parse(body));
                        });
                        break;
                }
            });
            r.setHeader('Authorization', 'Token ' + key);
            r.end();
            r.on('error', function (err) {
                callback(err);
            });
        },

        /**
         * Fetches a thumbnail for the given document id
         * @param   {string}   id            The document uuid
         * @param   {Object}   params        The thumbnail params
         * @param   {int}      params.width  The thumbnail width
         * @param   {int}      params.height The thumbnail height
         * @param   {Function} callback      A callback to call with the response (or error)
         * @returns {void}
         */
        getThumbnail: function (id, params, callback) {

            var retry = function () {
                this.getThumbnail(id, params, callback);
            }.bind(this);

            var url = DOCUMENTS_URL + '/' + id + '/thumbnail?' + querystring.stringify(params);
            var r = https.request(url, function (response) {
                var retryAfter, status;
                status = response.statusCode;
                switch (status) {
                    case 200:
                        callback(null, response);
                        break;
                    case 202:
                        retryAfter = response.headers['retry-after'];
                        if (retryAfter) {
                            setTimeout(retry, retryAfter * 1000);
                        }
                        break;
                    default:
                        // error
                        var body = '';
                        response.on('data', function (d) {
                            body += d.toString();
                        });
                        response.on('end', function () {
                            callback(JSON.parse(body));
                        });
                        break;
                }
            });
            r.setHeader('Authorization', 'Token ' + key);
            r.end();
            r.on('error', function (err) {
                callback(err);
            });
        }
    };

    this.sessions = {

        /**
         * Request a viewing session for a document
         * @param   {String}   id                     The document uuid
         * @param   {Object}   params                 Session parameters
         * @param   {int}      params.duration        The duration in minutes until the session expires (default: 60)
         * @param   {Date}     params.expires_at      The timestamp at which the session should expire
         * @param   {boolean}  params.is_downloadable Whether a the original file will be available for download via GET /sessions/{id}/content while the session is active
         * @param   {Function} callback               A callback to call with the response data (or error)
         * @returns {void}
         */
        create: function (id, params, callback) {
            var retry = function () {
                this.create(params, callback);
            }.bind(this);

            params['document_id'] = id;

            if (params['expires_at']) {
                params['expires_at'] = getTimestamp(params['expires_at']);
            }

            req({
                method: 'POST',
                url: SESSIONS_URL,
                body: JSON.stringify(params)
            }, function (error, response, body) {
                var retryAfter, status;
                if (error) {
                    callback(error);
                } else {
                    status = response.statusCode;
                    switch (status) {
                        case 201:
                            callback(null, JSON.parse(body));
                            break;
                        case 202:
                            retryAfter = response.headers['retry-after'];
                            if (retryAfter) {
                                setTimeout(retry, retryAfter * 1000);
                            }
                            break;
                        default:
                            // error
                            callback(JSON.parse(body));
                            break;
                    }
                }
            });
        }
    };
}

module.exports = {
    BoxView: BoxView,
    createClient: function (key) {
        return new BoxView(key);
    }
};
