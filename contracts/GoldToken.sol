// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GoldToken
 * @notice ERC-20 in-game currency for EtherRealms.
 *         Authorized contracts (GameManager, Marketplace, etc.) may mint and burn gold.
 */
contract GoldToken is ERC20, Ownable {
    address public minter; // kept for backward compatibility
    mapping(address => bool) public authorized;

    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    event AuthorizedUpdated(address indexed addr, bool status);

    modifier onlyAuthorized() {
        require(msg.sender == minter || authorized[msg.sender], "GoldToken: caller is not authorized");
        _;
    }

    constructor() ERC20("EtherRealms Gold", "ERGOLD") Ownable(msg.sender) {}

    /**
     * @notice Owner sets the primary minter address (GameManager contract).
     */
    function setMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "GoldToken: zero address");
        emit MinterUpdated(minter, _minter);
        minter = _minter;
    }

    /**
     * @notice Owner can authorize additional contracts (e.g. Marketplace).
     */
    function setAuthorized(address _addr, bool _status) external onlyOwner {
        require(_addr != address(0), "GoldToken: zero address");
        authorized[_addr] = _status;
        emit AuthorizedUpdated(_addr, _status);
    }

    /**
     * @notice Mint gold to a player. Called by authorized contracts.
     */
    function mint(address to, uint256 amount) external onlyAuthorized {
        _mint(to, amount);
    }

    /**
     * @notice Burn gold from a player (e.g. buying items, marketplace purchases).
     */
    function burnFrom(address from, uint256 amount) external onlyAuthorized {
        _burn(from, amount);
    }
}
