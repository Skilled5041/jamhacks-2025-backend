import { Elysia, t } from "elysia";
import { getOpenAIResponse, streamGeminiResponse } from "./openai";
import { teacherPrompt, coderPrompt } from "./proompts";
import { analyzeCode, CodeError } from "./codeanalyzer";

// Create a messages object to maintain conversation history for each connection
const connectionMessages = new Map();

async function handleMessage(ws: any, messages: Array<{ role: string, content: string }>, code: string) {
    console.log(messages.slice(1, messages.length));
    let response = '';
    let codeHelper = false;

    ws.send("Startstreaming");

    const { text: geminiResponse, snippets } = await streamGeminiResponse(messages, (data) => {
        if (data.includes("ASKCODEHELPER")) {
            codeHelper = true;
        }
        if (!codeHelper) {
            ws.send(data); // Stream text normally
        }
    });

    if (snippets.length > 0) {
        ws.send(JSON.stringify({
            type: "snippets",
            snippets
        }));
    }

    if(codeHelper){
        console.log("Asking big bro");
        const codeRes = await getOpenAIResponse([
            {role: "system", content: coderPrompt},
            {role: "user", content: response}
        ])
        console.log(codeRes);
        messages.push({role: "assistant", content: `The expert coder has responded with the following: ${codeRes}`});
        response = '';
        await streamGeminiResponse(messages, (data)=>{
            response += data;
            ws.send(data);
        });

        const { text: finalResponse, snippets: oaiSnippets } = await streamGeminiResponse(messages, (data) => {
            ws.send(data);
        });

        if (oaiSnippets.length > 0) {
            ws.send(JSON.stringify({
                type: "snippets",
                snippets: oaiSnippets
            }));
        }
    } else {
        messages.push({ role: "assistant", content: geminiResponse });
    }

    connectionMessages.set(ws.id, messages);

    // end stream
    ws.send("Endstreaming");
}

// new function for code analysis
async function handleCodeAnalysis(ws: any, code: string) {
    try {
        // Analyze the code for errors
        const errors = await analyzeCode(code);
        
        // Send errors to the client
        ws.send(JSON.stringify({
            type: "codeErrors",
            errors
        }));
        
        return errors;
    } catch (error) {
        console.error("Error analyzing code:", error);
        ws.send(JSON.stringify({
            type: "codeErrors",
            // error line & characters sent to frontend
            errors: [{
                line: 1,
                character: 1,
                message: "Failed to analyze code",
                severity: "error"
            }]
        }));
        return [];
    }
}

const app = new Elysia()
    .get("/", () => "Hello World")
    .ws('/help', {      
        body: t.Object({
            code: t.String(),
            message: t.String()
        }),
        open(ws) {
            // Initialize messages array for new connections with the system message
            connectionMessages.set(ws.id, [
                { role: 'system', content: teacherPrompt },
                { role: 'assistant', content: '🪿 Honk! Are we adding something shiny and new, or chasing down a sneaky bug? And where in this messy nest of code are we poking today?' }
            ]);
        },
        async message(ws, {code, message}) {
            // Get existing messages for this connection or create new array if none exists
            let messages = connectionMessages.get(ws.id) || [
                { role: 'system', content: teacherPrompt }
            ];
            
            // first analyze the code for errors
            const errors = await handleCodeAnalysis(ws, code);
            
            // adding user message with error information if available
            const errorInfo = errors.length > 0 
                ? `\n\nI detected the following issues in your code:\n${errors.map(e => 
                    `Line ${e.line}, Character ${e.character}: ${e.message} (${e.severity})`).join('\n')}`
                : '';
                
            // Add user message
            messages.push({ role: 'user', content: `Code: ${code}.${errorInfo}\n\nQuestion: ${message}` });
            handleMessage(ws, messages, code);
        },
        close(ws) {
            // Clean up messages when connection closes
            connectionMessages.delete(ws.id);
        }
    })
    .ws('/debug', {
        body: t.Object({
            code: t.String(),
            message: t.String()
        }),
        open(ws) {
            // Initialize messages array for new connections with the system message
            connectionMessages.set(ws.id, [
                { role: 'system', content: teacherPrompt },
                {role: 'user', content: 'I have an error in my code. Can you help me debug it?'}
            ]);
        },
        async message(ws, {code, message}) {
            // Get existing messages for this connection or create new array if none exists
            let messages = connectionMessages.get(ws.id) || [
                { role: 'system', content: teacherPrompt }
            ];
            
            // First analyze the code for errors
            const errors = await handleCodeAnalysis(ws, code);
            
            // Enhanced debugging with error information
            const errorInfo = errors.length > 0 
                ? `\n\nI found these specific issues:\n${errors.map(e => 
                    `Line ${e.line}, Character ${e.character}: ${e.message} (${e.severity})`).join('\n')}`
                : '\n\nNo syntax errors were detected, but there might be logical issues.';
            
            // Add user message
            messages.push({ role: 'user', content: `This is the user's current code: ${code}.${errorInfo}\n\nThe user was asking: ${message}` });
            
            handleMessage(ws, messages, code);
        },
        close(ws){
            connectionMessages.delete(ws.id);
        }
    })
    
    // new endpoint for code analysis without chat
    .ws('/analyze', {
        body: t.Object({
            code: t.String()
        }),
        async message(ws, {code}) {
            await handleCodeAnalysis(ws, code);
        }
    })
    .listen(3000);

console.log(
    `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
