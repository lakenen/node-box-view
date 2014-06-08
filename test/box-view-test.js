var TOKEN = 'test api token';

var test = require('tape'),
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
            'Authorization': 'Token ' + TOKEN,
            'Content-Type': 'application/json'
        }
    });
}

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

test('documents.list request the appropriate docs when filters are applied', function (t) {
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
        .reply(200);

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
