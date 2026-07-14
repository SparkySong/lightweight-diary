// eslint-disable-next-line @typescript-eslint/ban-types
function isFunction(val) {
    return typeof val === 'function';
}
function isPlainObject(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
}
function isPromise(val) {
    return isPlainObject(val) && isFunction(val.then) && isFunction(val.catch);
}
function isDef(value) {
    return value !== undefined && value !== null;
}
function isObj(x) {
    const type = typeof x;
    return x !== null && (type === 'object' || type === 'function');
}
function isNumber(value) {
    return /^\d+(\.\d+)?$/.test(value);
}
function isBoolean(value) {
    return typeof value === 'boolean';
}
const IMAGE_REGEXP = /\.(jpeg|jpg|gif|png|svg|webp|jfif|bmp|dpg)/i;
const VIDEO_REGEXP = /\.(mp4|mpg|mpeg|dat|asf|avi|rm|rmvb|mov|wmv|flv|mkv)/i;
function isImageUrl(url) {
    return IMAGE_REGEXP.test(url);
}
function isVideoUrl(url) {
    return VIDEO_REGEXP.test(url);
}

module.exports = {
    isFunction,
    isPlainObject,
    isPromise,
    isDef,
    isObj,
    isNumber,
    isBoolean,
    isImageUrl,
    isVideoUrl
};
