import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  CharacterNFTABI,
  ItemNFTABI,
  GoldTokenABI,
  GameManagerABI,
  GuildManagerABI,
  MarketplaceABI,
  CONTRACT_ADDRESSES,
} from './contracts/config';
import CharacterPanel from './components/CharacterPanel';
import GameActions from './components/GameActions';
import WorldEvents from './components/WorldEvents';
import Leaderboard from './components/Leaderboard';
import Inventory from './components/Inventory';
import GuildPanel from './components/GuildPanel';
import Marketplace from './components/Marketplace';
import Notification from './components/Notification';

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [contracts, setContracts] = useState(null);
  const [character, setCharacter] = useState(null);
  const [charId, setCharId] = useState(0);
  const [goldBalance, setGoldBalance] = useState('0');
  const [energy, setEnergy] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('actions');
  const [mintName, setMintName] = useState('');

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);
  const connectWallet = async () => {
    if (!window.ethereum) {
      showNotification('MetaMask not detected. Please install MetaMask!', 'error');
      return;
    }
    try {
      // Request to switch to Sepolia testnet (chainId: 11155111)
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }], // 0xaa36a7 is 11155111 in hex (Sepolia)
        });
      } catch (switchError) {
        // If the chain doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xaa36a7',
              chainName: 'Sepolia',
              rpcUrls: ['https://rpc.sepolia.org'],
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            }],
          });
        } else {
          throw switchError;
        }
      }

      const prov = new ethers.BrowserProvider(window.ethereum);
      await prov.send('eth_requestAccounts', []);
      const sign = await prov.getSigner();
      const addr = await sign.getAddress();

      setProvider(prov);
      setSigner(sign);
      setAccount(addr);

      const characterNFT = new ethers.Contract(CONTRACT_ADDRESSES.CharacterNFT, CharacterNFTABI.abi, sign);
      const itemNFT = new ethers.Contract(CONTRACT_ADDRESSES.ItemNFT, ItemNFTABI.abi, sign);
      const goldToken = new ethers.Contract(CONTRACT_ADDRESSES.GoldToken, GoldTokenABI.abi, sign);
      const gameManager = new ethers.Contract(CONTRACT_ADDRESSES.GameManager, GameManagerABI.abi, sign);
      const guildManager = new ethers.Contract(CONTRACT_ADDRESSES.GuildManager, GuildManagerABI.abi, sign);

      // Marketplace contract (may not be deployed yet)
      let marketplace = null;
      if (CONTRACT_ADDRESSES.Marketplace) {
        try {
          marketplace = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace, MarketplaceABI.abi, sign);
        } catch (e) {
          console.warn('Marketplace contract not available:', e);
        }
      }

      setContracts({ characterNFT, itemNFT, goldToken, gameManager, guildManager, marketplace });
      showNotification('Wallet connected to Sepolia testnet!');
    } catch (err) {
      showNotification(err.message || 'Failed to connect to Sepolia testnet', 'error');
    }
  };

  const loadCharacter = useCallback(async () => {
    if (!contracts || !account) return;
    try {
      const id = await contracts.characterNFT.playerCharacter(account);
      const numId = Number(id);
      setCharId(numId);
      if (numId > 0) {
        const char = await contracts.characterNFT.getCharacter(numId);
        setCharacter({
          name: char.name,
          level: Number(char.level),
          xp: Number(char.xp),
          hp: Number(char.hp),
          maxHp: Number(char.maxHp),
          strength: Number(char.strength),
          defense: Number(char.defense),
          equippedWeapon: Number(char.equippedWeapon),
          equippedArmor: Number(char.equippedArmor),
          guildId: Number(char.guildId),
          energy: Number(char.energy),
        });
        const e = await contracts.gameManager.getAvailableEnergy(numId);
        setEnergy(Number(e));
        const gold = await contracts.goldToken.balanceOf(account);
        setGoldBalance(ethers.formatEther(gold));
      }
    } catch (err) {
      console.error('Failed to load character:', err);
    }
  }, [contracts, account]); 

  useEffect(() => {
    loadCharacter();
  }, [loadCharacter]);

  useEffect(() => {
    if (window.ethereum) {
      const handler = (accounts) => {
        if (accounts.length > 0) window.location.reload();
      };
      window.ethereum.on('accountsChanged', handler);
      return () => window.ethereum.removeListener('accountsChanged', handler);
    }
  }, []);

  const mintCharacter = async () => {
    if (!mintName.trim()) {
      showNotification('Please enter a character name', 'error');
      return;
    }
    if (!contracts) {
      showNotification('Wallet not connected', 'error');
      return;
    }
    setLoading(true);
    try {
      const tx = await contracts.characterNFT.mintCharacter(mintName, {
        value: ethers.parseEther('0.01'),
      });
      showNotification('Minting character... Please wait for confirmation.');
      await tx.wait();
      showNotification('Character minted successfully!');
      await loadCharacter();
    } catch (err) {
      showNotification(err.reason || err.message || 'Mint failed', 'error');
    }
    setLoading(false);
  };

  const handleAction = async (actionFn) => {
    setLoading(true);
    try {
      await actionFn();
      await loadCharacter();
    } catch (err) {
      showNotification(err.reason || err.message || 'Transaction failed', 'error');
    }
    setLoading(false);
  };

  // ── Connect Screen ──
  if (!account) {
    return (
      <div className="app">
        <div className="connect-screen">
          <h1>EtherRealms</h1>
          <p className="subtitle">Ethereum Sepolia MMORPG Proof of Concept</p>
          <p>A blockchain-powered persistent shared world</p>
          <button className="btn btn-primary" onClick={connectWallet} style={{ marginTop: 8 }}>
            Connect MetaMask
          </button>
        </div>
        {notification && <Notification {...notification} />}
      </div>
    );
  }

  // ── Mint Screen ──
  if (charId === 0) {
    return (
      <div className="app">
        <div className="header">
          <h1>EtherRealms</h1>
          <div className="wallet-info">
            <span className="wallet-address">{account.slice(0, 6)}...{account.slice(-4)}</span>
          </div>
        </div>
        <div className="mint-screen">
          <h2>Create Your Hero</h2>
          <p>Mint a unique character NFT to enter the world of EtherRealms. Cost: 0.01 ETH</p>
          <input
            className="mint-input"
            placeholder="Enter character name..."
            value={mintName}
            onChange={(e) => setMintName(e.target.value)}
            maxLength={32}
          />
          <button className="btn btn-primary" onClick={mintCharacter} disabled={loading}>
            {loading ? <><span className="spinner" /> Minting...</> : 'Mint Character (0.01 ETH)'}
          </button>
        </div>
        {notification && <Notification {...notification} />}
      </div>
    );
  }

  // ── Game Screen ──
  return (
    <div className="app">
      <div className="header">
        <h1>EtherRealms: <span>PoC</span></h1>
        <div className="wallet-info">
          <div className="gold-display">
            <span>&#9733;</span> {parseFloat(goldBalance).toFixed(0)} GOLD
          </div>
          <span className="wallet-address">{account.slice(0, 6)}...{account.slice(-4)}</span>
        </div>
      </div>

      <div className="game-layout">
        {/* Left: Character Panel */}
        <div>
          <CharacterPanel character={character} energy={energy} charId={charId} />
        </div>

        {/* Center: Game Actions */}
        <div>
          <div className="tabs">
            <button className={`tab ${activeTab === 'actions' ? 'active' : ''}`} onClick={() => setActiveTab('actions')}>Actions</button>
            <button className={`tab ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>Inventory</button>
            <button className={`tab ${activeTab === 'market' ? 'active' : ''}`} onClick={() => setActiveTab('market')}>Market</button>
            <button className={`tab ${activeTab === 'guild' ? 'active' : ''}`} onClick={() => setActiveTab('guild')}>Guild</button>
            <button className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
          </div>

          {activeTab === 'actions' && (
            <GameActions
              contracts={contracts}
              charId={charId}
              energy={energy}
              loading={loading}
              onAction={handleAction}
              showNotification={showNotification}
            />
          )}
          {activeTab === 'inventory' && (
            <Inventory
              contracts={contracts}
              account={account}
              charId={charId}
              loading={loading}
              onAction={handleAction}
              showNotification={showNotification}
              goldBalance={goldBalance}
            />
          )}
          {activeTab === 'market' && (
            <Marketplace
              contracts={contracts}
              account={account}
              loading={loading}
              onAction={handleAction}
              showNotification={showNotification}
              goldBalance={goldBalance}
            />
          )}
          {activeTab === 'guild' && (
            <GuildPanel
              contracts={contracts}
              account={account}
              character={character}
              loading={loading}
              onAction={handleAction}
              showNotification={showNotification}
            />
          )}
          {activeTab === 'leaderboard' && (
            <Leaderboard contracts={contracts}/>
          )}
        </div>

        {/* Right: World Events */}
        <div>
          <WorldEvents contracts={contracts}/>
        </div>
      </div>

      {notification && <Notification {...notification} />}
    </div>
  );
}

export default App;
