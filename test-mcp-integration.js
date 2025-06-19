// Test script for MCP tool auto-registration and integration

// Example MCP configuration to add to VS Code settings:
const exampleMCPConfig = {
    "http-lm-api.mcpClients": {
        "filesystem": {
            "command": "uvx",
            "args": ["mcp-server-filesystem", "/Users/kexiang.shan"],
            "env": {}
        },
        "weather": {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-weather"],
            "env": {
                "WEATHER_API_KEY": "your-api-key-here"
            }
        }
    }
};

const testMCPTools = {
    model: "claude-3-5-sonnet",
    messages: [
        {
            role: "user", 
            content: "Please use the filesystem tools to list files and the weather tools to get weather information"
        }
    ],
    tools: [
        {
            type: "function",
            function: {
                name: "filesystem:list_files",
                description: "List files in a directory using MCP filesystem server",
                parameters: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Directory path to list"
                        }
                    },
                    required: ["path"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "weather:get_weather",
                description: "Get weather information using MCP weather server",
                parameters: {
                    type: "object",
                    properties: {
                        location: {
                            type: "string",
                            description: "Location to get weather for"
                        }
                    },
                    required: ["location"]
                }
            }
        }
    ],
    stream: true
};

async function testMCPIntegration() {
    try {
        console.log('🧪 Testing MCP tool integration...');
        console.log('📋 Example VS Code settings configuration:');
        console.log(JSON.stringify(exampleMCPConfig, null, 2));
        
        // First, check if MCP tools are available
        console.log('\n🔍 Checking available tools...');
        const toolsResponse = await fetch('http://localhost:3000/tools');
        if (!toolsResponse.ok) {
            console.error('❌ Failed to fetch tools:', toolsResponse.statusText);
            return;
        }
        
        const toolsData = await toolsResponse.json();
        console.log(`✅ Found ${toolsData.tools.length} total tools`);
        
        // Look for MCP tools (should have client prefix)
        const mcpTools = toolsData.tools.filter(tool => 
            tool.function.name.includes(':') || 
            tool.function.description.includes('MCP')
        );
        
        console.log(`🔧 Found ${mcpTools.length} MCP tools:`);
        mcpTools.forEach(tool => {
            console.log(`   - ${tool.function.name}: ${tool.function.description}`);
        });
        
        if (mcpTools.length === 0) {
            console.log('⚠️  No MCP tools found. Make sure you have configured MCP clients in VS Code settings.');
            console.log('   Add the following to your VS Code settings.json:');
            console.log(JSON.stringify(exampleMCPConfig, null, 4));
            return;
        }
        
        // Test MCP tool call
        console.log('\n🚀 Testing MCP tool calls...');
        const response = await fetch('http://localhost:3000/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testMCPTools)
        });
        
        if (!response.ok) {
            console.error('❌ MCP tool test failed:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return;
        }
        
        console.log('✅ MCP tool request sent successfully');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let mcpToolCalls = 0;
        let mcpToolResults = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.choices?.[0]?.delta?.tool_calls) {
                            const toolName = data.choices[0].delta.tool_calls[0].function.name;
                            if (toolName.includes(':')) {
                                mcpToolCalls++;
                                console.log(`🔧 MCP tool call: ${toolName}`);
                            }
                        }
                        
                        if (data.choices?.[0]?.delta?.tool_results) {
                            const result = data.choices[0].delta.tool_results[0];
                            if (result.function.name.includes(':')) {
                                mcpToolResults++;
                                console.log(`📊 MCP tool result: ${result.function.name}`);
                                console.log(`   Result: ${result.function.result.slice(0, 100)}...`);
                            }
                        }
                    } catch (parseError) {
                        // Ignore JSON parse errors for partial chunks
                    }
                }
            }
        }
        
        console.log(`\n📈 MCP Integration Test Results:`);
        console.log(`   MCP tools available: ${mcpTools.length}`);
        console.log(`   MCP tool calls made: ${mcpToolCalls}`);
        console.log(`   MCP tool results received: ${mcpToolResults}`);
        
        if (mcpToolCalls > 0 && mcpToolResults > 0) {
            console.log('🎉 SUCCESS: MCP integration is working!');
        } else if (mcpTools.length > 0) {
            console.log('⚠️  MCP tools are registered but not called/executed properly');
        } else {
            console.log('❌ MCP integration not working - no tools found');
        }
        
    } catch (error) {
        console.error('❌ MCP integration test failed:', error);
    }
}

async function testMCPConfiguration() {
    console.log('\n🔧 MCP Configuration Test');
    console.log('To enable MCP integration, add the following to your VS Code settings:');
    console.log('1. Open VS Code Settings (Cmd+,)');
    console.log('2. Search for "http-lm-api.mcpClients"');
    console.log('3. Add MCP client configurations like:');
    console.log(JSON.stringify(exampleMCPConfig, null, 2));
    console.log('\n4. Restart VS Code extension or reload window');
    console.log('5. Run this test again');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testMCPIntegration, testMCPConfiguration };
} else if (typeof window === 'undefined') {
    // Running in Node.js
    testMCPIntegration().then(() => {
        console.log('\n✨ MCP integration test completed');
    });
}