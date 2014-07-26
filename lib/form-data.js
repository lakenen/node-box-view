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
        // if it's a typed array, we need to get the underlying ArrayBuffer
        if (isTypedArray(data)) {
            data = data.buffer;
        }
        // data must be converted to Blob if it's an ArrayBuffer
        if (data instanceof window.ArrayBuffer) {
          data = new window.Blob([ data ]);
        }
        // native FormData only supports a filename option
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

function isTypedArray(object) {
  return object instanceof window.Int8Array ||
         object instanceof window.Uint8Array ||
         object instanceof window.Int16Array ||
         object instanceof window.Uint16Array ||
         object instanceof window.Int32Array ||
         object instanceof window.Uint32Array ||
         object instanceof window.Float32Array ||
         object instanceof window.Float64Array;
}
