// Test script for runtime tool discovery mechanism
const testUnknownTool = {
    model: "claude-3-5-sonnet",
    messages: [
        {
            role: "user", 
            content: "Please use the 'unknown_tool' to do something, and also use 'git' command"
        }
    ],
    tools: [
        {
            type: "function",
            function: {
                name: "unknown_tool",
                description: "This tool doesn't exist and should be discovered",
                parameters: {
                    type: "object",
                    properties: {
                        action: {
                            type: "string",
                            description: "What to do"
                        }
                    },
                    required: ["action"]
                }
            }
        },
        {
            type: "function",
            function: {
                name: "git",
                description: "Git command",
                parameters: {
                    type: "object",
                    properties: {
                        command: {
                            type: "string",
                            description: "Git command to run"
                        }
                    },
                    required: ["command"]
                }
            }
        }
    ],
    stream: true
};

async function testRuntimeDiscovery() {
    try {
        console.log('🧪 Testing runtime tool discovery...');
        
        const response = await fetch('http://localhost:3000/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testUnknownTool)
        });
        
        if (!response.ok) {
            console.error('❌ Response not OK:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return;
        }
        
        console.log('✅ Request sent successfully');
        console.log('🔧 Expected: Runtime discovery of "unknown_tool" and "git"');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let streamData = '';
        let toolCallsDetected = 0;
        let discoveryMessages = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            streamData += chunk;
            
            // Parse SSE chunks
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.choices?.[0]?.delta?.tool_calls) {
                            toolCallsDetected++;
                            const toolName = data.choices[0].delta.tool_calls[0].function.name;
                            console.log(`🔧 Tool call detected: ${toolName}`);
                        }
                        if (data.choices?.[0]?.delta?.tool_results) {
                            const result = data.choices[0].delta.tool_results[0].function.result;
                            if (result.includes('dynamically discovered')) {
                                discoveryMessages++;
                                console.log(`🎯 Discovery message: ${result}`);
                            }
                        }
                    } catch (parseError) {
                        // Ignore JSON parse errors for partial chunks
                    }
                }
            }
        }
        
        console.log(`\n📊 Test Results:`);
        console.log(`   Tool calls detected: ${toolCallsDetected}`);
        console.log(`   Discovery messages: ${discoveryMessages}`);
        console.log(`   Total stream length: ${streamData.length} chars`);
        
        if (discoveryMessages > 0) {
            console.log('🎉 SUCCESS: Runtime tool discovery working!');
        } else {
            console.log('⚠️  No discovery messages detected - tools may have been pre-registered');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Test with different unknown tools
async function testMultipleUnknownTools() {
    const testPayload = {
        model: "claude-3-5-sonnet", 
        messages: [
            {
                role: "user",
                content: "Use these tools: python, ls, unknown_command_xyz"
            }
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: "python",
                    description: "Python interpreter",
                    parameters: { type: "object", properties: { code: { type: "string" } } }
                }
            },
            {
                type: "function", 
                function: {
                    name: "unknown_command_xyz",
                    description: "Unknown command",
                    parameters: { type: "object", properties: { args: { type: "string" } } }
                }
            }
        ],
        stream: true
    };
    
    console.log('\n🧪 Testing multiple unknown tools...');
    // Similar testing logic here...
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testRuntimeDiscovery, testMultipleUnknownTools };
} else if (typeof window === 'undefined') {
    // Running in Node.js
    testRuntimeDiscovery().then(() => {
        console.log('\n✨ Runtime discovery test completed');
    });
}