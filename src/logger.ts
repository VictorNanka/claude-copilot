import * as vscode from 'vscode';

import * as winston from 'winston';
import { OutputChannelTransport } from 'winston-transport-vscode';

export const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new OutputChannelTransport({
            outputChannel: vscode.window.createOutputChannel('LM API proxy'),
        }),
    ],
});
