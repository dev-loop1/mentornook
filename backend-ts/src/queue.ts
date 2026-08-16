import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { activeConnections } from './routes/websocket.js';

// Setup Redis connection for BullMQ
const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
});

export const documentQueue = new Queue('document-processing', { connection });

// Define the worker that will process the jobs
export const documentWorker = new Worker(
  'document-processing',
  async (job: Job) => {
    const { userId, documentName } = job.data;
    
    // Simulate heavy background processing (5 seconds)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return { status: 'completed', documentName };
  },
  { connection }
);

// Listen to completed jobs and notify users via WebSockets
documentWorker.on('completed', (job: Job, returnvalue: any) => {
  const { userId, documentName } = job.data;
  
  // Find the active websocket connection for the user
  const connection = activeConnections.get(userId);
  if (connection) {
    connection.send(JSON.stringify({
      type: 'notification',
      message: `Your document '${documentName}' has been processed successfully.`,
      data: returnvalue
    }));
  }
});

documentWorker.on('failed', (job: Job | undefined, err: Error) => {
  if (job) {
    const { userId, documentName } = job.data;
    const connection = activeConnections.get(userId);
    if (connection) {
      connection.send(JSON.stringify({
        type: 'error',
        message: `Failed to process document '${documentName}'.`,
        error: err.message
      }));
    }
  }
});
