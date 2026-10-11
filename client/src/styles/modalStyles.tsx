import { Colors } from "@/utils/Constants";
import { StyleSheet } from "react-native";

// Map picker sheet: same yellow primary button, ink text and light surfaces as the booking flow.
export const modalStyles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: '#fff'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    headerSide: {
        width: 36,
        height: 36,
    },
    closeButton: {
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerText: {
        flex: 1,
        textAlign: 'center',
        color: Colors.text,
    },
    footerContainer: {
        backgroundColor: '#fff',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowColor: '#0f172a',
        elevation: 10,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 28,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        marginTop: -16,
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 12,
        paddingHorizontal: 12,
    },
    addressText: {
        flex: 1,
        color: Colors.text,
    },
    buttonContainer: {
        marginTop: 12,
    },
    button: {
        backgroundColor: Colors.primary,
        borderRadius: 14,
        paddingVertical: 15,
        justifyContent: 'center',
        alignItems: 'center'
    },
    buttonText: {
        color: Colors.text,
    },
    searchContainer: {
        backgroundColor: '#f8fafc',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        marginHorizontal: 16,
        marginVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    input: {
        flex: 1,
        marginLeft: 8,
        height: 44,
        color: Colors.text,
    }
})
