const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB connection error:', error);
        global.fallbackData = {
            stats: [
                {
                    model: 'gpt-4o',
                    averageScore: 19,
                    totalTests: 5,
                    recentScores: [{ score: 14, timestamp: new Date() }]
                },
                {
                    model: 'claude-3-5-sonnet-20241022',
                    averageScore: 17,
                    totalTests: 5,
                    recentScores: [{ score: 22, timestamp: new Date() }]
                },
                {
                    model: 'grok-beta',
                    averageScore: 5,
                    totalTests: 5,
                    recentScores: [{ score: 0, timestamp: new Date() }]
                }
            ]
        };
    }
};

module.exports = connectDB; 