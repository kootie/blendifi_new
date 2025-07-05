import { SorobanRpc, Contract } from '@stellar/stellar-sdk';
import { CONFIG } from '../lib/config';

export function useStellar() {
  const server = new SorobanRpc.Server(CONFIG.RPC_URL, { allowHttp: CONFIG.RPC_URL.startsWith('http://') });
  const contract = new Contract(CONFIG.BLEND_CONTRACT_ADDRESS);
  return { server, contract };
}