import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NeuronForge — Decentralized Agent Infrastructure on 0G",
  description: "Build, orchestrate, persist, and trade autonomous AI agents using OpenClaw and 0G Network. The decentralized agent factory powered by INFTs.",
  keywords: ["AI agents", "0G Network", "OpenClaw", "INFT", "ERC-7857", "decentralized AI", "Web3"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <nav className="navbar">
          <div className="navbar-inner">
            <a href="/" className="navbar-brand">
              <span className="brand-icon">⚡</span>
              NeuronForge
            </a>
            <ul className="navbar-links">
              <li><a href="/forge">Forge</a></li>
              <li><a href="/skills">Skills</a></li>
              <li><a href="/marketplace">Marketplace</a></li>
              <li>
                <button className="btn btn-primary btn-sm" id="connect-wallet-btn">
                  🔗 Connect Wallet
                </button>
              </li>
            </ul>
          </div>
        </nav>
        <main style={{ paddingTop: '64px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
