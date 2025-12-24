import { createServer } from 'http';
import { handler } from './build/handler.js';
import { Server } from 'socket.io';

const PORT = process.env.PORT || 3000;

const server = createServer(handler);

// Socket.IO setup
const io = new Server(server, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST']
	}
});

let connectedClients = 0;

io.on('connection', (socket) => {
	connectedClients++;
	console.log(`Client connected. Total: ${connectedClients}`);

	socket.on('join', (userId) => {
		socket.join(`user:${userId}`);
		console.log(`User ${userId} joined their room`);
	});

	socket.on('tab:create', (tab) => {
		const rooms = Array.from(socket.rooms);
		const userRoom = rooms.find((r) => r.startsWith('user:'));
		if (userRoom) {
			socket.to(userRoom).emit('tab:create', tab);
		}
	});

	socket.on('tab:update', (data) => {
		const rooms = Array.from(socket.rooms);
		const userRoom = rooms.find((r) => r.startsWith('user:'));
		if (userRoom) {
			socket.to(userRoom).emit('tab:update', data);
		}
	});

	socket.on('tab:delete', (tabId) => {
		const rooms = Array.from(socket.rooms);
		const userRoom = rooms.find((r) => r.startsWith('user:'));
		if (userRoom) {
			socket.to(userRoom).emit('tab:delete', tabId);
		}
	});

	socket.on('content:update', (data) => {
		const rooms = Array.from(socket.rooms);
		const userRoom = rooms.find((r) => r.startsWith('user:'));
		if (userRoom) {
			socket.to(userRoom).emit('content:update', data);
		}
	});

	socket.on('tabs:reorder', (tabs) => {
		const rooms = Array.from(socket.rooms);
		const userRoom = rooms.find((r) => r.startsWith('user:'));
		if (userRoom) {
			socket.to(userRoom).emit('tabs:reorder', tabs);
		}
	});

	socket.on('disconnect', () => {
		connectedClients--;
		console.log(`Client disconnected. Total: ${connectedClients}`);
	});
});

// Export for admin stats
globalThis.getConnectedClients = () => connectedClients;

server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
