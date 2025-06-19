// Simple test script for dynamic tool registration
const testPayload = {
    model: "claude-3-5-sonnet",
    messages: [
        {
            role: "user", 
            content: "Please use the Read tool to read a file and the Bash tool to run a command"
        }
    ],
    tools: [
        {
            type: "function",
            function: {
                name: "Read",
                description: "Reads a file from the local filesystem",
                parameters: {
                    type: "object",
                    properties: {
                        file_path: {
                            type: "string",
                            description: "The absolute path to the file to read"
                        }
                    },
                    required: ["file_path"]
                }
            }
        },
        {
            type: "function", 
            function: {
                name: "Bash",
                description: "Executes a given bash command",
                parameters: {
                    type: "object",
                    properties: {
                        command: {
                            type: "string",
                            description: "The command to execute"
                        }
                    },
                    required: ["command"]
                }
            }
        }
    ],
    stream: true
};

async function testDynamicRegistration() {
    try {
        const response = await fetch('http://localhost:3000/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });
        
        if (!response.ok) {
            console.error('Response not OK:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Error response:', errorText);
            return;
        }
        
        console.log('✅ Request sent successfully');
        console.log('🔧 Expected tools to be dynamically registered: Read, Bash');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let streamData = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            streamData += decoder.decode(value, { stream: true });
            console.log('📝 Received chunk:', streamData.slice(-100)); // Show last 100 chars
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testDynamicRegistration };
} else if (typeof window === 'undefined') {
    // Running in Node.js
    testDynamicRegistration();
}