const os = require('os');

// Next.js blocks cross-origin requests to the dev server by default (DNS
// rebinding protection). Without the current LAN IP listed, a page opened
// from a phone loads its HTML but never hydrates -- it just spins.
//
// Detected at startup rather than hardcoded: this machine's IP is assigned
// by DHCP and changes on its own, and a stale value here fails in a way
// that looks nothing like a config problem.
function localNetworkAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(iface => iface && iface.family === 'IPv4' && !iface.internal)
    .map(iface => iface.address);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['localhost', '127.0.0.1', ...localNetworkAddresses()],
};

module.exports = nextConfig;
