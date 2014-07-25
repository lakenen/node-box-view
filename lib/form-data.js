/*global window*/
var isBrowser = typeof window !== 'undefined' &&
                typeof window.FormData !== 'undefined';

// use native FormData in a browser
var FD = isBrowser?
    window.FormData :
    require('form-data');

module.exports = FormData;
module.exports.isBrowser = isBrowser;

function FormData() {
    this.fd = new FD();
}

FormData.prototype.append = function (name, data, opt) {
    if (isBrowser) {
        if (opt && opt.filename) {
            return this.fd.append(name, data, opt.filename);
        }
        return this.fd.append(name, data);
    }
    return this.fd.append.apply(this.fd, arguments);
};

FormData.prototype.pipe = function (to) {
    if (isBrowser && to.end) {
        return to.end(this.fd);
    }
    return this.fd.pipe(to);
};

FormData.prototype.getHeaders = function () {
    if (isBrowser) {
        return {};
    }
    return this.fd.getHeaders();
};
