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
  Linking,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomText from "./CustomText";
import { Colors } from "@/utils/Constants";
import { useWS } from "@/service/WSProvider";
import { reportChat, type ChatReportReason } from "@/service/rideService";

import { useConnectivity } from "@/service/connectivity";
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

const REPORT_REASONS: { key: ChatReportReason; label: string }[] = [
  { key: "ABUSIVE", label: "Abusive or offensive messages" },
  { key: "HARASSMENT", label: "Harassment or unwanted contact" },
  { key: "SAFETY", label: "I feel unsafe" },
  { key: "SPAM", label: "Spam or scam" },
  { key: "OTHER", label: "Something else" },
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
  const insets = useSafeAreaInsets();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ChatReportReason | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [reportError, setReportError] = useState<string | null>(null);

  const openReport = () => {
    setReportReason(null);
    setReportDetails("");
    setReportError(null);
    setReportStatus("idle");
    setReportOpen(true);
  };

  const submitReport = async () => {
    if (!reportReason || reportStatus === "sending") return;
    setReportStatus("sending");
    setReportError(null);
    try {
      await reportChat(rideId, reportReason, reportDetails.trim() || undefined);
      setReportStatus("sent");
    } catch (e: any) {
      setReportError(e?.message || "Could not send the report. Please try again.");
      setReportStatus("idle");
    }
  };

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

  const online = useConnectivity((st) => st.online);
  const sendMessage = (text?: string, image?: string) => {
    if (!text && !image) return;
    // Offline sends would sit in a queue looking delivered; keep the text until we're back.
    if (!online) return;

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
              <TouchableOpacity
                onPress={openReport}
                style={styles.reportButton}
                accessibilityRole="button"
                accessibilityLabel={`Report ${otherUserName || "this person"}`}
                hitSlop={6}
              >
                <Ionicons name="flag-outline" size={22} color="#dc2626" />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={26} color={Colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {reportOpen ? (
            <ScrollView
              style={styles.reportPanel}
              contentContainerStyle={[styles.reportContent, { paddingBottom: Math.max(insets.bottom, 0) + 32 }]}
              keyboardShouldPersistTaps="handled"
            >
              {reportStatus === "sent" ? (
                <View style={styles.reportDone}>
                  <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
                  <CustomText fontFamily="SemiBold" fontSize={17} style={styles.reportDoneTitle}>
                    Thanks for telling us
                  </CustomText>
                  <CustomText fontSize={14} color="#666" style={styles.reportDoneText}>
                    Our team will look at this chat and take action. If you are in danger, call 112 now.
                  </CustomText>
                  <TouchableOpacity onPress={() => setReportOpen(false)} style={styles.reportSubmit}>
                    <CustomText fontFamily="SemiBold" fontSize={15} color="#fff">
                      Back to chat
                    </CustomText>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <CustomText fontFamily="SemiBold" fontSize={17}>
                    Report {otherUserName || "this person"}
                  </CustomText>
                  <CustomText fontSize={14} color="#666" style={styles.reportIntro}>
                    Our team will read this chat and check what happened. We won't tell {otherUserName || "them"} you reported them.
                  </CustomText>
                  {REPORT_REASONS.map((r) => {
                    const selected = reportReason === r.key;
                    return (
                      <TouchableOpacity
                        key={r.key}
                        onPress={() => setReportReason(r.key)}
                        style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <Ionicons
                          name={selected ? "radio-button-on" : "radio-button-off"}
                          size={20}
                          color={selected ? "#dc2626" : "#999"}
                        />
                        <CustomText fontSize={15} style={styles.reasonText}>
                          {r.label}
                        </CustomText>
                      </TouchableOpacity>
                    );
                  })}
                  <TextInput
                    style={styles.reportInput}
                    placeholder="Tell us more (optional)"
                    value={reportDetails}
                    onChangeText={setReportDetails}
                    multiline
                    maxLength={1000}
                  />
                  {reportError ? (
                    <CustomText fontSize={13} color="#dc2626" style={styles.reportErrorText}>
                      {reportError}
                    </CustomText>
                  ) : null}
                  <TouchableOpacity
                    onPress={submitReport}
                    disabled={!reportReason || reportStatus === "sending"}
                    style={[styles.reportSubmit, (!reportReason || reportStatus === "sending") && styles.reportSubmitDisabled]}
                  >
                    {reportStatus === "sending" ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <CustomText fontFamily="SemiBold" fontSize={15} color="#fff">
                        Send report
                      </CustomText>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setReportOpen(false)} style={styles.reportCancel}>
                    <CustomText fontSize={15} color="#666">
                      Cancel
                    </CustomText>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          ) : null}

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={[styles.messagesContainer, reportOpen && styles.hidden]}
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
          {showQuickMessages && !reportOpen && (
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
          <View
            style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 10) }, reportOpen && styles.hidden]}
          >
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
              placeholder={online ? "Type a message..." : "Waiting for connection…"}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              onPress={() => sendMessage(inputText)}
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              disabled={!inputText.trim() || !online}
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
  reportButton: {
    padding: 6,
  },
  hidden: {
    display: "none",
  },
  reportPanel: {
    flex: 1,
  },
  reportContent: {
    padding: 20,
    paddingBottom: 32,
  },
  reportIntro: {
    marginTop: 6,
    marginBottom: 16,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 14,
    marginBottom: 10,
  },
  reasonRowSelected: {
    borderColor: "#dc2626",
    backgroundColor: "#fef2f2",
  },
  reasonText: {
    flex: 1,
  },
  reportInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 90,
    fontSize: 15,
    textAlignVertical: "top",
    marginTop: 4,
  },
  reportErrorText: {
    marginTop: 10,
  },
  reportSubmit: {
    marginTop: 16,
    backgroundColor: "#dc2626",
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: "center",
    alignSelf: "stretch",
  },
  reportSubmitDisabled: {
    opacity: 0.4,
  },
  reportCancel: {
    alignItems: "center",
    paddingVertical: 14,
  },
  reportDone: {
    alignItems: "center",
    paddingTop: 32,
  },
  reportDoneTitle: {
    marginTop: 12,
  },
  reportDoneText: {
    textAlign: "center",
    marginTop: 8,
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
