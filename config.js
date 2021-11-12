const devMode = ( process.env.DEV || 1 ) !== 0;
const localMode = ( process.env.LOCAL || 0 ) !== 0;
const verboseMode = ( process.env.VERBOSE || 0 ) !== 0;
const serverPort = process.env.PORT || 8855;
const logToFile = ( process.env.LOG_TO_FILE || ( localMode ? 0 : 1 ) ) !== 0;

const loglevel = verboseMode ? 'verbose' : ( devMode ? 'debug' : 'info' );

const winston = require('winston');

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
        filename: './logs/server.log',
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
};