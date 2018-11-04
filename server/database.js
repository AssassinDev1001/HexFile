
var assert = require('assert');
var uuid = require('uuid');
var config = require('../config/config');

var async = require('async');
var lib = require('./lib');
var pg = require('pg');
var passwordHash = require('password-hash');
var speakeasy = require('speakeasy');
var m = require('multiline');
var fs = require('fs');


var databaseUrl = config.DATABASE_URL_LOCAL;

console.log('web server connected to db : [', databaseUrl, ']');
lib.log('info', 'web server connected to db : [' + databaseUrl + ']');

if (!databaseUrl) { throw new Error('must set DATABASE_URL environment var'); }

pg.types.setTypeParser(20, function (val) { // parse int8 as an integer
    return val === null ? null : parseInt(val);
});

// callback is called with (err, client, done)
function connect (callback) {
    return pg.connect(databaseUrl, callback);
    // return pg.connect({connectionString:databaseUrl, ssl:true}, callback);
}

function query (query, params, callback) {
    // third parameter is optional
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }

    doIt();
    function doIt () {
        connect(function (err, client, done) {
            if (err) return callback(err);

            client.query(query, params, function (err, result) {
                done();
                if (err) {
                    if (err.code === '40P01') {
                        console.log('[DB_DEADLOCKED] retrying deadlocked transaction - query:' + query + '   params:' + params);
                        lib.log('error', '[DB_DEADLOCKED] retrying deadlocked transaction - query:' + query + '   params:' + params);
                        return doIt();
                    }
                    return callback(err);
                }
                callback(null, result);
            });
        });
    }
}

exports.query = query;

pg.on('error', function (err) {
    console.error('POSTGRES EMITTED AN ERROR:' + err);
    lib.log('error', 'POSTGRES EMITTED AN ERROR:' + err);
});

// runner takes (client, callback)

// callback should be called with (err, data)
// client should not be used to commit, rollback or start a new transaction

// callback takes (err, data)

function getClient (runner, callback) {
    doIt();

    function doIt () {
        connect(function (err, client, done) {
            if (err) return callback(err);

            function rollback (err) {
                client.query('ROLLBACK', done);

                if (err.code === '40P01') {
                    console.log('[ROLLBACK] - retrying deadlocked transaction..');
                    lib.log('error', '[ROLLBACK] - retrying deadlocked transaction..');
                    return doIt();
                }

                callback(err);
            }

            client.query('BEGIN', function (err) {
                if (err) { return rollback(err); }

                runner(client, function (err, data) {
                    if (err) { return rollback(err); }

                    client.query('COMMIT', function (err) {
                        if (err) { return rollback(err); }

                        done();
                        callback(null, data);
                    });
                });
            });
        });
    }
}

// Returns a sessionId
exports.createUser = function (username, password, email, ipAddress, userAgent, time_zone, callback) {
    assert(username && password);

    getClient(function (client, callback) {
        var nextId;
        var sql = 'SELECT MAX(id) FROM users';
        query(sql, [], function (err, result) {
            nextId = result.rows[0]['max'];
            nextId = (nextId == null) ? 1 : (nextId + 1);

            var hashedPassword = passwordHash.generate(password);

            sql = 'INSERT INTO users(id, username, email, password) VALUES($1, $2, $3, $4) RETURNING id';
            client.query(sql, [nextId, username, email, hashedPassword], function (err, data) {
                if (err) {
                    if (err.code === '23505') {
                        return callback('USERNAME_TAKEN');
                    } else {
                        return callback(err);
                    }
                }

                assert(data.rows.length === 1);
                var user = data.rows[0];

                return createSession(client, user.id, ipAddress, userAgent, false, time_zone, callback);
            });
        });
    }, callback);
};

// Possible errors:
//   NO_USER, WRONG_PASSWORD, INVALID_OTP
exports.validateUser = function (username, password, callback) {
    assert(username && password);
    var sql = 'SELECT id, password FROM users WHERE (lower(username) = lower($1) OR lower(email) = lower($1))';
    query(sql, [username], function (err, data) {
        if (err) return callback(err);

        if (data.rows.length !== 1) { return callback('NO_USER'); }

        var user = data.rows[0];

        var verified = passwordHash.verify(password, user.password);
        if (!verified) {
            return callback('WRONG_PASSWORD');
        }

        callback(null, user.id);
    });
};

/** Expire all the not expired sessions of an user by id **/
exports.expireSessionsByUserId = function (userId, callback) {
    assert(userId);
    query('UPDATE sessions SET expired = now() WHERE user_id = $1 AND expired > now()', [userId], callback);
};

function createSession (client, userId, ipAddress, userAgent, remember, time_zone, callback) {
    var sessionId = uuid.v4();

    var expired = new Date();
    if (remember) { expired.setFullYear(expired.getFullYear() + 10); } else { expired.setDate(expired.getDate() + 21); }

    client.query('INSERT INTO sessions(id, user_id, ip_address, user_agent, expired, time_zone) VALUES($1, $2, $3, $4, $5, $6) RETURNING id',
        [sessionId, userId, ipAddress, userAgent, expired, time_zone], function (err, res) {
            if (err) return callback(err);
            assert(res.rows.length === 1);

            var session = res.rows[0];
            assert(session.id);
            var sessionInfo = {id: session.id, expires: expired};
            return callback(null, sessionInfo);
        });
}

exports.createOneTimeToken = function (userId, ipAddress, userAgent, time_zone, callback) {
    assert(userId);
    // getClient(function(client, callback)
    // {
    var id = uuid.v4();
    /* client. */query('INSERT INTO sessions(id, user_id, ip_address, user_agent, ott, time_zone) VALUES($1, $2, $3, $4, $5, $6) RETURNING id', [id, userId, ipAddress, userAgent, true, time_zone], function (err, result) {
        if (err) return callback(err);
        assert(result.rows.length === 1);

        var ott = result.rows[0];
        callback(null, ott.id);
    });
    // }, callback);
};

exports.createSession = function (userId, ipAddress, userAgent, remember, time_zone, callback) {
    assert(userId && callback);

    getClient(function (client, callback) {
        createSession(client, userId, ipAddress, userAgent, remember, time_zone, function (err, sessionInfo) {
            callback(err, sessionInfo);
        });
    }, function (err, sessionInfo) {
        callback(err, sessionInfo);
    });
};

exports.getUserFromUsername = function (username, callback) {
    assert(username && callback);
    query('SELECT * FROM users_view WHERE lower(username) = lower($1)', [username], function (err, data) {
        if (err) return callback(err);

        if (data.rows.length === 0) { return callback('NO_USER'); }

        assert(data.rows.length === 1);
        var user = data.rows[0];
        assert(typeof user.balance_satoshis === 'number');

        callback(null, user);
    });
};

exports.getUsersFromEmail = function (email, callback) {
    assert(email, callback);
    query('select * from users where email = lower($1)', [email], function (err, data) {
        if (err) return callback(err);

        if (data.rows.length === 0) { return callback('NO_USERS'); }

        callback(null, data.rows);
    });
};

exports.getUserBySessionId = function (sessionId, callback) {
    assert(sessionId && callback);
    query('SELECT * FROM users_view WHERE id = (SELECT user_id FROM sessions WHERE id = $1 AND ott = false AND expired > now())', [sessionId], function (err, response) {
        if (err) return callback(err);

        var data = response.rows;
        if (data.length === 0) { return callback('NOT_VALID_SESSION'); }

        assert(data.length === 1);

        var user = data[0];

        return callback(null, user);
    });
};

exports.getUserByValidRecoverId = function (recoverId, callback) {
    assert(recoverId && callback);
    query('SELECT * FROM users_view WHERE id = (SELECT user_id FROM recovery WHERE id = $1 AND used = false AND expired > NOW())', [recoverId], function (err, res) {
        if (err) return callback(err);

        var data = res.rows;
        if (data.length === 0) { return callback('NOT_VALID_RECOVER_ID'); }

        assert(data.length === 1);
        return callback(null, data[0]);
    });
};

exports.getUserByName = function (username, callback) {
    assert(username);
    query('SELECT * FROM users WHERE lower(username) = lower($1)', [username], function (err, result) {
        if (err) return callback(err);
        if (result.rows.length === 0) { return callback('USER_DOES_NOT_EXIST'); }

        assert(result.rows.length === 1);
        callback(null, result.rows[0]);
    });
};

exports.checkDup = function (reg_name, email, callback) {
    var sql = 'SELECT (SELECT count(*) FROM users WHERE lower(username)=lower($1)) + (SELECT count(*) FROM register WHERE lower(username)=lower($1)) as name_dup';
    query(sql, [reg_name], function (err, res) {
        if (err) return callback(err);
            if (res.rowCount != 1) return callback('ERROR_1');

        var nCntDup = parseInt(res.rows[0].name_dup);
        if (nCntDup > 0) return callback(null, 'NAME_DUP');

        sql = 'SELECT (SELECT count(*) FROM users WHERE lower(email)=lower($1)) + (SELECT count(*) FROM register WHERE lower(email)=lower($1)) as email_dup';
        query(sql, [email], function (err, res) {
            if (err) return callback(err);

            if (res.rowCount != 1) return callback('ERROR_2');

            var nCntDup = parseInt(res.rows[0].email_dup);
            if (nCntDup > 0) return callback(null, 'EMAIL_DUP');

            callback(null, 'NO_DUP');
        });
    });
};

exports.createRegBuffer = function (username, password, email, ipAddress, userAgent, verify_code, callback) {
    var sql;
    sql = 'DELETE FROM register WHERE username=$1';
    query(sql, [username], function (err, res) {
        if (err) return callback(err);

        sql = 'INSERT INTO register (username, password, email, ip_address, user_agent, verify_code, created) VALUES($1, $2, $3, $4, $5, $6, now())';
        query(sql, [username, password, email, ipAddress, userAgent, verify_code], function (err, res) {
            if (err) return callback(err);
            return callback(null);
        });
    });
};

/*
 * get the company mail address or set to the default value
 */
exports.getCompanyMail = function (callback) {
    /* getClient(function(client, callback)
    { */
    query("SELECT strvalue FROM common WHERE strkey='company_mail'", function (err, res) {
        if (err) return callback(err);
        if (res.rowCount === 0) {
            lib.log('info', 'setting - insert company_mail [begin] : example@domain.com');
            console.log('setting - insert company_mail [begin] : example@domain.com');
            /* client. */query("INSERT INTO common(strkey, strvalue) VALUES ('company_mail', 'example@domain.com')", function (error, result) {
                if (error) return callback(error);
                lib.log('info', 'setting - insert company_mail [end] : example@domain.com');
                console.log('setting - insert company_mail [end] : example@domain.com');
                return callback(null, 'example@domain.com');
            });
        } else {
            return callback(null, res.rows[0].strvalue);
        }
    });
    /* }, callback); */
};

/*
 * get company password for the above email or return the default
 */
exports.getCompanyPassword = function (callback) {
    /* getClient(function(client, callback)
    { */
    query("SELECT strvalue FROM common WHERE strkey='mail_password'", function (err, res) {
        if (err) return callback(err);
        if (res.rowCount === 0) {
            /* client. */query("INSERT INTO common(strkey, strvalue) VALUES ('mail_password', 'password')", function (error, result) {
                if (error) return callback(error);
                return callback(null, 'password');
            });
        } else {
            return callback(null, res.rows[0].strvalue);
        }
    });
    // }, callback);
};

exports.checkVerifyCode = function (username, verify_code, callback) {
    var sql = "SELECT DATE_PART('hour', now()-created)*60 + DATE_PART('minute', now()-created) AS min_diff, check_count, verify_code FROM register WHERE lower(username)=lower($1)";
    query(sql, [username], function (err, res) {
        if (err) return callback(err);
        if (res.rowCount != 1) {
            if (err) return callback(err);
            return callback('ILLEGAL_USER');
        } else {
            sql = 'UPDATE register SET check_count=check_count + 1 WHERE lower(username)=lower($1)';
            query(sql, [username], function (err) {
                if (err) return callback(err);

                var nMin = res.rows[0].min_diff;
                var nCheckCount = res.rows[0].check_count;
                var strVerifyCode = res.rows[0].verify_code;

                nMin = parseInt(nMin);
                nCheckCount = parseInt(nCheckCount);
                if (nCheckCount > 3) {
                    sql = 'DELETE FROM register WHERE lower(username)=lower($1)';
                    /* client. */query(sql, [username], function (err) {
                        if (err) return callback(err);
                        return callback('EXCEED_MAX_INPUT');
                    });
                } else {
                    if (nMin > 5) {
                        sql = 'DELETE FROM register WHERE lower(username)=lower($1)';
                        /* client. */query(sql, [username], function (err) {
                            if (err) return callback(err);
                            return callback('EXCEED_MAX_MINUTE');
                        });
                    } else {
                        if (strVerifyCode != verify_code) {
                            return callback('VERIFY_CODE_MISMATCH');
                        }
                        return callback(null, res.rows[0]);
                    }
                }
            });
        }
    });
};

exports.delRegBuffer = function (username, callback) {
    var sql = "DELETE FROM register WHERE lower(username)=lower($1) OR (DATE_PART('hour', now()-created)*60 + DATE_PART('minute', now()-created)) > 5 OR check_count > 3";
    query(sql, [username], function (err) {
        if (err) return callback(err);

        callback(null);
    });
};

exports.getVerifyCodeFromRegBufferWithUsername = function (username, email, strVerifyCode, callback) {
    var sql = 'SELECT * ' +
        'FROM register ' +
        'WHERE  check_count < 3 AND ' +
        'lower(username) = lower($1) AND ' +
        'email = $2 AND ' +
        'extract(epoch from (NOW() - created)) < 300 ' +
        'ORDER BY created DESC';

    query(sql, [username, email], function (err, result) {
        if (err) { return callback(err); }

        if (result.rowCount == 0) { return callback('TIME_LIMIT', ''); }

        sql = 'UPDATE register SET verify_code = $1, email = $2, check_count = check_count + 1 WHERE username = $3 AND verify_code = $4';
        query(sql, [strVerifyCode, email, username, result.rows[0]['verify_code']], function (err) {
            if (err) return callback(err, false);
            return callback(null, strVerifyCode);
        });
    });
};

/**
 * Insert File
 * @author Silver Star
 * @since 2018.7.12
 * @param param.id(-1 / >1)
 * @param param.original_filename
 * @param param.saved_filename
 * @param param.description
 * @param param.file_type
 * @param param.file_size
 * @return {id, saved_filename, original_filename, created, description, file_size, file_type, download_count,icon_path, prev_original_filename}
 */
exports.insertFile = function(param, callback) {
    var sql = '';
    if(param.id != -1 && param.id != undefined) {
        sql = 'SELECT * FROM files WHERE id = $1';
        query(sql, [param.id], function(err, current_file_info) {
            if(err)
                return callback(err);
            current_file_info = current_file_info.rows[0];

            sql =   'UPDATE files ' +
                    'SET saved_filename = $1, original_filename = $2, created = NOW(), description = $3, ' +
                    'file_size = $4, file_type = $5, download_count = 0, icon_path = $6 WHERE id = $7 RETURNING *';
            query(sql, [param.saved_filename, param.original_filename, param.description, param.file_size, param.file_type, '', param.id], function(err, new_file_info) {
                if(err)
                    return callback(err);
                new_file_info = new_file_info.rows[0];
                if(current_file_info != undefined)
                    new_file_info.prev_original_filename = current_file_info.original_filename;
                return callback(null, new_file_info);
            });

        });
    } else {
        sql = 'INSERT INTO files (saved_filename, original_filename, file_size, description, file_type, icon_path) VALUES($1, $2, $3, $4, $5, $6) RETURNING *';
        query(sql, [param.saved_filename, param.original_filename, param.file_size, param.description, param.file_type, ''], function(err, new_file_info) {
            if (err)
                return callback(err);
            new_file_info = new_file_info.rows[0];
            return callback(null, new_file_info);
        });
    }
};

exports.deleteFile = function(param, callback) {
    let sql = 'SELECT * FROM files WHERE id = $1';
    query(sql, [param.file_id], function(err, file_info) {
       if(err)
           return callback(err);
       if(file_info.rows.length != 1)
           return callback('NO_FILE');
       file_info = file_info.rows[0];

       sql = 'DELETE FROM files WHERE id = $1';
       query(sql, [param.file_id], function(err) {
           if(err)
               return callback(err);
           return callback(null, file_info);
       })
    });
};


/**
 * Update Description of File
 * @author Silver Star
 * @since 2018.7.13
 * @param param
 * @param callback
 */
exports.updateDescription = function(param, callback) {
    let sql = 'UPDATE files SET description = $1 WHERE id = $2';
    query(sql, [param.description, param.file_id], function(err, result) {
        return callback(err);
    });
};

/**
 * Get File List
 * @author Silver Star
 * @since 2018.7.13
 * @param param
 * @return {meta:{}, data:[{id, saved_filename, original_filename, created_formated,
 *          description, file_size, file_type, download_count, icon_path}]}
 */
exports.getFileList = function(param, callback) {
    let result = {};
    result.meta = {};
    result.data = [];

    result.meta.page = param.pagination.page;
    result.meta.perpage = param.pagination.perpage;
    result.meta.sort = param.sort.sort;
    result.meta.field = param.sort.field;

    let sql = 'SELECT COUNT(*) AS cnt FROM files';
    query(sql, function(err, count_result) {
        if(err)
            return callback(err);
        result.meta.total = count_result.rows[0].cnt;

        result.meta.pages = Math.ceil(result.meta.total / result.meta.perpage);
        if (result.meta.pages < result.meta.page)
            result.meta.page = result.meta.pages;
        var offset = (result.meta.page - 1) * result.meta.perpage;
        if (offset < 0)
            offset = 0;

        var where_clause = '';
        if(param.query.generalSearch != '') {
            var filter = "'%" + param.query.generalSearch + "%'";
            where_clause = " WHERE lower(id::TEXT) LIKE " + filter + "\n" +
                "OR lower(original_filename) LIKE " + filter + "\n" +
                "OR lower(description) LIKE " + filter + "\n" +
                "OR lower(file_type) LIKE " + filter + "\n" +
                "OR lower(file_size::TEXT) LIKE " + filter + "\n" +
                "OR lower(download_count::TEXT) LIKE " + filter + "\n" +
                "OR lower((created AT time zone 'Asia/Shanghai')::TEXT) LIKE " + filter + "\n";
        }


        sql =   "SELECT *, created AT time zone $1 AS created_formated\n" +
                "FROM files\n" + where_clause +
                "ORDER BY " + result.meta.field + " " + result.meta.sort + " " +
                "LIMIT $2 OFFSET $3\n";
        query(sql, [param.query.time_zone_name, result.meta.perpage, offset], function(err, data_result) {
            if(err)
                return callback(err);
            result.data = data_result.rows;
            return callback(null, result);
        });
    });
};