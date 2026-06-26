import { Colors } from "@/utils/Constants";
import { StyleSheet } from "react-native";

export const homeStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    minHeight: "100%",
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    alignItems: "center",
  },
  sheetScroll: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
  },
  sheetView: {
    backgroundColor: "#fff",
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
});