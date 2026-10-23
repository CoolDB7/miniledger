import React, { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { api } from "../api";
import { useAuth } from "../auth";
import { colors } from "../theme";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const sendOtp = () => run(async () => {
    await api.requestOtp(phone.trim());
    setInfo("OTP sent! (Mock: check the server console for the code)");
    setStep("otp");
  });

  const verify = () => run(async () => {
    const { token } = await api.verifyOtp(phone.trim(), otp.trim());
    await signIn(token); // navigation switches automatically once token is set
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={styles.title}>MiniLedger</Text>
      <Text style={styles.subtitle}>Track money you've lent to friends</Text>

      {step === "phone" ? (
        <>
          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input} value={phone} onChangeText={setPhone}
            placeholder="+919876543210" keyboardType="phone-pad" autoFocus
          />
        </>
      ) : (
        <>
          <Text style={styles.info}>{info}</Text>
          <Text style={styles.label}>Enter 6-digit OTP for {phone}</Text>
          <TextInput
            style={styles.input} value={otp} onChangeText={setOtp}
            placeholder="123456" keyboardType="number-pad" maxLength={6} autoFocus
          />
        </>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, busy && { opacity: 0.6 }]} disabled={busy}
        onPress={step === "phone" ? sendOtp : verify}
      >
        {busy ? <ActivityIndicator color="#fff" /> : (
          <Text style={styles.buttonText}>{step === "phone" ? "Send OTP" : "Verify & Login"}</Text>
        )}
      </Pressable>

      {step === "otp" && (
        <Pressable onPress={() => { setStep("phone"); setOtp(""); setError(""); }}>
          <Text style={styles.link}>Change number</Text>
        </Pressable>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.bg },
  title: { fontSize: 34, fontWeight: "800", color: colors.primary },
  subtitle: { color: colors.muted, marginBottom: 32, marginTop: 4 },
  label: { fontWeight: "600", color: colors.text, marginBottom: 6 },
  info: { color: colors.success, marginBottom: 12 },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 14, fontSize: 18, marginBottom: 12,
  },
  error: { color: colors.danger, marginBottom: 12 },
  button: { backgroundColor: colors.primary, padding: 16, borderRadius: 10, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  link: { color: colors.primary, textAlign: "center", marginTop: 16, fontWeight: "600" },
});
