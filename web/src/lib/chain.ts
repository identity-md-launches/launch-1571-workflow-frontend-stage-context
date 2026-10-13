import type { EIP1193Provider } from 'viem';
import type { WalletAddChain } from '../config';

type RpcError = { code?: number; message?: string; data?: { originalError?: { code?: number } } };

/**
 * Switches the wallet to the configured chain. When the wallet does not know the chain
 * (error 4902 or an "unrecognized chain" message), offers wallet_addEthereumChain with the
 * handoff's exact parameters and switches again.
 */
export async function switchOrAddChain(provider: EIP1193Provider, chainIdHex: `0x${string}`, add: WalletAddChain | null): Promise<void> {
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
    return;
  } catch (err) {
    const e = err as RpcError;
    const code = e?.code ?? e?.data?.originalError?.code;
    const unknown = code === 4902 || /unrecognized|not added|unknown chain|try adding/i.test(e?.message ?? '');
    if (!unknown || !add) throw err;
  }
  await provider.request({ method: 'wallet_addEthereumChain', params: [add] });
  await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
}
