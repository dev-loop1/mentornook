import { FastifyInstance, FastifyRequest } from 'fastify';
import { WebSocket } from '@fastify/websocket';

// Map to store active connections by userId
export const activeConnections = new Map<number, WebSocket>();

export default async function websocketRoutes(server: FastifyInstance) {
  server.get('/ws', { websocket: true }, (connection: WebSocket, req: FastifyRequest) => {
    let userId: number | null = null;
    let isAuthenticated = false;

    // We expect the first message to be an authentication message with the JWT token
    connection.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (!isAuthenticated) {
          if (data.type === 'auth' && data.token) {
            // Verify JWT token manually
            try {
              const decoded = server.jwt.verify(data.token) as any;
              userId = decoded.id;
              isAuthenticated = true;
              
              if (userId) {
                activeConnections.set(userId, connection);
                connection.send(JSON.stringify({ type: 'auth_success', message: 'Authenticated successfully' }));
                server.log.info(`WebSocket authenticated for user ${userId}`);
              }
            } catch (err) {
              connection.send(JSON.stringify({ type: 'auth_error', message: 'Invalid token' }));
              connection.close();
            }
          } else {
            connection.send(JSON.stringify({ type: 'error', message: 'Authentication required' }));
            connection.close();
          }
          return;
        }

        // Handle other messages from authenticated clients (e.g. ping)
        if (data.type === 'ping') {
          connection.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (err) {
        server.log.error(err, 'Error processing websocket message');
      }
    });

    connection.on('close', () => {
      if (userId) {
        activeConnections.delete(userId);
        server.log.info(`WebSocket disconnected for user ${userId}`);
      }
    });
  });
}
