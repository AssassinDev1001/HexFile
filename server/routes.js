var assert = require('better-assert');
var database = require('./database');
var user = require('./user');
var mime = require('mime');
var fs = require('fs');

function staticPageLogged (page, loggedGoTo) {
    return function (req, res) {
        var user = req.user;
        if (!user) {
            if (page === 'register') {
                return res.render('register');
            }

            return res.render(page);
        }

        if (loggedGoTo) return res.redirect(loggedGoTo);

        return res.render(page, { user: user });
    };
};

function contact (origin) {
    assert(typeof origin === 'string');

    return function (req, res, next) {
        var ret = '\tUser Information\n' + req.user + '\n\tEmail\n' + req.body.email + '\n\tMessage' + req.body.message;
        var user = req.user;
        var from = req.body.email;
        var message = req.body.message;

        if (!from) {
            return res.render(origin, {
                user: user,
                warning: 'email required'
            });
        }

        if (!message) {
            return res.render(origin, {
                user: user,
                warning: 'message required'
            });
        }

        if (user) message = 'user_id: ' + req.user.id + '\n' + message;

        sendEmail.contact(from, message, null, function (err) {
            if (err) { return next(new Error('Error sending email: \n' + err)); }

            return res.render(origin, {
                user: user,
                success: 'Thank you for writing, one of my humans will write you back very soon :) ',
                ret: ret
            });
        });
    };
}

function restrict (req, res, next) {
    if (!req.user) {
        res.status(401);
        if (req.header('Accept') === 'text/plain') { res.send('Not authorized'); } else { res.render('401'); }
    } else { next(); }
};

function restrictRedirectToHome (req, res, next) {
    if (!req.user) {
        res.redirect('/');
        return;
    }
    next();
};

function adminRestrict (req, res, next) {
    if (!req.user || !req.user.admin) {
        res.status(401);
        if (req.header('Accept') === 'text/plain') { res.send('Not authorized'); } else { res.render('401'); } // Not authorized page.
        return;
    }
    next();
}

module.exports = function (app) {
    // app.get('/', staticPageLogged('index'));
    app.get('/', user.index);
    app.get('/register', staticPageLogged('register', '/'));
    app.get('/login', staticPageLogged('login', '/'));
    app.get('/forgot-password', staticPageLogged('forgot-password'));

    app.get('/error', function (req, res, next) { // Sometimes we redirect people to /error
        return res.render('error');
    });

    app.post('/contact', contact('contact'));
    app.post('/logout', restrictRedirectToHome, user.logout);
    app.get('/logout', restrictRedirectToHome, user.logout);
    app.post('/login', user.login);
    app.post('/register', user.register);
    app.post('/register-verify', user.registerVerify);
    app.post('/resendRegisterVerifyCodeToEmail', user.resendRegisterVerifyCodeToEmail);

    app.post('/uploadAvatar', restrict, user.uploadAvatar);

    app.post('/uploadFile', restrict, user.uploadFile);
    app.post('/updateDescription', restrict, user.updateDescription);
    app.post('/deleteFile', restrict, user.deleteFile);
    app.get('/download/:saved_filename/:original_filename', function(req, res) {
        var file = 'theme/files/' + req.params.saved_filename;
        var mimetype = mime.lookup(file);

        res.setHeader('Content-disposition', 'attachment; filename=' + req.params.original_filename);
        res.setHeader('Content-type', mimetype);

        var filestream = fs.createReadStream(file);
        filestream.pipe(res);
    });
    app.post('/getFileList', user.getFileList);

    app.post('/ott', restrict, function (req, res, next) {
        var user = req.user;
        var time_zone = req.user.time_zone;
        var ipAddress = req.ip;
        var userAgent = req.get('user-agent');
        assert(user);
        // console.log('WRT : routes.js : app.post/ott');
        database.createOneTimeToken(user.id, ipAddress, userAgent, time_zone, function (err, token) {
            if (err) {
                console.error('[INTERNAL_ERROR] unable to get OTT got ' + err);
                res.status(500);
                return res.send('Server internal error');
            }
            res.send(token);
        });
    });

    app.get('*', function (req, res) {
        res.status(404);
        res.render('404');
    });
};
