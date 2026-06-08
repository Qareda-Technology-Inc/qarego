
interface CustomButtonProps {
    title: string;
    loading?: boolean;
    onPress?: () => void
    disabled?: boolean
}

interface Country {
    name: string;
    code: string;
    dialCode: string;
    flag: string;
}

interface PhoneInputProps {
    value: string;
    onChangeText: (text: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    countryCode?: string;
    onCountryChange?: (country: Country) => void;
}

interface CustomTextProps {
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'h7' | 'h8';
    style?: any;
    fontSize?: number;
    children: React.ReactNode;
    fontFamily?: 'SemiBold' | 'Regular' | 'Bold' | 'Medium' | 'Light';
    numberOfLines?: number;
}

