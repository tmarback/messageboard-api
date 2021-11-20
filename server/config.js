const devMode = ( process.env.DEV || 1 ) != 0;
const localMode = ( process.env.LOCAL || 1 ) != 0;
const verboseMode = ( process.env.VERBOSE || 0 ) != 0;
const serverPort = process.env.PORT || 8855;

const path = require('path');

const logToFile = ( process.env.LOG_TO_FILE || ( localMode ? 0 : 1 ) ) != 0;
const logDir = process.env.LOG_DIR || './logs';
const logFile = path.join( logDir, 'server.log' );

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = ( process.env.DB_PORT || 5432 ) | 0;
const dbUser = process.env.DB_USER || ( devMode ? 'dev' : 'anniv3' );
const dbPass = process.env.DB_PASSWORD || 'nopassword';

const loglevel = devMode ? 'debug' : ( verboseMode ? 'verbose' : 'info' );

const winston = require('winston');
const { Pool } = require('pg')

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
});

module.exports = {
    devMode: devMode,
    localMode: localMode,
    verboseMode: verboseMode,
    serverPort: serverPort,
    loglevel: loglevel,
    baseLogger: logger,
    makeLogger: ( name ) => {
        // return logger.child( { loggerName: name } );
        const child = logger.child();
        child.defaultMeta = { ...logger.defaultMeta, loggerName: name }; // https://github.com/winstonjs/winston/issues/1788
        return child;
    },
    makePool: ( database ) => {
        return new Pool({
            user: dbUser,
            password: dbPass,
            host: dbHost,
            database: database,
            port: dbPort,
          });
    },
};