import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";
import { withContentCollections } from "@content-collections/next";

// Cohabi Cut is served under cohabi.org/cut, beside the Commons. NEXT_PUBLIC_BASE_PATH=/cut in production;
// unset for local development at /.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;
// Local development only: COMMONS_ORIGIN (e.g. http://127.0.0.1:8787) proxies the Commons' own paths, so the
// "From Cohabi" tab works on localhost. In production the site's proxy (Caddy) already serves these paths.
const commons = process.env.COMMONS_ORIGIN;

const nextConfig: NextConfig = {
	basePath,
	async rewrites() {
		if (!commons) return [];
		return ["api", "images", "audio", "videos"].map((p) => ({
			source: `/${p}/:path*`,
			destination: `${commons}/${p}/:path*`,
			basePath: false as const,
		}));
	},
	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
	},
	reactStrictMode: true,
	productionBrowserSourceMaps: true,
	output: "standalone",
	// Cohabi Cut lands on your projects, not on OpenCut's marketing page.
	async redirects() {
		return [{ source: "/", destination: "/projects", permanent: false }];
	},
	images: {
		// No server-side image resizing: no native "sharp" binary to match the server's ARM CPU.
		unoptimized: true,
		remotePatterns: [
			{
				protocol: "https",
				hostname: "plus.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
			{
				protocol: "https",
				hostname: "images.marblecms.com",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				protocol: "https",
				hostname: "avatars.githubusercontent.com",
			},
			{
				protocol: "https",
				hostname: "api.iconify.design",
			},
			{
				protocol: "https",
				hostname: "api.simplesvg.com",
			},
			{
				protocol: "https",
				hostname: "api.unisvg.com",
			},
			{
				protocol: "https",
				hostname: "cdn.brandfetch.io",
			},
		],
	},
};

export default withContentCollections(withBotId(nextConfig));
