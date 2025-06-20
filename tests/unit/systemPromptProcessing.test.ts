import { Config } from '../../src/config';

// We'll need to extract the system prompt processing functions from server.ts
// For now, let's create a utility module for testing

describe('System Prompt Processing', () => {
  const mockConfig: Config = {
    port: 68686,
    startAutomatically: true,
    defaultModel: 'gpt-4.1',
    mcpClients: {},
    systemPrompt: 'You are a helpful assistant.',
    systemPromptFormat: 'merge',
    enableSystemPromptProcessing: true,
  };

  // Helper function to simulate the system prompt processing logic
  const processSystemPrompts = (messages: any[], config: Config): any[] => {
    if (!config.enableSystemPromptProcessing) {
      return messages.map((message: any) => {
        if (message.role === 'system') {
          return { ...message, role: 'user' };
        }
        return message;
      });
    }

    const systemMessages: any[] = [];
    const nonSystemMessages: any[] = [];

    messages.forEach(message => {
      if (message.role === 'system') {
        systemMessages.push(message);
      } else {
        nonSystemMessages.push(message);
      }
    });

    let allSystemContent = '';
    if (config.systemPrompt.trim()) {
      allSystemContent += `${config.systemPrompt.trim()}\n\n`;
    }

    if (systemMessages.length > 0) {
      const systemContent = systemMessages
        .map(msg => (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)))
        .join('\n\n');
      allSystemContent += systemContent;
    }

    if (!allSystemContent.trim()) {
      return messages.map((message: any) => {
        if (message.role === 'system') {
          return { ...message, role: 'user' };
        }
        return message;
      });
    }

    return applySystemPromptFormat(
      nonSystemMessages,
      allSystemContent.trim(),
      config.systemPromptFormat
    );
  };

  const applySystemPromptFormat = (
    messages: any[],
    systemContent: string,
    format: string
  ): any[] => {
    if (messages.length === 0) {
      return [
        {
          role: 'user',
          content: formatSystemPrompt(systemContent, '', format),
        },
      ];
    }

    const firstMessage = messages[0];
    const restMessages = messages.slice(1);

    switch (format) {
      case 'merge':
        const firstUserContent =
          typeof firstMessage.content === 'string'
            ? firstMessage.content
            : JSON.stringify(firstMessage.content);

        return [
          {
            ...firstMessage,
            role: firstMessage.role === 'system' ? 'user' : firstMessage.role,
            content: formatSystemPrompt(systemContent, firstUserContent, 'merge'),
          },
          ...restMessages,
        ];

      case 'assistant_acknowledgment':
        return [
          {
            role: 'assistant',
            content: 'I understand and will follow these instructions carefully.',
          },
          {
            role: 'user',
            content: `${formatSystemPrompt(
              systemContent,
              '',
              'assistant_acknowledgment'
            )}\n\nPlease proceed with following these instructions.`,
          },
          ...messages.map(msg => ({
            ...msg,
            role: msg.role === 'system' ? 'user' : msg.role,
          })),
        ];

      case 'simple_prepend':
        const content =
          typeof firstMessage.content === 'string'
            ? firstMessage.content
            : JSON.stringify(firstMessage.content);

        return [
          {
            ...firstMessage,
            role: firstMessage.role === 'system' ? 'user' : firstMessage.role,
            content: `${systemContent}\n\n${content}`,
          },
          ...restMessages,
        ];

      default:
        return messages;
    }
  };

  const formatSystemPrompt = (
    systemContent: string,
    userContent: string,
    format: string
  ): string => {
    switch (format) {
      case 'merge':
        if (!userContent.trim()) {
          return `<SYSTEM_INSTRUCTIONS>\n${systemContent}\n</SYSTEM_INSTRUCTIONS>`;
        }
        return `<SYSTEM_INSTRUCTIONS>\n${systemContent}\n</SYSTEM_INSTRUCTIONS>\n\n<USER_MESSAGE>\n${userContent}\n</USER_MESSAGE>`;

      case 'assistant_acknowledgment':
        return `<INSTRUCTIONS>\n${systemContent}\n</INSTRUCTIONS>`;

      case 'simple_prepend':
        return systemContent;

      default:
        return systemContent;
    }
  };

  describe('processSystemPrompts', () => {
    it('should handle merge format correctly', () => {
      const messages = [
        { role: 'system', content: 'Be helpful and accurate.' },
        { role: 'user', content: 'Hello, how are you?' },
      ];

      const result = processSystemPrompts(messages, {
        ...mockConfig,
        systemPromptFormat: 'merge',
      });

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toContain('<SYSTEM_INSTRUCTIONS>');
      expect(result[0].content).toContain('You are a helpful assistant.');
      expect(result[0].content).toContain('Be helpful and accurate.');
      expect(result[0].content).toContain('<USER_MESSAGE>');
      expect(result[0].content).toContain('Hello, how are you?');
    });

    it('should handle assistant_acknowledgment format correctly', () => {
      const messages = [
        { role: 'system', content: 'Be helpful and accurate.' },
        { role: 'user', content: 'Hello, how are you?' },
      ];

      const result = processSystemPrompts(messages, {
        ...mockConfig,
        systemPromptFormat: 'assistant_acknowledgment',
      });

      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toBe('I understand and will follow these instructions carefully.');
      expect(result[1].role).toBe('user');
      expect(result[1].content).toContain('<INSTRUCTIONS>');
      expect(result[2].role).toBe('user');
      expect(result[2].content).toBe('Hello, how are you?');
    });

    it('should handle simple_prepend format correctly', () => {
      const messages = [
        { role: 'system', content: 'Be helpful and accurate.' },
        { role: 'user', content: 'Hello, how are you?' },
      ];

      const result = processSystemPrompts(messages, {
        ...mockConfig,
        systemPromptFormat: 'simple_prepend',
      });

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toContain('You are a helpful assistant.');
      expect(result[0].content).toContain('Be helpful and accurate.');
      expect(result[0].content).toContain('Hello, how are you?');
    });

    it('should handle no system messages', () => {
      const messages = [{ role: 'user', content: 'Hello, how are you?' }];

      const result = processSystemPrompts(messages, {
        ...mockConfig,
        systemPrompt: '',
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(messages[0]);
    });

    it('should handle disabled system prompt processing', () => {
      const messages = [
        { role: 'system', content: 'Be helpful and accurate.' },
        { role: 'user', content: 'Hello, how are you?' },
      ];

      const result = processSystemPrompts(messages, {
        ...mockConfig,
        enableSystemPromptProcessing: false,
      });

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user'); // system converted to user
      expect(result[0].content).toBe('Be helpful and accurate.');
      expect(result[1].role).toBe('user');
      expect(result[1].content).toBe('Hello, how are you?');
    });

    it('should handle multiple system messages', () => {
      const messages = [
        { role: 'system', content: 'System message 1' },
        { role: 'system', content: 'System message 2' },
        { role: 'user', content: 'User message' },
      ];

      const result = processSystemPrompts(messages, {
        ...mockConfig,
        systemPromptFormat: 'merge',
      });

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('System message 1');
      expect(result[0].content).toContain('System message 2');
      expect(result[0].content).toContain('User message');
    });

    it('should handle empty messages array', () => {
      const messages: any[] = [];

      const result = processSystemPrompts(messages, mockConfig);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toContain('You are a helpful assistant.');
    });
  });

  describe('formatSystemPrompt', () => {
    it('should format merge style with user content', () => {
      const result = formatSystemPrompt('System prompt', 'User message', 'merge');

      expect(result).toBe(
        '<SYSTEM_INSTRUCTIONS>\nSystem prompt\n</SYSTEM_INSTRUCTIONS>\n\n<USER_MESSAGE>\nUser message\n</USER_MESSAGE>'
      );
    });

    it('should format merge style without user content', () => {
      const result = formatSystemPrompt('System prompt', '', 'merge');

      expect(result).toBe('<SYSTEM_INSTRUCTIONS>\nSystem prompt\n</SYSTEM_INSTRUCTIONS>');
    });

    it('should format assistant_acknowledgment style', () => {
      const result = formatSystemPrompt('System prompt', '', 'assistant_acknowledgment');

      expect(result).toBe('<INSTRUCTIONS>\nSystem prompt\n</INSTRUCTIONS>');
    });

    it('should format simple_prepend style', () => {
      const result = formatSystemPrompt('System prompt', '', 'simple_prepend');

      expect(result).toBe('System prompt');
    });
  });
});
