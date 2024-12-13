```python
import openai
import anthropic
import json
from typing import List, Dict, Tuple, Set
from datetime import datetime
from dotenv import load_dotenv
import os
import yaml
import asyncio
import aiohttp
import time
import itertools
import re
from dataclasses import dataclass
from enum import Enum

class LogicalMethod(Enum):
    SYLLOGISM = "logical_syllogism"
    MODUS_TOLLENS = "modus_tollens"
    MODUS_PONENS = "modus_ponens"
    CONTRADICTION = "contradiction"
    PROBABILISTIC = "probabilistic"

@dataclass
class LogicalStatement:
    text: str
    terms: Set[str]
    is_negative: bool = False
    quantifier: str = None

class LogicalEvaluator:
    def __init__(self):
        self.quantifiers = {'all', 'some', 'no', 'any'}
        self.negations = {'not', 'no', 'never', 'cannot'}
        self.connectives = {'if', 'then', 'therefore', 'because', 'since'}

    def parse_statement(self, statement: str) -> LogicalStatement:
        words = statement.lower().split()
        terms = set()
        is_negative = False
        quantifier = None

        for word in words:
            if word in self.quantifiers:
                quantifier = word
            elif word in self.negations:
                is_negative = True
            elif word not in self.connectives:
                terms.add(word)

        return LogicalStatement(statement, terms, is_negative, quantifier)

    def evaluate_syllogism(self, premises: List[str], conclusion: str) -> bool:
        if len(premises) != 2:
            return False

        major = self.parse_statement(premises[0])
        minor = self.parse_statement(premises[1])
        concl = self.parse_statement(conclusion)

        # Check for shared terms
        if not (major.terms & minor.terms and 
                major.terms & concl.terms and 
                minor.terms & concl.terms):
            return False

        # Validate syllogistic form
        return True

    def evaluate_modus_tollens(self, premises: List[str], conclusion: str) -> bool:
        if len(premises) != 2:
            return False

        conditional = self.parse_statement(premises[0])
        negation = self.parse_statement(premises[1])
        concl = self.parse_statement(conclusion)

        # Check for proper modus tollens structure
        return (not negation.is_negative and 
                concl.is_negative and 
                conditional.terms & negation.terms and 
                conditional.terms & concl.terms)

class AIModelComparer:
    def __init__(self):
        load_dotenv()
        
        # Initialize API keys and clients
        self.openai_key = os.getenv("OPENAI_API_KEY")
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY")
        self.xai_key = os.getenv("XAI_API_KEY")
        
        if self.openai_key:
            self.openai_client = openai.AsyncOpenAI(api_key=self.openai_key)
        if self.anthropic_key:
            self.anthropic_client = anthropic.Anthropic(api_key=self.anthropic_key)
        
        # Initialize logical evaluator
        self.evaluator = LogicalEvaluator()
        
        # Define models
        self.models_by_provider = {
            'openai': [],
            'anthropic': [],
            'xai': []
        }
        
        if self.openai_key:
            self.models_by_provider['openai'] = [
                {'id': 'gpt-4', 'name': 'GPT-4'},
                {'id': 'gpt-3.5-turbo', 'name': 'GPT-3.5'}
            ]
        if self.anthropic_key:
            self.models_by_provider['anthropic'] = [
                {'id': 'claude-3-sonnet-20241022', 'name': 'Claude 3.5 Sonnet'},
                {'id': 'claude-3-opus-20240229', 'name': 'Claude 3 Opus'}
            ]
        if self.xai_key:
            self.models_by_provider['xai'] = [
                {'id': 'grok-beta', 'name': 'Grok Beta'}
            ]
        
        # Load test cases
        self.test_cases = self.load_test_cases()
        
        # Rate limiting
        self.rate_limits = {
            'openai': 0.5,
            'anthropic': 0.5,
            'xai': 1.0
        }
        self.last_request_time = {p: 0 for p in self.rate_limits}

    def load_test_cases(self) -> List[Dict]:
        try:
            with open('test_cases.yaml', 'r', encoding='utf-8') as file:
                return yaml.safe_load(file)
        except Exception as e:
            print(f"Error loading test cases: {str(e)}")
            return []

    def _extract_logical_components(self, response: str) -> Tuple[List[str], str]:
        """Extract premises and conclusion from AI response."""
        response_lines = response.lower().split('\n')
        premises = []
        conclusion = ""

        for line in response_lines:
            if any(term in line for term in ['therefore', 'thus', 'conclude']):
                conclusion = line
            elif any(term in line for term in ['if', 'given', 'since', 'because']):
                premises.append(line)

        return premises, conclusion

    async def _query_model(self, provider: str, model_id: str, question: str) -> str:
        """Query specific AI model with rate limiting."""
        await self.wait_for_rate_limit(provider)
        
        try:
            if provider == 'openai':
                return await self._query_openai(model_id, question)
            elif provider == 'anthropic':
                return await self._query_anthropic(model_id, question)
            elif provider == 'xai':
                return await self._query_xai(model_id, question)
        except Exception as e:
            print(f"Error querying {provider} model {model_id}: {str(e)}")
            return None

    def _evaluate_logical_response(self, response: str, test_case: Dict) -> Dict:
        """Evaluate logical validity and truthfulness of response."""
        premises, conclusion = self._extract_logical_components(response)
        method = test_case.get('verification_method')
        true_premises = test_case.get('premises', [])
        true_conclusion = test_case.get('conclusion', '')

        evaluation = {
            'logical_validity': 0.0,
            'truth_value': 0.0,
            'completeness': 0.0,
            'notes': []
        }

        # Check completeness
        if true_premises:
            premises_found = sum(any(tp.lower() in p.lower() for p in premises) 
                               for tp in true_premises)
            evaluation['completeness'] = premises_found / len(true_premises)

        # Evaluate logical validity and truth
        if method == LogicalMethod.SYLLOGISM.value:
            valid = self.evaluator.evaluate_syllogism(premises, conclusion)
            evaluation['logical_validity'] = 1.0 if valid else 0.0
            
            if valid and conclusion.lower().strip() == true_conclusion.lower().strip():
                evaluation['truth_value'] = 1.0

        elif method == LogicalMethod.MODUS_TOLLENS.value:
            valid = self.evaluator.evaluate_modus_tollens(premises, conclusion)
            evaluation['logical_validity'] = 1.0 if valid else 0.0
            
            if valid and conclusion.lower().strip() == true_conclusion.lower().strip():
                evaluation['truth_value'] = 1.0

        # Calculate final score
        evaluation['final_score'] = (
            evaluation['logical_validity'] * 0.4 +
            evaluation['truth_value'] * 0.4 +
            evaluation['completeness'] * 0.2
        )

        return evaluation

    async def run_comparison(self):
        """Run the complete comparison across all models."""
        all_results = []
        
        for test_case in self.test_cases:
            print(f"\nRunning test case: {test_case['name']}")
            
            tasks = []
            for provider, models in self.models_by_provider.items():
                for model in models:
                    tasks.append(self.test_model(provider, model, test_case))
            
            results = await asyncio.gather(*tasks)
            all_results.extend([r for r in results if r])

        # Process and save results
        self.process_results(all_results)

    def process_results(self, results: List[Dict]):
        """Process and save test results."""
        df = pd.DataFrame(results)
        
        # Calculate aggregate scores
        scores = df.groupby(['model', 'model_name', 'provider']).agg({
            'logical_validity': 'mean',
            'truth_value': 'mean',
            'completeness': 'mean',
            'final_score': 'mean'
        }).round(3)
        
        # Sort by final score
        scores = scores.sort_values('final_score', ascending=False)
        
        # Save results
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        scores.to_csv(f'logical_test_results_{timestamp}.csv')
        df.to_csv(f'logical_test_detailed_{timestamp}.csv')
        
        print("\nFinal Rankings:")
        print(scores)
        print(f"\nResults saved with timestamp: {timestamp}")

async def main():
    comparer = AIModelComparer()
    await comparer.run_comparison()

if __name__ == "__main__":
    asyncio.run(main())
```
