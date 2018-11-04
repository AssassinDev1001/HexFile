
var nodemailer = require('nodemailer');
var database = require('./database');

/*
 * email send function (in )
 * details object there are all the information about the mail transfer
 * source address can be get from the common table in database
 */
function send (details, callback) {

    var user, pass, service;
    database.getCompanyMail(function (err, res) {
        if (err) return callback(err);
        user = res;
        service = res.substr(res.indexOf('@') + 1);
        service = service.substr(0, service.indexOf('.'));

        database.getCompanyPassword(function (err, result) {
            pass = result;

            // Create a SMTP transporter object
            let transporter = nodemailer.createTransport({
                service: service,
                auth: {
                    user: user,
                    pass: pass
                }
            });

            // Message object
            let message = {
                from: 'Panorama Center',
                to: details.to,
                subject: 'Support Message',
                html: details.html
            };

            transporter.sendMail(message, (err, info) => {
                if (err) {
                    console.log('\n  Error occurred. ' + err.message);
                    return callback(err);
                }

                callback(null);
            });
        });
    });
};

exports.sendRegVCode = function (to, strVerifyCode, i18n_lang, callback) {
    var strRegVerifyCode = 'Verification Code';
    var strRegVerifyCode_is = 'Verification Code is';
    // if(i18n_lang == 'zh') {
    //     strRegVerifyCode = 'MADABIT 验证妈';
    //     strRegVerifyCode_is = 'MADABIT 验证妈是';
    // }

    var html = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +

        '<html xmlns="http://www.w3.org/1999/xhtml">' +
        '<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8" />' +
        '<title>' + strRegVerifyCode + '</title>' +
        '</head>' +
        '<body>' +
        '<h2>' + strRegVerifyCode_is + '</h2>' +
        '<br>' +
        strVerifyCode +
       '</body></html>';

    var details = {
        to: to,
        subject: strRegVerifyCode,
        html: html
    };
    send(details, callback);
};

