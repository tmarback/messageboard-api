'use strict';

import { devMode, localMode, serverPort, websiteOrigin, loglevel, baseLogger, makeLogger, makePool } from './config.js';
import resolver from './esmresolver.js'

import http from 'http';
import path from 'path';
import express from 'express';

import { fileURLToPath } from 'url';
const __dirname = path.dirname( fileURLToPath( import.meta.url ) );

const app = express();

import YAML from 'yamljs';
import swaggerUI from 'swagger-ui-express';
import OpenApiValidator from 'express-openapi-validator';
import expressWinston from 'express-winston';
import cors from 'cors';

const apiLogger = makeLogger( 'API' );
app.use( expressWinston.logger({
    winstonInstance: apiLogger,
    level: 'info',
    expressFormat: true,
    colorize: true,
    meta: true,
}));

app.use(express.json());

const corsOptions = {
    origin: devMode ? '*' : websiteOrigin,
}
app.use( cors( corsOptions ) );

app.get( '/', ( req, res ) => { // Redirect root to specification
    res.redirect( 301, '/spec/' );
});

const specPath = path.join( __dirname, 'api/api-spec.yaml' );
const spec = YAML.load( specPath );
if ( localMode ) { // Remove all security in local mode
    baseLogger.info( "LOCAL mode - removing all security" );
    delete spec.components.security;
    delete spec.components.securitySchemes;
    var validateSecurity = false;
} else if ( devMode ) { // Use only API key for dev server
    baseLogger.info( "DEV mode - configuring API key security" );
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
    const apiKeyPool = makePool( 'auth', devMode ? 1 : 5 );
    const authLogger = makeLogger( 'auth' );
    validateSecurity = {
        handlers: {
            ApiKeyAuth: (req, scopes, schema) => {
                const key = req.get( apiKeyHeader );
                authLogger.debug( `Evaluating API key ${key}` );
                return apiKeyPool.query( 'SELECT api_key_auth.has_access( $1::text, $2::text, $3::text )',
                                         [ key, 'anniv3', 'dev' ] ).then( res => {
                    authLogger.debug( `DB response for API key ${key} received` );
                    authLogger.debug( `DB response for API key ${key} has ${res.rows.length} rows` );
                    const result = res.rows[0].has_access;
                    authLogger.verbose( `API key ${key} returned response ${result} from the database` );
                    switch ( result ) {
                        case 0: // Valid key, has access
                            authLogger.debug( `API key ${key} is authorized` );
                            return true;
                        case 1: // Valid key, no access
                            authLogger.debug( `API key ${key} is valid but has insufficient permissions` );
                            throw { status: 403, message: 'Forbidden' };
                        case 2: // Invalid key
                            authLogger.debug( `API key ${key} is invalid` );
                            throw { status: 401, message: 'Unauthorized', headers: [ 
                                [ 'WWW-Authenticate', apiKeyHeader ],
                            ] };
                        default: // WTF?
                            authLogger.error( `API key ${key} query returned invalid response ${result}` );
                            throw Error( "Unexpected response to API key check query" );
                    }
                });
            }
        }
    }
} else {
    baseLogger.info( "PROD mode - Setting version" );
    const fullVersion = spec.info.version;
    const version = `v${fullVersion.split( "." )[0]}`;
    spec.servers[0].variables.version.enum = [ version ];
    spec.servers[0].variables.version.default = version;
    validateSecurity = true;
}
app.get( '/spec/raw.json', ( req, res ) => {
    res.status( 200 ).json( spec );
})
app.use( '/spec', swaggerUI.serve, swaggerUI.setup( spec ) );

app.use(
    OpenApiValidator.middleware({
        apiSpec: spec,
        validateRequests: true,
        validateResponses: devMode,
        validateSecurity: validateSecurity,
        validateApiSpec: true,
        validateFormats: 'fast',
        unknownFormats: true,
        operationHandlers: {
            basePath: path.join( __dirname, 'handlers' ),
            resolver: resolver, // Until the validator supports modules natively
        },
    }),
);

app.use( expressWinston.errorLogger({
    winstonInstance: apiLogger,
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
    apiLogger.debug( `Handling error: ${err}` );
    const status = err.status || 500;
    const headers = err.headers || [];
    for ( const [ header, val ] of headers ) {
        res.set( header, val );
    }
    res.status( status ).json({
        status: status,
        message: err.message,
        // errors: err.errors,
    });
});

http.createServer( app ).listen( serverPort, function () {
    baseLogger.info( `Starting server on port ${serverPort} with log level ${loglevel}, dev mode ${devMode ? 'on' : 'off'}, local mode ${localMode ? 'on' : 'off'}` );
});
