var assert = require('better-assert');
var lib = require('./lib');
var database = require('./database');
var _ = require('lodash');
var config = require('../config/config');
var Jimp = require('jimp');
var fs = require('fs');
var sendEmail = require('./sendEmail');
var querystring = require('querystring');
var request = require('request');
var path = require('path');

var secure;
if (config.PRODUCTION === config.PRODUCTION_LOCAL_DEV) secure = true;
if (config.PRODUCTION === config.PRODUCTION_SERVER) secure = true;

var sessionOptions = {
    httpOnly: true,
    // secure : secure
    secure: false
};

// WRT : 20180404
// send verification code to phone_number
function sendVerificationCode (strPhoneNumber, strVerificationCode, strCodec, callback) {
    var codec;
    var strMsg;
    // message content should be changed to hex strings
    // english can be well done with ascii string
    // but, chinese , korean, japanese ... should be coverted to UTF-16BE codec
    if (strCodec === 'en') {
        codec = '0';
        strMsg = 'Your MADABIT Verification Code is ' + strVerificationCode;
        strMsg = Buffer.from(strMsg, 'utf8').toString('hex');
    } else if (strCodec === 'zh') {
        codec = '8';
        var strVHCode = Buffer.from(strVerificationCode, 'utf8').toString('hex');
        var nLen = strVHCode.length;

        var strUTF16BE = '';
        for (var nId = 0; nId < nLen; nId += 2) {
            strUTF16BE += '00' + strVHCode.substr(nId, 2);
        }

        // MADABIT验证码：137695。验证码有效5分钟 。【疯点】
        strMsg = '004D0041004400410042004900549A8C8BC17801FF1A0020' + strUTF16BE + '002030029A8C8BC178016709654800355206949F0020301075AF70B93011';
    }

    var form = {
        Src: 'beneforex2018',
        Pwd: 'baofu123',
        // Src: 'chourvuthy',
        // Pwd: 'lPG_!5rVM9O_J_<r6T',
        Dest: strPhoneNumber,
        Codec: codec,
        Msg: strMsg,
        Servicesid: 'SEND'
    };

    var formData = querystring.stringify(form);
    var contentLength = formData.length;

    request({
        headers: {
            'Content-Length': contentLength,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        uri: 'http://m.isms360.com:8085/mt/MT3.ashx',
        body: formData,
        method: 'POST'
    }, function (err, res, body) {
        if (err) {
            lib.log('error', 'sms - send verification code - error:' + err);
            return callback(err);
        }

        console.log('sms : ', strPhoneNumber, strVerificationCode, body);
        lib.log('info', 'sms - send verification code - phone_number:' + strPhoneNumber + '   verification_code:' + strVerificationCode + '   return:' + body);
        return callback(null, body);
    });
}

/**
 * Register a user
 * @updated by Silver Star
 */
exports.register = function (req, res, next) {
    var values = {};
    var username = lib.removeNullsAndTrim(req.body.username);
    var password = lib.removeNullsAndTrim(req.body.password);
    var password2 = lib.removeNullsAndTrim(req.body.confirm);
    var email = lib.removeNullsAndTrim(req.body.email);

    if (email == undefined) email = '';

    var renderPage = 'register';

    console.log('register - [begin] - username:' + username + '   ip:' + req.ip);
    lib.log('info', 'register - [begin] - username:' + username + '   ip:' + req.ip);

    if (req.headers.referer.includes('register') == false) {
        renderPage = 'index';
        req.originalUrl = '/';
    }

    values.username = username;
    values.password = password;
    values.confirm = password2;
    values.email = email;

    var ipAddress = req.ip;
    var userAgent = req.get('user-agent'); // infomation of browser

    var notValid = lib.isInvalidUsername(username);
    if (notValid) {
        console.log('register - username is not valid');
        lib.log('info', 'register - username is not valid');
        console.log('register - render - ' + renderPage + '   username:' + username);
        lib.log('info', 'register - render - ' + renderPage + '   username:' + username);
        return res.render(renderPage, {
            warning: 'Username is not valid.',
            values: values
        });
    }

    // stop new registrations of >16 char usernames
    if (username.length > 16) {
        console.log('register - username is too long');
        lib.log('info', 'register - username is too long');
        console.log('register - render - ' + renderPage + '   username:' + username);
        lib.log('info', 'register - render - ' + renderPage + '   username:' + username);
        return res.render(renderPage, {
            warning: 'Username is too long.',
            values: value
        });
    }

    notValid = lib.isInvalidPassword(password);
    if (notValid) {
        console.log('register - password is not valid');
        lib.log('info', 'register - password is not valid');
        console.log('register - render - ' + renderPage + '   username:' + username);
        lib.log('info', 'register - render - ' + renderPage + '   username:' + username);
        return res.render(renderPage, {
            warning: 'rule_alert6',
            values: values
        });
    }

    if (password.length > 50) {
        console.log('register - password is too long');
        lib.log('info', 'register - password is too long');
        console.log('register - render - ' + renderPage + '   username:' + username);
        lib.log('info', 'register - render - ' + renderPage + '   username:' + username);
        return res.render(renderPage, {
            warning: 'rule_alert29',
            values: value
        });
    }

    notValid = lib.isInvalidEmail(email);
    if (notValid) {
        console.log('register - render - ' + renderPage + '   username:' + username);
        lib.log('info', 'register - render - ' + renderPage + '   username:' + username);
        return res.render(renderPage, {
            warning: 'rule_alert7',
            values: values
        });
    }

    // Ensure password and confirmation match
    if (password !== password2) {
        console.log('register - password not match with confirmation.');
        lib.log('info', 'register - password not match with confirmation.');
        console.log('register - render - ' + renderPage + '   username:' + username);
        lib.log('info', 'register - render - ' + renderPage + '   username:' + username);
        return res.render(renderPage, {
            warning: 'rule_alert2',
            values: values
        });
    }

    // check username and phone_number is duplicated or not

    console.log('before check up');
    database.checkDup(username, email, function (err, strDup) {
        if (err) {
            console.log('register - check_dup - db error - username:' + username);
            lib.log('error', 'register - check_dup - db error - username:' + username);
            return res.render(renderPage, {
                warning: 'Database error in checkNameDup',
                values: values
            });
        }

        if (strDup === 'NAME_DUP') {
            console.log('register - check_dup - name already exists - username:' + username);
            lib.log('error', 'register - check_dup - name already exists - username:' + username);
            return res.render(renderPage, {
                warning: 'Username is already taken.',
                values: values
            });
        } else if (strDup === 'EMAIL_DUP') {
            console.log('register - check_dup - email already exists - username:' + username);
            lib.log('error', 'register - check_dup - email already exists - username:' + username);
            return res.render(renderPage, {
                warning: 'Email is already taken.',
                values: values
            });
        }

        if (strDup !== 'NO_DUP') {
            console.log('register - check_dup - case - username:' + username + '   str_dup:' + strDup);
            lib.log('error', 'register - check_dup - case - username:' + username + '   str_dup:' + strDup);
            return res.render(renderPage, {
                warning: 'An error occurred.',
                values: values
            });
        }

        // register in temp buffer
        var strVerifyCode = lib.getVerifyCode();
        // if(phone_number == '85569845910') strVerifyCode = '0';

        database.createRegBuffer(username, password, email, ipAddress, userAgent, strVerifyCode, function (err) {
            if (err) {
                console.log('register - create_register_buffer - error - username:' + username + '   email:' + email + '   ip_address:' + ipAddress + '   verification_code:' + strVerifyCode);
                lib.log('error', 'register - create_register_buffer - error - username:' + username + '   email:' + email + '   ip_address:' + ipAddress + '   verification_code:' + strVerifyCode);
                return res.render(renderPage, {
                    warning: 'Database error in createRegBuffer',
                    values: values
                });
            }

            console.log('register - create_register_buffer - success - username:' + username + '   email:' + email + '   ip_address:' + ipAddress + '   verification_code:' + strVerifyCode);
            lib.log('info', 'register - create_register_buffer - success - username:' + username + '   email:' + email + '   ip_address:' + ipAddress + '   verification_code:' + strVerifyCode);

            sendEmail.sendRegVCode(email, strVerifyCode, req.i18n_lang, function (err) {
                if (err) {
                    console.log(err);
                    console.log('error - send verification code');
                }
                return res.render('register_verify', {
                    values: values
                });
            });
        });
    });
};

/**
 * Resend Phone Verification Code To Email when user register
 * @author SilverStar
 */
exports.resendRegisterVerifyCodeToEmail = function (req, res, next) {
    var username = lib.removeNullsAndTrim(req.body.username);
    var email = lib.removeNullsAndTrim(req.body.email);

    var strVerifyCode = lib.getVerifyCode();
    database.getVerifyCodeFromRegBufferWithUsername(username, email, strVerifyCode, function (err, result) {
        if (err) {
            if (err === 'TIME_LIMIT') { return res.send(err); }
            return res.send(false);
        }
        sendEmail.sendRegVCode(email, strVerifyCode, req.i18n_lang, function (err) {
            if (err) {
                console.log(err);
                console.log('error - send verification code');

                return res.send(false);
            }

            return res.send(true);
        });
    });
};

/**
 * POST
 * Public API
 * Register - phone - verification a user
 */
exports.registerVerify = function (req, res, next) {
    var values = {};

    // var recaptcha = lib.removeNullsAndTrim(req.body['g-recaptcha-response']);
    var username = lib.removeNullsAndTrim(req.body.username);
    var verify_code = lib.removeNullsAndTrim(req.body.verify_code);
    var password = lib.removeNullsAndTrim(req.body.password);
    var password2 = lib.removeNullsAndTrim(req.body.confirm);
    var email = lib.removeNullsAndTrim(req.body.email);
    var time_zone = lib.removeNullsAndTrim(req.body.time_zone);
    var ip_address = req.ip;
    var user_agent = req.get('user-agent');

    if (email === undefined) email = '';

    values.username = username;
    values.verify_code = verify_code;
    values.ip_address = ip_address;
    values.user_agent = user_agent;
    values.password = password;
    values.confirm = password2;
    values.email = email;
    values.time_zone = time_zone;

    var notValidUsername = lib.isInvalidUsername(username);
    var notValidPassword = lib.isInvalidPassword(password);
    if (email != '') {
        var notValidEmail = lib.isInvalidPassword(email);
        if (notValidEmail) {
            return res.render(renderPage, {
                warning: 'Parameter is not valid.'
            });
        }
    }

    if (notValidUsername || notValidPassword) {
        return res.render(renderPage, {
            warning: 'Parameter is not valid.'
        });
    }

    if (username.length > 50 || password.length > 50 || time_zone.length > 50) {
        return res.render(renderPage, {
            warning: 'Length of parameter is too long.'
        });
    }

    console.log('register_verify - username:' + username + '   verification_code:' + verify_code + '   ip_address:' + ip_address);
    lib.log('info', 'register_verify - username:' + username + '   verification_code:' + verify_code + '   ip_address:' + ip_address);

    database.checkVerifyCode(username, verify_code, function (err_check) {
        if (err_check === 'ILLEGAL_USER') {
            console.log('register_verify - illegal_user - username:' + username + '   verification_code:' + verify_code);
            lib.log('error', 'register_verify - illegal_user - username:' + username + '   verification_code:' + verify_code);

            return res.render('register_verify', {
                warning: 'Illegal User attempt was found. Try register from the first step.',
                values: values
            });
        } else if (err_check === 'EXCEED_MAX_INPUT') {
            console.log('register_verify - exceed_max_input - username:' + username + '   verification_code:' + verify_code);
            lib.log('error', 'register_verify - exceed_max_input - username:' + username + '   verification_code:' + verify_code);
            return res.render('register_verify', {
                warning: 'You exceed 3 times for verification code input. Try register from the first step.',
                values: values
            });
        } else if (err_check === 'EXCEED_MAX_MINUTE') {
            console.log('register_verify - exceed_max_time - username:' + username + '   verification_code:' + verify_code);
            lib.log('error', 'register_verify - exceed_max_time - username:' + username + '   verification_code:' + verify_code);

            return res.render('register_verify', {
                warning: 'You exceed 5 min for verification. Try register from the first step.',
                values: values
            });
        } else if (err_check === 'VERIFY_CODE_MISMATCH') {
            console.log('register_verify - verification_code_mismatch - username:' + username + '   verification_code:' + verify_code);
            lib.log('error', 'register_verify - verification_code_mismatch - username:' + username + '   verification_code:' + verify_code);

            return res.render('register_verify', {
                warning: 'Verification code mismatch. Try again.',
                values: values
            });
        } else if (err_check == null) {
            database.createUser(values.username, values.password, values.email, values.ip_address, values.user_agent, values.time_zone, function (err, sessionInfo) {
                if (err) {
                    if (err === 'USERNAME_TAKEN') {
                        console.log('register_verify - create_user - error - username_taken - username:' + values.username);
                        lib.log('error', 'register_verify - create_user - username_taken - username:' + values.username);
                        return res.render('register', {
                            warning: 'Username is already taken.',
                            values: values
                        });
                    }

                    console.log('register_verify - create_user - case - username:' + values.username);
                    lib.log('error', 'register_verify - create_user - case - username:' + values.username);

                    return next(new Error('Unable to register user: \n' + err));
                }

                database.delRegBuffer(values.username, function (err) {
                    if (err) {
                        console.log('register_verify - delete_reg_buffer - error - username:' + values.username);
                        lib.log('error', 'register_verify - delete_reg_buffer - error - username:' + values.username);
                        return next(new Error('Unable to register user: \n' + err));
                    }

                    var cwd = 'theme/img/photos/';
                    // if (config.PRODUCTION === config.PRODUCTION_LOCAL_DEV || config.PRODUCTION === config.PRODUCTION_SERVER) {
                    //     cwd = 'build/img/photos/';
                    // }

                    var src = cwd + 'default_avatar.jpg';
                    var dst = cwd + username + '.jpg';
                    fs.copyFile(src, dst, function (error) {
                        if (error) throw error;

                        var sessionId = sessionInfo.id;
                        var expires = sessionInfo.expires;
                        res.cookie('id', sessionId, sessionOptions);

                        console.log('register_verify - register - success - username:' + values.username);
                        lib.log('success', 'register_verify - register - success - username:' + values.username);

                        return res.redirect('/');
                    });
                });
            });
        } else {
            console.log('register_verify - unknown error - username:' + username);
            lib.log('error', 'register_verify - unknown error - username:' + username);
            return res.render('register_verify', {
                warning: 'Unknown error occured.',
                values: values
            });
        }
    });
};

/**
 * POST
 * Public API
 * Login a user
 */
exports.login = function (req, res, next) {
    var username = lib.removeNullsAndTrim(req.body.username);
    var password = lib.removeNullsAndTrim(req.body.password);
    var remember = !!req.body.remember;
    var ipAddress = req.ip;
    var userAgent = req.get('user-agent');
    var time_zone = lib.removeNullsAndTrim(req.body.time_zone_login);

    var renderPage = 'login';

    if (req.headers.referer.includes('login') == false) {
        renderPage = 'index';
        req.originalUrl = '/';
    }

    var notValidUsername = lib.isInvalidUsername(username);
    var notValidPassword = lib.isInvalidPassword(password);

    if (notValidUsername || notValidPassword) {
        return res.render(renderPage, {
            warning: 'Parameter is not valid.'
        });
    }

    if (!username || !password) {
        return res.render(renderPage, {
            warning: 'No username or password'
        });
    }

    if (username.length > 50 || password.length > 50 || time_zone.length > 50) {
        return res.render(renderPage, {
            warning: 'Length of parameter is too long.'
        });
    }

    database.validateUser(username, password, function (err, userId) {
        if (err) {
            console.log('login - validate_user - username:' + username, '   error:' + err);
            lib.log('error', 'login - validate_user - username:' + username, '   error:' + err);

            if (err === 'NO_USER') {
                return res.render(renderPage, {
                    warning: 'Cannot find user.'
                });
            }
            if (err === 'WRONG_PASSWORD') {
                return res.render(renderPage, {
                    warning: 'Invalid Password'
                });
            }
            if (err === 'INVALID_OTP') {
                var warning = otp ? 'Invalid one-time password' : undefined;
                return res.render('login-mfa', {
                    username: username,
                    password: password,
                    warning: warning
                });
            }
            return next(new Error('Unable to validate user ' + username + ': \n' + err));
        }
        assert(userId);

        database.createSession(userId, ipAddress, userAgent, remember, time_zone, function (err, sessionInfo) {
            if (err) { return next(new Error('Unable to create session for userid ' + userId + ':\n' + err)); }

            var sessionId = sessionInfo.id;
            var expires = sessionInfo.expires;

            if (remember) { sessionOptions.expires = expires; }

            res.cookie('id', sessionId, sessionOptions);
            res.redirect('/');
        });
    });
};

/**
 * POST
 * Logged API
 * Logout the current user
 */
exports.logout = function (req, res, next) {
    var sessionId = req.cookies.id;
    var userId = req.user.id;

    assert(sessionId && userId);

    database.expireSessionsByUserId(userId, function (err) {
        if (err) {
            console.log('logout - error - username:' + req.user.username);
            return next(new Error('Unable to logout got error: \n' + err));
        }

        console.log('logout - success - username:' + req.user.username);
        sessionOptions.expires = null;

        res.cookie('id', sessionId, sessionOptions);
        res.redirect('/');
    });
};

exports.uploadAvatar = function (req, res) {
    var user = req.user;

    var strReturnURL = req.body.current_url;
    if (strReturnURL === '' || strReturnURL === undefined || strReturnURL === null) {
        strReturnURL = '/';
    }

    assert(user);

    var upload_path = __dirname + '/../uploads/' + req.files.avatar.name;
    var result_path = __dirname + '/../theme/img/photos/' + user.username + '.jpg';
    if (config.PRODUCTION === config.PRODUCTION_SERVER) {
        result_path = __dirname + '/../build/img/photos/' + user.username + '.jpg';
    }

    // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
    let sampleFile = req.files.avatar;

    // Use the mv() method to place the file somewhere on your server
    sampleFile.mv(upload_path, function (err) {
        if (err) {
            console.log('upload_avata - error - file.move - username:' + user.username);
            lib.log('error', 'upload_avata - file.move - username:' + user.username);
            return res.status(500).send(err);
        }

        console.log('upload_avata - success - file.move - username:' + user.username);
        lib.log('success', 'upload_avata - file.move - username:' + user.username);

        Jimp.read(upload_path, function (err, results) {
            if (err) throw err;
            else {
                results.resize(200, 200)
                    .quality(60)
                    .write(result_path);

                console.log('upload_avata - success - username:' + user.username);
                lib.log('success', 'upload_avata - username:' + user.username);

                res.redirect(strReturnURL);
            };
        });
    });
};

/**
 * Upload Scene
 * @author Silver Star
 * @since 2018.7.13
 */
exports.uploadFile = function (req, res) {
    let user = req.user;
    assert(user);

    let file_id = req.body.file_id;
    let description = req.body.description;
    let original_filename = req.files.file.name;
    let extension = path.extname(original_filename);
    let unique_id = Date.now() + '' + parseInt(Math.random() * 100000);
    let uploaded_path = __dirname + '/../uploads/' + unique_id;
    let saved_filename = user.id + '_' + unique_id + extension;
    let saved_path = __dirname + '/../theme/files/' + saved_filename;
    let uploaded_file = req.files.file;

    uploaded_file.mv(uploaded_path, function (err) {
        if (err) {
            console.log('uploadScene - error - file.move - username:' + user.username);
            lib.log('error', 'uploadScene - file.move - username:' + user.username);
            return res.status(500).send(err);
        }

        fs.rename(uploaded_path, saved_path, function (err, stats) {
            if (err) {
                console.log('uploadScene - fs.rename:', err);
                return res.send(false);
            }

            const file_stats = fs.statSync(saved_path);

            let param = {};
            param.id = file_id;
            param.original_filename = original_filename;
            param.saved_filename = saved_filename;
            param.description = description;
            param.saved_path = saved_path;
            param.file_type = extension.substr(1).toUpperCase();
            param.file_size = file_stats.size;

            database.insertFile(param, function (err, data) {
                if (err) {
                    console.log('uploadScene - db.insertScene:', err);
                    fs.unlinkSync(param.saved_path);
                    return res.send(false);
                }
                if(data.prev_original_filename != undefined)
                    fs.unlinkSync(data.prev_original_filename);
                return res.send(data);
            });
        });
    });
};

exports.deleteFile = function(req, res) {
    let param = {};
    param.file_id = req.body.file_id;

    database.deleteFile(param, function(err, deleted_file_info) {
        if(err)
            return res.send(err);

        let saved_path = __dirname + '/../theme/files/' + deleted_file_info.saved_filename;
        if (fs.existsSync(saved_path)) {
            fs.unlinkSync(saved_path);
        }
        return res.send(true);
    });
};

exports.updateDescription = function (req, res) {
    let user = req.user;
    let param = {};
    param.file_id = req.body.file_id;
    param.description = req.body.description;
    database.updateDescription(param, function(err, result) {
        if(err)
            return res.send(false);
        return res.send(true);
    });
};

exports.getFileList = function (req, res) {
    let user = req.user;

    let param = {};
    param.pagination = {};
    param.sort = {};
    param.query = {};

    param.pagination.page = req.body.pagination.page;
    param.pagination.perpage = req.body.pagination.perpage;
    if (req.body.sort == undefined) {
        param.sort.sort = 'DESC';
        param.sort.field = 'created';
    } else {
        param.sort.sort = req.body.sort.sort;
        param.sort.field = req.body.sort.field;
    }

    if(req.body.query.generalSearch == undefined)
        param.query.generalSearch = '';
    else param.query.generalSearch = req.body.query.generalSearch.toLowerCase();
    param.query.time_zone_name = req.body.query.time_zone_name;

    database.getFileList(param, function (err, result) {
        if (err)
            return res.send(err);
        return res.send(result);
    });
};

exports.index = function (req, res) {
    var user = req.user;
    return res.render('index', {
        user: user,
    });
};
