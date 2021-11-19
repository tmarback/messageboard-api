const devMode = ( process.env.DEV || 1 ) !== 0;
const localMode = ( process.env.LOCAL || 1 ) !== 0;
const verboseMode = ( process.env.VERBOSE || 0 ) !== 0;
const serverPort = process.env.PORT || 8855;

const path = require('path');

const logToFile = ( process.env.LOG_TO_FILE || ( localMode ? 0 : 1 ) ) !== 0;
const logDir = process.env.LOG_DIR || './logs';
const logFile = path.join( logDir, 'server.log' );

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = ( process.env.DB_PORT || 5432 ) | 0;
const dbUser = process.env.DB_USER || ( devMode ? 'dev' : 'anniv3' );

const loglevel = verboseMode ? 'verbose' : ( devMode ? 'debug' : 'info' );

const winston = require('winston');
const { Pool } = require('pg')

const consoleFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `[${timestamp}] [${level}]: ${message}`;
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
});

module.exports = {
    devMode: devMode,
    localMode: localMode,
    verboseMode: verboseMode,
    serverPort: serverPort,
    baseLogger: logger,
    loglevel: loglevel,
    makePool: ( database ) => {
        return new Pool({
            user: dbUser,
            host: dbHost,
            database: database,
            port: dbPort,
          });
    },
};