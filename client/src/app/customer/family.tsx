import { View, SafeAreaView, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
import React, { useState } from "react";
import { commonStyles } from "@/styles/commonStyles";
import CustomText from "@/components/shared/CustomText";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/utils/Constants";
import { router } from "expo-router";

const FamilyProfile = () => {
    // Mock state for now
    const [members, setMembers] = useState([
        { id: '1', name: 'Spouse', phone: '+1234567890', relation: 'Partner' }
    ]);

    const handleAddMember = () => {
        Alert.alert("Coming Soon", "This feature is under development.");
    };

    return (
        <View style={commonStyles.container}>
            <SafeAreaView style={{ backgroundColor: '#fff' }} />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <CustomText variant="h5" fontFamily="Bold">Family Profile</CustomText>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={styles.banner}>
                    <Ionicons name="people" size={40} color={Colors.primary} />
                    <CustomText fontFamily="Bold" fontSize={18} style={{ marginTop: 10 }}>
                        Ride together, pay together
                    </CustomText>
                    <CustomText fontSize={14} color="#666" style={{ textAlign: 'center', marginTop: 5 }}>
                        Add family members to share ride details and payment methods safely.
                    </CustomText>
                </View>

                <CustomText fontFamily="Bold" fontSize={16} style={{ marginBottom: 15 }}>
                    Family Members
                </CustomText>

                {members.map((member) => (
                    <View key={member.id} style={styles.memberCard}>
                        <View style={styles.avatar}>
                            <Ionicons name="person" size={20} color="#fff" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 15 }}>
                            <CustomText fontFamily="Medium">{member.name}</CustomText>
                            <CustomText fontSize={12} color="#666">{member.phone} • {member.relation}</CustomText>
                        </View>
                        <TouchableOpacity>
                             <Ionicons name="ellipsis-vertical" size={20} color="#ccc" />
                        </TouchableOpacity>
                    </View>
                ))}

                <TouchableOpacity style={styles.addButton} onPress={handleAddMember}>
                    <Ionicons name="add-circle" size={24} color={Colors.primary} />
                    <CustomText fontFamily="Medium" color={Colors.primary} style={{ marginLeft: 10 }}>
                        Add Family Member
                    </CustomText>
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3
    },
    backButton: {
        padding: 5
    },
    banner: {
        backgroundColor: '#fff5e6',
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 30
    },
    memberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#f0f0f0'
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ccc',
        justifyContent: 'center',
        alignItems: 'center'
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        marginTop: 10,
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: 12,
        borderStyle: 'dashed'
    }
});

export default FamilyProfile;
