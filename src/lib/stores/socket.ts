import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { boardStore, type ClientTab } from './board';

export const connected = writable(false);

let ws: WebSocket | null = null;

export function initSocket(_userId: string) {
	if (!browser || ws) return;

	function connect() {
		const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
		ws = new WebSocket(`${protocol}://${location.host}/api/sync`);

		ws.addEventListener('open', () => connected.set(true));
		ws.addEventListener('close', () => {
			connected.set(false);
			ws = null;
			// Reconnect after 2 seconds
			setTimeout(connect, 2000);
		});
		ws.addEventListener('error', () => {
			ws?.close();
		});

		ws.addEventListener('message', (event) => {
			try {
				const msg = JSON.parse(event.data);
				switch (msg.type) {
					case 'tab:create':
						boardStore.addTab(msg.payload as ClientTab);
						break;
					case 'tab:update':
						boardStore.updateTab(msg.payload.id, msg.payload);
						break;
					case 'tab:delete':
						boardStore.removeTab(msg.payload as string);
						break;
					case 'content:update':
						boardStore.updateTab(msg.payload.tabId, { content: msg.payload.content });
						break;
					case 'tabs:reorder':
						boardStore.reorderTabs(msg.payload as ClientTab[]);
						break;
				}
			} catch {
				// ignore malformed messages
			}
		});
	}

	connect();
}

function send(type: string, payload: unknown) {
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type, payload }));
	}
}

export function emitTabCreate(tab: ClientTab) {
	send('tab:create', tab);
}

export function emitTabUpdate(id: string, updates: { name?: string; content?: string }) {
	send('tab:update', { id, ...updates });
}

export function emitTabDelete(tabId: string) {
	send('tab:delete', tabId);
}

export function emitContentUpdate(tabId: string, content: string) {
	send('content:update', { tabId, content });
}

export function emitTabsReorder(tabs: ClientTab[]) {
	send('tabs:reorder', tabs);
}

export function disconnectSocket() {
	if (ws) {
		ws.close();
		ws = null;
		connected.set(false);
	}
}
