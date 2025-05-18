import { Elysia, t } from "elysia";
import { streamOpenAIResponse, streamGeminiResponse, getOpenAIResponse } from "./openai";
import {teacherPrompt, coderPrompt} from "./proompts";


// Create a messages object to maintain conversation history for each connection
const connectionMessages = new Map();

async function askCodeExpert(message: string, code: string){
    const res = await getOpenAIResponse([
        {role: "system", content: coderPrompt},
        {role: "user", content: `Please create a fill-in the blank exercise. Context: ${message}\n\nCode: <<<${code}>>>`}
    ])
    return res;
}

async function handleMessage(ws: any, messages: Array<{ role: string, content: string }>, code:string) {
    console.log(messages.slice(1, messages.length));
    let response = '';
    let codeHelper = false;

    ws.send("Startstreaming");
    // Get OpenAI response
    await streamGeminiResponse(messages, (data) => {
        if(data.includes("🎐")){
            codeHelper = true;
        }
        response += data;
        data = data.replaceAll("\n", "🆕");
        if(!codeHelper){
            ws.send(data);
        }
    });


    if(codeHelper){
        console.log(`Asking expert coder: ${response}`);
        ws.send("codeinsertion");
        let newRes = '';
        await streamOpenAIResponse([
            {role: "system", content: coderPrompt},
            {role: "user", content: `Message: ${response}\n\nCode: <<<${code}>>>`}
        ],(data) => {
            newRes += data;
            ws.send(data);
        });
        
        messages.push({role: "assistant", content: `${response}`});
    }

    messages.push({ role: "assistant", content: response });
    
    connectionMessages.set(ws.id, messages);
    
    // end stream
    ws.send("Endstreaming");
}


const app = new Elysia()
    .get("/", () => "Hello World")
    .post("/fitb", async ({body}) => {
        return await askCodeExpert(body.message, body.code);
    },
    {
        body: t.Object({
            code: t.String(),
            message: t.String()
        })
    }
)
    .ws('/help',  {        
body: t.Object({
            code: t.String(),
            message: t.String()
        }),
        open(ws) {
            // Initialize messages array for new connections with the system message
            connectionMessages.set(ws.id, [
                { role: 'system', content: teacherPrompt },
                { role: 'assistant', content: '🪿 Honk! How can I help you?' }
            ]);
        },
        async message(ws, {code, message}) {
            // Get existing messages for this connection or create new array if none exists
            let messages = connectionMessages.get(ws.id) || [
                { role: 'system', content: teacherPrompt }
            ];
            
            // Add user message
            messages.push({ role: 'user', content: `Code: <<<${code}>>>.\n\nQuestion: ${message}` });
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
            
            // Add user message
            messages.push({ role: 'user', content: `Code: <<<${code}>>>.\n\nQuestion: ${message}` });
            
            handleMessage(ws, messages, code);
        },
        close(ws){
            connectionMessages.delete(ws.id);
        }
    })
    .listen(3000);

console.log(
    `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
