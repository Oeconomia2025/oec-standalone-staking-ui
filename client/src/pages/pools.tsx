
import { useState } from "react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Lock,
  Clock,
  TrendingUp,
  Wallet,
  Plus,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { WalletConnect } from "@/components/wallet-connect";
import { useAccount } from "wagmi";

// Mock data for staking pools
const stakingPools = [
  {
    id: 1,
    name: "OEC Flexible Staking",
    apy: 15.0,
    lockPeriod: "Flexible",
    lockDays: 0,
    minStake: 100,
    maxStake: null,
    totalStaked: 2500000,
    participants: 1250,
    description: "Stake and unstake anytime with no lock period",
    featured: false,
    gradient: "from-cyan-500 to-blue-600"
  },
  {
    id: 2,
    name: "OEC 30-Day Lock",
    apy: 25.0,
    lockPeriod: "30 Days",
    lockDays: 30,
    minStake: 500,
    maxStake: null,
    totalStaked: 1800000,
    participants: 890,
    description: "Higher rewards with 30-day commitment",
    featured: true,
    gradient: "from-cyan-500 to-teal-600"
  },
  {
    id: 3,
    name: "OEC 60-Day Lock",
    apy: 40.0,
    lockPeriod: "60 Days",
    lockDays: 60,
    minStake: 1000,
    maxStake: null,
    totalStaked: 3200000,
    participants: 1580,
    description: "Premium returns for 60-day staking",
    featured: true,
    gradient: "from-purple-500 to-pink-600"
  },
  {
    id: 4,
    name: "OEC 90-Day Lock",
    apy: 60.0,
    lockPeriod: "90 Days",
    lockDays: 90,
    minStake: 2000,
    maxStake: 100000,
    totalStaked: 4500000,
    participants: 780,
    description: "Maximum APY with 90-day lock period",
    featured: false,
    gradient: "from-purple-600 to-purple-800"
  }
];

export default function Pools() {
  const { isConnected } = useAccount();
  const [expandedPool, setExpandedPool] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<{ [key: number]: string }>({});
  const [stakeAmount, setStakeAmount] = useState<{ [key: number]: string }>({});

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const toggleExpand = (poolId: number) => {
    setExpandedPool(expandedPool === poolId ? null : poolId);
    if (!activeTab[poolId]) {
      setActiveTab(prev => ({ ...prev, [poolId]: 'Stake' }));
    }
  };

  const setTab = (poolId: number, tab: string) => {
    setActiveTab(prev => ({ ...prev, [poolId]: tab }));
  };

  const handleStakeAmountChange = (poolId: number, value: string) => {
    setStakeAmount(prev => ({ ...prev, [poolId]: value }));
  };

  const getPercentageAmount = (poolId: number, percentage: number) => {
    const amount = stakeAmount[poolId] ? parseFloat(stakeAmount[poolId]) : 0;
    return (amount * percentage / 100).toString();
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Staking Pools
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground">
            Choose from various staking pools with different lock periods and APY rates
          </p>
        </div>

        {/* Wallet Connection Notice */}
        {!isConnected && (
          <Card className="crypto-card p-4 border mb-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Wallet className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-sm font-medium">Connect your wallet to start staking</p>
                  <p className="text-xs text-gray-400">You can browse pools without connection, but need a wallet to stake</p>
                </div>
              </div>
              <div className="max-w-xs">
                <WalletConnect />
              </div>
            </div>
          </Card>
        )}

        {/* Staking Pools */}
        <div className="space-y-2">
          {stakingPools.map((pool) => (
            <div key={pool.id} className="space-y-0">
              {/* Pool Header */}
              <div 
                className={`relative p-3 sm:p-4 bg-gradient-to-r ${pool.gradient} ${expandedPool === pool.id ? 'rounded-t-lg' : 'rounded-lg'} cursor-pointer transition-all duration-200 hover:shadow-lg`}
                onClick={() => toggleExpand(pool.id)}
              >
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                    <Lock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-semibold truncate">{pool.name}</h3>
                      <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm opacity-90">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">{pool.lockPeriod}</span>
                        <span className="hidden sm:inline">—</span>
                        <span className="hidden sm:inline">staked</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
                    <div className="text-right">
                      <Badge className="bg-white/20 text-white border-white/30 mb-1 text-xs sm:text-sm">
                        {pool.apy}% APY
                      </Badge>
                      <div className="text-xs sm:text-sm opacity-90">0 DDB</div>
                    </div>
                    {expandedPool === pool.id ? (
                      <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedPool === pool.id && (
                <Card className="rounded-t-none border-t-0 bg-gray-900/50 backdrop-blur-sm">
                  <div className="p-4 space-y-4">
                    {/* Navigation Tabs and Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex bg-gray-800 rounded-lg p-1 w-full sm:w-auto">
                        {['Stake', 'Unstake', 'Rewards'].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setTab(pool.id, tab)}
                            className={`flex-1 min-w-[80px] px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                              activeTab[pool.id] === tab
                                ? 'bg-slate-600 text-white shadow-sm'
                                : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
                        <Button variant="outline" size="sm" className="border-red-500 text-red-400 hover:bg-red-500/10 text-xs sm:text-sm">
                          Early Withdraw
                        </Button>
                        <Button variant="outline" size="sm" className="border-gray-500 text-gray-300 hover:bg-gray-500/10 text-xs sm:text-sm">
                          Exit (Withdraw + Claim)
                        </Button>
                      </div>
                    </div>

                    {/* Tab Content */}
                    {activeTab[pool.id] === 'Stake' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Left Side - Staking Interface */}
                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold">Amount to Stake</h4>
                          
                          <div className="relative">
                            <input
                              type="number"
                              placeholder="0"
                              value={stakeAmount[pool.id] || ''}
                              onChange={(e) => handleStakeAmountChange(pool.id, e.target.value)}
                              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-4 text-xl sm:text-2xl text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          {/* Percentage Buttons */}
                          <div className="grid grid-cols-4 gap-2">
                            {[25, 50, 75, 100].map((percentage) => (
                              <button
                                key={percentage}
                                onClick={() => handleStakeAmountChange(pool.id, getPercentageAmount(pool.id, percentage))}
                                className="py-2 px-2 sm:px-3 bg-gray-700 hover:bg-gray-600 rounded-md text-xs sm:text-sm font-medium transition-colors"
                              >
                                {percentage === 100 ? 'Max' : `${percentage}%`}
                              </button>
                            ))}
                          </div>

                          <p className="text-xs text-gray-400">
                            Min/Max are enforced by contract (if any). Ensure you've approved enough DDB.
                          </p>

                          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-base sm:text-lg font-semibold">
                            Stake
                          </Button>
                        </div>

                        {/* Right Side - Pool Information */}
                        <div className="space-y-4">
                          <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400 text-sm">Estimated Daily Rewards:</span>
                              <span className="font-semibold text-green-400 text-sm">0.00 DDB</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400 text-sm">Estimated Monthly Rewards:</span>
                              <span className="font-semibold text-green-400 text-sm">0.00 DDB</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400 text-sm">Lock Period:</span>
                              <span className="font-semibold text-sm">{pool.lockPeriod}</span>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Min Stake:</span>
                              <span>{formatNumber(pool.minStake)} OEC</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Total Staked:</span>
                              <span>{formatNumber(pool.totalStaked)} OEC</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Participants:</span>
                              <span>{pool.participants.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Unstake Tab Content */}
                    {activeTab[pool.id] === 'Unstake' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <h4 className="text-lg font-semibold">Amount to Unstake</h4>
                          
                          <div className="relative">
                            <input
                              type="number"
                              placeholder="0"
                              value={stakeAmount[pool.id] || ''}
                              onChange={(e) => handleStakeAmountChange(pool.id, e.target.value)}
                              className="w-full bg-gray-800 border border-gray-600 rounded-lg p-4 text-xl sm:text-2xl text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-4 gap-2">
                            {[25, 50, 75, 100].map((percentage) => (
                              <button
                                key={percentage}
                                onClick={() => handleStakeAmountChange(pool.id, getPercentageAmount(pool.id, percentage))}
                                className="py-2 px-2 sm:px-3 bg-gray-700 hover:bg-gray-600 rounded-md text-xs sm:text-sm font-medium transition-colors"
                              >
                                {percentage === 100 ? 'Max' : `${percentage}%`}
                              </button>
                            ))}
                          </div>

                          <p className="text-xs text-gray-400">
                            Early unstaking may apply penalties (see pool rules).
                          </p>

                          <Button className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 text-base sm:text-lg font-semibold">
                            Unstake
                          </Button>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400 text-sm">Estimated Daily Rewards:</span>
                              <span className="font-semibold text-green-400 text-sm">0.00 DDB</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400 text-sm">Estimated Monthly Rewards:</span>
                              <span className="font-semibold text-green-400 text-sm">0.00 DDB</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400 text-sm">Lock Period:</span>
                              <span className="font-semibold text-sm">{pool.lockPeriod}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Rewards Tab Content */}
                    {activeTab[pool.id] === 'Rewards' && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-4">
                          <div className="text-center space-y-4">
                            <div className="text-4xl sm:text-6xl font-bold text-green-400">0.00</div>
                            <div className="text-base sm:text-lg text-gray-400">DDB</div>
                            <div className="text-sm text-gray-500">Available Rewards</div>
                            
                            <Button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-base sm:text-lg font-semibold">
                              Claim Rewards
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400 text-sm">Total Earned:</span>
                              <span className="font-semibold text-sm">0.00 DDB</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400 text-sm">Next Reward:</span>
                              <span className="font-semibold text-sm">—</span>
                            </div>
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400 text-sm">Distribution:</span>
                              <span className="font-semibold text-sm">per block</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          ))}
        </div>

        {/* Pool Statistics */}
        <Card className="crypto-card p-4 sm:p-6 border">
          <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-crypto-green" />
            Pool Statistics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-crypto-blue">
                {formatNumber(stakingPools.reduce((sum, pool) => sum + pool.totalStaked, 0))}
              </div>
              <div className="text-xs sm:text-sm text-gray-400">Total Value Locked</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-crypto-green">
                {stakingPools.reduce((sum, pool) => sum + pool.participants, 0).toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-gray-400">Total Participants</div>
            </div>
            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-purple-400">
                {Math.max(...stakingPools.map(pool => pool.apy))}%
              </div>
              <div className="text-xs sm:text-sm text-gray-400">Highest APY</div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
