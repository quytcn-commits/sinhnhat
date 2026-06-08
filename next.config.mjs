/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // build gọn để chạy Docker (server.js + deps cần thiết)
};

export default nextConfig;
