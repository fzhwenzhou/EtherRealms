import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const RARITY_NAMES = ['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const ITEM_TYPE_NAMES = ['Weapon', 'Armor', 'Potion'];

function Marketplace({ contracts, account, loading, onAction, showNotification, goldBalance }) {
  const [listings, setListings] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [sellItemId, setSellItemId] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [activeView, setActiveView] = useState('browse'); // 'browse' | 'sell'

  const loadListings = useCallback(async () => {
    if (!contracts || !contracts.marketplace) return;
    setLoadingData(true);
    try {
      const result = await contracts.marketplace.getActiveListings(50);
      const [listingIds, itemIds, sellers, prices, itemNames, itemTypes, itemPowers, itemRarities] = result;
      
      const data = listingIds.map((id, i) => ({
        listingId: Number(id),
        itemId: Number(itemIds[i]),
        seller: sellers[i],
        price: ethers.formatEther(prices[i]),
        rawPrice: prices[i],
        name: itemNames[i],
        itemType: Number(itemTypes[i]),
        power: Number(itemPowers[i]),
        rarity: Number(itemRarities[i]),
        isMine: sellers[i].toLowerCase() === account.toLowerCase(),
      })).filter(d => d.listingId > 0);
      
      setListings(data);
    } catch (err) {
      console.error('Failed to load marketplace:', err);
    }
    setLoadingData(false);
  }, [contracts, account]);

  const loadMyItems = useCallback(async () => {
    if (!contracts || !account) return;
    try {
      const nextId = Number(await contracts.itemNFT.getNextTokenId());
      const items = [];
      for (let i = 1; i < nextId; i++) {
        try {
          const owner = await contracts.itemNFT.ownerOf(i);
          if (owner.toLowerCase() === account.toLowerCase()) {
            const item = await contracts.itemNFT.getItem(i);
            items.push({
              id: i,
              name: item.name,
              itemType: Number(item.itemType),
              power: Number(item.power),
              rarity: Number(item.rarity),
            });
          }
        } catch {
          // burned or invalid
        }
      }
      setMyItems(items);
    } catch (err) {
      console.error('Failed to load items for sell:', err);
    }
  }, [contracts, account]);

  useEffect(() => {
    loadListings();
    loadMyItems();
  }, [loadListings, loadMyItems]);

  const handleBuy = (listing) => {
    const balance = parseFloat(goldBalance);
    const price = parseFloat(listing.price);
    if (balance < price) {
      showNotification(`Not enough gold! Need ${price.toFixed(0)} but you have ${balance.toFixed(0)}.`, 'error');
      return;
    }
    onAction(async () => {
      const tx = await contracts.marketplace.buyItem(listing.listingId);
      showNotification(`Buying ${listing.name}...`);
      await tx.wait();
      showNotification(`Successfully bought ${listing.name}!`);
      await loadListings();
      await loadMyItems();
    });
  };

  const handleSell = () => {
    if (!sellItemId || !sellPrice) {
      showNotification('Please select an item and set a price.', 'error');
      return;
    }
    const price = parseFloat(sellPrice);
    if (price <= 0 || isNaN(price)) {
      showNotification('Price must be greater than 0.', 'error');
      return;
    }
    onAction(async () => {
      // First approve the marketplace to transfer the item
      const approveTx = await contracts.itemNFT.approve(
        await contracts.marketplace.getAddress(),
        parseInt(sellItemId)
      );
      showNotification('Approving item transfer...');
      await approveTx.wait();

      // Then list the item
      const listTx = await contracts.marketplace.listItem(
        parseInt(sellItemId),
        ethers.parseEther(sellPrice)
      );
      showNotification('Listing item on marketplace...');
      await listTx.wait();
      showNotification('Item listed successfully!');
      setSellItemId('');
      setSellPrice('');
      await loadListings();
      await loadMyItems();
    });
  };

  const handleCancel = (listing) => {
    onAction(async () => {
      const tx = await contracts.marketplace.cancelListing(listing.listingId);
      showNotification('Cancelling listing...');
      await tx.wait();
      showNotification('Listing cancelled. Item returned to inventory.');
      await loadListings();
      await loadMyItems();
    });
  };

  if (!contracts?.marketplace) {
    return (
      <div className="card">
        <h2>&#128176; Marketplace</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Marketplace contract not deployed yet. Please deploy the Marketplace contract first.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Sub-navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn btn-sm ${activeView === 'browse' ? 'btn-primary' : ''}`}
          style={activeView !== 'browse' ? { background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' } : {}}
          onClick={() => setActiveView('browse')}
        >
          Browse Market
        </button>
        <button
          className={`btn btn-sm ${activeView === 'sell' ? 'btn-primary' : ''}`}
          style={activeView !== 'sell' ? { background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' } : {}}
          onClick={() => setActiveView('sell')}
        >
          Sell Items
        </button>
      </div>

      {activeView === 'browse' && (
        <div className="card">
          <h2>&#128176; Marketplace ({listings.length} listings)</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Buy items from other players. 2% fee goes to the treasury.
          </p>
          
          {loadingData ? (
            <div className="loading"><span className="spinner" /> Loading marketplace...</div>
          ) : listings.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No items listed. Be the first to sell!
            </p>
          ) : (
            <div className="items-grid">
              {listings.map((listing) => (
                <div key={listing.listingId} className="item-card" style={{ position: 'relative' }}>
                  <div className="item-name">{listing.name}</div>
                  <div className={`item-rarity rarity-${listing.rarity}`}>
                    {RARITY_NAMES[listing.rarity]}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {ITEM_TYPE_NAMES[listing.itemType]} · Power: {listing.power}
                  </div>
                  <div style={{ 
                    fontSize: 14, fontWeight: 600, color: 'var(--gold)', 
                    marginTop: 6, marginBottom: 6 
                  }}>
                    ★ {parseFloat(listing.price).toFixed(0)} Gold
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Seller: {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}
                  </div>
                  <div>
                    {listing.isMine ? (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleCancel(listing)}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleBuy(listing)}
                        disabled={loading}
                      >
                        Buy
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            className="btn btn-sm btn-primary"
            onClick={loadListings}
            style={{ marginTop: 12 }}
          >
            Refresh
          </button>
        </div>
      )}

      {activeView === 'sell' && (
        <div className="card">
          <h2>&#128184; Sell Items</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            List your items for sale on the marketplace. Select an item and set a price.
          </p>

          {myItems.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              No items in your inventory to sell. Explore or fight monsters to find items!
            </p>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Select Item:
                </label>
                <select
                  value={sellItemId}
                  onChange={(e) => setSellItemId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 14,
                  }}
                >
                  <option value="">-- Choose an item --</option>
                  {myItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      #{item.id} {item.name} ({RARITY_NAMES[item.rarity]} {ITEM_TYPE_NAMES[item.itemType]}, Power: {item.power})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                  Price (ERGOLD):
                </label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              <button
                className="btn btn-warning"
                onClick={handleSell}
                disabled={loading || !sellItemId || !sellPrice}
                style={{ width: '100%' }}
              >
                {loading ? <><span className="spinner" /> Processing...</> : 'List for Sale'}
              </button>
            </>
          )}

          {/* My active listings */}
          {listings.filter(l => l.isMine).length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 8 }}>
                My Active Listings
              </h3>
              <div className="items-grid">
                {listings.filter(l => l.isMine).map((listing) => (
                  <div key={listing.listingId} className="item-card">
                    <div className="item-name">{listing.name}</div>
                    <div className={`item-rarity rarity-${listing.rarity}`}>
                      {RARITY_NAMES[listing.rarity]}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)', marginTop: 4 }}>
                      ★ {parseFloat(listing.price).toFixed(0)} Gold
                    </div>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleCancel(listing)}
                      disabled={loading}
                      style={{ marginTop: 6 }}
                    >
                      Cancel Listing
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Marketplace;
