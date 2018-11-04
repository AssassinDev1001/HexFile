
var assert = require('better-assert');
var crypto = require('crypto');
var config = require('../config/config');
var https = require('https');
var fs = require('fs');

exports.isInvalidUsername = function (input) {
    if (typeof input !== 'string') return 'NOT_STRING';
    if (input.length === 0) return 'NOT_PROVIDED';
    if (input.length < 3) return 'TOO_SHORT';
    if (input.length > 50) return 'TOO_LONG';
    if (!/^[a-z0-9_\-]*$/i.test(input)) return 'INVALID_CHARS';
    if (input === '__proto__') return 'INVALID_CHARS';
    return false;
};

exports.isInvalidPassword = function (password) {
    if (typeof password !== 'string') return 'NOT_STRING';
    if (password.length === 0) return 'NOT_PROVIDED';
    if (password.length < 7) return 'TOO_SHORT';
    if (password.length > 200) return 'TOO_LONG';
    return false;
};

exports.isInvalidEmail = function (email) {
    if (typeof email !== 'string') return 'NOT_STRING';
    if (email.length > 100) return 'TOO_LONG';
    if (email.indexOf('@') === -1) return 'NO_@'; // no @ sign
    if (!/^[-0-9a-zA-Z.+_]+@[-0-9a-zA-Z.+_]+\.[a-zA-Z]{2,4}$/i.test(email)) return 'NOT_A_VALID_EMAIL'; // contains whitespace
    return false;
};

exports.isUUIDv4 = function (uuid) {
    return (typeof uuid === 'string') && uuid.match(/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i);
};

exports.isInt = function isInteger (nVal) {
    return typeof nVal === 'number' && isFinite(nVal) && nVal > -9007199254740992 && nVal < 9007199254740992 && Math.floor(nVal) === nVal;
};

exports.hasOwnProperty = function (obj, propName) {
    return Object.prototype.hasOwnProperty.call(obj, propName);
};

exports.getOwnProperty = function (obj, propName) {
    return Object.prototype.hasOwnProperty.call(obj, propName) ? obj[propName] : undefined;
};

exports.parseTimeString = function (str) {
    var reg = /^\s*([1-9]\d*)([dhms])\s*$/;
    var match = str.match(reg);

    if (!match) { return null; }

    var num = parseInt(match[1]);
    switch (match[2]) {
        case 'd': num *= 24;
        case 'h': num *= 60;
        case 'm': num *= 60;
        case 's': num *= 1000;
    }

    assert(num > 0);
    return num;
};

exports.printTimeString = function (ms) {
    var days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    if (days >= 3) return '' + days + 'd';

    var hours = Math.ceil(ms / (60 * 60 * 1000));
    if (hours >= 3) return '' + hours + 'h';

    var minutes = Math.ceil(ms / (60 * 1000));
    if (minutes >= 3) return '' + minutes + 'm';

    var seconds = Math.ceil(ms / 1000);
    return '' + seconds + 's';
};

var secret = config.SIGNING_SECRET;

exports.sign = function (str) {
    return crypto
        .createHmac('sha256', secret)
        .update(str)
        .digest('base64');
};

exports.validateSignature = function (str, sig) {
    return exports.sign(str) == sig;
};

exports.removeNullsAndTrim = function (str) {
    if (typeof str === 'string') { return str.replace(/\0/g, '').trim(); } else { return str; }
};

exports.clearPhoneNumber = function (phone_number) {
    if (phone_number == '') return '';

    if (phone_number.substr(0, 1) == '+') {
        phone_number = phone_number.substr(1, phone_number.length - 1);
    }

    var aryPhoneNumber = phone_number.split(' ');
    var nCnt = aryPhoneNumber.length;
    var strRealPhone = '';
    for (var nId = 0; nId < nCnt; nId++) {
        strRealPhone += aryPhoneNumber[nId];
    }

    return strRealPhone;
};
exports.getGeoInfo = function (strIP, callback) {
    var optionsget = {
        host: 'usercountry.com',
        port: 443,
        path: '/v1.0/json/' + strIP,
        method: 'GET'
    };

    var reqGet = https.request(optionsget, function (res) {
        var body = '';
        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            var fbResponse = JSON.parse(body);

            if (fbResponse.status == 'failure') {
                var userInfo = {};
                userInfo.country = 'Cambodia';
                userInfo.city = 'Phnom Penh';
                userInfo.alpha_2 = 'KH';
                userInfo.alpha_3 = 'KHM';
                userInfo.phone = '855';

                return callback(null, userInfo);
            } else if (fbResponse.status == 'success') {
                var userInfo = {};
                userInfo.country = fbResponse.country.name;
                userInfo.city = fbResponse.region.city;
                userInfo.alpha_2 = fbResponse.country.alpha - 2;
                userInfo.alpha_3 = fbResponse.country.alpha - 3;
                userInfo.phone = fbResponse.country.phone;

                return callback(null, userInfo);
            }
        });

        res.on('error', function () {
            return callback('ERROR_1');
        });
    });
    reqGet.end();
};

exports.getCommaFloat = function (n, decimals) {
    if (typeof decimals === 'undefined') {
        if (n % 100 === 0) { decimals = 0; } else { decimals = 2; }
    }

    var original = n.toFixed(decimals);
    var aryOriginal = original.split('.');
    if (aryOriginal.length == 1) {
        return original.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    }

    var result = aryOriginal[0].replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,') + '.' + aryOriginal[1];
    return result;
};

exports.log = function (strMark, strMsg) {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1;
    var yyyy = today.getFullYear();

    if (dd < 10) dd = '0' + dd;
    if (mm < 10) mm = '0' + mm;

    /// //////////////////////////////////////////////////////////////////////
    var strDir = './log';
    if (!fs.existsSync(strDir)) {
        fs.mkdirSync(strDir);
    }

    var strFile = strDir + '/w_' + yyyy + mm + dd + '.log';
    if (fs.existsSync(strFile) == false) {
        fs.closeSync(fs.openSync(strFile, 'w'));
    }

    /// ///
    var strLocalTime = today.toLocaleString();
    strMsg = strLocalTime + ' : ' + strMark + ' : ' + strMsg + '\r\n';
    fs.appendFile(strFile, strMsg, function (err) {
        if (err) return console.log(strFile, ':', strMark, ':', err);
    });
};


exports.getVerifyCode = function () {
    var fRand6Digits = Math.random() * (999999 - 100000) + 100000;
    var nRand6Digits = parseInt(fRand6Digits);
    return nRand6Digits.toString();
};