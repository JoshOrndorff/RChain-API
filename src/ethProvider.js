// @ts-check
// adapted from https://github.com/tgrospic/rnode-client-js/blob/e4d97ee436a9a35ed2fe7b6c3307d03e4e2e9612/src/eth/eth-wrapper.js
import { Base16 } from './codec.js';
const { freeze } = Object;

/**
 * "To notify sites of asynchronous injection,
 * MetaMask dispatches the ethereum#initialized event
 * on `window` immediately after the provider
 * has been set as `window.ethereum`."
 * -- https://github.com/MetaMask/detect-provider
 */
export const MetaMask = {
  initialized: 'ethereum#initialized',
};

/**
 * Metamask wrapper for Ethereum provider
 * https://metamask.github.io/metamask-docs/guide/ethereum-provider.html#methods-new-api
 *
 * @param {{ window: {
 *   ethereum?: MetaMaskProvider,
 *   addEventListener: typeof window.addEventListener,
 *   removeEventListener: typeof window.removeEventListener,
 * }}} io
 *
 * @typedef {{
 *   readonly isMetaMask: boolean,
 *   autoRefreshOnNetworkChange: boolean,
 *   request: (args: RequestArguments) => Promise<unknown>
 * }} MetaMaskProvider
 *
 * EIP-1193: Ethereum Provider JavaScript API
 * https://eips.ethereum.org/EIPS/eip-1193
 * @typedef {{
 *   readonly method: string;
 *   readonly params?: readonly unknown[] | object;
 * }} RequestArguments
 */
export function getEthProvider({ window }) {
  return new Promise((resolve) => {
    if (window.ethereum) {
      resolve(window.ethereum);
    }

    // eslint-disable-next-line no-use-before-define
    window.addEventListener(MetaMask.initialized, handle, { once: true });

    function handle() {
      window.removeEventListener(MetaMask.initialized, handle);
      const { ethereum } = window;
      if (!ethereum)
        throw new Error(
          `${MetaMask.initialized} event fired with window.ethereum not defined.`,
        );
      resolve(ethereum);
    }
  });
}

/**
 * @param {MetaMaskProvider} ethereum
 */
export function MetaMaskAccount(ethereum) {
  // https://docs.metamask.io/guide/ethereum-provider.html#properties
  ethereum.autoRefreshOnNetworkChange = false;

  return freeze({
    /**
     * Request an address selected in Metamask
     * - the first request will ask the user for permission
     * @returns { Promise<string> } ETH address in hex format
     */
    async ethereumAddress() {
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!Array.isArray(accounts))
        throw Error(
          `Ethereum RPC response is not a list of accounts (${accounts}).`,
        );

      return accounts[0];
    },

    /**
     * Ethereum personal signature
     * https://github.com/ethereum/go-ethereum/wiki/Management-APIs#personal_sign
     * @param {Iterable<number>} bytes
     * @param {string} ethAddr
     * @returns { Promise<string> } signature in hex format
     */
    async ethereumSign(bytes, ethAddr) {
      let data = `0x${Buffer.from([...bytes], 'utf8').toString('hex')}`;
      const sig = await ethereum.request({
        method: 'personal_sign',
        params: [data, ethAddr],
      });
      if (typeof sig !== 'string') throw new TypeError(typeof sig);
      return sig;
    },
  });
}
