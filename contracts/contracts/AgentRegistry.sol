// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentRegistry
 * @notice On-chain registry for NeuronForge AI agents
 * @dev Stores agent metadata hashes, skill compositions, and tracks creators
 */
contract AgentRegistry {
    struct Agent {
        uint256 id;
        address creator;
        string name;
        string metadataHash;    // 0G Storage root hash for agent state
        string[] skillHashes;   // Skill identifiers
        uint256 createdAt;
        uint256 updatedAt;
        bool active;
    }

    // Agent counter
    uint256 private _nextAgentId = 1;

    // Agent storage
    mapping(uint256 => Agent) public agents;
    
    // Creator -> Agent IDs
    mapping(address => uint256[]) public creatorAgents;
    
    // Total agents
    uint256 public totalAgents;

    // Events
    event AgentRegistered(
        uint256 indexed agentId,
        address indexed creator,
        string name,
        string metadataHash
    );
    
    event AgentUpdated(
        uint256 indexed agentId,
        string newMetadataHash
    );
    
    event AgentDeactivated(uint256 indexed agentId);

    /**
     * @notice Register a new agent
     * @param metadataHash 0G Storage root hash containing agent state
     * @param skillHashes Array of skill identifiers
     * @param name Human-readable agent name
     */
    function registerAgent(
        string calldata metadataHash,
        string[] calldata skillHashes,
        string calldata name
    ) external returns (uint256) {
        uint256 agentId = _nextAgentId++;
        
        Agent storage agent = agents[agentId];
        agent.id = agentId;
        agent.creator = msg.sender;
        agent.name = name;
        agent.metadataHash = metadataHash;
        agent.createdAt = block.timestamp;
        agent.updatedAt = block.timestamp;
        agent.active = true;

        // Copy skill hashes
        for (uint256 i = 0; i < skillHashes.length; i++) {
            agent.skillHashes.push(skillHashes[i]);
        }

        creatorAgents[msg.sender].push(agentId);
        totalAgents++;

        emit AgentRegistered(agentId, msg.sender, name, metadataHash);
        return agentId;
    }

    /**
     * @notice Update agent state hash (new memory/config snapshot)
     * @param agentId The ID of the agent to update
     * @param newMetadataHash New 0G Storage root hash
     */
    function updateAgentState(
        uint256 agentId,
        string calldata newMetadataHash
    ) external {
        Agent storage agent = agents[agentId];
        require(agent.creator == msg.sender, "Not agent creator");
        require(agent.active, "Agent is deactivated");

        agent.metadataHash = newMetadataHash;
        agent.updatedAt = block.timestamp;

        emit AgentUpdated(agentId, newMetadataHash);
    }

    /**
     * @notice Deactivate an agent
     */
    function deactivateAgent(uint256 agentId) external {
        Agent storage agent = agents[agentId];
        require(agent.creator == msg.sender, "Not agent creator");
        
        agent.active = false;
        emit AgentDeactivated(agentId);
    }

    /**
     * @notice Get agent skill hashes
     */
    function getAgentSkills(uint256 agentId) external view returns (string[] memory) {
        return agents[agentId].skillHashes;
    }

    /**
     * @notice Get all agent IDs for a creator
     */
    function getAgentsByCreator(address creator) external view returns (uint256[] memory) {
        return creatorAgents[creator];
    }
}
