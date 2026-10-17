export function isWalletCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.startsWith('[ABORTED_ERROR]:')
  );
}

export function walletErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  )
    return error.message;
  return 'The request failed. Please try again.';
}
