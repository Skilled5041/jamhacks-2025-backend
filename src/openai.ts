import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources';

const geminiClient = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL:"https://generativelanguage.googleapis.com/v1beta/openai/"
});
const openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

function toChatCompletionMessages(messages: Array<{ role: string, content: string }>): ChatCompletionMessageParam[] {
  return messages.map(msg => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content
  }));
}

export const getOpenAIResponse = async (messages: Array<{ role: string, content: string }>) => { 
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

export const analyzeCodeWithOpenAI = async (code: string) => {
    try {
        const systemPrompt = `
            You are a code analysis expert specializing in logical error detection. Analyze the provided JavaScript/TypeScript code for logical errors and potential bugs, not syntax errors.
            
            Focus on issues like:
            - Incorrect logic in conditionals
            - Potential race conditions
            - Error handling problems
            - Memory leaks
            - Incorrect API usage
            - Infinite loops or recursion
            - Edge case bugs
            - Type mismatches or unsafe type operations
            - Inefficient algorithms or patterns
            - Security vulnerabilities
            
            Return ONLY a JSON object with this structure:
            {
                "errors": [
                    {
                        "line": number,
                        "character": number,
                        "message": "detailed error description",
                        "severity": "error" or "warning"
                    }
                ]
            }
            
            It is ABSOLUTELY CRITICAL that you include accurate line and character numbers for each error.
            Return empty array if no logical errors. Be extremely precise with line and character positions.
        `;
        
        const completion = await openaiClient.chat.completions.create({
            model: 'gpt-4o',
            response_format: { type: "json_object" },
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Analyze this code for logical errors:\n\`\`\`\n${code}\n\`\`\`` }
            ]
        });
        
        const response = completion.choices[0].message.content;
        try {
            const parsedResponse = JSON.parse(response ?? '{ "errors": [] }');
            
            // ensuring the response has the expected format
            if (!parsedResponse.errors) {
                parsedResponse.errors = [];
            }
            
            // validating each error object has required fields
            interface CodeAnalysisError {
              line: number;
              character: number;
              message: string;
              severity: 'error' | 'warning';
            }

            interface CodeAnalysisResponse {
              errors: CodeAnalysisError[];
            }

            (parsedResponse as CodeAnalysisResponse).errors = (parsedResponse.errors as CodeAnalysisError[]).filter((error: CodeAnalysisError) => 
              typeof error.line === 'number' && 
              typeof error.character === 'number' && 
              typeof error.message === 'string' && 
              (error.severity === 'error' || error.severity === 'warning')
            );
            
            return parsedResponse;
        } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            console.log('Raw response:', response);
            return { errors: [] };
        }
    } catch (error) {
        console.error('OpenAI API error during code analysis:', error);
        return { errors: [] };
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

export const streamGeminiResponse = async (
  messages: Array<{ role: string; content: string }>,
  callback: (data: string) => void
): Promise<{ text: string; snippets: string[] }> => { // Now returns both full text and snippets
  try {
    // Convert messages to proper types
    const chatMessages = messages.map(msg => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: msg.content
    }));

    let fullResponse = '';
    const snippetBuffer: string[] = [];
    let inSnippet = false;
    let currentSnippet = '';

    const stream = await geminiClient.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      callback(content); // Continue streaming to client

      // Real-time snippet detection
      for (const char of content) {
        if (char === '!') {
          if (currentSnippet.endsWith('!!')) {
            // Closing snippet
            if (inSnippet) {
              snippetBuffer.push(currentSnippet.slice(0, -2));
              currentSnippet = '';
              inSnippet = false;
            } 
            // Opening snippet
            else {
              inSnippet = true;
              currentSnippet = '';
            }
          } else {
            currentSnippet += char;
          }
        } else if (inSnippet) {
          currentSnippet += char;
        }
      }
    }

    // Handle any unterminated snippet
    if (inSnippet && currentSnippet) {
      snippetBuffer.push(currentSnippet);
    }

    return {
      text: fullResponse,
      snippets: snippetBuffer
    };

  } catch (error) {
    console.error('Gemini API error:', error);
    return { text: '', snippets: [] };
  }
};

export function extractSnippets(text: string): string[] {
  const regex = /!!!([\s\S]*?)!!!/g;
  return [...text.matchAll(regex)].map(match => 
    match[1].replace(/^```[a-z]*\n|\n```$/g, '')
  );
}
