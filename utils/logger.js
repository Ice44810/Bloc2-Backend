/**
 * Utility for logging application events
 * Budget_App - Logging Module
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

const getLogFilename = () => {
    const date = new Date().toISOString().split('T')[0];
    return path.join(LOG_DIR, `app-${date}.log`);
};

const formatLogMessage = (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (data) {
        if (data instanceof Error) {
            logEntry += `\n  Error: ${data.message}\n  Stack: ${data.stack}`;
        } else if (typeof data === 'object') {
            logEntry += `\n  Data: ${JSON.stringify(data, null, 2)}`;
        } else {
            logEntry += `\n  Data: ${data}`;
        }
    }
    
    return logEntry;
};

const writeToLog = (level, message, data = null) => {
    const logMessage = formatLogMessage(level, message, data);
    
    // Console output
    switch (level) {
        case 'error':
            console.error(logMessage);
            break;
        case 'warn':
            console.warn(logMessage);
            break;
        default:
            console.log(logMessage);
    }
    
    // File output
    try {
        fs.appendFileSync(getLogFilename(), logMessage + '\n');
    } catch (err) {
        console.error('Failed to write to log file:', err);
    }
};

module.exports = {
    info: (message, data) => writeToLog('info', message, data),
    warn: (message, data) => writeToLog('warn', message, data),
    error: (message, data) => writeToLog('error', message, data),
    debug: (message, data) => writeToLog('debug', message, data),
    
    // HTTP request logging
    logRequest: (method, url, statusCode, duration) => {
        writeToLog('info', `HTTP ${method} ${url}`, { statusCode, duration: `${duration}ms` });
    },
    
    // Database query logging
    logQuery: (query, duration) => {
        writeToLog('debug', `DB Query executed`, { query: query.substring(0, 100), duration: `${duration}ms` });
    },
    
    // Authentication events
    logAuth: (event, email, success) => {
        writeToLog('info', `Auth: ${event}`, { email, success });
    }
};

