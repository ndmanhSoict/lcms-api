import crypto from 'node:crypto';
import qs from 'qs';

export type VnpayParams = Record<string, string | number | null | undefined>;

export function formatVnpayDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

export function sortVnpayParams(params: VnpayParams) {
  const sorted: Record<string, string> = {};
  const keys = Object.keys(params)
    .filter(key => params[key] !== undefined && params[key] !== null && String(params[key]) !== '')
    .map(key => encodeURIComponent(key))
    .sort();

  keys.forEach(encodedKey => {
    const originalValue = params[encodedKey];
    if (originalValue !== undefined && originalValue !== null && String(originalValue) !== '') {
      sorted[encodedKey] = encodeURIComponent(String(originalValue)).replace(/%20/g, '+');
    }
  });

  return sorted;
}

export function stringifyVnpayParams(params: VnpayParams) {
  const sortedParams = sortVnpayParams(params);
  return qs.stringify(sortedParams, { encode: false });
}

export function signVnpayParams(params: VnpayParams, hashSecret: string) {
  const signData = stringifyVnpayParams(params);
  return crypto.createHmac('sha512', hashSecret).update(signData, 'utf8').digest('hex');
}

export function verifyVnpayChecksum(params: VnpayParams, hashSecret: string) {
  const secureHash = String(params.vnp_SecureHash ?? '');
  const dataToSign = { ...params };
  delete dataToSign.vnp_SecureHash;
  delete dataToSign.vnp_SecureHashType;
  const signed = signVnpayParams(dataToSign, hashSecret);
  return secureHash.toLowerCase() === signed.toLowerCase();
}
