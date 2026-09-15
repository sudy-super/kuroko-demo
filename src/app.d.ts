// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// ドロワーを履歴に積むときの印 (Drawer.svelte の浅い経路)
		interface PageState {
			drawer?: boolean;
		}
		// interface Platform {}
	}
}

export {};
