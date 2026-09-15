'use client';

import { useEffect, useState } from 'react';
import { getLocalGameManager } from '@/app/lib/local/GameManager';
import { useAuth } from './AuthProvider';

interface BotStatus {
  name: string;
  isActive: boolean;
  lastTradeAt: number;
  cooldownRemaining: number;
}

export default function LocalMarketManager() {
  const { session } = useAuth();
  const [botStates, setBotStates] = useState<BotStatus[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (!session) return;

    const manager = getLocalGameManager();
    const gameIds = ['E5hY08DB', 'cfjkpb0h', 'VGbBBoJA', 'eS24tECQ'];

    setIsMonitoring(true);
    manager.startMonitoring(
      gameIds,
      (game) => console.log('Game:', game.id),
      (err) => console.error('Error:', err)
    );

    const interval = setInterval(() => setBotStates(manager.getBotStates()), 1000);
    return () => {
      manager.stopMonitoring();
      clearInterval(interval);
    };
  }, [session]);

  if (!session) return <div>Sign in to enable local bots</div>;

  return (
    <div style={{ margin: '20px 0', padding: '20px', border: '1px solid #ddd', borderRadius: '12px' }}>
      <h3>🎮 Local Browser Manager</h3>
      <div>Status: {isMonitoring ? '✓ Monitoring' : '○ Idle'}</div>
      <div style={{ marginTop: '12px' }}>
        {botStates.map(bot => (
          <div key={bot.name} style={{ padding: '8px', marginBottom: '4px', background: '#f8f9fa', borderRadius: '6px' }}>
            <strong>{bot.name}</strong>: {bot.isActive ? '🟢 Active' : '⚫ Inactive'}
            {bot.cooldownRemaining > 0 && ` (Cooldown: ${Math.ceil(bot.cooldownRemaining / 1000)}s)`}
          </div>
        ))}
      </div>
    </div>
  );
}
