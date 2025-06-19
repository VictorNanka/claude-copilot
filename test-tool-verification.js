// Comprehensive test for Claude Code tool signatures and registration

const expectedTools = [
    "Task", "Bash", "Glob", "Grep", "LS", "exit_plan_mode",
    "Read", "Edit", "MultiEdit", "Write", "NotebookRead",
    "NotebookEdit", "WebFetch", "TodoRead", "TodoWrite", "WebSearch"
];

const toolSignatures = {
    "Task": ["description", "prompt"],
    "Bash": ["command"],
    "Glob": ["pattern"],
    "Grep": ["pattern"], 
    "LS": ["path"],
    "exit_plan_mode": ["plan"],
    "Read": ["file_path"],
    "Edit": ["file_path", "old_string", "new_string"],
    "MultiEdit": ["file_path", "edits"],
    "Write": ["file_path", "content"],
    "NotebookRead": ["notebook_path"],
    "NotebookEdit": ["notebook_path", "new_source"],
    "WebFetch": ["url", "prompt"],
    "TodoRead": [],
    "TodoWrite": ["todos"],
    "WebSearch": ["query"]
};

async function testToolAvailability() {
    try {
        console.log('🔍 Testing Claude Code tool availability...');
        
        const response = await fetch('http://localhost:3000/tools');
        if (!response.ok) {
            console.error('❌ Failed to fetch tools:', response.statusText);
            return;
        }
        
        const data = await response.json();
        const tools = data.tools || [];
        
        console.log(`📊 Total tools available: ${tools.length}`);
        
        // Filter Claude Code tools (not MCP tools with ":")
        const claudeCodeTools = tools.filter(tool => 
            !tool.function.name.includes(':') && 
            expectedTools.includes(tool.function.name)
        );
        
        console.log(`🔧 Claude Code tools found: ${claudeCodeTools.length}/16`);
        
        // Check each expected tool
        const foundTools = [];
        const missingTools = [];
        
        for (const expectedTool of expectedTools) {
            const tool = claudeCodeTools.find(t => t.function.name === expectedTool);
            if (tool) {
                foundTools.push(expectedTool);
                
                // Verify required parameters
                const expectedParams = toolSignatures[expectedTool];
                const actualParams = tool.function.parameters?.properties || {};
                const requiredParams = tool.function.parameters?.required || [];
                
                const missingParams = expectedParams.filter(param => !actualParams[param]);
                const extraRequired = requiredParams.filter(param => !expectedParams.includes(param));
                
                if (missingParams.length > 0) {
                    console.log(`⚠️  ${expectedTool}: Missing parameters: ${missingParams.join(', ')}`);
                }
                if (extraRequired.length > 0) {
                    console.log(`⚠️  ${expectedTool}: Extra required parameters: ${extraRequired.join(', ')}`);
                }
                if (missingParams.length === 0 && extraRequired.length === 0) {
                    console.log(`✅ ${expectedTool}: Parameters correct`);
                }
            } else {
                missingTools.push(expectedTool);
            }
        }
        
        console.log(`\n📋 Tool Registration Summary:`);
        console.log(`✅ Found: ${foundTools.join(', ')}`);
        if (missingTools.length > 0) {
            console.log(`❌ Missing: ${missingTools.join(', ')}`);
        }
        
        console.log(`\n🎯 Registration Status: ${foundTools.length}/16 tools registered`);
        
        if (foundTools.length === 16) {
            console.log('🎉 SUCCESS: All Claude Code tools are properly registered!');
        } else {
            console.log('⚠️  Some tools are missing or not properly registered');
        }
        
        return {
            total: tools.length,
            claudeCodeTools: claudeCodeTools.length,
            foundTools,
            missingTools,
            success: foundTools.length === 16
        };
        
    } catch (error) {
        console.error('❌ Tool availability test failed:', error);
        return null;
    }
}

async function testToolCall(toolName, params) {
    const testPayload = {
        model: "claude-3-5-sonnet",
        messages: [
            {
                role: "user",
                content: `Please use the ${toolName} tool`
            }
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: toolName,
                    description: `Test call for ${toolName}`,
                    parameters: {
                        type: "object",
                        properties: params.reduce((acc, param) => {
                            acc[param] = { type: "string", description: `${param} parameter` };
                            return acc;
                        }, {}),
                        required: params
                    }
                }
            }
        ],
        stream: false
    };
    
    try {
        const response = await fetch('http://localhost:3000/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload)
        });
        
        if (response.ok) {
            console.log(`✅ ${toolName}: Tool call successful`);
            return true;
        } else {
            console.log(`❌ ${toolName}: Tool call failed - ${response.status}`);
            return false;
        }
    } catch (error) {
        console.log(`❌ ${toolName}: Tool call error - ${error.message}`);
        return false;
    }
}

async function runFullTest() {
    console.log('🧪 Starting comprehensive Claude Code tool verification...\n');
    
    // Test 1: Tool availability
    const availabilityResult = await testToolAvailability();
    
    if (!availabilityResult) {
        console.log('❌ Cannot proceed with tool call tests - availability test failed');
        return;
    }
    
    // Test 2: Sample tool calls
    console.log('\n🚀 Testing sample tool calls...');
    const sampleTests = [
        ['Read', ['file_path']],
        ['Bash', ['command']],
        ['TodoRead', []],
        ['LS', ['path']]
    ];
    
    let successfulCalls = 0;
    for (const [toolName, params] of sampleTests) {
        if (availabilityResult.foundTools.includes(toolName)) {
            const success = await testToolCall(toolName, params);
            if (success) successfulCalls++;
        }
    }
    
    console.log(`\n📊 Final Results:`);
    console.log(`   Tools registered: ${availabilityResult.claudeCodeTools}/16`);
    console.log(`   Sample calls successful: ${successfulCalls}/${sampleTests.length}`);
    console.log(`   Overall status: ${availabilityResult.success && successfulCalls > 0 ? '✅ PASS' : '❌ FAIL'}`);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testToolAvailability, testToolCall, runFullTest };
} else if (typeof window === 'undefined') {
    runFullTest();
}