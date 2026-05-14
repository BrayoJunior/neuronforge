/**
 * Multi-wallet provider detection utility.
 * Handles MetaMask + Phantom + other wallet extensions gracefully.
 */
export function getProvider(): any {
  if (typeof window === "undefined") return null;
  const eth = (window as any).ethereum;
  if (!eth) return null;
  // If multiple providers exist, find MetaMask specifically
  if (eth.providers?.length) {
    return eth.providers.find((p: any) => p.isMetaMask) || eth.providers[0];
  }
  return eth;
}
