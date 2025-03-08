import { useAccount, useBalance } from 'wagmi'

export function Balance() {
  const { address } = useAccount()
  const { data: balance } = useBalance({
    address: address,
  })

  if (!address) return <div>Connect your wallet first</div>

  return (
    <div>
      Balance: {balance?.formatted} {balance?.symbol}
    </div>
  )
} 