const { isDef, isNumber, isPlainObject, isPromise } = require('./validator');
const { canIUseGroupSetData, canIUseNextTick, getSystemInfoSync } = require('./version');

function range(num, min, max) {
    return Math.min(Math.max(num, min), max);
}
function nextTick(cb) {
    if (canIUseNextTick()) {
        wx.nextTick(cb);
    }
    else {
        setTimeout(() => {
            cb();
        }, 1000 / 30);
    }
}
function addUnit(value) {
    if (!isDef(value)) {
        return undefined;
    }
    value = String(value);
    return isNumber(value) ? `${value}px` : value;
}
function requestAnimationFrame(cb) {
    return setTimeout(() => {
        cb();
    }, 1000 / 30);
}
function pickExclude(obj, keys) {
    if (!isPlainObject(obj)) {
        return {};
    }
    return Object.keys(obj).reduce((prev, key) => {
        if (!keys.includes(key)) {
            prev[key] = obj[key];
        }
        return prev;
    }, {});
}
function getRect(context, selector) {
    return new Promise((resolve) => {
        wx.createSelectorQuery()
            .in(context)
            .select(selector)
            .boundingClientRect()
            .exec((rect = []) => resolve(rect[0]));
    });
}
function getAllRect(context, selector) {
    return new Promise((resolve) => {
        wx.createSelectorQuery()
            .in(context)
            .selectAll(selector)
            .boundingClientRect()
            .exec((rect = []) => resolve(rect[0]));
    });
}
function groupSetData(context, cb) {
    if (canIUseGroupSetData()) {
        context.groupSetData(cb);
    }
    else {
        cb();
    }
}
function toPromise(promiseLike) {
    if (isPromise(promiseLike)) {
        return promiseLike;
    }
    return Promise.resolve(promiseLike);
}
// 浮点数精度处理
function addNumber(num1, num2) {
    const cardinal = Math.pow(10, 10);
    return Math.round((num1 + num2) * cardinal) / cardinal;
}
// 限制value在[min, max]之间
const clamp = (num, min, max) => Math.min(Math.max(num, min), max);
function getCurrentPage() {
    const pages = getCurrentPages();
    return pages[pages.length - 1];
}
const isPC = ['mac', 'windows'].includes(getSystemInfoSync().platform);
// 是否企业微信
const isWxWork = getSystemInfoSync().environment === 'wxwork';

module.exports = {
    isDef,
    range,
    nextTick,
    addUnit,
    requestAnimationFrame,
    pickExclude,
    getRect,
    getAllRect,
    groupSetData,
    toPromise,
    addNumber,
    clamp,
    getCurrentPage,
    isPC,
    isWxWork,
    getSystemInfoSync
};
