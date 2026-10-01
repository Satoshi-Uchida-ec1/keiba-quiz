import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静的ファイルだけで配信し、ホスティングを移しやすくする（docs/tech.md）
  output: "export",
};

export default nextConfig;
