'use strict';

import { devMode, localMode, serverPort, websiteOrigin, trustedProxies, loglevel, baseLogger, makeLogger, makePool } from './config.js';
import resolver from './esmresolver.js'

import http from 'http';
import path from 'path';
import express from 'express';

import { fileURLToPath } from 'url';
const __dirname = path.dirname( fileURLToPath( import.meta.url ) );

const app = express();

import cors from 'cors';
import YAML from 'yamljs';
import swaggerUI from 'swagger-ui-express';
import OpenApiValidator from 'express-openapi-validator';
import expressWinston from 'express-winston';
import rateLimit from 'express-rate-limit';

if ( !localMode ) { // Configure proxy if not running locally
    app.set( 'trust proxy', trustedProxies );
}

const apiLogger = makeLogger( 'API' );
app.use( expressWinston.logger({
    winstonInstance: apiLogger,
    level: 'info',
    expressFormat: true,
    colorize: true,
    meta: true,
}));

app.use( express.json() );

const corsOptions = {
    origin: ( devMode || localMode ) ? '*' : websiteOrigin,
}
app.use( cors( corsOptions ) );

if ( !devMode ) { // Limit new messages to one per day per client IP
    app.post( '/messages', rateLimit({
        max: 1,
        windowMs: 24 * 60 * 60 * 1000,
        headers: true,
        skipFailedRequests: true,
    }));
}

app.get( '/', ( req, res ) => { // Redirect root to specification
    res.redirect( 301, '/spec/' );
});

const specPath = path.join( __dirname, 'api/api-spec.yaml' );
const spec = YAML.load( specPath );

if ( localMode ) { // Remove all security in local mode
    baseLogger.info( "LOCAL mode - disabling all security" );
    var validateSecurity = false;
} else {
    baseLogger.info( "PUBLIC mode - configuring security handling" );
    const apiKeyPool = makePool( 'auth', devMode ? 1 : 5 );
    const authLogger = makeLogger( 'auth' );
    var validateSecurity = {
        handlers: {
            ApiKeyAuth: async ( req, scopes, schema ) => {
                const headerName = schema.name;
                const key = req.get( headerName );
                authLogger.debug( `Evaluating API key ${key} for roles ${scopes}` );
                const res = await apiKeyPool.query( 'SELECT api_key_auth.has_access( $1::text, $2::text, $3::text[] )',
                                        [ key, 'anniv3', scopes ] );

                authLogger.debug( `DB response for API key ${key} received` );
                authLogger.silly( `DB response for API key ${key} has ${res.rows.length} rows` );
                const result = res.rows[0].has_access;
                authLogger.verbose( `API key ${key} returned response ${result} from the database` );
                switch ( result ) {
                    case 0: // Valid key, has access
                        authLogger.info( `API key ${key} is authorized for endpoint ${req.path} ${req.method}` );
                        return true;
                    case 1: // Valid key, no access
                        authLogger.info( `API key ${key} is valid but has insufficient permissions for endpoint ${req.path} ${req.method}` );
                        throw { status: 403, message: 'Forbidden' };
                    case 2: // Invalid key
                        authLogger.info( `API key ${key} is invalid` );
                        throw { status: 401, message: 'Unauthorized', headers: [ 
                            [ 'WWW-Authenticate', headerName ],
                        ] };
                    default: // WTF?
                        authLogger.error( `API key ${key} query returned invalid response ${result}` );
                        throw Error( "Unexpected response to API key check query" );
                }
            }
        }
    };
}

if ( devMode ) { // Use only API key for dev server
    baseLogger.info( "DEV mode - configuring API key security globally" );
    spec.security = [
        { ApiKeyAuth: [ 'dev' ] }
    ];
    for ( const [ path, pathSchema ] of Object.entries( spec.paths ) ) {
        for ( const [ operation, opSchema ] of Object.entries( pathSchema ) ) {
            console.debug( `Removing security for ${path} ${operation}` );
            delete opSchema.security
        }
    }
} else {
    baseLogger.info( "PROD mode - Setting version" );
    const fullVersion = spec.info.version;
    const version = `v${fullVersion.split( "." )[0]}`;
    spec.servers[0].variables.version.enum = [ version ];
    spec.servers[0].variables.version.default = version;
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
    exceptionToMeta: ( error ) => {
        return {
            error: error,
            exception: true,
            stack: devMode ? error.stack : null,
        }
    }
}));

app.use( ( err, req, res, next ) => {
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
