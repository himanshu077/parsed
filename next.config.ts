import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Needed so Next.js doesn't warn about ambiguous workspace root during dev
    root: path.resolve(__dirname),
  },
  serverExternalPackages: ["unpdf"],
  webpack: (config) => {
    // pdfjs-dist has a browser field of {canvas:false,fs:false,...} with no
    // string entry point, confusing bundlers. Point directly to the built file.
    config.resolve.alias = {
      ...config.resolve.alias,
      "pdfjs-dist": path.resolve(
        __dirname,
        "node_modules/pdfjs-dist/build/pdf.mjs"
      ),
    };
    return config;
  },
};

export default nextConfig;
