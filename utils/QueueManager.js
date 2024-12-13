class QueueManager {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.requestInterval = 10000; // 10 seconds between requests
        this.lastProcessedTime = Date.now();
        this.completedResults = new Map(); // Store completed results
        this.activeConnections = new Set(); // Track active connections
    }

    addToQueue(request) {
        const id = Math.random().toString(36).substr(2, 9);
        const queueItem = {
            id,
            request,
            status: 'waiting',
            position: this.queue.length + 1,
            addedAt: Date.now(),
            processingStarted: null,
            processingCompleted: null
        };
        
        this.queue.push(queueItem);
        
        // Start processing if it's not already running
        if (!this.processing) {
            this.processQueue();
        }
        
        return id;
    }

    async processQueue() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            const now = Date.now();
            const timeToWait = Math.max(0, this.requestInterval - (now - this.lastProcessedTime));

            if (timeToWait > 0) {
                await new Promise(resolve => setTimeout(resolve, timeToWait));
            }

            const item = this.queue[0];
            item.status = 'processing';
            item.processingStarted = Date.now();
            
            try {
                const result = await item.request();
                item.status = 'completed';
                item.result = result;
                item.processingCompleted = Date.now();
                
                // Store result for 5 minutes
                this.completedResults.set(item.id, {
                    result,
                    timestamp: Date.now(),
                    processingTime: item.processingCompleted - item.processingStarted
                });
                
                // Clean up old results
                this.cleanupOldResults();
            } catch (error) {
                item.status = 'error';
                item.error = error.message;
            }

            this.lastProcessedTime = Date.now();
            this.queue.shift();
            
            // Update positions for remaining items
            this.queue.forEach((item, index) => {
                item.position = index + 1;
            });
        }

        this.processing = false;
    }

    getStatus(id) {
        // First check active queue
        const queueItem = this.queue.find(item => item.id === id);
        if (queueItem) {
            const estimatedTime = queueItem.position * this.requestInterval / 1000;
            const queueInfo = this.getQueueInfo();
            
            return {
                status: queueItem.status,
                position: queueItem.position,
                estimatedTime,
                queueLength: queueInfo.length,
                activeRequests: queueInfo.active,
                averageWait: queueInfo.averageWait
            };
        }

        // Then check completed results
        const completedResult = this.completedResults.get(id);
        if (completedResult) {
            return {
                status: 'completed',
                position: 0,
                estimatedTime: 0,
                result: completedResult.result,
                processingTime: completedResult.processingTime
            };
        }

        // If not found anywhere
        return {
            status: 'not_found',
            position: 0,
            estimatedTime: 0
        };
    }

    getQueueInfo() {
        const active = this.queue.filter(item => item.status === 'processing').length;
        const waiting = this.queue.filter(item => item.status === 'waiting').length;
        const completed = this.completedResults.size;
        
        // Calculate average wait time from recent completed items
        const recentCompletions = Array.from(this.completedResults.values())
            .filter(r => Date.now() - r.timestamp < 300000); // Last 5 minutes
        
        const averageWait = recentCompletions.length > 0
            ? recentCompletions.reduce((acc, curr) => acc + curr.processingTime, 0) / recentCompletions.length / 1000
            : this.requestInterval / 1000;

        return {
            length: this.queue.length,
            active,
            waiting,
            completed,
            averageWait: Math.round(averageWait)
        };
    }

    cleanupOldResults() {
        const fiveMinutesAgo = Date.now() - 300000;
        for (const [id, data] of this.completedResults) {
            if (data.timestamp < fiveMinutesAgo) {
                this.completedResults.delete(id);
            }
        }
    }
}

module.exports = new QueueManager(); 