var TOKEN = process.env.BOX_VIEW_API_TOKEN;

var fs = require('fs'),
    test = require('tape'),
    http = require('http'),
    BoxView = require('../'),
    client = BoxView.createClient(TOKEN);

var options = {
    params: {},
    retry: false
};

client.documentsUploadURL = process.env.BOX_VIEW_DOCUMENTS_UPLOAD_URL || client.documentsUploadURL;

test('documents.uploadFile should upload the given file when called with a filename', function (t) {
    t.plan(2);
    client.documents.uploadFile(__dirname + '/files/content.pdf', options, function (err, doc) {
        t.notOk(!!err, 'should not be error');
        t.equal(doc.type, 'document', 'should be a document');
    });
});

test('documents.uploadFile should upload the given file when called with a file stream', function (t) {
    t.plan(2);
    var file = fs.createReadStream(__dirname + '/files/content.pdf');
    client.documents.uploadFile(file, options, function (err, doc) {
        t.notOk(!!err, 'should not be error');
        t.equal(doc.type, 'document', 'should be a document');
    });
});

test('documents.uploadFile should upload the given file when called with a buffer', function (t) {
    t.plan(2);
    var file = fs.readFileSync(__dirname + '/files/content.pdf');
    client.documents.uploadFile(file, options, function (err, doc) {
        t.notOk(!!err, 'should not be error');
        t.equal(doc.type, 'document', 'should be a document');
    });
});

test('documents.uploadFile should upload the given file when called with an http response w/ content-disposition+filename header', function (t) {
    t.plan(3);
    var server = http.createServer(function (req, res) {
        var filename = __dirname + '/files/content.pdf';
        fs.stat(filename, function (err, stat) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=content-disposition.pdf');
            res.setHeader('Content-Length', stat.size);
            fs.createReadStream(filename).pipe(res);
        });
    }).listen(0, function () {
        var port = server.address().port;
        http.get('http://localhost:' + port, function (res) {
            client.documents.uploadFile(res, options, function (err, doc) {
                t.notOk(!!err, 'should not be error');
                t.equal(doc.type, 'document', 'should be a document');
                t.equal(doc.name, 'content-disposition.pdf', 'should be the correct name');
                server.close();
            });
        });
    });
});

test('documents.uploadFile should upload the given file when called with an http response with a pathname', function (t) {
    t.plan(3);
    var server = http.createServer(function (req, res) {
        var filename = __dirname + '/files/content.pdf';
        fs.stat(filename, function (err, stat) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', stat.size);
            fs.createReadStream(filename).pipe(res);
        });
    }).listen(0, function () {
        var port = server.address().port;
        http.get('http://localhost:' + port + '/pathname.pdf', function (res) {
            client.documents.uploadFile(res, options, function (err, doc) {
                t.notOk(!!err, 'should not be error');
                t.equal(doc.type, 'document', 'should be a document');
                t.equal(doc.name, 'pathname.pdf', 'should be the correct name');
                server.close();
            });
        });
    });
});

test('documents.uploadFile should provide a default filename when a filename cannot be determined', function (t) {
    t.plan(3);
    var server = http.createServer(function (req, res) {
        var filename = __dirname + '/files/content.pdf';
        fs.stat(filename, function (err, stat) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Length', stat.size);
            fs.createReadStream(filename).pipe(res);
        });
    }).listen(0, function () {
        var port = server.address().port;
        http.get('http://localhost:' + port + '/', function (res) {
            client.documents.uploadFile(res, options, function (err, doc) {
                t.notOk(!!err, 'should not be error');
                t.equal(doc.type, 'document', 'should be a document');
                t.equal(doc.name, 'untitled document', 'should be the correct name');
                server.close();
            });
        });
    });
});
