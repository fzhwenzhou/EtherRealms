import CharacterNFTABI from './CharacterNFT.json';
import ItemNFTABI from './ItemNFT.json';
import GoldTokenABI from './GoldToken.json';
import GameManagerABI from './GameManager.json';
import GuildManagerABI from './GuildManager.json';
import addresses from './addresses.json';

// Default addresses for Hardhat local network
// Update these after deploying to Sepolia
const CONTRACT_ADDRESSES = {
  CharacterNFT: addresses.CharacterNFT,
  ItemNFT: addresses.ItemNFT,
  GoldToken: addresses.GoldToken,
  GameManager: addresses.GameManager,
  GuildManager: addresses.GuildManager,
};

export {
  CharacterNFTABI,
  ItemNFTABI,
  GoldTokenABI,
  GameManagerABI,
  GuildManagerABI,
  CONTRACT_ADDRESSES,
};
