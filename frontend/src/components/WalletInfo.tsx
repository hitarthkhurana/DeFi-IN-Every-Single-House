import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { Balance } from './Balance'

export function WalletInfo() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected)
    return (
      <div>
        <div>Connected to {address}</div>
        <Balance />
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    )

  return (
    <div>
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          type="button"
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  )
} 