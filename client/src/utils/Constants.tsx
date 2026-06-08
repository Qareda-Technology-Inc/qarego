import { Dimensions } from "react-native";

export const screenHeight = Dimensions.get('screen').height;
export const screenWidth = Dimensions.get('screen').width;

/** Ghana Cedi - use this for all fare/price display */
export const CURRENCY_SYMBOL = "GH₵";

/**
 * Format amount as currency (e.g. "GH₵12.50").
 * Use for fares, prices, and any monetary value.
 */
export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount == null || Number.isNaN(amount)) return `${CURRENCY_SYMBOL}0.00`;
  return `${CURRENCY_SYMBOL}${Number(amount).toFixed(2)}`;
};

export enum Colors {
    primary = '#EDD228',
    background = '#fff',
    text = '#222',
    theme = '#CF551F',
    secondary = '#E5EBF5',
    tertiary = '#3C75BE',
    secondary_light='#F6F7F9',
    iosColor='#007AFF'
}

