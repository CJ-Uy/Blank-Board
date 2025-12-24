import { writable } from 'svelte/store';
import { io, type Socket } from 'socket.io-client';
import { browser } from '$app/environment';
import { boardStore, type ClientTab } from './board';

export const connected = writable(false);

let socket: Socket | null = null;

export function initSocket(userId: string) {
	if (!browser || socket) return;

	socket = io({
		autoConnect: true,
		reconnection: true,
		reconnectionDelay: 1000,
		reconnectionAttempts: 5
	});

	socket.on('connect', () => {
		connected.set(true);
		socket?.emit('join', userId);
	});

	socket.on('disconnect', () => {
		connected.set(false);
	});

	socket.on('tab:create', (tab: ClientTab) => {
		boardStore.addTab(tab);
	});

	socket.on('tab:update', (data: { id: string; name?: string; content?: string }) => {
		boardStore.updateTab(data.id, { name: data.name, content: data.content });
	});

	socket.on('tab:delete', (tabId: string) => {
		boardStore.removeTab(tabId);
	});

	socket.on('content:update', (data: { tabId: string; content: string }) => {
		boardStore.updateTab(data.tabId, { content: data.content });
	});

	socket.on('tabs:reorder', (tabs: ClientTab[]) => {
		boardStore.reorderTabs(tabs);
	});

	return socket;
}

export function emitTabCreate(tab: ClientTab) {
	socket?.emit('tab:create', tab);
}

export function emitTabUpdate(id: string, updates: { name?: string; content?: string }) {
	socket?.emit('tab:update', { id, ...updates });
}

export function emitTabDelete(tabId: string) {
	socket?.emit('tab:delete', tabId);
}

export function emitContentUpdate(tabId: string, content: string) {
	socket?.emit('content:update', { tabId, content });
}

export function emitTabsReorder(tabs: ClientTab[]) {
	socket?.emit('tabs:reorder', tabs);
}

export function disconnectSocket() {
	if (socket) {
		socket.disconnect();
		socket = null;
		connected.set(false);
	}
}
