import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import type { ClientTab } from '$lib/stores/board';

let io: Server | null = null;
let connectedClients = 0;

export function getConnectedClients(): number {
	return connectedClients;
}

export function setupSocketIO(server: HttpServer): Server {
	io = new Server(server, {
		cors: {
			origin: '*',
			methods: ['GET', 'POST']
		}
	});

	io.on('connection', (socket) => {
		connectedClients++;
		console.log(`Client connected. Total: ${connectedClients}`);

		socket.on('join', (userId: string) => {
			socket.join(`user:${userId}`);
			console.log(`User ${userId} joined their room`);
		});

		socket.on('tab:create', (tab: ClientTab) => {
			const rooms = Array.from(socket.rooms);
			const userRoom = rooms.find((r) => r.startsWith('user:'));
			if (userRoom) {
				socket.to(userRoom).emit('tab:create', tab);
			}
		});

		socket.on('tab:update', (data: { id: string; name?: string; content?: string }) => {
			const rooms = Array.from(socket.rooms);
			const userRoom = rooms.find((r) => r.startsWith('user:'));
			if (userRoom) {
				socket.to(userRoom).emit('tab:update', data);
			}
		});

		socket.on('tab:delete', (tabId: string) => {
			const rooms = Array.from(socket.rooms);
			const userRoom = rooms.find((r) => r.startsWith('user:'));
			if (userRoom) {
				socket.to(userRoom).emit('tab:delete', tabId);
			}
		});

		socket.on('content:update', (data: { tabId: string; content: string }) => {
			const rooms = Array.from(socket.rooms);
			const userRoom = rooms.find((r) => r.startsWith('user:'));
			if (userRoom) {
				socket.to(userRoom).emit('content:update', data);
			}
		});

		socket.on('tabs:reorder', (tabs: ClientTab[]) => {
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

	return io;
}

export function getIO(): Server | null {
	return io;
}
