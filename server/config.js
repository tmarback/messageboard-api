export const devMode = ( process.env.DEV || 1 ) != 0;
export const localMode = ( process.env.LOCAL || 1 ) != 0;
export const verboseMode = ( process.env.VERBOSE || 0 ) != 0;

export const serverPort = process.env.PORT || 8855;
export const websiteOrigin = process.env.WEBSITE_ORIGIN || 'localhost';
export const trustedProxies = ( process.env.TRUSTED_PROXIES || 0 ) | 0;

import path from 'path';
import { mkdir } from 'fs/promises';
import { pathToFileURL } from 'url';

export const assetsDir = process.env.ASSETS_DIR || './assets';
export const assetsUri = process.env.ASSETS_URI || ( localMode ? pathToFileURL( assetsDir ).href : 'localhost' );
await mkdir( assetsDir, {
    recursive: true,
    mode: 0o775,
});

const logToFile = ( process.env.LOG_TO_FILE || ( localMode ? 0 : 1 ) ) != 0;
const logDir = process.env.LOG_DIR || './logs';
const logFile = path.join( logDir, 'server.log' );
export const loglevel = process.env.LOG_LEVEL || ( devMode ? 'debug' : ( verboseMode ? 'verbose' : 'info' ) );

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = ( process.env.DB_PORT || 5432 ) | 0;
const dbUser = process.env.DB_USER || ( devMode ? 'dev' : 'anniv3' );
const dbPass = process.env.DB_PASSWORD || 'nopassword';

import winston from 'winston';
import pg from 'pg';
const { Pool } = pg;

const consoleFormat = winston.format.printf(({ level, message, timestamp, loggerName }) => {
    return `[${timestamp}] [${loggerName}] [${level}]: ${message}`;
});
var transports = [new winston.transports.Console({
    level: devMode ? loglevel : 'warn',
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        consoleFormat,
    ),
})];

if ( logToFile ) {
    transports.push(new winston.transports.File({
        filename: logFile,
        maxsize: 100 * 1000 * 1000,
        maxFiles: 5,
        tailable: true,
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
        ),
    }));
}

const logger = winston.createLogger({
    level: loglevel,
    transports: transports,
    defaultMeta: {
        loggerName: 'root',
    },
})
export { logger as baseLogger };

/**
 * Creates a new logger.
 * 
 * @param {string} name The name of the logger
 * @returns The logger
 */
export function makeLogger( name ) {
    // return logger.child( { loggerName: name } );
    const child = logger.child();
    child.defaultMeta = { ...logger.defaultMeta, loggerName: name }; // https://github.com/winstonjs/winston/issues/1788
    return child;
};

/**
 * Creates a connection pool to a database.
 * 
 * @param {string} database The database to connect to
 * @param {number} max Maximum number of connections
 * @returns A connection pool to the given database
 */
export function makePool( database, max ) {
    return new Pool({
        user: dbUser,
        password: dbPass,
        host: dbHost,
        database: database,
        port: dbPort,
        application_name: 'anniv3-website',
        max: max,
      });
};
