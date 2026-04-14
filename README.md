# EtherRealms – Ethereum Sepolia MMORPG Proof of Concept

A blockchain-based MMORPG proof of concept built on the Ethereum Sepolia testnet, demonstrating on-chain game mechanics including character NFTs, item system, gold economy, combat, and guild governance.

## Group Members

- Fang Zihao (122090106)
- Liang Ruilan (122090308)
- Xu Penggan (122090625)

## Project Overview

EtherRealms implements a minimal MMORPG game using Solidity smart contracts on the Ethereum Sepolia Testnet. The project focuses on verifying core mechanisms: on-chain shared world state, NFT characters/items, player interaction, persistent progress, and guild governance.

### Core Features

1. **Character System (ERC-721)** – Mint unique character NFTs with on-chain attributes (level, XP, HP, STR, DEF)
2. **Item System (ERC-721)** – Weapons, armor, and potions with 5 rarity tiers and ownership history tracking
3. **Gold Economy (ERC-20)** – In-game currency earned through gameplay, spent on items and guild treasury
4. **Adventure & Combat** – Exploration and turn-based PvE combat with 3 monster types
5. **Guild Governance** – Create guilds, shared treasury, governance proposals with on-chain voting
6. **Shared World** – Global event log, leaderboard, and player list for "massively online" experience

## Tech Stack

| Component       | Technology                         |
| --------------- | ---------------------------------- |
| Smart Contracts | Solidity 0.8.24, OpenZeppelin v5.0 |
| Dev Framework   | Hardhat                            |
| Testing         | Hardhat Test (Mocha + Chai)        |
| Frontend        | React 18, Vite 5, ethers.js v6     |
| Wallet          | MetaMask                           |
| Testnet         | Ethereum Sepolia                   |

## Quick Start

### Prerequisites

- Node.js >= 18
- MetaMask browser extension
- Sepolia testnet ETH (from a faucet)

### 1. Install Dependencies

```bash
# Install smart contract dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Compile Contracts

```bash
npm run compile
```

### 3. Run Tests

```bash
npm run test
```

All 24 tests should pass:

```
  EtherRealms
    CharacterNFT (5 tests)
    GoldToken (1 test)
    GameManager - Adventure (6 tests)
    GameManager - Combat (3 tests)
    GameManager - Rest (1 test)
    GameManager - Equipment (1 test)
    GameManager - Guild System (5 tests)
    GameManager - Leaderboard (1 test)
    ItemNFT - Ownership History (1 test)

  24 passing
```

### 4. Deploy to Local Network

```bash
# Terminal 1: Start local Hardhat node
npm run node

# Terminal 2: Deploy contracts
npm run deploy:local
```

### 5. Deploy to Sepolia Testnet

```bash
# Set environment variables
export SEPOLIA_RPC_URL="https://rpc.sepolia.org"
export PRIVATE_KEY="your-private-key-here"

# Deploy
npm run deploy:sepolia
```

### 6. Run Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

### 7. Demo Flow

1. Open the web page
2. Connect MetaMask (switch to Sepolia network)
3. Click "Mint Character" (costs 0.01 ETH)
4. Enter the game interface
5. Click "Explore" to gain XP and gold
6. Click on monsters to fight them
7. Buy/equip items from the shop
8. Create or join a guild
9. Create governance proposals and vote
10. View the leaderboard and world events

The full loop can be experienced in ~5 minutes.

## Contract Architecture

```
┌─────────────┐
│ GameManager  │──── Central game logic hub
├─────────────┤
│ explore()   │
│ fightMonster│
│ equipItem() │
│ rest()      │
│ buyItem()   │
│ createGuild │
│ leaderboard │
└──────┬──────┘
       │ manages
       ├──→ CharacterNFT.sol (ERC-721 + attributes + action history)
       ├──→ ItemNFT.sol      (ERC-721 + ownership history)
       ├──→ GoldToken.sol    (ERC-20 in-game currency)
       └──→ GuildManager.sol (Guild governance + treasury)
```

## Project Structure

```
etherrealms/
├── contracts/           # Solidity smart contracts
│   ├── CharacterNFT.sol
│   ├── ItemNFT.sol
│   ├── GoldToken.sol
│   ├── GuildManager.sol
│   ├── GameManager.sol
│   └── Marketplace.sol
├── test/                # Hardhat test suite (24 tests)
│   └── EtherRealms.test.js
├── scripts/             # Deployment scripts
│   └── deploy.js
├── frontend/            # React DApp
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── CharacterPanel.jsx
│   │   │   ├── GameActions.jsx
│   │   │   ├── WorldEvents.jsx
│   │   │   ├── Leaderboard.jsx
│   │   │   ├── Inventory.jsx
│   │   │   ├── GuildPanel.jsx
│   │   │   ├── Marketplace.jsx
│   │   │   └── Notification.jsx
│   │   └── contracts/   # ABIs and addresses
│   └── index.html
├── hardhat.config.js
├── package.json
└── README.md
```

## Addressing PoC Feedback

The PoC reviewer noted that the original proposal looked like an "on-chain RPG" rather than a project designed around MMORPG structures. We addressed this by implementing:

| MMORPG Structure          | Implementation                                                            |
| ------------------------- | ------------------------------------------------------------------------- |
| Persistent shared world   | Global `worldEvents` array, `getAllPlayers()`, `leaderboard()`      |
| Long-term player identity | One character per address,`ActionRecord` history, permanent progression |
| Traceable asset histories | `ItemNFT.ownershipHistory`, `CharacterNFT.actionHistory`              |
| Guild governance          | `GuildManager` with treasury, proposals, on-chain voting                |
| Player-driven economy     | ERC-20 gold earned through gameplay, spent on items/healing/treasury      |

## Known Limitations

- **Randomness**: Uses pseudo-random (blockhash) – upgradeable to Chainlink VRF
- **Gas Costs**: Free on Sepolia; production would need Layer 2 deployment
- **Scalability**: Leaderboard uses O(n²) sort; production needs off-chain indexing
- **No PvP**: Current version is PvE only

## License

MIT

## TODOs
1. On the real ETH chain, establish a Uniswap pool to exchange ETH with ETHGOLD.
