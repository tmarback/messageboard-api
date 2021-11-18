'use strict';

const { devMode, localMode, serverPort, baseLogger, loglevel } = require('./config');

const express = require("express");
const http = require('http');
const path = require('path');

const app = express();

const YAML = require('yamljs')
const swaggerUI = require('swagger-ui-express');
const OpenApiValidator = require('express-openapi-validator');

const expressWinston = require('express-winston');
const e = require('express');

app.use(expressWinston.logger({
    winstonInstance: baseLogger,
    level: 'info',
    expressFormat: true,
    colorize: true,
    meta: true,
}));

app.use(express.json());

const specPath = path.join(__dirname, '/api/api-spec.yaml');
const spec = YAML.load(specPath);
if ( localMode ) { // Remove all security in local mode
    delete spec.components.security;
    delete spec.components.securitySchemes;
    var validateSecurity = false;
} else if ( devMode ) { // Use only API key for dev server
    const apiKeyHeader = 'X-API-Key';
    spec.components.securitySchemes = {
        ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: apiKeyHeader,
        }
    };
    spec.security = [
        { ApiKeyAuth: [] }
    ];
    const apiKeys = new Set([ '1214' ]);
    validateSecurity = {
        handlers: {
            ApiKeyAuth: (req, scopes, schema) => {
                if ( apiKeys.has( req.get( apiKeyHeader ) ) ) {
                    return true;
                } else {
                    throw { status: 403, message: 'Forbidden' };
                }
            }
        }
    }
} else {
    const fullVersion = spec.info.version;
    const version = `v${fullVersion.split(".")[0]}`;
    spec.servers[0].variables.version.enum = [ version ];
    spec.servers[0].variables.version.default = version;
    validateSecurity = true;
}
app.get('/spec/raw.json', (req, res) => {
    res.status(200).json(spec);
})
app.use('/spec', swaggerUI.serve, swaggerUI.setup(spec));

app.use(
    OpenApiValidator.middleware({
        apiSpec: spec,
        validateRequests: true,
        validateResponses: devMode,
        validateSecurity: validateSecurity,
        validateApiSpec: true,
        validateFormats: 'fast',
        unknownFormats: true,
        operationHandlers: path.join(__dirname, '/handlers'),
    }),
);

app.use(expressWinston.errorLogger({
    winstonInstance: baseLogger,
    msg: `[{{err.status}}] {{err.message}} {{req.method}}${devMode ? '\n{{err.stack}}' : ''}`,
    meta: true,
    responseField: null, // Error object already has the relevant info
    level: 'error',
    exceptionToMeta: (error) => {
        return {
            error: error,
            exception: true,
            stack: devMode ? error.stack : null,
        }
    }
}));

app.use((err, req, res, next) => {
    // console.error(err);
    const status = err.status || 500;
    res.status(status).json({
        status: status,
        message: err.message,
        // errors: err.errors,
    });
});

http.createServer(app).listen(serverPort, function () {
    baseLogger.info(`Starting server on port ${serverPort} with log level ${loglevel}, dev mode ${devMode ? 'on' : 'off'}`);
});
