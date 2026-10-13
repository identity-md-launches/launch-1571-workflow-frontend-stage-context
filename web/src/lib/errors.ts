import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, InsufficientFundsError } from 'viem';

const MESSAGES: Record<string, string> = {
  BelowMinimumBet: 'Your bet is below the current minimum.',
  BettingClosed: 'Betting for this round has closed.',
  BettingStillOpen: 'Betting is still open; wait for the lock time.',
  CancellationNotAllowed: 'This round cannot be cancelled right now.',
  CannotSwitchSide: 'You already backed the other cat in this round.',
  EnforcedPause: 'New rounds are paused.',
  ExpectedPause: 'The game is not paused.',
  InsufficientVrfPayment: 'The randomness fee sent was too low. Try again with the refreshed quote.',
  InvalidAddress: 'That address is not allowed.',
  InvalidCats: 'Pick two different cats from the roster.',
  InvalidSetting: 'That value is outside the allowed range.',
  InvalidSide: 'Pick RED or BLUE.',
  NoRounds: 'No round has been opened yet.',
  NothingToClaim: 'There is nothing to claim for this round.',
  NothingToWithdraw: 'You have no credit to withdraw.',
  OwnableUnauthorizedAccount: 'Only the owner can do that.',
  PreviousRoundOpen: 'A round is already open.',
  TransferFailed: 'The ETH transfer failed.',
  UnauthorizedKeeper: 'Only the owner or keeper can do that.',
  UnknownRound: 'That round does not exist.',
  WrapperUnavailable: 'The Chainlink VRF wrapper is unavailable.',
  WrongStatus: 'The round is not in the right state for that.',
};

/** Rule 7 of the frontend-ux guide: translate reverts and wallet errors to plain language. */
export function describeError(e: unknown): string {
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return 'You rejected the request in your wallet.';
    if (e.walk((x) => x instanceof InsufficientFundsError)) return 'Your wallet does not have enough ETH for this transaction and its gas.';
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (revert?.data?.errorName) {
      return MESSAGES[revert.data.errorName] ?? `The contract rejected this: ${revert.data.errorName}.`;
    }
    const short = e.shortMessage || e.message;
    if (/user rejected|user denied/i.test(short)) return 'You rejected the request in your wallet.';
    if (/chain mismatch|does not match the target chain/i.test(short)) return 'Your wallet is on a different network.';
    return short;
  }
  if (e && typeof e === 'object' && 'message' in e) {
    const m = String((e as { message: unknown }).message);
    if (/user rejected|user denied/i.test(m)) return 'You rejected the request in your wallet.';
    return m;
  }
  return 'Something went wrong.';
}
