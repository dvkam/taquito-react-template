import { Buffer } from 'buffer';
import type { PoolSnapshot } from './pool-protocol';

// Protocol layout parser, independent of the SDK's forger. Used only by the local experiment.
export function readOrderTransaction(hex: string) {
  const bytes = Buffer.from(hex, 'hex');
  const spendsLength = bytes.readUInt32BE(0);
  const outputsLengthOffset = 4 + spendsLength;
  const outputsEnd = outputsLengthOffset + 4 + bytes.readUInt32BE(outputsLengthOffset);
  let offset = outputsLengthOffset + 4;
  const outputs: PoolSnapshot['diff']['commitments_and_ciphertexts'] = [];
  const slices: { start: number; end: number }[] = [];
  while (offset < outputsEnd) {
    const start = offset;
    const commitment = bytes.subarray(offset, offset + 32).toString('hex');
    offset += 32 + 192;
    const cv = bytes.subarray(offset, offset + 32).toString('hex');
    offset += 32;
    const epk = bytes.subarray(offset, offset + 32).toString('hex');
    offset += 32;
    const payloadLength = bytes.readUInt32BE(offset);
    offset += 4;
    if (payloadLength !== 79) throw new Error('Expected the memo-8 ciphertext length');
    const payload_enc = bytes.subarray(offset, offset + payloadLength).toString('hex');
    offset += payloadLength;
    const nonce_enc = bytes.subarray(offset, offset + 24).toString('hex');
    offset += 24;
    const payload_out = bytes.subarray(offset, offset + 80).toString('hex');
    offset += 80;
    const nonce_out = bytes.subarray(offset, offset + 24).toString('hex');
    offset += 24;
    outputs.push([commitment, { cv, epk, payload_enc, nonce_enc, payload_out, nonce_out }]);
    slices.push({ start, end: offset });
  }
  if (offset !== outputsEnd || bytes.length < offset + 108)
    throw new Error('Invalid transaction layout');
  const balance = bytes.readBigInt64BE(offset + 64).toString();
  const root = bytes.subarray(offset + 72, offset + 104).toString('hex');
  const boundLength = bytes.readUInt32BE(offset + 104);
  if (bytes.length !== offset + 108 + boundLength) throw new Error('Invalid bound data length');
  return {
    outputs,
    slices,
    balance,
    root,
    boundData: bytes.subarray(offset + 108).toString('hex'),
  };
}
