// @ts-nocheck
import * as vscode from 'vscode';

import * as winston from 'winston';
import { OutputChannelTransport } from 'winston-transport-vscode';

const outputChannel = vscode.window?.createOutputChannel
  ? vscode.window.createOutputChannel('LM API proxy')
  : {
      appendLine: () => {},
      show: () => {},
    };

export const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new OutputChannelTransport({
      outputChannel,
    }),
  ],
});
