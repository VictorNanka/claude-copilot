// Claude Code 官方 16 个内置工具的精确签名定义
// 基于官方工具规范更新

export const claudeToolSignatures = [
    {
        name: "Task",
        description: "Launch a new agent that has access to tools for complex task execution",
        parameters: {
            type: "object",
            properties: {
                description: {
                    type: "string",
                    description: "A short (3-5 word) description of the task"
                },
                prompt: {
                    type: "string",
                    description: "The task for the agent to perform"
                }
            },
            required: ["description", "prompt"],
            additionalProperties: false
        }
    },
    {
        name: "Bash",
        description: "Executes a given bash command in a persistent shell session",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "The command to execute"
                },
                description: {
                    type: "string",
                    description: "Clear, concise description of what this command does in 5-10 words"
                },
                timeout: {
                    type: "number",
                    description: "Optional timeout in milliseconds (max 600000)"
                }
            },
            required: ["command"],
            additionalProperties: false
        }
    },
    {
        name: "Glob",
        description: "Fast file pattern matching tool that works with any codebase size",
        parameters: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "The glob pattern to match files against"
                },
                path: {
                    type: "string",
                    description: "The directory to search in. If not specified, the current working directory will be used"
                }
            },
            required: ["pattern"],
            additionalProperties: false
        }
    },
    {
        name: "Grep",
        description: "Fast content search tool that works with any codebase size",
        parameters: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "The regular expression pattern to search for in file contents"
                },
                path: {
                    type: "string",
                    description: "The directory to search in. Defaults to the current working directory"
                },
                include: {
                    type: "string",
                    description: "File pattern to include in the search (e.g. \"*.js\", \"*.{ts,tsx}\")"
                }
            },
            required: ["pattern"],
            additionalProperties: false
        }
    },
    {
        name: "LS",
        description: "Lists files and directories in a given path",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "The absolute path to the directory to list (must be absolute, not relative)"
                },
                ignore: {
                    type: "array",
                    description: "List of glob patterns to ignore",
                    items: { type: "string" }
                }
            },
            required: ["path"],
            additionalProperties: false
        }
    },
    {
        name: "exit_plan_mode",
        description: "Use this tool when you are in plan mode and have finished presenting your plan and are ready to code",
        parameters: {
            type: "object",
            properties: {
                plan: {
                    type: "string",
                    description: "The plan you came up with, that you want to run by the user for approval. Supports markdown"
                }
            },
            required: ["plan"],
            additionalProperties: false
        }
    },
    {
        name: "Read",
        description: "Reads a file from the local filesystem",
        parameters: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "The absolute path to the file to read"
                },
                offset: {
                    type: "number",
                    description: "The line number to start reading from"
                },
                limit: {
                    type: "number",
                    description: "The number of lines to read"
                }
            },
            required: ["file_path"],
            additionalProperties: false
        }
    },
    {
        name: "Edit",
        description: "Performs exact string replacements in files",
        parameters: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "The absolute path to the file to modify"
                },
                old_string: {
                    type: "string",
                    description: "The text to replace"
                },
                new_string: {
                    type: "string",
                    description: "The text to replace it with (must be different from old_string)"
                },
                replace_all: {
                    type: "boolean",
                    description: "Replace all occurences of old_string (default false)",
                    default: false
                }
            },
            required: ["file_path", "old_string", "new_string"],
            additionalProperties: false
        }
    },
    {
        name: "MultiEdit",
        description: "Multiple edits to a single file in one operation",
        parameters: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "The absolute path to the file to modify"
                },
                edits: {
                    type: "array",
                    description: "Array of edit operations to perform sequentially on the file",
                    minItems: 1,
                    items: {
                        type: "object",
                        properties: {
                            old_string: {
                                type: "string",
                                description: "The text to replace"
                            },
                            new_string: {
                                type: "string",
                                description: "The text to replace it with"
                            },
                            replace_all: {
                                type: "boolean",
                                description: "Replace all occurences of old_string (default false)",
                                default: false
                            }
                        },
                        required: ["old_string", "new_string"],
                        additionalProperties: false
                    }
                }
            },
            required: ["file_path", "edits"],
            additionalProperties: false
        }
    },
    {
        name: "Write",
        description: "Writes a file to the local filesystem",
        parameters: {
            type: "object",
            properties: {
                file_path: {
                    type: "string",
                    description: "The absolute path to the file to write"
                },
                content: {
                    type: "string",
                    description: "The content to write to the file"
                }
            },
            required: ["file_path", "content"],
            additionalProperties: false
        }
    },
    {
        name: "NotebookRead",
        description: "Reads a Jupyter notebook (.ipynb file) and returns all of the cells",
        parameters: {
            type: "object",
            properties: {
                notebook_path: {
                    type: "string",
                    description: "The absolute path to the Jupyter notebook file to read"
                },
                cell_id: {
                    type: "string",
                    description: "The ID of a specific cell to read. If not provided, all cells will be read"
                }
            },
            required: ["notebook_path"],
            additionalProperties: false
        }
    },
    {
        name: "NotebookEdit",
        description: "Completely replaces the contents of a specific cell in a Jupyter notebook",
        parameters: {
            type: "object",
            properties: {
                notebook_path: {
                    type: "string",
                    description: "The absolute path to the Jupyter notebook file to edit"
                },
                new_source: {
                    type: "string",
                    description: "The new source for the cell"
                },
                cell_id: {
                    type: "string",
                    description: "The ID of the cell to edit"
                },
                cell_type: {
                    type: "string",
                    enum: ["code", "markdown"],
                    description: "The type of the cell (code or markdown)"
                },
                edit_mode: {
                    type: "string",
                    enum: ["replace", "insert", "delete"],
                    description: "The type of edit to make (replace, insert, delete). Defaults to replace"
                }
            },
            required: ["notebook_path", "new_source"],
            additionalProperties: false
        }
    },
    {
        name: "WebFetch",
        description: "Fetches content from a specified URL and processes it using an AI model",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    format: "uri",
                    description: "The URL to fetch content from"
                },
                prompt: {
                    type: "string",
                    description: "The prompt to run on the fetched content"
                }
            },
            required: ["url", "prompt"],
            additionalProperties: false
        }
    },
    {
        name: "TodoRead",
        description: "Use this tool to read the current to-do list for the session",
        parameters: {
            type: "object",
            properties: {},
            additionalProperties: false
        }
    },
    {
        name: "TodoWrite",
        description: "Use this tool to create and manage a structured task list for your current coding session",
        parameters: {
            type: "object",
            properties: {
                todos: {
                    type: "array",
                    description: "The updated todo list",
                    items: {
                        type: "object",
                        properties: {
                            content: {
                                type: "string",
                                minLength: 1,
                                description: "The content of the todo item"
                            },
                            status: {
                                type: "string",
                                enum: ["pending", "in_progress", "completed"],
                                description: "The status of the todo item"
                            },
                            priority: {
                                type: "string",
                                enum: ["high", "medium", "low"],
                                description: "The priority level of the todo item"
                            },
                            id: {
                                type: "string",
                                description: "Unique identifier for the todo item"
                            }
                        },
                        required: ["content", "status", "priority", "id"],
                        additionalProperties: false
                    }
                }
            },
            required: ["todos"],
            additionalProperties: false
        }
    },
    {
        name: "WebSearch",
        description: "Allows Claude to search the web and use the results to inform responses",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    minLength: 2,
                    description: "The search query to use"
                },
                allowed_domains: {
                    type: "array",
                    description: "Only include search results from these domains",
                    items: { type: "string" }
                },
                blocked_domains: {
                    type: "array",
                    description: "Never include search results from these domains",
                    items: { type: "string" }
                }
            },
            required: ["query"],
            additionalProperties: false
        }
    }
];