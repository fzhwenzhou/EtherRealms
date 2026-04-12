import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  CharacterNFTABI,
  ItemNFTABI,
  GoldTokenABI,
  GameManagerABI,
  GuildManagerABI,
  CONTRACT_ADDRESSES,
} from './contracts/config';
import CharacterPanel from './components/CharacterPanel';
import GameActions from './components/GameActions';
import WorldEvents from './components/WorldEvents';
import Leaderboard from './components/Leaderboard';
import Inventory from './components/Inventory';
import GuildPanel from './components/GuildPanel';
import Notification from './components/Notification';

// ─── Demo Mode Data ───────────────────────────────────
// const DEMO_CHARACTER = {
//   name: 'DemoHero',
//   level: 3,
//   xp: 310,
//   hp: 95,
//   maxHp: 120,
//   strength: 19,
//   defense: 11,
//   equippedWeapon: 1,
//   equippedArmor: 2,
//   guildId: 1,
//   energy: 4,
// };

// const DEMO_ITEMS = [
//   { id: 1, name: 'Iron Sword', itemType: 0, power: 8, rarity: 2 },
//   { id: 2, name: 'Leather Armor', itemType: 1, power: 6, rarity: 1 },
//   { id: 3, name: 'Minor Potion', itemType: 2, power: 15, rarity: 1 },
//   { id: 4, name: 'Steel Blade', itemType: 0, power: 18, rarity: 3 },
// ];

// const DEMO_EVENTS = [
//   { id: 5, player: '0xf39Fd6...b922', characterId: 1, eventType: 0, message: 'DemoHero explored the wilderness', timestamp: Math.floor(Date.now()/1000) - 60 },
//   { id: 4, player: '0xf39Fd6...b922', characterId: 1, eventType: 1, message: 'DemoHero defeated Goblin', timestamp: Math.floor(Date.now()/1000) - 120 },
//   { id: 3, player: '0x70997...79C8', characterId: 2, eventType: 4, message: 'ShadowMage reached level 5', timestamp: Math.floor(Date.now()/1000) - 300 },
//   { id: 2, player: '0xf39Fd6...b922', characterId: 1, eventType: 3, message: 'DemoHero found an item while exploring!', timestamp: Math.floor(Date.now()/1000) - 500 },
//   { id: 1, player: '0x3C44Cd...6C62', characterId: 3, eventType: 5, message: "Guild 'Dragon Slayers' was founded!", timestamp: Math.floor(Date.now()/1000) - 800 },
// ];

// const DEMO_LEADERS = [
//   { id: 2, name: 'ShadowMage', level: 5, xp: 980, owner: '0x70997...79C8' },
//   { id: 1, name: 'DemoHero', level: 3, xp: 310, owner: '0xf39Fd6...b922' },
//   { id: 3, name: 'IronKnight', level: 2, xp: 150, owner: '0x3C44Cd...6C62' },
// ];

// const DEMO_GUILD = {
//   id: 1,
//   name: 'Dragon Slayers',
//   leader: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
//   treasury: '125',
//   memberCount: 3,
//   createdAt: Math.floor(Date.now()/1000) - 86400,
// };

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
  // const [demoMode, setDemoMode] = useState(false);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // ─── Demo Mode ──────────────────────────────────────
  // const enterDemoMode = () => {
  //   setDemoMode(true);
  //   setAccount('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  //   setCharId(1);
  //   setCharacter({ ...DEMO_CHARACTER });
  //   setEnergy(DEMO_CHARACTER.energy);
  //   setGoldBalance('185');
  //   showNotification('Demo mode activated! Explore the interface freely.');
  // };

  // const demoAction = (msg) => {
  //   setLoading(true);
  //   showNotification(msg);
  //   setTimeout(() => {
  //     setLoading(false);
  //     // Simulate stat changes
  //     setCharacter(prev => ({
  //       ...prev,
  //       xp: prev.xp + Math.floor(Math.random() * 20 + 10),
  //       hp: Math.max(1, prev.hp - Math.floor(Math.random() * 10)),
  //     }));
  //     setEnergy(prev => Math.max(0, prev - 1));
  //     setGoldBalance(prev => String(parseInt(prev) + Math.floor(Math.random() * 15 + 5)));
  //     showNotification('Action complete! (Demo)');
  //   }, 1500);
  // };

  // ─── Real Wallet Connection ─────────────────────────
  const connectWallet = async () => {
    if (!window.ethereum) {
      showNotification('MetaMask not detected. Try Demo Mode to explore the interface!', 'error');
      return;
    }
    try {
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

      setContracts({ characterNFT, itemNFT, goldToken, gameManager, guildManager });
      showNotification('Wallet connected!');
    } catch (err) {
      showNotification(err.message || 'Connection failed', 'error');
    }
  };

  const loadCharacter = useCallback(async () => {
    // if (demoMode || !contracts || !account) return;
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
    // if (demoMode) {
    //   setCharacter({ ...DEMO_CHARACTER, name: mintName });
    //   setCharId(1);
    //   setEnergy(5);
    //   setGoldBalance('0');
    //   showNotification('Character minted! (Demo)');
    //   return;
    // }
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
    // if (demoMode) {
    //   demoAction('Processing action...');
    //   return;
    // }
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
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={connectWallet}>
              Connect MetaMask
            </button>
            {/*
            <button className="btn btn-warning" onClick={enterDemoMode}>
              Demo Mode
            </button>
            */}
          </div>
          <p className="subtitle" style={{ marginTop: 16, fontSize: 12 }}>
            No MetaMask?
          </p>
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
            {loading ? <><span className="spinner" /> Minting...</> : demoMode ? 'Create Character (Demo)' : 'Mint Character (0.01 ETH)'}
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
