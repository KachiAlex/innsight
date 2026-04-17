// vite.config.ts
import { defineConfig } from "file:///D:/innsight/node_modules/vite/dist/node/index.js";
import react from "file:///D:/innsight/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      external: ["html2canvas", "dompurify", "canvg"],
      output: {
        manualChunks: {
          // Vendor chunks
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": ["lucide-react", "react-hot-toast"],
          "chart-vendor": ["recharts"],
          "pdf-vendor": ["jspdf", "jspdf-autotable"],
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
          "utils-vendor": ["axios", "date-fns", "zustand"]
        }
      }
    },
    chunkSizeWarningLimit: 1e3,
    sourcemap: false,
    minify: "esbuild",
    // Optimize for Netlify
    assetsInlineLimit: 4096
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"]
  },
  // Define API URL for production
  define: {
    __VITE_API_URL__: JSON.stringify(process.env.VITE_API_URL || "https://innsight-backend.onrender.com")
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxpbm5zaWdodFxcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcaW5uc2lnaHRcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L2lubnNpZ2h0L2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbcmVhY3QoKV0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwb3J0OiA1MTczLFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAxJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgZXh0ZXJuYWw6IFsnaHRtbDJjYW52YXMnLCAnZG9tcHVyaWZ5JywgJ2NhbnZnJ10sXHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgLy8gVmVuZG9yIGNodW5rc1xyXG4gICAgICAgICAgJ3JlYWN0LXZlbmRvcic6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcclxuICAgICAgICAgICd1aS12ZW5kb3InOiBbJ2x1Y2lkZS1yZWFjdCcsICdyZWFjdC1ob3QtdG9hc3QnXSxcclxuICAgICAgICAgICdjaGFydC12ZW5kb3InOiBbJ3JlY2hhcnRzJ10sXHJcbiAgICAgICAgICAncGRmLXZlbmRvcic6IFsnanNwZGYnLCAnanNwZGYtYXV0b3RhYmxlJ10sXHJcbiAgICAgICAgICAnZm9ybS12ZW5kb3InOiBbJ3JlYWN0LWhvb2stZm9ybScsICdAaG9va2Zvcm0vcmVzb2x2ZXJzJywgJ3pvZCddLFxyXG4gICAgICAgICAgJ3V0aWxzLXZlbmRvcic6IFsnYXhpb3MnLCAnZGF0ZS1mbnMnLCAnenVzdGFuZCddLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgc291cmNlbWFwOiBmYWxzZSxcclxuICAgIG1pbmlmeTogJ2VzYnVpbGQnLFxyXG4gICAgLy8gT3B0aW1pemUgZm9yIE5ldGxpZnlcclxuICAgIGFzc2V0c0lubGluZUxpbWl0OiA0MDk2LFxyXG4gIH0sXHJcbiAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICBpbmNsdWRlOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXHJcbiAgfSxcclxuICAvLyBEZWZpbmUgQVBJIFVSTCBmb3IgcHJvZHVjdGlvblxyXG4gIGRlZmluZToge1xyXG4gICAgX19WSVRFX0FQSV9VUkxfXzogSlNPTi5zdHJpbmdpZnkocHJvY2Vzcy5lbnYuVklURV9BUElfVVJMIHx8ICdodHRwczovL2lubnNpZ2h0LWJhY2tlbmQub25yZW5kZXIuY29tJyksXHJcbiAgfSxcclxufSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFvUCxTQUFTLG9CQUFvQjtBQUNqUixPQUFPLFdBQVc7QUFHbEIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxlQUFlO0FBQUEsTUFDYixVQUFVLENBQUMsZUFBZSxhQUFhLE9BQU87QUFBQSxNQUM5QyxRQUFRO0FBQUEsUUFDTixjQUFjO0FBQUE7QUFBQSxVQUVaLGdCQUFnQixDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQSxVQUN6RCxhQUFhLENBQUMsZ0JBQWdCLGlCQUFpQjtBQUFBLFVBQy9DLGdCQUFnQixDQUFDLFVBQVU7QUFBQSxVQUMzQixjQUFjLENBQUMsU0FBUyxpQkFBaUI7QUFBQSxVQUN6QyxlQUFlLENBQUMsbUJBQW1CLHVCQUF1QixLQUFLO0FBQUEsVUFDL0QsZ0JBQWdCLENBQUMsU0FBUyxZQUFZLFNBQVM7QUFBQSxRQUNqRDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSx1QkFBdUI7QUFBQSxJQUN2QixXQUFXO0FBQUEsSUFDWCxRQUFRO0FBQUE7QUFBQSxJQUVSLG1CQUFtQjtBQUFBLEVBQ3JCO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLEVBQ3BEO0FBQUE7QUFBQSxFQUVBLFFBQVE7QUFBQSxJQUNOLGtCQUFrQixLQUFLLFVBQVUsUUFBUSxJQUFJLGdCQUFnQix1Q0FBdUM7QUFBQSxFQUN0RztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
