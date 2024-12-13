require('dotenv').config();
const express = require('express');
const app = express();
const layouts = require('express-ejs-layouts');
const connectDB = require('./config/db');
const TestResult = require('./models/TestResult');
const port = process.env.PORT || 3000;
const queueManager = require('./utils/QueueManager');
const mongoose = require('mongoose');

// Connect to MongoDB
connectDB();

// Initialize all API clients in one place
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize the clients
const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
});

const anthropic = new Anthropic({ 
    apiKey: process.env.ANTHROPIC_API_KEY 
});

// Add X.AI client
const xai = {
    apiKey: process.env.XAI_API_KEY,
    baseUrl: 'https://api.x.ai/v1'
};

// Add middleware
app.use(express.json());
app.use(express.static('public'));

// Add this for debugging
console.log('Environment variables loaded:', {
    OPENAI_KEY: process.env.OPENAI_API_KEY ? 'Set' : 'Not set',
    ANTHROPIC_KEY: process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not set',
    GOOGLE_KEY: process.env.GOOGLE_API_KEY ? 'Set' : 'Not set'
});

// Score tracking system
const scoreTracker = {
    scores: {},
    testResults: [],
    
    // Add a new test result
    addResult(result) {
        const timestamp = new Date().toISOString();
        this.testResults.push({
            ...result,
            timestamp
        });
        
        // Update average scores
        if (!this.scores[result.model]) {
            this.scores[result.model] = {
                totalScore: 0,
                count: 0,
                averageScore: 0,
                recentScores: []
            };
        }
        
        const modelStats = this.scores[result.model];
        modelStats.totalScore += result.score || 0;
        modelStats.count += 1;
        modelStats.averageScore = Math.round(modelStats.totalScore / modelStats.count);
        
        // Keep last 10 scores for recent performance
        modelStats.recentScores.unshift({
            score: result.score,
            timestamp
        });
        if (modelStats.recentScores.length > 10) {
            modelStats.recentScores.pop();
        }
    },
    
    // Get aggregated stats
    getStats() {
        return Object.entries(this.scores).map(([model, stats]) => ({
            model,
            averageScore: stats.averageScore,
            totalTests: stats.count,
            recentScores: stats.recentScores
        }));
    },
    
    // Get recent test results
    getRecentResults(limit = 50) {
        return this.testResults.slice(0, limit);
    }
};

// Define giData globally
const giData = {
    title: 'Galileo Index (GI)',
    description: 'A Metric for AI Truth Assessment',
    components: [
        {
            name: 'Factual Accuracy',
            weight: 0.35,
            description: 'Measures the model\'s ability to provide factually correct information'
        },
        {
            name: 'Scientific Consistency',
            weight: 0.25,
            description: 'Evaluates alignment with established scientific principles'
        },
        {
            name: 'Uncertainty Recognition',
            weight: 0.20,
            description: 'Assesses the model\'s ability to acknowledge limitations and uncertainties'
        },
        {
            name: 'Source Attribution',
            weight: 0.20,
            description: 'Evaluates proper citation and attribution of information'
        }
    ]
};

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('view options', { layout: 'layout' });
app.use(express.static('public'));

// Add middleware to make giData available to all views
app.use((req, res, next) => {
    res.locals.giData = giData;
    next();
});

app.use(layouts);

// All routes should be defined here, before app.listen
app.get('/', async (req, res) => {
    try {
        if (!mongoose.connection.readyState) {
            // Use fallback data if DB is not connected
            return res.render('index', { stats: global.fallbackData.stats });
        }

        const stats = await TestResult.aggregate([
            {
                $group: {
                    _id: '$model',
                    averageScore: { $avg: '$score' },
                    totalTests: { $sum: 1 },
                    recentScores: {
                        $push: {
                            score: '$score',
                            timestamp: '$timestamp'
                        }
                    }
                }
            },
            {
                $project: {
                    model: '$_id',
                    averageScore: { $round: ['$averageScore', 0] },
                    totalTests: 1,
                    recentScores: { $slice: ['$recentScores', -10] }
                }
            },
            { $sort: { averageScore: -1 } }
        ]).exec();

        res.render('index', { stats });
    } catch (error) {
        console.error('Error rendering index:', error);
        // Use fallback data on error
        res.render('index', { stats: global.fallbackData.stats });
    }
});

app.get('/whitepaper', (req, res) => {
    res.render('whitepaper');
});

app.get('/playground', (req, res) => {
    res.render('playground');
});

// Define the test cases
const logicTestCases = {
    modus_ponens: {
        name: "Modus Ponens",
        description: "If P then Q; P; Therefore Q",
        premises: [
            "If P then Q",
            "P"
        ],
        conclusion: "Therefore, Q",
        logicForm: {
            type: "modus_ponens",
            variables: {
                P: "It's raining",
                Q: "The ground is wet"
            }
        },
        truthTable: [
            { P: true, Q: true, valid: true },
            { P: true, Q: false, valid: false },
            { P: false, Q: true, valid: true },
            { P: false, Q: false, valid: true }
        ],
        correctAnswer: true
    },
    modus_tollens: {
        name: "Modus Tollens",
        description: "If P then Q; Not Q; Therefore not P",
        premises: [
            "If P then Q",
            "Not Q"
        ],
        conclusion: "Therefore, not P",
        logicForm: {
            type: "modus_tollens",
            variables: {
                P: "The sun is shining",
                Q: "It is daytime"
            }
        },
        truthTable: [
            { P: true, Q: true, valid: true },
            { P: true, Q: false, valid: false },
            { P: false, Q: true, valid: true },
            { P: false, Q: false, valid: true }
        ],
        correctAnswer: true
    }
    // Add more test cases...
};

// Add a logical evaluation function
function evaluateLogic(premises, conclusion, logicType) {
    // Convert natural language to logical form
    const logicalForm = parseToLogicalForm(premises, conclusion, logicType);
    
    // Evaluate validity using truth tables
    const validity = checkTruthTable(logicalForm);
    
    // Check for common logical fallacies
    const fallacies = checkFallacies(logicalForm);
    
    return {
        isValid: validity.isValid,
        score: calculateLogicScore(validity, fallacies),
        reasoning: generateReasoning(validity, fallacies),
        fallacies: fallacies
    };
}

function parseToLogicalForm(premises, conclusion, logicType) {
    // Convert natural language to logical symbols
    const symbols = extractLogicalSymbols(premises, conclusion);
    
    // Identify logical connectives (AND, OR, IF-THEN, etc.)
    const connectives = identifyConnectives(premises);
    
    return {
        type: logicType,
        symbols: symbols,
        connectives: connectives,
        structure: buildLogicalStructure(symbols, connectives)
    };
}

function checkTruthTable(logicalForm) {
    const variables = Object.keys(logicalForm.symbols);
    const rows = generateTruthTableRows(variables);
    
    return rows.map(row => ({
        ...row,
        conclusion: evaluateLogicalExpression(logicalForm.structure, row)
    }));
}

function calculateLogicScore(validity, fallacies) {
    let score = 100;
    
    // Deduct points for invalid logical form
    if (!validity.isValid) score -= 50;
    
    // Deduct points for each fallacy
    fallacies.forEach(fallacy => {
        score -= fallacy.severity * 10;
    });
    
    // Add bonus points for complex valid arguments
    if (validity.isValid && validity.complexity > 1) {
        score += Math.min(validity.complexity * 5, 20);
    }
    
    return Math.max(0, Math.min(100, score));
}

// Update the model testing function to use the logic evaluator
async function testModel(model, testCase) {
    const prompt = formatPrompt(testCase);
    
    try {
        const modelResponse = await getModelResponse(model, prompt, testCase);
        const logicEvaluation = evaluateLogic(
            testCase.premises,
            testCase.conclusion,
            testCase.logicForm.type
        );
        
        // Compare model's response with logical evaluation
        const accuracy = compareResponses(modelResponse, logicEvaluation);
        
        return {
            model,
            response: modelResponse,
            logicEvaluation,
            accuracy,
            details: {
                validityMatch: modelResponse.isValid === logicEvaluation.isValid,
                reasoningQuality: evaluateReasoning(modelResponse.reasoning),
                fallacyDetection: compareFallacyDetection(
                    modelResponse.fallacies,
                    logicEvaluation.fallacies
                )
            }
        };
    } catch (error) {
        console.error(`Error testing ${model}:`, error);
        return {
            model,
            error: true,
            message: error.message || 'Failed to get response'
        };
    }
}

// Add helper functions for logical evaluation
function evaluateReasoning(reasoning) {
    const criteria = {
        completeness: checkCompleteness(reasoning),
        clarity: checkClarity(reasoning),
        logicalFlow: checkLogicalFlow(reasoning),
        termConsistency: checkTermConsistency(reasoning)
    };
    
    return {
        score: calculateReasoningScore(criteria),
        details: criteria
    };
}

function compareFallacyDetection(modelFallacies, actualFallacies) {
    const truePositives = intersection(modelFallacies, actualFallacies);
    const falsePositives = difference(modelFallacies, actualFallacies);
    const falseNegatives = difference(actualFallacies, modelFallacies);
    
    return {
        accuracy: truePositives.length / (truePositives.length + falsePositives.length + falseNegatives.length),
        truePositives,
        falsePositives,
        falseNegatives
    };
}

// Middleware for parsing JSON bodies
app.use(express.json());

// API Keys (move these to .env file in production)
const API_KEYS = {
    'gpt-4': process.env.OPENAI_API_KEY,
    'claude-3': process.env.ANTHROPIC_API_KEY,
    'gemini-pro': process.env.GOOGLE_API_KEY
};

// Endpoint to get test cases
app.get('/api/test-cases', (req, res) => {
    res.json(logicTestCases);
});

// Endpoint to run tests
app.post('/api/run-test', async (req, res) => {
    const { testCase, models } = req.body;
    
    try {
        const results = await Promise.all(
            models.map(model => testModel(model, testCase))
        );
        res.json({ results });
    } catch (error) {
        console.error('Test execution error:', error);
        res.status(500).json({ error: 'Error running tests' });
    }
});

// Helper function to format the prompt
function formatPrompt(testCase) {
    return `
You are a logical reasoning evaluator. Analyze the following logical argument:

Premises:
${testCase.premises.join('\n')}

Conclusion:
${testCase.conclusion}

Evaluate if this logical argument is valid. Respond with a JSON object in this exact format:
{
    "isValid": boolean,
    "reasoning": "your step-by-step reasoning",
    "confidence": number between 0 and 1
}

Do not include any other text in your response, only the JSON object.
    `.trim();
}

// Update the models configuration
const availableModels = {
    openai: [
        { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
        { id: 'gpt-4-0125-preview', name: 'GPT-4 Turbo', provider: 'OpenAI' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5', provider: 'OpenAI' }
    ],
    anthropic: [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'Anthropic' }
    ],
    xai: [
        { id: 'grok-beta', name: 'Grok Beta', provider: 'X.AI' }
    ]
};

// Update the API test endpoint
app.post('/api/test', async (req, res) => {
    const { prompt, models, settings } = req.body;
    
    if (!prompt || !models || !Array.isArray(models) || models.length === 0) {
        return res.status(400).json({ 
            error: 'Invalid request. Prompt and models array required.' 
        });
    }
    
    // Create the request function
    const request = async () => {
        const results = await Promise.all(models.map(async (model) => {
            try {
                let response;
                let result;
                
                // OpenAI Models
                if (model.startsWith('gpt')) {
                    if (model === 'gpt-4o') {
                        response = await openai.chat.completions.create({
                            model: "gpt-4o",
                            messages: [
                                settings.systemPrompt ? 
                                    { role: 'system', content: settings.systemPrompt } : 
                                    { role: 'system', content: 'You are a helpful assistant.' },
                                { role: 'user', content: prompt }
                            ],
                            temperature: settings.temperature || 0.7
                        });
                        const scoreDetails = calculateScore(response.choices[0].message.content.trim());
                        result = {
                            model,
                            prompt,
                            response: response.choices[0].message.content.trim(),
                            score: scoreDetails.total,
                            scoreBreakdown: scoreDetails.breakdown,
                            settings
                        };
                    } else {
                        // Handle other GPT models
                        response = await openai.chat.completions.create({
                            model: model,
                            messages: [
                                settings.systemPrompt ? 
                                    { role: 'system', content: settings.systemPrompt } : 
                                    { role: 'system', content: 'You are a helpful AI assistant.' },
                                { role: 'user', content: prompt }
                            ],
                            temperature: settings.temperature || 0.7
                        });
                        const scoreDetails = calculateScore(response.choices[0].message.content.trim());
                        result = {
                            model,
                            prompt,
                            response: response.choices[0].message.content.trim(),
                            score: scoreDetails.total,
                            scoreBreakdown: scoreDetails.breakdown,
                            settings
                        };
                    }
                }
                
                // Anthropic Models
                else if (model.startsWith('claude')) {
                    if (model === 'claude-3-5-sonnet-20241022') {
                        const msg = await anthropic.messages.create({
                            model: "claude-3-5-sonnet-20241022",
                            max_tokens: 1000,
                            temperature: settings.temperature || 0,
                            messages: [{ role: "user", content: prompt }]
                        });
                        response = msg.content[0].text;
                        const scoreDetails = calculateScore(response.trim());
                        result = {
                            model,
                            prompt,
                            response: response.trim(),
                            score: scoreDetails.total,
                            scoreBreakdown: scoreDetails.breakdown,
                            settings
                        };
                    } else {
                        response = await anthropic.messages.create({
                            model: model,
                            max_tokens: 1024,
                            messages: [{ role: 'user', content: prompt }],
                            system: settings.systemPrompt || 'You are a helpful AI assistant.',
                            temperature: settings.temperature || 0.7
                        });
                        const scoreDetails = calculateScore(response.content[0].text.trim());
                        result = {
                            model,
                            prompt,
                            response: response.content[0].text.trim(),
                            score: scoreDetails.total,
                            scoreBreakdown: scoreDetails.breakdown,
                            settings
                        };
                    }
                }
                
                // X.AI (Grok) Models
                else if (model === 'grok-beta') {
                    response = await fetch(`${xai.baseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${xai.apiKey}`
                        },
                        body: JSON.stringify({
                            messages: [
                                settings.systemPrompt ? 
                                    { role: 'system', content: settings.systemPrompt } : 
                                    { role: 'system', content: 'You are a helpful AI assistant.' },
                                { role: 'user', content: prompt }
                            ],
                            model: 'grok-beta',
                            stream: false,
                            temperature: settings.temperature || 0.7
                        })
                    });
                    
                    const data = await response.json();
                    const scoreDetails = calculateScore(data.choices[0].message.content.trim());
                    result = {
                        model,
                        prompt,
                        response: data.choices[0].message.content.trim(),
                        score: scoreDetails.total,
                        scoreBreakdown: scoreDetails.breakdown,
                        settings
                    };
                }

                if (result) {
                    await TestResult.create(result);
                    return result;
                }
                
                return {
                    model,
                    response: `Model ${model} not supported yet.`,
                    score: null
                };
            } catch (error) {
                console.error(`Error with ${model}:`, error);
                return {
                    model,
                    response: `Error: ${error.message || 'Failed to get response'}`,
                    score: null
                };
            }
        }));
        return { results };
    };

    // Add to queue and get queue ID
    const queueId = queueManager.addToQueue(request);
    
    res.json({ 
        queueId,
        message: 'Request queued successfully',
        queueInfo: queueManager.getQueueInfo()
    });
});

// Add endpoint to check queue status
app.get('/api/queue-status/:queueId', (req, res) => {
    const status = queueManager.getStatus(req.params.queueId);
    
    // If completed, include the results
    if (status.status === 'completed' && status.result) {
        res.json({
            ...status,
            results: status.result.results
        });
    } else {
        res.json(status);
    }
});

// Add endpoint for global queue info
app.get('/api/queue-info', (req, res) => {
    const queueInfo = queueManager.getQueueInfo();
    res.json(queueInfo);
});

// Simple scoring function - can be enhanced based on your needs
function calculateScore(response) {
    // Extract the scoring components from giData
    const components = {
        factualAccuracy: evaluateFactualAccuracy(response),
        scientificConsistency: evaluateScientificConsistency(response),
        uncertaintyRecognition: evaluateUncertaintyRecognition(response),
        sourceAttribution: evaluateSourceAttribution(response)
    };

    // Calculate weighted score based on giData weights
    const score = Math.round(
        components.factualAccuracy * 0.35 +      // 35% weight
        components.scientificConsistency * 0.25 + // 25% weight
        components.uncertaintyRecognition * 0.20 + // 20% weight
        components.sourceAttribution * 0.20        // 20% weight
    );

    return {
        total: score,
        breakdown: components
    };
}

function evaluateFactualAccuracy(response) {
    let score = 0;
    
    // Check for presence of specific facts or claims
    const hasSpecificFacts = /\b\d+\b|\b(research|study|evidence)\b/gi.test(response);
    if (hasSpecificFacts) score += 40;
    
    // Check for precise language
    const hasPreciseLanguage = /\b(specifically|precisely|exactly|approximately)\b/gi.test(response);
    if (hasPreciseLanguage) score += 30;
    
    // Check for qualifiers
    const hasQualifiers = /\b(however|although|while|whereas)\b/gi.test(response);
    if (hasQualifiers) score += 30;
    
    return Math.min(score, 100);
}

function evaluateScientificConsistency(response) {
    let score = 0;
    
    // Check for scientific terminology
    const hasScientificTerms = /\b(hypothesis|theory|experiment|data|analysis|research|study)\b/gi.test(response);
    if (hasScientificTerms) score += 35;
    
    // Check for logical structure
    const hasLogicalStructure = /\b(therefore|thus|because|since|as a result)\b/gi.test(response);
    if (hasLogicalStructure) score += 35;
    
    // Check for methodology references
    const hasMethodology = /\b(method|approach|procedure|process|technique)\b/gi.test(response);
    if (hasMethodology) score += 30;
    
    return Math.min(score, 100);
}

function evaluateUncertaintyRecognition(response) {
    let score = 0;
    
    // Check for uncertainty expressions
    const hasUncertainty = /\b(may|might|could|possibly|potentially|uncertain|unclear)\b/gi.test(response);
    if (hasUncertainty) score += 40;
    
    // Check for limitation acknowledgment
    const hasLimitations = /\b(limitation|constraint|restriction|caveat|however)\b/gi.test(response);
    if (hasLimitations) score += 30;
    
    // Check for alternative viewpoints
    const hasAlternatives = /\b(alternatively|other perspectives|different views|some argue)\b/gi.test(response);
    if (hasAlternatives) score += 30;
    
    return Math.min(score, 100);
}

function evaluateSourceAttribution(response) {
    let score = 0;
    
    // Check for citations or references
    const hasCitations = /\b(according to|cited by|referenced in|study by)\b/gi.test(response);
    if (hasCitations) score += 40;
    
    // Check for specific sources
    const hasSpecificSources = /\b(journal|paper|publication|research|article)\b/gi.test(response);
    if (hasSpecificSources) score += 30;
    
    // Check for dates or temporal references
    const hasTemporalRefs = /\b(\d{4}|\d{4}s|recent|current|latest)\b/gi.test(response);
    if (hasTemporalRefs) score += 30;
    
    return Math.min(score, 100);
}

// Update stats endpoints to use MongoDB
app.get('/api/stats', async (req, res) => {
    try {
        const stats = await TestResult.aggregate([
            {
                $group: {
                    _id: '$model',
                    averageScore: { $avg: '$score' },
                    totalTests: { $sum: 1 },
                    recentScores: {
                        $push: {
                            score: '$score',
                            timestamp: '$timestamp'
                        }
                    }
                }
            },
            {
                $project: {
                    model: '$_id',
                    averageScore: { $round: ['$averageScore', 0] },
                    totalTests: 1,
                    recentScores: { $slice: ['$recentScores', -10] }
                }
            },
            { $sort: { averageScore: -1 } }
        ]);

        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get('/api/recent-results', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const results = await TestResult.find()
            .sort({ timestamp: -1 })
            .limit(limit)
            .select('model prompt response score timestamp');
        
        res.json(results);
    } catch (error) {
        console.error('Error fetching recent results:', error);
        res.status(500).json({ error: 'Failed to fetch recent results' });
    }
});

// Update the routes to use MongoDB data
app.get('/stats', async (req, res) => {
    try {
        const stats = await TestResult.aggregate([
            {
                $group: {
                    _id: '$model',
                    averageScore: { $avg: '$score' },
                    totalTests: { $sum: 1 },
                    recentScores: {
                        $push: {
                            score: '$score',
                            timestamp: '$timestamp'
                        }
                    }
                }
            },
            {
                $project: {
                    model: '$_id',
                    averageScore: { $round: ['$averageScore', 0] },
                    totalTests: 1,
                    recentScores: { $slice: ['$recentScores', -10] }
                }
            },
            { $sort: { averageScore: -1 } }
        ]);

        const recentResults = await TestResult.find()
            .sort({ timestamp: -1 })
            .limit(10)
            .select('model prompt response score timestamp');

        res.render('stats', { stats, recentResults });
    } catch (error) {
        console.error('Error rendering stats:', error);
        res.render('stats', { stats: [], recentResults: [] });
    }
});

app.get('/api/all-results', async (req, res) => {
    try {
        const results = await TestResult.find()
            .sort({ timestamp: -1 })
            .select('model prompt response score timestamp');
        
        res.json(results);
    } catch (error) {
        console.error('Error fetching all results:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`);
}); 