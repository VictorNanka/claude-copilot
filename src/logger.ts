/**
 * Legacy logger for backward compatibility
 * @deprecated Use the new centralized logging system from ./utils/logging.ts
 */

import { logger as centralizedLogger } from './utils/logging';

// Export the centralized logger for backward compatibility
export const logger = {
  error: (message: string, meta?: unknown) => {
    if (meta) {
      centralizedLogger.error(message, meta, { component: 'legacy' });
    } else {
      centralizedLogger.error(message, undefined, { component: 'legacy' });
    }
  },
  warn: (message: string, meta?: unknown) => {
    centralizedLogger.warn(message, { component: 'legacy', meta });
  },
  info: (message: string, meta?: unknown) => {
    centralizedLogger.info(message, { component: 'legacy', meta });
  },
  debug: (message: string, meta?: unknown) => {
    centralizedLogger.debug(message, { component: 'legacy', meta });
  },
};
