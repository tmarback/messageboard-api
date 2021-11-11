const devMode = ( process.env.DEV || 1 ) !== 0;
const verboseMode = ( process.env.VERBOSE || 0 ) !== 0;
const serverPort = process.env.PORT || 8855;

const loglevel = verboseMode ? 'verbose' : ( devMode ? 'debug' : info );

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
        //winston.format.json(),
    ),
})];

if ( !devMode ) {
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
    verboseMode: verboseMode,
    serverPort: serverPort,
    baseLogger: logger,
    loglevel: loglevel,
};