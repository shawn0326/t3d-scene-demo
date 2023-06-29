/** @type {import('vite').UserConfig} */
export default {
  base: "./",
	build: {
		chunkSizeWarningLimit: 600,
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					if (id.includes('node_modules/t3d')) {
						return 't3d';
					}
				}
			}
		}
	}
}