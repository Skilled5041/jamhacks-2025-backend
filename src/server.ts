import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import axios from "axios";

// does this work differently with bun
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PORT = process.env.PORT || 3000;

const app = new Elysia()
  .use(cors())
  .post("/api/gemini/ask", async ({ body }) => {
    const { conversation } = body as { conversation: Array<{role: string, content: string}> };
    
    if (!conversation || !Array.isArray(conversation)) {
      return new Response(JSON.stringify({ error: 'Conversation history required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // including the backticks so it's easier for us to parse & inject fill in the blank code into the editor 
    const systemPrompt = `
You are MrGoose, a helpful and friendly coding assistant that supports beginner developers inside VS Code.
Your main goals:
- Help the user when they are trying to build or add a feature to their code.
- Engage in a helpful and non-overwhelming conversation to understand what they are trying to build.
- Ask them what their idea is and give hints based on their responses.
- You decide when to provide multiple choice options or a fill-in-the-blank style template.
- For fill-in-the-blanks, always use triple backticks and clear underscores like: ____.
- Wrap code snippets inside triple backticks and specify the language (e.g. \`\`\`js, \`\`\`ts).
- Only provide full code if absolutely necessary and only as a last resort.
- If the user seems stuck or confused after a few turns, gently guide them with structured help.
- Assume that the user will end the chat whenever they feel satisfied, so you don't need to explicitly ask.
Your job is to teach by guiding, not solving everything.
`;

    const fullPrompt = [
      { role: 'system', content: systemPrompt },
      ...conversation,
    ];

    try {
      const response = await axios.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        {
          contents: [
            {
              role: 'user',
              parts: fullPrompt.map((msg) => ({ text: `${msg.role}: ${msg.content}` })),
            },
          ],
        },
        {
          params: {
            key: GEMINI_API_KEY,
          },
        }
      );

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, MrGoose had a brain freeze!';
      return { reply: text };
    } catch (error) {
      console.error('Gemini API error:', error);
      return new Response(JSON.stringify({ error: 'Failed to get response from Gemini.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  })
  .listen(PORT);

console.log(
  `MrGoose backend is running at http://${app.server?.hostname}:${app.server?.port}`
);
