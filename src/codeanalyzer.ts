import { analyzeCodeWithOpenAI } from './openai';

export interface CodeError {
  line: number;
  character: number;
  message: string;
  severity: 'error' | 'warning';
}

interface CodeAnalysisResult {
  errors: Array<Partial<CodeError>>;
}

export async function analyzeCode(code: string): Promise<CodeError[]> {
  // focusing mainly on logic errors so we'll just use LLM
  try {
    const result = await analyzeCodeWithOpenAI(code) as CodeAnalysisResult;
    
    // ensuring the result has the expected format - should have errors array
    if (result && result.errors && Array.isArray(result.errors)) {
      // validating each error object has required fields
      return result.errors.filter((error): error is CodeError => 
        typeof error.line === 'number' && 
        typeof error.character === 'number' && 
        typeof error.message === 'string' && 
        (error.severity === 'error' || error.severity === 'warning')
      );
    }
    
    console.warn('Unexpected result format from analyzeCodeWithOpenAI:', result);
    return [];
  } catch (error: unknown) {
    console.error('Failed during LLM code analysis:', error);
    return [];
  }
}
