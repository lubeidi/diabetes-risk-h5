import { defineConfig } from "vite";

const apiTarget =
  process.env.DIABETES_API_TARGET ||
  "https://ai-cloud-bk.4paradigm.com/dev/ac-adapter";

export default defineConfig({
  root: ".",
  publicDir: "public",
  server: {
    port: Number(process.env.PORT || 5174),
    host: "127.0.0.1",
    proxy: {
      "/moeagi": {
        target: apiTarget,
        changeOrigin: true,
        secure: true,
      },
      "/microLife/tracking": {
        target: "https://micro-life.iwhop.cn",
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
