// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GuildManager
 * @notice On-chain guild governance for EtherRealms.
 *         Guilds provide persistent social structures and shared treasury,
 *         addressing the feedback to strengthen MMORPG-specific on-chain structures.
 */
contract GuildManager is Ownable {
    address public gameManager;

    struct Guild {
        string  name;
        address leader;
        uint256 treasury;
        uint256 memberCount;
        uint64  createdAt;
        bool    active;
    }

    struct Proposal {
        uint256 guildId;
        string  description;
        address proposer;
        uint256 votesFor;
        uint256 votesAgainst;
        uint64  deadline;
        bool    executed;
    }

    uint256 public nextGuildId;
    uint256 public nextProposalId;

    mapping(uint256 => Guild) public guilds;
    mapping(uint256 => mapping(address => bool)) public guildMembers;
    mapping(address => uint256) public playerGuild; // player => guildId
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event GuildCreated(uint256 indexed guildId, string name, address indexed leader);
    event MemberJoined(uint256 indexed guildId, address indexed member);
    event MemberLeft(uint256 indexed guildId, address indexed member);
    event TreasuryDonation(uint256 indexed guildId, address indexed donor, uint256 amount);
    event ProposalCreated(uint256 indexed proposalId, uint256 indexed guildId, string description);
    event Voted(uint256 indexed proposalId, address indexed voter, bool support);

    modifier onlyGameManager() {
        require(msg.sender == gameManager, "GuildManager: not GameManager");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function setGameManager(address _gm) external onlyOwner {
        require(_gm != address(0), "GuildManager: zero address");
        gameManager = _gm;
    }

    /**
     * @notice Create a new guild. The creator becomes the leader.
     */
    function createGuild(string calldata _name, address creator) external onlyGameManager returns (uint256) {
        require(bytes(_name).length > 0 && bytes(_name).length <= 32, "GuildManager: invalid name");
        require(playerGuild[creator] == 0, "GuildManager: already in guild");

        nextGuildId++;
        uint256 guildId = nextGuildId;

        guilds[guildId] = Guild({
            name: _name,
            leader: creator,
            treasury: 0,
            memberCount: 1,
            createdAt: uint64(block.timestamp),
            active: true
        });

        guildMembers[guildId][creator] = true;
        playerGuild[creator] = guildId;

        emit GuildCreated(guildId, _name, creator);
        return guildId;
    }

    function joinGuild(uint256 guildId, address player) external onlyGameManager {
        require(guilds[guildId].active, "GuildManager: guild not active");
        require(playerGuild[player] == 0, "GuildManager: already in guild");

        guildMembers[guildId][player] = true;
        playerGuild[player] = guildId;
        guilds[guildId].memberCount++;

        emit MemberJoined(guildId, player);
    }

    function leaveGuild(address player) external onlyGameManager {
        uint256 guildId = playerGuild[player];
        require(guildId != 0, "GuildManager: not in guild");
        require(guilds[guildId].leader != player, "GuildManager: leader cannot leave");

        guildMembers[guildId][player] = false;
        playerGuild[player] = 0;
        guilds[guildId].memberCount--;

        emit MemberLeft(guildId, player);
    }

    function donateToTreasury(uint256 guildId, uint256 amount, address donor) external onlyGameManager {
        require(guilds[guildId].active, "GuildManager: guild not active");
        guilds[guildId].treasury += amount;
        emit TreasuryDonation(guildId, donor, amount);
    }

    /**
     * @notice Create a governance proposal within a guild.
     */
    function createProposal(
        uint256 guildId,
        string calldata description,
        address proposer
    ) external onlyGameManager returns (uint256) {
        require(guildMembers[guildId][proposer], "GuildManager: not a member");

        nextProposalId++;
        uint256 proposalId = nextProposalId;

        proposals[proposalId] = Proposal({
            guildId: guildId,
            description: description,
            proposer: proposer,
            votesFor: 0,
            votesAgainst: 0,
            deadline: uint64(block.timestamp + 3 days),
            executed: false
        });

        emit ProposalCreated(proposalId, guildId, description);
        return proposalId;
    }

    function vote(uint256 proposalId, address voter, bool support) external onlyGameManager {
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "GuildManager: already executed");
        require(block.timestamp < p.deadline, "GuildManager: voting ended");
        require(guildMembers[p.guildId][voter], "GuildManager: not a member");
        require(!hasVoted[proposalId][voter], "GuildManager: already voted");

        hasVoted[proposalId][voter] = true;
        if (support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }

        emit Voted(proposalId, voter, support);
    }

    // ─── View helpers ─────────────────────────────────

    function getGuild(uint256 guildId) external view returns (Guild memory) {
        return guilds[guildId];
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function isGuildMember(uint256 guildId, address player) external view returns (bool) {
        return guildMembers[guildId][player];
    }
}
