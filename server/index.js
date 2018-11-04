'use strict';

var fs = require('fs');

var express = require('express');
var http = require('http');
var https = require('https');
var constants = require('constants');
// var assert = require('assert');
var compression = require('compression');
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var _ = require('lodash');
const fileUpload = require('express-fileupload');
var app = express();
var config = require('../config/config');
var routes = require('./routes');
var database = require('./database');
var lib = require('./lib');
var session = require('express-session');
var https = require('https');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/** Render Engine
 *
 * Put here render engine global variable trough app.locals
 * **/
app.set('views', path.join(__dirname, '../views'));

app.locals.buildConfig = config.BUILD;
app.locals.recaptchaKey = '';
app.locals.buildConfig = config.BUILD;
app.locals.miningFeeBits = 100;

var dotCaching = true;
if (config.PRODUCTION === config.PRODUCTION_LOCAL_DEV) {
    app.locals.pretty = true;
    dotCaching = false;
}

app.engine('html', require('dot-emc').init(
    {
        app: app,
        fileExtension: 'html',
        options: {
            templateSettings: {
                cache: dotCaching
            }
        }
    }
).__express);

/** Middleware **/
app.use(bodyParser());
app.use(cookieParser());
app.use(compression());
app.use(fileUpload());

/** App settings **/
app.set('view engine', 'html');
app.disable('x-powered-by');
app.enable('trust proxy');

app.use(session({
    secret: 'secret',
    saveUninitialized: true,
    resave: true
}));

/** Serve Static cont **/
var twoWeeksInSeconds = 1209600;
if (config.PRODUCTION !== config.PRODUCTION_LOCAL_DEV) {
    app.use(express.static(path.join(__dirname, '../build'), { maxAge: twoWeeksInSeconds * 1000 }));
} else {
    app.use(express.static(path.join(__dirname, '../theme'), { maxAge: twoWeeksInSeconds * 1000 }));
    app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')), { maxAge: twoWeeksInSeconds * 1000 });
}

/** Login middleware
 *
 * If the user is logged append the user object to the request
 */

// var strIP = ip.address();
// var bIsPublicIP = checkip(strIP).isPublicIp;

app.use(function (req, res, next) {
    // if ((config.PRODUCTION === config.PRODUCTION_LOCAL_DEV || config.PRODUCTION === config.PRODUCTION_SERVER) && !req.secure) {
    //     res.redirect('https://' + req.headers.host + req.url);
    //     return;
    // }

    var sessionId = req.cookies.id;

    if (!sessionId) {
        res.header('Vary', 'Accept, Accept-Encoding, Cookie');
        res.header('Cache-Control', 'public, max-age=60'); // Cache the logged-out version
        return next();
    }

    res.header('Cache-Control', 'no-cache');
    res.header('Content-Security-Policy', "frame-ancestors 'none'");

    if (!lib.isUUIDv4(sessionId)) {
        res.clearCookie('id');
        return next();
    }

    database.getUserBySessionId(sessionId, function (err, user) {
        if (err) {
            res.clearCookie('id');
            if (err === 'NOT_VALID_SESSION') {
                return res.redirect('/');
            } else {
                console.error('[INTERNAL_ERROR] Unable to get user by session id ' + sessionId + ':', err);
                return res.redirect('/error');
            }
        }

        user.advice = req.query.m;
        user.error = req.query.err;
        req.user = user;
        next();
    });
});

/** Error Middleware
 *
 * How to handle the errors:
 * If the error is a string: Send it to the client.
 * If the error is an actual: error print it to the server log.
 *
 * We do not use next() to avoid sending error logs to the client
 * so this should be the last middleware in express .
 */
function errorHandler (err, req, res, next) {
    if (err) {
        if (typeof err === 'string') {
            return res.render('error', { error: err });
        } else {
            if (err.stack) {
                console.error('[INTERNAL_ERROR] ', err.stack);
            } else console.error('[INTERNAL_ERROR', err);
            res.render('error');
        }
    } else {
        console.warning("A 'next()' call was made without arguments, if this an error or a msg to the client?");
    }
}

routes(app);
app.use(errorHandler);

/**  Server **/
var serverHttp = http.createServer(app);
serverHttp.listen(config.PORT_HTTP, function () {
    console.log('W: Listening on port ', config.PORT_HTTP, ' with HTTP');

    lib.log('success', 'W: Listening on port ', config.PORT_HTTP, ' with HTTP');
});
var server = serverHttp;

var serverHttps;
if (config.PRODUCTION == config.PRODUCTION_SERVER) {
    var options = {
        key: fs.readFileSync(config.HTTPS_KEY),
        cert: fs.readFileSync(config.HTTPS_CERT),
        secureProtocol: 'SSLv23_method',
        secureOptions: constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_SSLv2
    };

    if (config.HTTPS_CA) {
        options.ca = fs.readFileSync(config.HTTPS_CA);
    }

    serverHttps = https.createServer(options, app);
    serverHttps.listen(config.PORT_HTTPS, function () {
        console.log('W: Listening on port ', config.PORT_HTTPS, ' with HTTPS');
    });

    server = serverHttps;
}
/** Log uncaught exceptions and kill the application **/
process.on('uncaughtException', function (err) {
    console.error((new Date()).toUTCString() + ' uncaughtException:', err.message);
    console.error(err.stack);
    process.exit(1);
});
