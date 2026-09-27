import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { boardStore, type ClientTab } from './board';
import { dropStore, type ClientDrop } from './drops';
import { editVersion, pendingNotes } from './noteSaves';

export const connected = writable(false);

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reconnectDelay = 300;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = true;

async function syncTabsFromServer() {
	try {
		const version = editVersion;
		const pendingAtStart = new Set(pendingNotes.keys());
		const res = await fetch('/api/tabs');
		if (!res.ok) return;
		const serverTabs = (await res.json()) as ClientTab[];

		if (version !== editVersion || stopped) return;
		const localTabs = get(boardStore.tabs);
		boardStore.setTabs(
			serverTabs.map((tab) =>
				pendingAtStart.has(tab.id) || pendingNotes.has(tab.id)
					? (localTabs.find((local) => local.id === tab.id) ?? tab)
					: tab
			)
		);
	} catch {
		/* ignore */
	}
}

export function initSocket() {
	if (!browser || ws) return;
	stopped = false;

	function connect() {
		if (stopped || ws) return;
		const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
		ws = new WebSocket(`${protocol}://${location.host}/api/sync`);
		const socket = ws;

		ws.addEventListener('open', () => {
			if (stopped || ws !== socket) return;
			connected.set(true);
			reconnectDelay = 300;
			// WS is up — stop the fallback poll to avoid redundant D1 reads.
			if (pollTimer) {
				clearInterval(pollTimer);
				pollTimer = null;
			}
			// Keep connection alive — Cloudflare drops idle WS connections.
			pingTimer = setInterval(() => {
				if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
			}, 20_000);
			// Catch up on anything missed while disconnected.
			syncTabsFromServer();
			const activeTabId = get(boardStore.activeTabId);
			if (activeTabId) void dropStore.loadDrops(activeTabId).catch(() => {});
		});
		ws.addEventListener('close', () => {
			if (stopped || ws !== socket) return;
			connected.set(false);
			ws = null;
			if (pingTimer) {
				clearInterval(pingTimer);
				pingTimer = null;
			}
			// WS dropped — start polling as fallback until reconnected.
			if (!pollTimer) pollTimer = setInterval(syncTabsFromServer, 3000);
			reconnectTimer = setTimeout(connect, reconnectDelay);
			reconnectDelay = Math.min(reconnectDelay * 2, 8000);
		});
		ws.addEventListener('error', () => {
			socket.close();
		});

		ws.addEventListener('message', (event) => {
			if (stopped || ws !== socket) return;
			try {
				const msg = JSON.parse(event.data);
				switch (msg.type) {
					case 'tab:create':
						boardStore.addTab(msg.payload as ClientTab, false);
						break;
					case 'tab:update':
						boardStore.updateTab(
							msg.payload.id,
							pendingNotes.has(msg.payload.id)
								? {
										...(msg.payload.name !== undefined ? { name: msg.payload.name } : {}),
										...(msg.payload.pinned !== undefined ? { pinned: msg.payload.pinned } : {})
									}
								: msg.payload
						);
						break;
					case 'tab:delete':
						boardStore.removeTab(msg.payload as string);
						break;
					case 'content:update':
						if (!pendingNotes.has(msg.payload.tabId))
							boardStore.updateTab(msg.payload.tabId, { content: msg.payload.content });
						break;
					case 'tabs:reorder':
						boardStore.reorderTabs(
							(msg.payload as ClientTab[]).map((tab) => ({
								...(get(boardStore.tabs).find((local) => local.id === tab.id) ?? tab),
								order: tab.order
							}))
						);
						break;
					case 'drop:create':
						dropStore.addDrop(msg.payload as ClientDrop);
						break;
					case 'drop:delete':
						dropStore.removeDrop(msg.payload as string);
						break;
					case 'drop:update':
						dropStore.updateDrop(msg.payload.id, msg.payload.content);
						break;
				}
			} catch {
				/* ignore malformed messages */
			}
		});
	}

	connect();
}

function send(type: string, payload: unknown) {
	if (ws?.readyState === WebSocket.OPEN) {
		try {
			ws.send(JSON.stringify({ type, payload }));
		} catch {
			ws.close();
		}
	}
}

export function emitTabCreate(tab: ClientTab) {
	send('tab:create', tab);
}
export function emitTabUpdate(
	id: string,
	updates: { name?: string; content?: string; pinned?: boolean }
) {
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
export function emitDropCreate(drop: ClientDrop) {
	send('drop:create', drop);
}
export function emitDropDelete(dropId: string) {
	send('drop:delete', dropId);
}
export function emitDropUpdate(id: string, content: string) {
	send('drop:update', { id, content });
}

export function disconnectSocket() {
	stopped = true;
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (pingTimer) {
		clearInterval(pingTimer);
		pingTimer = null;
	}
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
	if (ws) {
		ws.close();
		ws = null;
		connected.set(false);
	}
}
