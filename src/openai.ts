import OpenAI from 'openai';

const geminiClient = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL:"https://generativelanguage.googleapis.com/v1beta/openai/"
});
const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

import { ChatCompletionMessageParam } from 'openai/resources';

export const getOpenAIResponse = async (messages: Array<{ role: string, content: string }>, ) => { 
    try {
        const chatMessages: ChatCompletionMessageParam[] = messages.map(msg => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content
        }));
        
        const completion = await openaiClient.chat.completions.create({
            model: 'gpt-4o',
            messages: chatMessages
        });
        
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API error:', error);
        return "OpenAI error";
    }
}

export const streamOpenAIResponse = async (messages: Array<{ role: string, content: string }>, callback: (data: string) => void) => {
    try {
        const chatMessages: ChatCompletionMessageParam[] = messages.map(msg => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content
        }));
        
        const stream = await openaiClient.chat.completions.create({
            model: 'gpt-4o',
            messages: chatMessages,
            stream: true,
        });
        
        for await (const chunk of stream) {
            if (chunk.choices[0].delta.content) {
                callback(chunk.choices[0].delta.content);
            }
        }
    } catch (error) {
        console.error('OpenAI API error:', error);
    }
}

export const streamGeminiResponse = async (messages: Array<{ role: string, content: string }>, callback: (data: string) => void) => {
    try {
        const chatMessages: ChatCompletionMessageParam[] = messages.map(msg => ({
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content
        }));
        
        const stream = await geminiClient.chat.completions.create({
            model: 'gemini-2.0-flash',
            messages: chatMessages,
            stream: true,
        });
        
        for await (const chunk of stream) {
            if (chunk.choices[0].delta.content) {
                callback(chunk.choices[0].delta.content);
            }
        }
    } catch (error) {
        console.error('Gemini API error:', error);
    }
}