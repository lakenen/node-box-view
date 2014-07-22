var TOKEN = 'test api token';

var fs = require('fs'),
    test = require('tape'),
    nock = require('nock'),
    BoxView = require('../'),
    client = BoxView.createClient(TOKEN);

// don't allow any http requests that we don't expect
nock.disableNetConnect();

function nockAPI() {
    return nock('https://view-api.box.com', {
        reqheaders: {
            'Authorization': 'Token ' + TOKEN,
            'Content-Type': 'application/json'
        }
    });
}
function nockUploads() {
    return nock('https://upload.view-api.box.com', {
        reqheaders: {
            'Authorization': 'Token ' + TOKEN
        }
    });
}

//////// DOCUMENTS /////////

test('documents.list should return a list of documents when the request is successful', function (t) {
    t.plan(3);

    var doc1 = { id: 'abc', name: 'foo', status: 'done', 'created_at': '2014-06-02T18:30:57Z' },
        doc2 = { id: 'xyz', name: 'bar', status: 'queued', 'created_at': '2014-06-02T18:30:57Z' },
        response = [doc1, doc2];

    var request = nockAPI()
        .get('/1/documents')
        .reply(200, response);

    client.documents.list(function (err, docs) {
        t.notOk(err, 'should not be an error');
        t.deepEqual(response, docs, 'should be the same docs');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('documents.list should request the appropriate docs when filters are applied', function (t) {
    t.plan(2);

    var params = {
        limit: 20,
        'created_before': new Date().toISOString()
    };

    var request = nockAPI()
        .get('/1/documents?' + require('querystring').stringify(params))
        .reply(200, []);

    client.documents.list(params, function (err) {
        t.notOk(err, 'should not be an error');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('documents.list should return a list of documents when the request is successful', function (t) {
    t.plan(3);

    var id = 'abc',
        doc1 = { id: id, name: 'foo', status: 'done', 'created_at': '2014-06-02T18:30:57Z' };

    var request = nockAPI()
        .get('/1/documents/' + id)
        .reply(200, doc1);

    client.documents.get(id, function (err, doc) {
        t.notOk(err, 'should not be an error');
        t.deepEqual(doc1, doc, 'should be the same doc');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('documents.get should return an error when the document is not found', function (t) {
    t.plan(3);

    var id = 'abc',
        err = {
            message: 'Not found',
            type: 'error',
            'request_id': 'abcxyz'
        };

    var request = nockAPI()
        .get('/1/documents/' + id)
        .reply(404, err);

    client.documents.get(id, function (err, doc) {
        t.ok(err, 'should be an error');
        t.notOk(doc, 'should not be a doc');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('documents.update should return the document when the document is updated successfully', function (t) {
    t.plan(3);

    var id = 'abc',
        doc1 = { id: id, name: 'bar', status: 'done', 'created_at': '2014-06-02T18:30:57Z' },
        params = { name: 'bar' };

    var request = nockAPI()
        .put('/1/documents/' + id, params)
        .reply(200, doc1);

    client.documents.update(id, params, function (err, doc) {
        t.notOk(err, 'should not be an error');
        t.deepEqual(doc1, doc, 'should be a doc');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('documents.update should return an error when the document is not found', function (t) {
    t.plan(3);

    var id = 'abc',
        err = {
            message: 'Not found',
            type: 'error',
            'request_id': 'abcxyz'
        },
        params = { name: 'bar' };

    var request = nockAPI()
        .put('/1/documents/' + id, params)
        .reply(404, err);

    client.documents.update(id, params, function (err, doc) {
        t.ok(err, 'should be an error');
        t.notOk(doc, 'should not be a doc');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('documents.delete should make a DELETE request properly', function (t) {
    t.plan(2);

    var id = 'abc';

    var request = nockAPI()
        .delete('/1/documents/' + id)
        .reply(204);

    client.documents.delete(id, function (err) {
        t.notOk(err, 'should not be an error');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('documents.delete should return an error when the document is not found', function (t) {
    t.plan(2);

    var id = 'abc',
        err = {
            message: 'Not found',
            type: 'error',
            'request_id': 'abcxyz'
        };

    var request = nockAPI()
        .delete('/1/documents/' + id)
        .reply(404, err);

    client.documents.delete(id, function (err) {
        t.ok(err, 'should be an error');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

// TODO: add some tests to match properly on multipart form data when I figure out how (https://github.com/pgte/nock/issues/191)
test('uploadFile should make a file upload request properly when given a filename', function (t) {
    t.plan(3);

    var doc1 = { some: 'stuff' };

    var request = nockUploads()
        .post('/1/documents')
        .reply(202, doc1);

    client.documents.uploadFile(__dirname + '/files/content.pdf', function (err, doc) {
        t.notOk(err, 'should not be an error');
        t.deepEqual(doc1, doc, 'should be a doc');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

// TODO: add some tests to match properly on multipart form data when I figure out how (https://github.com/pgte/nock/issues/191)
test('uploadFile should set content-length properly when called', function (t) {
    t.plan(3);
    var file = __dirname + '/files/content.pdf';
    fs.stat(file, function (err, stat) {
        var doc1 = { some: 'stuff' };
        var request = nockUploads()
            .matchHeader('content-length', function (val) {
                return val >= stat.size;
            })
            .post('/1/documents')
            .reply(202, doc1);

        client.documents.uploadFile(file, function (err, doc) {
            t.notOk(err, 'should not be an error');
            t.deepEqual(doc1, doc, 'should be a doc');
            t.ok(request.isDone(), 'request should be made properly');
        });
    });
});

test('uploadFile should make a file upload request properly when given a file stream', function (t) {
    t.plan(3);

    var doc1 = { some: 'stuff' };

    var request = nockUploads()
        .post('/1/documents')
        .reply(202, doc1);

    client.documents.uploadFile(fs.createReadStream(__dirname + '/files/content.pdf'), function (err, doc) {
        t.notOk(err, 'should not be an error');
        t.deepEqual(doc1, doc, 'should be a doc');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('uploadFile should make a file upload request properly when given extra options', function (t) {
    t.plan(3);

    var doc1 = { some: 'stuff' },
        options = {
            'non_svg': true,
            name: 'test file'
        };

    var request = nockUploads()
        .post('/1/documents')
        .reply(202, doc1);

    client.documents.uploadFile(fs.createReadStream(__dirname + '/files/content.pdf'), options, function (err, doc) {
        t.notOk(err, 'should not be an error');
        t.deepEqual(doc1, doc, 'should be a doc');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('uploadURL should make a url upload request properly', function (t) {
    t.plan(3);

    var url = 'http://example.com/blah.pdf',
        doc1 = { some: 'stuff' };

    var request = nockAPI()
        .post('/1/documents', {
            name: 'blah.pdf',
            url: url
        })
        .reply(202, doc1);

    client.documents.uploadURL(url, function (err, doc) {
        t.notOk(err, 'should not be an error');
        t.deepEqual(doc1, doc, 'should be a doc');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('uploadURL should make a url upload request with the proper params', function (t) {
    t.plan(3);

    var url = 'http://example.com/blah.pdf',
        doc1 = { some: 'stuff' };

    var request = nockAPI()
        .post('/1/documents', {
            name: 'foo',
            url: url
        })
        .reply(202, doc1);

    client.documents.uploadURL(url, { name: 'foo' }, function (err, doc) {
        t.notOk(err, 'should not be an error');
        t.deepEqual(doc1, doc, 'should be a doc');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('documents.getContent should return the document content as a readable stream when successful', function (t) {
    t.plan(3);

    var id = 'abc';
    var request = nockAPI()
        .get('/1/documents/' + id + '/content.pdf')
        .replyWithFile(200, __dirname + '/files/content.pdf');

    client.documents.getContent(id, 'pdf', function (err, response) {
        t.notOk(err, 'should not be an error');
        t.ok(response.readable, 'response should be a readble stream');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('documents.getThumbnail should retry requesting thumbnail when retry-after header is sent', function (t) {
    t.plan(4);

    var id = 'abc';
    var request1 = nockAPI()
        .get('/1/documents/' + id + '/thumbnail?width=200&height=100')
        .reply(202, '', { 'retry-after': 0.001 }); // small retry-after for testing purposes
    var request2 = nockAPI()
        .get('/1/documents/' + id + '/thumbnail?width=200&height=100')
        .replyWithFile(200, __dirname + '/files/content.pdf');

    client.documents.getThumbnail(id, { width: 200, height: 100 }, function (err, response) {
        t.notOk(err, 'should not be an error');
        t.ok(response.readable, 'response should be a readble stream');
        t.ok(request1.isDone(), 'request should be made properly');
        t.ok(request2.isDone(), 'request should be made properly');
    });
});


test('documents.getContent should return the document content as a readable stream when successful', function (t) {
    t.plan(3);

    var id = 'abc';
    var request = nockAPI()
        .get('/1/documents/' + id + '/thumbnail?width=200&height=100')
        .replyWithFile(200, __dirname + '/files/content.pdf');

    client.documents.getThumbnail(id, { width: 200, height: 100 }, function (err, response) {
        t.notOk(err, 'should not be an error');
        t.ok(response.readable, 'response should be a readble stream');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('documents.getContent should retry requesting content when retry-after header is sent', function (t) {
    t.plan(4);

    var id = 'abc';
    var request1 = nockAPI()
        .get('/1/documents/' + id + '/content.pdf')
        .reply(202, '', { 'retry-after': 0.001 }); // small retry-after for testing purposes
    var request2 = nockAPI()
        .get('/1/documents/' + id + '/content.pdf')
        .replyWithFile(200, __dirname + '/files/content.pdf');

    client.documents.getContent(id, 'pdf', function (err, response) {
        t.notOk(err, 'should not be an error');
        t.ok(response.readable, 'response should be a readble stream');
        t.ok(request1.isDone(), 'request should be made properly');
        t.ok(request2.isDone(), 'request should be made properly');
    });
});

test('documents.getThumbnail should retry requesting thumbnail when retry-after header is sent', function (t) {
    t.plan(4);

    var id = 'abc';
    var request1 = nockAPI()
        .get('/1/documents/' + id + '/thumbnail?width=200&height=100')
        .reply(202, '', { 'retry-after': 0.001 }); // small retry-after for testing purposes
    var request2 = nockAPI()
        .get('/1/documents/' + id + '/thumbnail?width=200&height=100')
        .replyWithFile(200, __dirname + '/files/thumbnail.png');

    client.documents.getThumbnail(id, { width: 200, height: 100 }, function (err, response) {
        t.notOk(err, 'should not be an error');
        t.ok(response.readable, 'response should be a readble stream');
        t.ok(request1.isDone(), 'request should be made properly');
        t.ok(request2.isDone(), 'request should be made properly');
    });
});


test('documents.getThumbnail should return the thumbnail as a readable stream when successful', function (t) {
    t.plan(3);

    var id = 'abc';
    var request = nockAPI()
        .get('/1/documents/' + id + '/thumbnail?width=200&height=100')
        .replyWithFile(200, __dirname + '/files/thumbnail.png');

    client.documents.getThumbnail(id, { width: 200, height: 100 }, function (err, response) {
        t.notOk(err, 'should not be an error');
        t.ok(response.readable, 'response should be a readble stream');
        t.ok(request.isDone(), 'request should be made properly');
    });
});



//////// SESSIONS /////////

test('sessions.create should request a session when called', function (t) {
    t.plan(3);

    var id = 'abc';

    var session = {
        type: 'session',
        id: 'xyz',
        'expires_at': '3915-10-06T10:24:21.320Z'
    };

    var request = nockAPI()
        .post('/1/sessions', {
            'document_id': id
        })
        .reply(201, session);

    client.sessions.create(id, function (err, sess) {
        t.notOk(err, 'should not be an error');
        t.deepEqual(session, sess, 'session should be correct');
        t.ok(request.isDone(), 'request should be made properly');
    });
});

test('sessions.create should retry requesting a session when retry-after header is sent', function (t) {
    t.plan(4);

    var id = 'abc';

    var session = {
        type: 'session',
        id: 'xyz',
        'expires_at': '3915-10-06T10:24:21.320Z'
    };

    var request1 = nockAPI()
        .post('/1/sessions', {
            'document_id': id
        })
        .reply(202, '', { 'retry-after': 0.001 }); // small retry-after for testing purposes
    var request2 = nockAPI()
        .post('/1/sessions', {
            'document_id': id
        })
        .reply(201, session);

    client.sessions.create(id, function (err, sess) {
        t.notOk(err, 'should not be an error');
        t.deepEqual(session, sess, 'session should be correct');
        t.ok(request1.isDone(), 'request should be made properly');
        t.ok(request2.isDone(), 'request should be made properly');
    });
});
