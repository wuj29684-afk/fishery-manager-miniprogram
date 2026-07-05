import { defineConfig } from "@tarojs/cli";

export default defineConfig({
  projectName: "fishery-manager-local-dashboard",
  date: "2026-06-10",
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    828: 1.81 / 2
  },
  sourceRoot: "src",
  outputRoot: "dist",
  plugins: ["@tarojs/plugin-framework-react"],
  framework: "react",
  compiler: "webpack5",
  defineConstants: {
    "process.env.TARO_APP_API_BASE_URL": JSON.stringify(process.env.TARO_APP_API_BASE_URL || ""),
    "process.env.TARO_APP_CLOUDBASE_ENV_ID": JSON.stringify(process.env.TARO_APP_CLOUDBASE_ENV_ID || "")
  },
  mini: {
    postcss: {
      pxtransform: {
        enable: true
      },
      cssModules: {
        enable: false
      }
    }
  }
});
