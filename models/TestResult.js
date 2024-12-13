const mongoose = require('mongoose');

const TestResultSchema = new mongoose.Schema({
    model: {
        type: String,
        required: true
    },
    prompt: {
        type: String,
        required: true
    },
    response: {
        type: String,
        required: true
    },
    score: {
        type: Number,
        default: null
    },
    scoreBreakdown: {
        factualAccuracy: Number,
        scientificConsistency: Number,
        uncertaintyRecognition: Number,
        sourceAttribution: Number
    },
    settings: {
        temperature: Number,
        systemPrompt: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Add indexes for better query performance
TestResultSchema.index({ model: 1, timestamp: -1 });
TestResultSchema.index({ score: -1 });

module.exports = mongoose.model('TestResult', TestResultSchema); 