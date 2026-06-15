export const VIETNAM_MOBILE_PHONE_REGEX = /^(0[35789]\d{8}|\+84[35789]\d{8})$/;

export const VIETNAM_MOBILE_PHONE_MESSAGE =
  'Số điện thoại không đúng định dạng. Vui lòng nhập số di động Việt Nam gồm 10 số, ví dụ 0912345678 hoặc +84912345678';

export function normalizeVietnamPhone(value: unknown) {
  if (typeof value !== 'string') return undefined;

  const phone = value.trim();
  if (!phone) return undefined;

  return phone.startsWith('+84') ? `0${phone.slice(3)}` : phone;
}

