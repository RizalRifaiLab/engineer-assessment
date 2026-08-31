import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AlaSQL's Node build statically references `react-native-fetch-blob` in a
  // runtime-only branch. Keep it external on the server so the bundler doesn't
  // try to resolve that specifier; the browser build (alasql.min.js) is used
  // on the client and doesn't reference it.
  serverExternalPackages: ["alasql"],
};

export default nextConfig;
