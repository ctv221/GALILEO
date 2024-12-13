# Galileo Index

<div align="center">
  <img src="https://galileoindex.ai/logo.png" alt="Galileo Index Logo" width="200"/>
</div>

Illuminating truth in artificial intelligence through empirical measurement.

## Links

- 🌐 **Website**: [galileoindex.ai](https://galileoindex.ai)
- 🎮 **Playground**: [galileoindex.ai/playground](https://galileoindex.ai/playground)
- 🐦 **Twitter**: [@GalileoIndexSOL](https://x.com/GalileoIndexSOL)

## Overview

The Galileo Index (GI) is an open-source framework for measuring and comparing AI model truthfulness. Just as Galileo's telescope revolutionized our understanding of the cosmos, the Galileo Index aims to bring clarity to the expanding universe of artificial intelligence through rigorous measurement and empirical observation.

## Features

### Real-time Model Testing
- Compare leading AI models head-to-head in the Playground
- Test GPT-4o, Claude 3.5 Sonnet, Grok Beta, and more
- Get instant truthfulness scores and detailed breakdowns

### Scoring Methodology
Our scoring system evaluates AI responses across four key dimensions:

1. **Factual Accuracy (40%)**
   - Specific facts and numerical data (40pts)
   - Precise language usage (30pts)
   - Proper use of qualifiers (30pts)

2. **Scientific Consistency (35%)**
   - Scientific terminology (35pts)
   - Logical structure and flow (35pts)
   - Methodology references (30pts)

3. **Uncertainty Recognition (40%)**
   - Expression of uncertainty (40pts)
   - Limitation acknowledgment (30pts)
   - Alternative viewpoints (30pts)

4. **Source Attribution (40%)**
   - Citations and references (40pts)
   - Specific source mentions (30pts)
   - Temporal context (30pts)

### Performance Analytics
- Track model performance over time
- View detailed score breakdowns
- Compare historical results
- Access comprehensive statistics

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/galileo.git
cd galileo
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Add your API keys to .env
```

4. Start the server:
```bash
npm start
```

5. Visit `http://localhost:3000` in your browser

## Environment Variables

Required environment variables:
```env
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
XAI_API_KEY=your_xai_key
MONGODB_URI=your_mongodb_connection_string
```

## Tech Stack

- **Frontend**: EJS, CSS3, JavaScript
- **Backend**: Node.js, Express
- **Database**: MongoDB
- **AI APIs**: OpenAI, Anthropic, xAI

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Quote

> "Measure what is measurable, and make measurable what is not so."
> - Galileo Galilei
