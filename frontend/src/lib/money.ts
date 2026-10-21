/** Format a money amount with a tenant-supplied currency symbol. */
export const formatMoney = (
  amount: number | null | undefined,
  symbol = '₦'
): string =>
  `${symbol}${(amount ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

/** Nightly rate × nights — the reservation total rule from the spec. */
export const reservationTotal = (r: {
  rate: number;
  checkInDate: string | Date;
  checkOutDate: string | Date;
}): number => {
  const inMs = new Date(r.checkInDate).getTime();
  const outMs = new Date(r.checkOutDate).getTime();
  const nights = Math.max(1, Math.ceil((outMs - inMs) / 86400000));
  return Number(r.rate) * nights;
};
