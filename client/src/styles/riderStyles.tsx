import { Colors, screenHeight } from "@/utils/Constants";
import { StyleSheet } from "react-native";
import { DS } from "@/theme/designSystem";

export const riderStyles = StyleSheet.create({
    headerContainer: {
        backgroundColor: DS.color.surface,
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: DS.color.border,
    },
    emptyImage: {
        width: 120,
        height: 120,
        resizeMode: "contain",
        transform: [{ scaleX: -1 }],
        marginVertical: 15
    },
    toggleContainer: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        minHeight: 44,
        borderWidth: 1,
        borderRadius: 100,
        flexDirection: 'row',
        borderColor: DS.color.border,
        alignItems: 'center',
        gap: 8,
    },
    reliabilityBanner: {
        marginHorizontal: 10,
        marginTop: 8,
        padding: 12,
        borderRadius: 10,
        backgroundColor: "#fef3c7",
        borderWidth: 1,
        borderColor: "#fcd34d",
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: DS.color.bg,
        paddingTop: screenHeight * 0.2
    },
    icon: {
        width: 40,
        height: 40,
        resizeMode: 'contain'
    },
    earningContainer: {
        padding: 10,
        paddingVertical: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: "#1E293B"
    }
})

export const orderStyles = StyleSheet.create({
    flexRowBase: {
        gap: 10,
        flexDirection: 'row',
        alignItems: 'baseline',
        marginVertical: 5
    },

    continuousLine: {
        width: 2,
        height: '100%',
        position: "absolute",
        top: 12,
        backgroundColor: Colors.secondary,
        alignSelf: 'center',
        marginLeft: 2
    },
    borderLine: {
        borderLeftWidth: 1,
        paddingLeft: 12,
        borderLeftColor: Colors.secondary
    },
    label: {
        opacity: 0.65,
        marginVertical: 2
    },
    infoText: {
        width: '96%',
    },
    dropHollowCircle: {
        borderWidth: 2,
        top: 1,
        borderColor: "#F16485",
        padding: 3,
        borderRadius: 100
    },
    pickupHollowCircle: {
        borderWidth: 2,
        top: 1,
        borderColor: "#158A58",
        padding: 3,
        borderRadius: 100
    },
    container: {
        padding: 12,
        borderRadius: 14,
        backgroundColor: DS.color.surface,
        borderWidth: 1,
        borderColor: DS.color.border,
        ...DS.shadow.card,
        marginHorizontal: 10,
        marginTop: 10
    },
    bestOfferCard: {
        borderColor: "#22C55E",
        borderWidth: 1.5,
        shadowColor: "#16A34A",
        shadowOpacity: 0.18,
        elevation: 4,
    },
    rankHint: {
        color: "#16A34A",
        marginBottom: 6,
        marginTop: -2,
    },
    bestOfferBadge: {
        position: "absolute",
        right: 10,
        top: -10,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#16A34A",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        zIndex: 3,
    },
    flexRowEnd: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 10,
        gap: 10
    },
    rideIcon: {
        width: 30,
        height: 30,
        resizeMode: "contain"
    },
    locationsContainer: {
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: Colors.secondary,
        marginTop: 10
    },
    offerTypeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },
    statsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 8,
    },
    statChip: {
        flex: 1,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: DS.color.border,
    },
    statValue: {
        color: "#111827",
    },
    infoPanel: {
        marginTop: 8,
        padding: 10,
        borderRadius: 10,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: DS.color.border,
    }
})
