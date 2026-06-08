import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  Linking,
} from "react-native";
import React, { FC, memo, useEffect, useRef, useState } from "react";
import { modalStyles } from "@/styles/modalStyles";
import MapView, { Region } from "react-native-maps";
import { useUserStore } from "@/store/userStore";
import {
  getLatLong,
  getPlacesSuggestions,
  reverseGeocode,
} from "@/utils/mapUtils";
import { getCurrentLocationAsync } from "@/utils/locationUtils";
import LocationItem from "./LocationItem";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { RFValue } from "react-native-responsive-fontsize";
import { customMapStyle, indiaIntialRegion } from "@/utils/CustomMap";
import { mapStyles } from "@/styles/mapStyles";

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  selectedLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  onSelectLocation: (location: any) => void;
}

const MapPickerModal: FC<MapPickerModalProps> = ({
  visible,
  selectedLocation,
  onClose,
  title,
  onSelectLocation,
}) => {
  const mapRef = useRef<MapView>(null);
  const [text, setText] = useState("");
  const { location } = useUserStore();
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState<Region | null>(null);
  const [locations, setLocations] = useState([]);
  const textInputRef = useRef<TextInput>(null);

  const fetchLocation = async (query: string) => {
    if (query?.length > 4) {
      const data = await getPlacesSuggestions(query);
      setLocations(data);
    } else {
      setLocations([]);
    }
  };

  useEffect(() => {
    if (!visible) return;
    if (selectedLocation?.latitude != null && selectedLocation?.longitude != null) {
      setAddress(selectedLocation?.address ?? "");
      const reg = {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
      setRegion(reg);
      mapRef?.current?.fitToCoordinates(
        [{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }],
        { edgePadding: { top: 50, left: 50, bottom: 50, right: 50 }, animated: true }
      );
    } else {
      setAddress("");
      setRegion({
        latitude: location?.latitude ?? indiaIntialRegion.latitude,
        longitude: location?.longitude ?? indiaIntialRegion.longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      });
    }
  }, [visible, selectedLocation, mapRef, location?.latitude, location?.longitude]);

  const addLocation = async (item: {
    place_id: string;
    title?: string;
    description?: string;
  }) => {
    const data = await getLatLong(item.place_id, {
      title: item.title,
      description: item.description,
    });
    if (data) {
      setRegion({
        latitude: data.latitude,
        longitude: data.longitude,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      });
      setAddress(data.address);
    }
    textInputRef.current?.blur();
    setText("");
  };

  const renderLocations = ({ item }: any) => {
    return (
      <LocationItem item={item} onPress={() => addLocation(item)} />
    );
  };

  const handleRegionChangeComplete = async (newRegion: Region) => {
    try {
      const address = await reverseGeocode(
        newRegion?.latitude,
        newRegion?.longitude
      );
      setRegion(newRegion);
      setAddress(address);
    } catch (error) {
      console.log(error);
    }
  };

  const handleGpsButtonPress = async () => {
    const result = await getCurrentLocationAsync();
    if (!result.ok) {
      Alert.alert(
        "Location unavailable",
        result.message,
        result.canOpenSettings
          ? [
              { text: "Cancel", style: "cancel" },
              { text: "Open Settings", onPress: () => Linking.openSettings() },
            ]
          : [{ text: "OK" }]
      );
      return;
    }
    const { latitude, longitude } = result;
    mapRef.current?.fitToCoordinates([{ latitude, longitude }], {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
    try {
      const address = await reverseGeocode(latitude, longitude);
      setAddress(address);
    } catch {
      setAddress("");
    }
    setRegion({
      latitude,
      longitude,
      latitudeDelta: 0.5,
      longitudeDelta: 0.5,
    });
  };

  return (
    <Modal
      animationType="slide"
      visible={visible}
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={modalStyles?.modalContainer}>
        <Text style={modalStyles?.centerText}>Select {title}</Text>

        <TouchableOpacity onPress={onClose}>
          <Text style={modalStyles?.cancelButton}>Cancel</Text>
        </TouchableOpacity>

        <View style={modalStyles.searchContainer}>
          <Ionicons name="search-outline" size={RFValue(16)} color="#777" />
          <TextInput
            ref={textInputRef}
            style={modalStyles?.input}
            placeholder="Search address"
            placeholderTextColor="#aaa"
            value={text}
            onChangeText={(e) => {
              setText(e);
              fetchLocation(e);
            }}
          />
        </View>

        {text !== "" ? (
          <FlatList
            ListHeaderComponent={
              <View>
                {text.length > 4 ? null : (
                  <Text style={{ marginHorizontal: 16 }}>
                    Enter at least 4 characters to search
                  </Text>
                )}
              </View>
            }
            data={locations}
            renderItem={renderLocations}
            keyExtractor={(item: any) => item.place_id}
            initialNumToRender={5}
            windowSize={5}
          />
        ) : (
          <>
            <View style={{ flex: 1, width: "100%" }}>
              <MapView
                ref={mapRef}
                maxZoomLevel={16}
                minZoomLevel={12}
                pitchEnabled={false}
                onRegionChangeComplete={handleRegionChangeComplete}
                style={{ flex: 1 }}
                initialRegion={{
                  latitude:
                    region?.latitude ??
                    selectedLocation?.latitude ??
                    location?.latitude ??
                    indiaIntialRegion?.latitude,
                  longitude:
                    region?.longitude ??
                    selectedLocation?.longitude ??
                    location?.longitude ??
                    indiaIntialRegion?.longitude,
                  latitudeDelta: 0.5,
                  longitudeDelta: 0.5,
                }}
                provider="google"
                showsMyLocationButton={false}
                showsCompass={false}
                showsIndoors={false}
                showsIndoorLevelPicker={false}
                showsTraffic={false}
                showsScale={false}
                showsBuildings={false}
                showsPointsOfInterest={false}
                customMapStyle={customMapStyle}
                showsUserLocation={true}
              />
              <View style={mapStyles.centerMarkerContainer}>
                <Image
                  source={
                    title == "drop"
                      ? require("@/assets/icons/drop_marker.png")
                      : require("@/assets/icons/marker.png")
                  }
                  style={mapStyles.marker}
                />
              </View>
              <TouchableOpacity
                style={mapStyles.gpsButton}
                onPress={handleGpsButtonPress}
              >
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={RFValue(16)}
                  color="#3C75BE"
                />
              </TouchableOpacity>
            </View>

            <View style={modalStyles?.footerContainer}>
              <Text style={modalStyles.addressText} numberOfLines={2}>
                {address === "" ? "Getting address..." : address}
              </Text>
              <View style={modalStyles.buttonContainer}>
                <TouchableOpacity
                  style={modalStyles.button}
                  onPress={() => {
                    const lat = region?.latitude ?? selectedLocation?.latitude;
                    const lon = region?.longitude ?? selectedLocation?.longitude;
                    if (lat != null && lon != null) {
                      onSelectLocation({
                        type: title,
                        latitude: lat,
                        longitude: lon,
                        address: address || "",
                      });
                      onClose();
                    }
                  }}
                >
                  <Text style={modalStyles.buttonText}>Set Address</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

export default memo(MapPickerModal);
