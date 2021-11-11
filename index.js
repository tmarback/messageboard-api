'use strict';

const { devMode, serverPort, baseLogger, loglevel } = require('./config');

const express = require("express");
const http = require('http');
const path = require('path');

const app = express();

const YAML = require('yamljs')
const swaggerUI = require('swagger-ui-express');
const OpenApiValidator = require('express-openapi-validator');

const expressWinston = require('express-winston');
const winston = require('winston');

app.use(expressWinston.logger({
    winstonInstance: baseLogger,
    level: 'info',
    expressFormat: true,
    colorize: true,
    meta: true,
}));

app.use(express.json());

const specPath = path.join(__dirname, '/api/api-spec.yaml');
app.use('/spec/raw', express.static(specPath));

const spec = YAML.load(specPath);
app.use('/spec', swaggerUI.serve, swaggerUI.setup(spec));

app.use(
    OpenApiValidator.middleware({
        apiSpec: spec,
        validateRequests: true,
        validateResponses: devMode,
        validateSecurity: !devMode,
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
