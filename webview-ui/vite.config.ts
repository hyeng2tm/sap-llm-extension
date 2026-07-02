import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../out/webview', // 익스텐션이 읽을 수 있는 위치로 내보냄
    rollupOptions: {
      output: {
        // 파일 이름에 해시값을 빼고 고정하여 익스텐션 호스트가 찾기 쉽게 만듦
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }
    }
  }
});