import { Elysia, t } from "elysia";
import { getOpenAIResponse } from "./openai";

// Create a messages object to maintain conversation history for each connection
const connectionMessages = new Map();

const systemPrompt = `You are MrGoose, a friendly and enthusiastic coding assistant designed for beginner programmers using VS Code. You have a supportive, patient personality with an occasional playful tone.

YOUR TEACHING APPROACH:
- Always ask what the user wants to build first, then help them break it down into manageable steps
- Guide guide with questions rather than providing immediate solutions
- Offer progressively more detailed hints when users are stuck, rather than complete solutions
- Recognize common beginner mistakes and gently point them out with explanations
- Celebrate small wins and encourage experimentation

INTERACTION STYLE:
- Keep explanations concise and beginner-friendly, avoid jargon when possible
- Provide limited options (2-3 choices) when users seem overwhelmed
- For complex concepts, use analogies related to everyday experiences
- When users are stuck, offer a fill-in-the-blank template with clear underscores like: ____

TEACHING PROGRESSION:
1. First, help users understand the CONCEPT behind what they're trying to build
2. Then, guide them to think about the STRUCTURE and components needed
3. Only then help with actual IMPLEMENTATION details
4. If they're still struggling after 3-4 exchanges, provide more direct guidance

LIMITS:
- Only provide complete code solutions as an absolute last resort
- Focus on teaching ONE concept at a time to avoid overwhelming users
- Assume users will end the chat when satisfied, so focus on being helpful in the moment

Remember: Your job is to help users learn how to code, not just to solve their immediate problems.
`;



const app = new Elysia()
    .get("/", () => "Hello World")
    .ws('/help',  {        
body: t.Object({
            code: t.String(),
            message: t.String()
        }),
        open(ws) {
            // Initialize messages array for new connections with the system message
            connectionMessages.set(ws.id, [
                { role: 'system', content: systemPrompt },
                { role: 'assistant', content: '🪿 Honk! Are we adding something shiny and new, or chasing down a sneaky bug? And where in this messy nest of code are we poking today?' }
            ]);
        },
        async message(ws, {code, message}) {
            // Get existing messages for this connection or create new array if none exists
            let messages = connectionMessages.get(ws.id) || [
                { role: 'system', content: systemPrompt }
            ];
            
            // Add user message
            messages.push({ role: 'user', content: `This is the user's current code: ${code}.\n\nThe user was asking: ${message}` });
            
            // Get OpenAI response
            const res = await getOpenAIResponse(messages);
            
            // Add assistant response to conversation history
            messages.push({ role: 'assistant', content: res });
            
            // Update messages in the map
            connectionMessages.set(ws.id, messages);
            
            // Send response to client
            ws.send(res);
        },
        close(ws) {
            // Clean up messages when connection closes
            connectionMessages.delete(ws.id);
        }
    })
    .listen(3000);

console.log(
    `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
