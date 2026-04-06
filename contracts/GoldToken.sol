// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GoldToken
 * @notice ERC-20 in-game currency for EtherRealms.
 *         Only the GameManager (set as minter) may mint gold rewards.
 */
contract GoldToken is ERC20, Ownable {
    address public minter;

    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    modifier onlyMinter() {
        require(msg.sender == minter, "GoldToken: caller is not the minter");
        _;
    }

    constructor() ERC20("EtherRealms Gold", "ERGOLD") Ownable(msg.sender) {}

    /**
     * @notice Owner sets the minter address (GameManager contract).
     */
    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "GoldToken: zero address");
        emit MinterUpdated(minter, _minter);
        minter = _minter;
    }

    /**
     * @notice Mint gold to a player. Called by the GameManager after adventures.
     */
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    /**
     * @notice Burn gold from a player (e.g. buying items).
     */
    function burnFrom(address from, uint256 amount) external onlyMinter {
        _burn(from, amount);
    }
}
