import React, { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import CustomText from "@/components/shared/CustomText";
import { Colors } from "@/utils/Constants";
import { DS } from "@/theme/designSystem";

/** Anything with measureInWindow: a View ref, Pressable ref, etc. */
export type Measurable = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void };

export type TourStep = {
  key: string;
  target: React.RefObject<Measurable | null>;
  title: string;
  body: string;
};

type Rect = { x: number; y: number; width: number; height: number };

const PAD = 6;
const CARD_GAP = 12;
const CARD_MAX_WIDTH = 360;
const DIM = "rgba(15, 23, 42, 0.72)";
const MIN_VISIBLE = 160;
/** Room the tip card needs (its usual height plus a margin). */
const CARD_ROOM = 230;

function measure(ref: TourStep["target"]): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node) return resolve(null);
    node.measureInWindow((x, y, width, height) => {
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}

/**
 * Dims the screen except one real control at a time and explains it.
 * Steps whose target isn't on screen are skipped, so a missing service never blocks the tour.
 * onDone(shown) says whether anything was shown, so a tip whose control was off screen
 * can be offered again next time.
 */
export default function SpotlightTour({
  visible,
  steps,
  onDone,
}: {
  visible: boolean;
  steps: TourStep[];
  onDone: (shown: boolean) => void;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const show = useCallback(
    async (from: number) => {
      for (let i = from; i < steps.length; i++) {
        const r = await measure(steps[i].target);
        // Tall controls (like a list) may run off the bottom; their top just needs to be visible.
        if (r && r.y >= 0 && r.y < screenH - MIN_VISIBLE) {
          setIndex(i);
          setRect(r);
          return;
        }
      }
      setRect(null);
      onDone(from > 0);
    },
    [steps, screenH, onDone]
  );

  useEffect(() => {
    if (!visible) return;
    setRect(null);
    // Let entering animations settle so positions are final.
    const t = setTimeout(() => void show(0), 450);
    return () => clearTimeout(t);
  }, [visible, show]);

  if (!visible || !rect) return null;
  const step = steps[index];
  const isLast = !steps.slice(index + 1).length;

  const hole = {
    x: Math.max(rect.x - PAD, 0),
    y: Math.max(rect.y - PAD, 0),
    w: Math.min(rect.width + PAD * 2, screenW),
    h: Math.min(rect.height + PAD * 2, screenH - Math.max(rect.y - PAD, 0) - 24),
  };
  const radius = Math.min(18, hole.h / 2, hole.w / 2);
  const edge = Math.max(screenW, screenH);
  const cardW = Math.min(screenW - 32, CARD_MAX_WIDTH);
  const cardLeft = Math.min(Math.max(hole.x + hole.w / 2 - cardW / 2, 16), screenW - cardW - 16);
  const below = hole.y + hole.h + CARD_GAP;
  // Below the control if it fits, else above it; for a control that fills the screen,
  // over its lower part.
  const cardPos =
    below + CARD_ROOM < screenH
      ? { top: below }
      : hole.y - CARD_GAP > CARD_ROOM + 40
        ? { bottom: screenH - hole.y + CARD_GAP }
        : { bottom: 48 };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onDone(true)} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* One view with a huge dim border leaves a rounded hole over the control. */}
        <View
          style={[
            styles.dim,
            {
              left: hole.x - edge,
              top: hole.y - edge,
              width: hole.w + edge * 2,
              height: hole.h + edge * 2,
              borderWidth: edge,
              borderRadius: radius + edge,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.ring,
            { left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: radius },
          ]}
        />

        <View style={[styles.card, { width: cardW, left: cardLeft }, cardPos]}>
          {steps.length > 1 ? (
            <CustomText fontSize={11} fontFamily="SemiBold" style={styles.counter}>
              {index + 1} of {steps.length}
            </CustomText>
          ) : null}
          <CustomText fontFamily="Bold" fontSize={17} style={styles.title}>
            {step.title}
          </CustomText>
          <CustomText fontSize={14} style={styles.body}>
            {step.body}
          </CustomText>
          <View style={styles.actions}>
            {isLast ? (
              <View />
            ) : (
              <Pressable onPress={() => onDone(true)} hitSlop={10} accessibilityRole="button">
                <CustomText fontFamily="SemiBold" fontSize={14} style={styles.skip}>
                  Skip tour
                </CustomText>
              </Pressable>
            )}
            <Pressable
              onPress={() => (isLast ? onDone(true) : void show(index + 1))}
              style={({ pressed }) => [styles.next, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
            >
              <CustomText fontFamily="SemiBold" fontSize={14} style={styles.nextText}>
                {isLast ? "Got it" : "Next"}
              </CustomText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: "absolute", borderColor: DIM },
  ring: {
    position: "absolute",
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  card: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    ...DS.shadow.card,
  },
  counter: { color: Colors.theme, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  title: { color: Colors.text, marginBottom: 6 },
  body: { color: DS.color.textMuted, lineHeight: 21 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  skip: { color: DS.color.textMuted },
  next: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  nextText: { color: Colors.text },
});
