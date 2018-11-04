/**
 * For development you can set the variables by creating a .env file on the root
 */

var fs = require('fs');

var productLocalDev = 'LOCAL_DEV';
var productServer = 'SERVER';

var production;
production = productLocalDev;
// production = productServer;

var prodConfig;
if (production !== productLocalDev) {
    prodConfig = JSON.parse(fs.readFileSync('./config/build-config.json'));
    console.log('-- [', prodConfig['main.min.js'], '] loaded.');
}

module.exports = {

    PRODUCTION: production,

    PRODUCTION_LOCAL_DEV: productLocalDev,
    PRODUCTION_SERVER: productServer,

    DATABASE_URL_LOCAL: 'postgres://postgres:123456@localhost/hexfiledb',
    ENC_KEY: 'enc_key_wrt',
    SIGNING_SECRET: 'secret_wrt',

    PORT_HTTP: 80,
    PORT_HTTPS: 443,

    BUILD: prodConfig,
    HTTPS_KEY: './ssl/private.key',
    HTTPS_CERT: './ssl/certificate.crt',
    HTTPS_CA: './ssl/ca_bundle.crt'
};
