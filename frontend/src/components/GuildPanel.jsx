import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

function GuildPanel({ contracts, account, character, loading, onAction, showNotification, demoMode, demoGuild }) {
  const [guild, setGuild] = useState(null);
  const [guildName, setGuildName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [proposalText, setProposalText] = useState('');
  const [proposals, setProposals] = useState([]);
  const [donateAmount, setDonateAmount] = useState('');

  const loadGuild = useCallback(async () => {
    if (demoMode) {
      setGuild(demoGuild || null);
      setProposals([
        { id: 1, description: 'Organize a guild dungeon raid this weekend', proposer: '0x70997...79C8', votesFor: 2, votesAgainst: 0, deadline: Math.floor(Date.now()/1000) + 86400, executed: false },
      ]);
      return;
    }
    if (!contracts || !account || !character) return;
    try {
      const guildId = await contracts.guildManager.playerGuild(account);
      const numId = Number(guildId);
      if (numId > 0) {
        const g = await contracts.guildManager.getGuild(numId);
        setGuild({
          id: numId,
          name: g.name,
          leader: g.leader,
          treasury: ethers.formatEther(g.treasury),
          memberCount: Number(g.memberCount),
          createdAt: Number(g.createdAt),
        });

        const nextProposalId = Number(await contracts.guildManager.nextProposalId());
        const props = [];
        for (let i = 1; i <= nextProposalId; i++) {
          try {
            const p = await contracts.guildManager.getProposal(i);
            if (Number(p.guildId) === numId) {
              props.push({
                id: i,
                description: p.description,
                proposer: p.proposer,
                votesFor: Number(p.votesFor),
                votesAgainst: Number(p.votesAgainst),
                deadline: Number(p.deadline),
                executed: p.executed,
              });
            }
          } catch {}
        }
        setProposals(props);
      } else {
        setGuild(null);
        setProposals([]);
      }
    } catch (err) {
      console.error('Failed to load guild:', err);
    }
  }, [contracts, account, character, demoMode, demoGuild]);

  useEffect(() => {
    loadGuild();
  }, [loadGuild]);

  const handleCreate = () => {
    if (!guildName.trim()) return;
    if (demoMode) { onAction(() => {}); setGuildName(''); return; }
    onAction(async () => {
      const tx = await contracts.gameManager.createGuild(guildName);
      showNotification('Creating guild...');
      await tx.wait();
      showNotification('Guild created!');
      setGuildName('');
      await loadGuild();
    });
  };

  const handleJoin = () => {
    if (!joinId) return;
    if (demoMode) { onAction(() => {}); setJoinId(''); return; }
    onAction(async () => {
      const tx = await contracts.gameManager.joinGuild(parseInt(joinId));
      showNotification('Joining guild...');
      await tx.wait();
      showNotification('Joined guild!');
      setJoinId('');
      await loadGuild();
    });
  };

  const handleLeave = () => {
    if (demoMode) { onAction(() => {}); return; }
    onAction(async () => {
      const tx = await contracts.gameManager.leaveGuild();
      showNotification('Leaving guild...');
      await tx.wait();
      showNotification('Left guild.');
      await loadGuild();
    });
  };

  const handleDonate = () => {
    if (!donateAmount) return;
    if (demoMode) { onAction(() => {}); setDonateAmount(''); return; }
    onAction(async () => {
      const amount = ethers.parseEther(donateAmount);
      const tx = await contracts.gameManager.donateToGuild(amount);
      showNotification('Donating to treasury...');
      await tx.wait();
      showNotification('Donation complete!');
      setDonateAmount('');
      await loadGuild();
    });
  };

  const handleCreateProposal = () => {
    if (!proposalText.trim()) return;
    if (demoMode) { onAction(() => {}); setProposalText(''); return; }
    onAction(async () => {
      const tx = await contracts.gameManager.createProposal(proposalText);
      showNotification('Creating proposal...');
      await tx.wait();
      showNotification('Proposal created!');
      setProposalText('');
      await loadGuild();
    });
  };

  const handleVote = (proposalId, support) => {
    if (demoMode) { onAction(() => {}); return; }
    onAction(async () => {
      const tx = await contracts.gameManager.voteOnProposal(proposalId, support);
      showNotification('Voting...');
      await tx.wait();
      showNotification(`Vote cast: ${support ? 'For' : 'Against'}`);
      await loadGuild();
    });
  };

  if (!guild) {
    return (
      <div className="card guild-section">
        <h2>&#127984; Guild System</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Guilds provide persistent social structures with shared treasury and governance.
        </p>

        <h3>Create a Guild</h3>
        <input
          placeholder="Guild name..."
          value={guildName}
          onChange={(e) => setGuildName(e.target.value)}
          maxLength={32}
        />
        <button className="btn btn-primary" onClick={handleCreate} disabled={loading} style={{ width: '100%', marginBottom: 16 }}>
          Create Guild
        </button>

        <h3>Join a Guild</h3>
        <input
          placeholder="Guild ID..."
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          type="number"
        />
        <button className="btn btn-success" onClick={handleJoin} disabled={loading} style={{ width: '100%' }}>
          Join Guild
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <h2>&#127984; {guild.name}</h2>
        <div className="stat-row">
          <span className="label">Guild ID</span>
          <span className="value">#{guild.id}</span>
        </div>
        <div className="stat-row">
          <span className="label">Members</span>
          <span className="value">{guild.memberCount}</span>
        </div>
        <div className="stat-row">
          <span className="label">Treasury</span>
          <span className="value" style={{ color: 'var(--gold)' }}>{parseFloat(guild.treasury).toFixed(0)} Gold</span>
        </div>
        <div className="stat-row">
          <span className="label">Leader</span>
          <span className="value" style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {typeof guild.leader === 'string' && guild.leader.length > 10 ? `${guild.leader.slice(0, 6)}...${guild.leader.slice(-4)}` : guild.leader}
          </span>
        </div>

        <div className="guild-section" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder="Donate amount (gold)..."
              value={donateAmount}
              onChange={(e) => setDonateAmount(e.target.value)}
              type="number"
              style={{ marginBottom: 0 }}
            />
            <button className="btn btn-sm btn-warning" onClick={handleDonate} disabled={loading}>
              Donate
            </button>
          </div>
        </div>

        {guild.leader.toLowerCase() !== account.toLowerCase() && (
          <button className="btn btn-sm btn-danger" onClick={handleLeave} disabled={loading} style={{ marginTop: 12 }}>
            Leave Guild
          </button>
        )}
      </div>

      <div className="card guild-section">
        <h2>&#128220; Governance</h2>
        <div style={{ marginBottom: 12 }}>
          <input
            placeholder="Proposal description..."
            value={proposalText}
            onChange={(e) => setProposalText(e.target.value)}
          />
          <button className="btn btn-sm btn-primary" onClick={handleCreateProposal} disabled={loading}>
            Create Proposal
          </button>
        </div>

        {proposals.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No proposals yet.</p>
        ) : (
          proposals.map((p) => (
            <div key={p.id} style={{
              background: 'var(--bg-primary)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                Proposal #{p.id}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {p.description}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--accent-green)' }}>For: {p.votesFor}</span>
                <span style={{ color: 'var(--accent-red)' }}>Against: {p.votesAgainst}</span>
                {!p.executed && (
                  <>
                    <button className="btn btn-sm btn-success" onClick={() => handleVote(p.id, true)} disabled={loading}>
                      Vote For
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleVote(p.id, false)} disabled={loading}>
                      Vote Against
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default GuildPanel;
