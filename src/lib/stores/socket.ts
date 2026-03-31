import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { boardStore, type ClientTab } from './board';
import { dropStore, type ClientDrop } from './drops';

export const connected = writable(false);

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reconnectDelay = 300;

// Tracks when the local user last typed, so polls don't overwrite in-progress edits.
let lastLocalEditAt = 0;
export function markLocalEdit() { lastLocalEditAt = Date.now(); }

async function syncTabsFromServer() {
	try {
		const res = await fetch('/api/tabs');
		if (!res.ok) return;
		const serverTabs = await res.json() as ClientTab[];

		const recentlyEdited = Date.now() - lastLocalEditAt < 2000;
		if (recentlyEdited) {
			// Preserve local content for the active tab so in-progress typing isn't clobbered.
			const activeId = get(boardStore.activeTabId);
			const localTabs = get(boardStore.tabs);
			const merged = serverTabs.map(t => {
				if (t.id === activeId) return localTabs.find(l => l.id === t.id) ?? t;
				return t;
			});
			boardStore.setTabs(merged);
		} else {
			boardStore.setTabs(serverTabs);
		}
	} catch { /* ignore */ }
}

export function initSocket(_userId: string) {
	if (!browser || ws) return;

	// Poll every 3 s as a reliable fallback when WebSocket drops or stalls.
	pollTimer = setInterval(syncTabsFromServer, 3000);

	function connect() {
		const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
		ws = new WebSocket(`${protocol}://${location.host}/api/sync`);

		ws.addEventListener('open', () => {
			connected.set(true);
			reconnectDelay = 300;
			// Keep connection alive — Cloudflare drops idle WS connections.
			pingTimer = setInterval(() => {
				if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
			}, 20_000);
			// Catch up on anything missed while disconnected.
			syncTabsFromServer();
		});
		ws.addEventListener('close', () => {
			connected.set(false);
			ws = null;
			if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
			setTimeout(connect, reconnectDelay);
			reconnectDelay = Math.min(reconnectDelay * 2, 8000);
		});
		ws.addEventListener('error', () => { ws?.close(); });

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
					case 'drop:create':
						dropStore.addDrop(msg.payload as ClientDrop);
						break;
					case 'drop:delete':
						dropStore.removeDrop(msg.payload as string);
						break;
				}
			} catch { /* ignore malformed messages */ }
		});
	}

	connect();
}

function send(type: string, payload: unknown) {
	if (ws?.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type, payload }));
	}
}

export function emitTabCreate(tab: ClientTab) { send('tab:create', tab); }
export function emitTabUpdate(id: string, updates: { name?: string; content?: string }) {
	send('tab:update', { id, ...updates });
}
export function emitTabDelete(tabId: string) { send('tab:delete', tabId); }
export function emitContentUpdate(tabId: string, content: string) {
	send('content:update', { tabId, content });
}
export function emitTabsReorder(tabs: ClientTab[]) { send('tabs:reorder', tabs); }
export function emitDropCreate(drop: ClientDrop) { send('drop:create', drop); }
export function emitDropDelete(dropId: string) { send('drop:delete', dropId); }

export function disconnectSocket() {
	if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
	if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
	if (ws) { ws.close(); ws = null; connected.set(false); }
}
