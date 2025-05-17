import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI, // This is the default and can be omitted
});

import { ChatCompletionMessageParam } from 'openai/resources';

export const getOpenAIResponse = async (messages: Array<{ role: string, content: string }>) => { 
    try {
        const chatMessages: ChatCompletionMessageParam[] = messages.map(msg => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content
        }));
        
        const completion = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: chatMessages,
        });
        
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API error:', error);
        return "OpenAI error";
    }
}
