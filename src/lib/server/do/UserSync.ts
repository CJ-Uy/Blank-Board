/// <reference types="@cloudflare/workers-types" />

interface SyncMessage {
	type: 'tab:create' | 'tab:update' | 'tab:delete' | 'content:update' | 'tabs:reorder' | 'ping';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	payload: any;
}

export class UserSync implements DurableObject {
	private sockets = new Set<WebSocket>();
	private state: DurableObjectState;

	constructor(state: DurableObjectState) {
		this.state = state;
		// Restore any hibernated WebSockets
		this.state.getWebSockets().forEach((ws) => this.sockets.add(ws));
	}

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
			return new Response('Expected WebSocket upgrade', { status: 426 });
		}

		const { 0: client, 1: server } = new WebSocketPair();
		this.state.acceptWebSocket(server);
		this.sockets.add(server);

		return new Response(null, {
			status: 101,
			webSocket: client
		});
	}

	webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
		if (typeof message !== 'string') return;

		let parsed: SyncMessage;
		try {
			parsed = JSON.parse(message);
		} catch {
			return;
		}

		if (parsed.type === 'ping') return;

		// Broadcast to all other connected sockets
		for (const socket of this.sockets) {
			if (socket !== ws && socket.readyState === WebSocket.OPEN) {
				socket.send(message);
			}
		}
	}

	webSocketClose(ws: WebSocket): void {
		this.sockets.delete(ws);
	}

	webSocketError(ws: WebSocket): void {
		this.sockets.delete(ws);
	}
}
