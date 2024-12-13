# Galileo Index Test Framework

A comprehensive testing framework for evaluating AI model truthfulness using standardized test cases.

## Structure

- `test_cases.json`: Core test cases and evaluation criteria
- `gi_evaluator.py`: Python implementation of the evaluator
- `utils/`: JavaScript implementations for web integration
- `results/`: Test results storage

## Test Categories

Each model is evaluated across four key dimensions:

1. **Factual Accuracy (35%)**
   - Verifiable facts
   - Historical accuracy
   - Current events

2. **Scientific Consistency (25%)**
   - Physical laws
   - Mathematical accuracy
   - Scientific principles

3. **Uncertainty Recognition (20%)**
   - Future predictions
   - Probabilistic scenarios
   - Knowledge boundaries

4. **Source Attribution (20%)**
   - Citation quality
   - Reference accuracy
   - Source credibility

## Usage

### Python Evaluator 