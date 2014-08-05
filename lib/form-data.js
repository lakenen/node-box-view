/*global window*/
var isBrowser = typeof window !== 'undefined' &&
                typeof window.FormData !== 'undefined';

// use native FormData in a browser
var FD = isBrowser?
    window.FormData :
    require('form-data');

module.exports = FormData;

function FormData() {
    if (!(this instanceof FormData)) {
        return new FormData();
    }
    var fd = new FD();

    if (!isBrowser) {
        return fd;
    } else {
        this.fd = fd;
    }
}

FormData.prototype.append = function (name, data, opt) {
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
};

FormData.prototype.pipe = function (to) {
    if (to.end) {
        return to.end(this.fd);
    }
};

FormData.prototype.getHeaders = function () {
    return {};
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
