import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const RARITY_NAMES = ['', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
const ITEM_TYPE_NAMES = ['Weapon', 'Armor', 'Potion'];
const ITEM_COST = 50; // 50 ERGOLD

function Inventory({ contracts, account, charId, loading, onAction, showNotification, goldBalance, demoMode, demoItems }) {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const loadItems = useCallback(async () => {
    if (demoMode) {
      setItems(demoItems || []);
      return;
    }
    if (!contracts || !account) return;
    setLoadingItems(true);
    try {
      const nextId = Number(await contracts.itemNFT.getNextTokenId());
      const playerItems = [];
      // nextId is the NEXT token to be minted, so valid IDs are 1..(nextId-1)
      for (let i = 1; i < nextId; i++) {
        try {
          const owner = await contracts.itemNFT.ownerOf(i);
          if (owner.toLowerCase() === account.toLowerCase()) {
            const item = await contracts.itemNFT.getItem(i);
            playerItems.push({
              id: i,
              name: item.name,
              itemType: Number(item.itemType),
              power: Number(item.power),
              rarity: Number(item.rarity),
            });
          }
        } catch {
          // Burned or invalid token - skip
        }
      }
      setItems(playerItems);
    } catch (err) {
      console.error('Failed to load items:', err);
    }
    setLoadingItems(false);
  }, [contracts, account, demoMode, demoItems]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleEquip = (itemId) => {
    if (demoMode) { onAction(() => {}); return; }
    onAction(async () => {
      const tx = await contracts.gameManager.equipItem(charId, itemId);
      showNotification('Equipping item...');
      await tx.wait();
      showNotification('Item equipped!');
      await loadItems();
    });
  };

  const handleUsePotion = (itemId) => {
    if (demoMode) { onAction(() => {}); return; }
    onAction(async () => {
      const tx = await contracts.gameManager.usePotion(charId, itemId);
      showNotification('Using potion...');
      await tx.wait();
      showNotification('Potion used!');
      await loadItems();
    });
  };

  const handleBuy = (itemType) => {
    if (demoMode) { onAction(() => {}); return; }
    // Check balance before calling contract to provide better error messages
    const balance = parseFloat(goldBalance);
    if (balance < ITEM_COST) {
      showNotification(`Not enough gold! Need ${ITEM_COST} but you have ${balance.toFixed(0)}. Explore or fight monsters to earn more!`, 'error');
      return;
    }
    onAction(async () => {
      const tx = await contracts.gameManager.buyItem(itemType);
      showNotification('Purchasing item...');
      await tx.wait();
      showNotification('Item purchased!');
      await loadItems();
    });
  };

  return (
    <div>
      <div className="card">
        <h2>&#127917; Shop</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Buy items with ERGOLD. Each item costs 50 Gold. Your balance: {parseFloat(goldBalance).toFixed(0)} Gold
        </p>
        <div className="actions-grid">
          <button className="btn btn-sm btn-primary" onClick={() => handleBuy(0)} disabled={loading}>
            Buy Weapon (50G)
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => handleBuy(1)} disabled={loading}>
            Buy Armor (50G)
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => handleBuy(2)} disabled={loading}>
            Buy Potion (50G)
          </button>
        </div>
      </div>

      <div className="card">
        <h2>&#128092; Inventory ({items.length})</h2>
        {loadingItems ? (
          <div className="loading"><span className="spinner" /> Loading items...</div>
        ) : items.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No items. Explore or buy from the shop!</p>
        ) : (
          <div className="items-grid">
            {items.map((item) => (
              <div key={item.id} className="item-card">
                <div className="item-name">{item.name}</div>
                <div className={`item-rarity rarity-${item.rarity}`}>
                  {RARITY_NAMES[item.rarity]}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {ITEM_TYPE_NAMES[item.itemType]} · Power: {item.power}
                </div>
                <div style={{ marginTop: 6 }}>
                  {item.itemType === 2 ? (
                    <button className="btn btn-sm btn-success" onClick={() => handleUsePotion(item.id)} disabled={loading}>
                      Use
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-primary" onClick={() => handleEquip(item.id)} disabled={loading}>
                      Equip
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Inventory;
