// need to npm install esprima @types/esprima !!!


import { parseModule } from 'esprima';

export interface CodeError {
  line: number;
  character: number;
  message: string;
  severity: 'error' | 'warning';
}

export async function analyzeCode(code: string): Promise<CodeError[]> {
  const errors: CodeError[] = [];
  
  /*try {
    parseModule(code, { loc: true, tolerant: true });
  } catch (error: any) {
    if (error.lineNumber && error.column) {
      errors.push({
        // detects the line & character of the error
        line: error.lineNumber,
        character: error.column,
        message: error.description || 'Syntax error',
        severity: 'error'
      });
    }
  }*/

  // using LLM to analyze more complex issues
  try {
    const errorAnalysis = await analyzeLLM(code);
    if (errorAnalysis && errorAnalysis.length > 0) {
      errors.push(...errorAnalysis);
    }
  } catch (llmError) {
    console.error('LLM analysis error:', llmError);
  }

  return errors;
}

async function analyzeLLM(code: string): Promise<CodeError[]> {
  //  uses the specialized OpenAI function for code analysis
  const { analyzeCodeWithOpenAI } = await import('./openai');
  
  try {
    const result = await analyzeCodeWithOpenAI(code);
    
    if (result && Array.isArray(result)) {
      return result;
    } else if (result && result.errors && Array.isArray(result.errors)) {
      return result.errors;
    }
    
    return [];
  } catch (error) {
    console.error('Failed during LLM code analysis:', error);
    return [];
  }
}
