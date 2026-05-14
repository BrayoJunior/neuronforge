// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title NeuronForgeINFT
 * @notice Intelligent NFT (ERC-7857) implementation for AI agent tokenization
 * @dev Enables minting agents as INFTs with encrypted intelligence transfer
 *      Based on ERC-7857 standard by 0G Foundation
 */
contract NeuronForgeINFT {
    // Token data
    struct TokenData {
        address owner;
        string metadataURI;           // 0G Storage hash for public metadata
        bytes encryptedIntelligence;   // Encrypted agent state (skills, memory, persona)
        address creator;
        uint256 createdAt;
        bool exists;
    }

    // Token counter
    uint256 private _nextTokenId = 1;
    
    // Token storage
    mapping(uint256 => TokenData) private _tokens;
    
    // Owner -> token IDs
    mapping(address => uint256[]) private _ownerTokens;
    
    // Approvals
    mapping(uint256 => address) private _tokenApprovals;
    
    // Total supply
    uint256 public totalSupply;

    // Contract metadata
    string public name = "NeuronForge Agent";
    string public symbol = "NFAI";

    // Events (ERC-721 compatible + INFT-specific)
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event AgentMinted(uint256 indexed tokenId, address indexed to, string metadataURI);
    event AgentCloned(uint256 indexed originalTokenId, uint256 indexed newTokenId, address indexed to);
    event IntelligenceUpdated(uint256 indexed tokenId);

    modifier onlyOwner(uint256 tokenId) {
        require(_tokens[tokenId].owner == msg.sender, "Not token owner");
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        require(_tokens[tokenId].exists, "Token does not exist");
        _;
    }

    /**
     * @notice Mint a new agent INFT
     * @param to Address to mint to
     * @param metadataURI 0G Storage root hash for agent metadata
     * @param encryptedIntelligence Encrypted agent state
     */
    function mintAgent(
        address to,
        string calldata metadataURI,
        bytes calldata encryptedIntelligence
    ) external returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");

        uint256 tokenId = _nextTokenId++;

        _tokens[tokenId] = TokenData({
            owner: to,
            metadataURI: metadataURI,
            encryptedIntelligence: encryptedIntelligence,
            creator: msg.sender,
            createdAt: block.timestamp,
            exists: true
        });

        _ownerTokens[to].push(tokenId);
        totalSupply++;

        emit Transfer(address(0), to, tokenId);
        emit AgentMinted(tokenId, to, metadataURI);

        return tokenId;
    }

    /**
     * @notice Transfer an INFT (includes encrypted intelligence)
     * @dev In a full ERC-7857 implementation, this would involve
     *      oracle-mediated re-encryption via TEE/ZKP
     */
    function transferAgent(
        address to,
        uint256 tokenId
    ) external onlyOwner(tokenId) tokenExists(tokenId) {
        require(to != address(0), "Cannot transfer to zero address");

        TokenData storage token = _tokens[tokenId];
        address from = token.owner;
        token.owner = to;

        // Remove from sender's list
        _removeFromOwnerList(from, tokenId);
        
        // Add to receiver's list
        _ownerTokens[to].push(tokenId);

        // Clear approvals
        delete _tokenApprovals[tokenId];

        emit Transfer(from, to, tokenId);
    }

    /**
     * @notice Clone an agent INFT (creates copy with same intelligence)
     * @param tokenId Original token to clone
     * @param to Address to receive the clone
     */
    function cloneAgent(
        uint256 tokenId,
        address to
    ) external onlyOwner(tokenId) tokenExists(tokenId) returns (uint256) {
        require(to != address(0), "Cannot clone to zero address");

        TokenData storage original = _tokens[tokenId];
        uint256 newTokenId = _nextTokenId++;

        _tokens[newTokenId] = TokenData({
            owner: to,
            metadataURI: original.metadataURI,
            encryptedIntelligence: original.encryptedIntelligence,
            creator: original.creator,
            createdAt: block.timestamp,
            exists: true
        });

        _ownerTokens[to].push(newTokenId);
        totalSupply++;

        emit Transfer(address(0), to, newTokenId);
        emit AgentCloned(tokenId, newTokenId, to);

        return newTokenId;
    }

    /**
     * @notice Update the encrypted intelligence of an agent
     * @dev Called when agent learns/evolves
     */
    function updateIntelligence(
        uint256 tokenId,
        bytes calldata newIntelligence,
        string calldata newMetadataURI
    ) external onlyOwner(tokenId) tokenExists(tokenId) {
        TokenData storage token = _tokens[tokenId];
        token.encryptedIntelligence = newIntelligence;
        if (bytes(newMetadataURI).length > 0) {
            token.metadataURI = newMetadataURI;
        }

        emit IntelligenceUpdated(tokenId);
    }

    // ============ View Functions ============

    function ownerOf(uint256 tokenId) external view tokenExists(tokenId) returns (address) {
        return _tokens[tokenId].owner;
    }

    function balanceOf(address owner) external view returns (uint256) {
        return _ownerTokens[owner].length;
    }

    function tokenURI(uint256 tokenId) external view tokenExists(tokenId) returns (string memory) {
        return _tokens[tokenId].metadataURI;
    }

    function getTokenData(uint256 tokenId) external view tokenExists(tokenId) returns (
        address owner,
        string memory metadataURI,
        address creator,
        uint256 createdAt
    ) {
        TokenData storage token = _tokens[tokenId];
        return (token.owner, token.metadataURI, token.creator, token.createdAt);
    }

    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        return _ownerTokens[owner];
    }

    // ============ Internal Functions ============

    function _removeFromOwnerList(address owner, uint256 tokenId) internal {
        uint256[] storage tokens = _ownerTokens[owner];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenId) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                break;
            }
        }
    }
}
