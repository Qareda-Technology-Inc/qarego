import React, { FC, useState, useEffect, useRef } from "react";
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomText from "./CustomText";
import { Colors } from "@/utils/Constants";
import { useWS } from "@/service/WSProvider";
// import * as ImagePicker from "expo-image-picker";

interface Message {
  _id?: string;
  senderId: string;
  senderName?: string;
  text?: string;
  image?: string;
  timestamp: Date;
  isQuickMessage?: boolean;
}

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  rideId: string;
  otherUserId: string;
  otherUserName?: string;
  otherUserPhone?: string;
  currentUserId: string;
  currentUserName?: string;
  maskedPhone?: string;
}

const QUICK_MESSAGES = [
  "I'm here",
  "On my way",
  "Please wait",
  "I'll be there in 5 minutes",
  "Can't find you",
  "See you soon",
];

const ChatModal: FC<ChatModalProps> = ({
  visible,
  onClose,
  rideId,
  otherUserId,
  otherUserName,
  otherUserPhone,
  currentUserId,
  currentUserName,
  maskedPhone,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const { emit, on, off } = useWS();

  useEffect(() => {
    if (visible && rideId) {
      // Join chat room
      emit("joinChat", rideId);

      // Load chat history
      emit("getChatHistory", rideId);

      // Listen for new messages
      on("chatMessage", handleNewMessage);
      on("chatHistory", handleChatHistory);

      return () => {
        off("chatMessage");
        off("chatHistory");
        emit("leaveChat", rideId);
      };
    }
  }, [visible, rideId, emit, on, off]);

  const handleChatHistory = (history: Message[]) => {
    setMessages(history || []);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  };

  const handleNewMessage = (message: Message) => {
    // Avoid duplicate on sender: we already added optimistically
    if (message.senderId === currentUserId) return;
    setMessages((prev) => [...prev, message]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendMessage = (text?: string, image?: string) => {
    if (!text && !image) return;

    const message: Message = {
      senderId: currentUserId,
      senderName: currentUserName,
      text,
      image,
      timestamp: new Date(),
    };

    emit("sendChatMessage", {
      rideId,
      message,
    });

    // Optimistically add message
    setMessages((prev) => [...prev, message]);
    setInputText("");
    setShowQuickMessages(false);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendQuickMessage = (text: string) => {
    sendMessage(text);
  };

  const pickImage = async () => {
    Alert.alert(
      "Image Sharing",
      "Image sharing will be available after installing expo-image-picker. Run: npx expo install expo-image-picker"
    );
    // TODO: Uncomment after installing expo-image-picker
    // try {
    //   const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    //   if (status !== "granted") {
    //     Alert.alert("Permission needed", "Please grant camera roll permissions");
    //     return;
    //   }

    //   const result = await ImagePicker.launchImageLibraryAsync({
    //     mediaTypes: ImagePicker.MediaTypeOptions.Images,
    //     allowsEditing: true,
    //     quality: 0.8,
    //     base64: true,
    //   });

    //   if (!result.canceled && result.assets[0]) {
    //     const imageUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
    //     sendMessage(undefined, imageUri);
    //   }
    // } catch (error) {
    //   console.log("Error picking image:", error);
    //   Alert.alert("Error", "Failed to pick image");
    // }
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCall = () => {
    if (otherUserPhone) {
      Linking.openURL(`tel:${otherUserPhone.replace(/\s/g, "")}`);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerInfo}>
              <View style={styles.avatar}>
                <Ionicons name="person" size={26} color={Colors.primary} />
              </View>
              <View style={styles.headerText}>
                <CustomText fontFamily="SemiBold" fontSize={17}>
                  {otherUserName || "Contact"}
                </CustomText>
                {maskedPhone ? (
                  <CustomText fontSize={13} color="#666">
                    {maskedPhone}
                  </CustomText>
                ) : null}
              </View>
            </View>
            <View style={styles.headerActions}>
              {otherUserPhone ? (
                <TouchableOpacity onPress={handleCall} style={styles.callButton}>
                  <Ionicons name="call" size={22} color="#fff" />
                  <CustomText fontSize={12} fontFamily="Medium" style={styles.callButtonText}>
                    Call
                  </CustomText>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={26} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={48} color="#ddd" />
                <CustomText fontSize={15} color="#999" style={styles.emptyChatText}>
                  No messages yet. Say hello!
                </CustomText>
              </View>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.senderId === currentUserId;
                return (
                  <View
                    key={msg._id ?? `msg-${index}`}
                    style={[
                      styles.messageWrapper,
                      isMe ? styles.myMessageWrapper : styles.otherMessageWrapper,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        isMe ? styles.myMessage : styles.otherMessage,
                      ]}
                    >
                      {msg.image ? (
                        <Image
                          source={{ uri: msg.image }}
                          style={styles.messageImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <CustomText
                          fontSize={15}
                          style={isMe ? styles.myMessageText : styles.otherMessageText}
                        >
                          {msg.text}
                        </CustomText>
                      )}
                      <CustomText
                        fontSize={11}
                        style={[
                          styles.messageTime,
                          isMe ? styles.myMessageTime : styles.otherMessageTime,
                        ]}
                      >
                        {formatTime(msg.timestamp)}
                      </CustomText>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Quick Messages */}
          {showQuickMessages && (
            <View style={styles.quickMessagesContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {QUICK_MESSAGES.map((msg, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickMessageButton}
                    onPress={() => sendQuickMessage(msg)}
                  >
                    <CustomText fontSize={12}>{msg}</CustomText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input Area */}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              onPress={() => setShowQuickMessages(!showQuickMessages)}
              style={styles.quickButton}
            >
              <Ionicons
                name={showQuickMessages ? "close" : "chatbubbles"}
                size={20}
                color={Colors.primary}
              />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />

            <TouchableOpacity onPress={pickImage} style={styles.attachButton}>
              <Ionicons name="image-outline" size={20} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => sendMessage(inputText)}
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              disabled={!inputText.trim()}
            >
              <Ionicons
                name="send"
                size={20}
                color={inputText.trim() ? "#fff" : "#ccc"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: 44,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fafafa",
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  headerText: {
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22c55e",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  callButtonText: {
    color: "#fff",
  },
  closeButton: {
    padding: 6,
  },
  emptyChat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyChatText: {
    marginTop: 12,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 10,
  },
  messageWrapper: {
    marginBottom: 10,
  },
  myMessageWrapper: {
    alignItems: "flex-end",
  },
  otherMessageWrapper: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessage: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: "#e8e8e8",
    borderBottomLeftRadius: 4,
  },
  myMessageText: {
    color: "#fff",
  },
  otherMessageText: {
    color: Colors.text,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 5,
  },
  messageTime: {
    marginTop: 4,
  },
  myMessageTime: {
    color: "rgba(255,255,255,0.7)",
    textAlign: "right",
  },
  otherMessageTime: {
    color: "#999",
  },
  quickMessagesContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    maxHeight: 64,
    backgroundColor: "#f9f9f9",
  },
  quickMessageButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fafafa",
  },
  quickButton: {
    padding: 10,
    marginRight: 4,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  attachButton: {
    padding: 8,
    marginLeft: 5,
  },
  sendButton: {
    padding: 8,
    marginLeft: 5,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#f0f0f0",
  },
});

export default ChatModal;
