import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import MessagePopup, {
  MessageButton,
  MessageType,
} from "@/components/shared/MessagePopup";
import TopToast from "@/components/shared/TopToast";
import {
  clearAlertBridge,
  registerAlertBridge,
} from "@/utils/alertBridge";

export interface ShowMessageOptions {
  title: string;
  message?: string;
  type?: MessageType;
  buttons?: MessageButton[];
  dismissOnBackdrop?: boolean;
}

interface MessageState extends ShowMessageOptions {
  visible: boolean;
}

interface ToastState {
  visible: boolean;
  title: string;
  message?: string;
  type: Extract<MessageType, "success" | "info" | "warning" | "error">;
}

interface MessageContextValue {
  showMessage: (options: ShowMessageOptions) => void;
  showToast: (options: Omit<ShowMessageOptions, "buttons" | "dismissOnBackdrop">) => void;
  hideMessage: () => void;
}

const defaultState: MessageState = {
  visible: false,
  title: "",
  message: undefined,
  type: "confirm",
  buttons: undefined,
  dismissOnBackdrop: true,
};

const MessageContext = createContext<MessageContextValue | null>(null);

export const MessageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<MessageState>(defaultState);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    title: "",
    message: undefined,
    type: "info",
  });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideMessage = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const showToast = useCallback(
    (options: Omit<ShowMessageOptions, "buttons" | "dismissOnBackdrop">) => {
      const toastType =
        options.type === "success" ||
        options.type === "error" ||
        options.type === "warning"
          ? options.type
          : "info";
      setToast({
        visible: true,
        title: options.title,
        message: options.message,
        type: toastType,
      });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 2200);
    },
    []
  );

  const showMessage = useCallback((options: ShowMessageOptions) => {
    const hasButtons = !!options.buttons?.length;
    if (!hasButtons && (options.type === "success" || options.type === "info")) {
      showToast(options);
      return;
    }
    const { buttons } = options;
    const wrappedButtons: MessageButton[] | undefined = buttons?.map((btn) => ({
      ...btn,
      onPress: () => {
        hideMessage();
        btn.onPress?.();
      },
    }));
    setState({
      visible: true,
      ...options,
      buttons: wrappedButtons ?? undefined,
    });
  }, [hideMessage, showToast]);

  const handleBackdrop = useCallback(() => {
    hideMessage();
  }, [hideMessage]);

  useEffect(() => {
    registerAlertBridge(showMessage, hideMessage);
    return () => clearAlertBridge();
  }, [showMessage, hideMessage]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <MessageContext.Provider value={{ showMessage, showToast, hideMessage }}>
      {children}
      <TopToast
        visible={toast.visible}
        title={toast.title}
        message={toast.message}
        type={toast.type}
        onDismiss={hideToast}
      />
      <MessagePopup
        visible={state.visible}
        title={state.title}
        message={state.message}
        type={state.type}
        buttons={state.buttons}
        onBackdropPress={handleBackdrop}
        dismissOnBackdrop={state.dismissOnBackdrop}
      />
    </MessageContext.Provider>
  );
};

export function useMessage(): MessageContextValue {
  const ctx = useContext(MessageContext);
  if (!ctx) {
    throw new Error("useMessage must be used within a MessageProvider");
  }
  return ctx;
}
