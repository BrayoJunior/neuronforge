/**
 * NeuronForge — Marketplace API Routes
 */

import { Router, Request, Response } from 'express';
import { listOnMarketplace } from '../services/chain.js';

export const marketplaceRoutes = Router();

// In-memory marketplace listings
const listings: Array<{
  id: string;
  tokenId: string;
  name: string;
  description: string;
  price: string;
  seller: string;
  skills: string[];
  createdAt: number;
  status: 'active' | 'sold' | 'delisted';
}> = [];

/**
 * GET /api/marketplace — List all marketplace listings
 */
marketplaceRoutes.get('/', (_req: Request, res: Response) => {
  const activeListings = listings.filter(l => l.status === 'active');
  res.json({ listings: activeListings });
});

/**
 * POST /api/marketplace/list — List an agent INFT for sale
 */
marketplaceRoutes.post('/list', async (req: Request, res: Response) => {
  try {
    const { tokenId, name, description, price, skills } = req.body;

    if (!tokenId || !price) {
      res.status(400).json({ error: 'tokenId and price are required' });
      return;
    }

    // List on-chain
    try {
      await listOnMarketplace(tokenId, price);
    } catch (e) {
      console.warn('⚠️ On-chain listing failed (contract may not be deployed):', (e as Error).message);
    }

    const listing = {
      id: `listing_${Date.now()}`,
      tokenId,
      name: name || `Agent #${tokenId}`,
      description: description || '',
      price,
      seller: 'current_user', // Would come from wallet
      skills: skills || [],
      createdAt: Date.now(),
      status: 'active' as const,
    };

    listings.push(listing);
    res.status(201).json({ listing });
  } catch (error) {
    console.error('Listing error:', error);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

/**
 * POST /api/marketplace/buy/:id — Buy an agent INFT
 */
marketplaceRoutes.post('/buy/:id', async (req: Request, res: Response) => {
  try {
    const listing = listings.find(l => l.id === req.params.id);
    if (!listing) {
      res.status(404).json({ error: 'Listing not found' });
      return;
    }

    if (listing.status !== 'active') {
      res.status(400).json({ error: 'Listing is no longer active' });
      return;
    }

    listing.status = 'sold';

    res.json({
      message: 'Purchase successful',
      tokenId: listing.tokenId,
      price: listing.price,
    });
  } catch (error) {
    console.error('Purchase error:', error);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
});
