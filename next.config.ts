const nextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/minesweeper",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
